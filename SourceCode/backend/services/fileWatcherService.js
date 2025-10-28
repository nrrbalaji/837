import chokidar from "chokidar";
import pool from "../config/database.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { parse837File } from "./parsing837.js";
import { autoCorrectClaim } from "./autoCorrection.js";
import { generate837File } from "./generate837.js";
import dotenv from "dotenv";
dotenv.config();

/**
 * Local File System Watcher Service
 * Monitors local folders for new 837 files
 * Uses chokidar for efficient file system watching
 */

class FileWatcherService {
  constructor() {
    this.watchers = new Map(); // Facility ID → Chokidar watcher
    this.processingFiles = new Set(); // Track files being processed
    this.isShuttingDown = false;
    this.maxRetries = parseInt(process.env.LOCAL_MAX_RETRIES || "3");
    this.baseRetryDelay = parseInt(
      process.env.LOCAL_BASE_RETRY_DELAY_MS || "5000"
    );
  }

  /**
   * Initialize file watchers for all enabled facilities
   */
  async init() {
    console.log("=== Initializing File Watcher Service ===");

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT facility_id, facility_code, facility_name, ingestion_config
        FROM Facilities
        WHERE ingestion_mode = 'LOCAL_FOLDER'
          AND is_active = TRUE
          AND ingestion_config IS NOT NULL
          AND ingestion_config->>'mode' = 'LOCAL_FOLDER'
          AND (ingestion_config->'local'->>'enabled')::boolean = TRUE
      `);

      if (result.rows.length === 0) {
        console.log(
          "No facilities configured for local folder ingestion. Service idle."
        );
        return;
      }

      for (const facility of result.rows) {
        try {
          await this.startWatching(facility);
        } catch (error) {
          console.error(
            `Failed to start watching for facility ${facility.facility_code}:`,
            error.message
          );
        }
      }

      console.log(
        `✓ File watching started for ${result.rows.length} facilities`
      );
    } catch (error) {
      console.error("Failed to initialize File Watcher service:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start watching a folder for a specific facility
   * @param {Object} facility - Facility record with config
   */
  async startWatching(facility) {
    const { facility_id, facility_code, ingestion_config } = facility;
    const localConfig = ingestion_config.local;

    // Validate configuration
    if (!localConfig.input_folder || !localConfig.output_folder) {
      console.error(
        `Invalid local folder config for facility ${facility_code}: Missing required fields (input_folder, output_folder)`
      );
      return;
    }

    // Validate paths are absolute
    if (
      !path.isAbsolute(localConfig.input_folder) ||
      !path.isAbsolute(localConfig.output_folder)
    ) {
      console.error(
        `Invalid local folder config for facility ${facility_code}: Paths must be absolute`
      );
      return;
    }

    try {
      // Ensure folders exist and are accessible
      await fs.mkdir(localConfig.input_folder, { recursive: true });
      await fs.mkdir(localConfig.output_folder, { recursive: true });

      // Create .processing subfolder
      await fs.mkdir(
        path.join(localConfig.input_folder, ".processing"),
        { recursive: true }
      );

      if (localConfig.archive_folder) {
        await fs.mkdir(localConfig.archive_folder, { recursive: true });
      }

      // Test write permissions
      const testFile = path.join(localConfig.output_folder, ".write_test");
      await fs.writeFile(testFile, "test");
      await fs.unlink(testFile);

      console.log(`✓ Folder validation successful for ${facility_code}`);
    } catch (error) {
      console.error(
        `Folder validation failed for facility ${facility_code}:`,
        error.message
      );
      await this.logIngestionError(
        facility_id,
        "LOCAL_FOLDER",
        null,
        "PERMISSION_ERROR",
        `Folder access failed: ${error.message}`
      );
      return;
    }

    // Create watcher
    const watchDepth = localConfig.watch_recursive ? undefined : 0;
    const debounceMs = localConfig.debounce_milliseconds || 2000;

    const watcher = chokidar.watch(localConfig.input_folder, {
      ignored: [
        /(^|[\/\\])\../, // Ignore hidden files and .processing folder
        /.*\.processing$/, // Ignore .processing files
        /.*\.error$/, // Ignore .error files
        /.*\.quarantine$/, // Ignore quarantine files
      ],
      persistent: true,
      ignoreInitial: false, // Process existing files on startup
      awaitWriteFinish: {
        stabilityThreshold: debounceMs,
        pollInterval: 500,
      },
      depth: watchDepth,
      usePolling: false, // Use native FS events
      interval: 1000,
    });

    // Event: File added
    watcher.on("add", async (filePath) => {
      if (this.isShuttingDown) return;

      const ext = path.extname(filePath).toLowerCase();
      const validExtensions = [".837", ".edi", ".txt", ".x12", ".dat"];

      if (!validExtensions.includes(ext)) {
        return; // Skip non-EDI files
      }

      // Prevent duplicate processing
      if (this.processingFiles.has(filePath)) {
        console.log(
          `[${facility_code}] File ${path.basename(filePath)} is already being processed, skipping`
        );
        return;
      }

      this.processingFiles.add(filePath);

      try {
        await this.processFile(facility, filePath, localConfig);
      } catch (error) {
        console.error(
          `[${facility_code}] Error processing file ${path.basename(filePath)}:`,
          error.message
        );
      } finally {
        this.processingFiles.delete(filePath);
      }
    });

    // Event: Error
    watcher.on("error", (error) => {
      console.error(`Watcher error for facility ${facility_code}:`, error);
      this.logIngestionError(
        facility_id,
        "LOCAL_FOLDER",
        null,
        "WATCHER_ERROR",
        error.message
      );
    });

    // Event: Ready
    watcher.on("ready", () => {
      console.log(
        `✓ Watcher ready for facility ${facility_code}: ${localConfig.input_folder}`
      );
    });

    this.watchers.set(facility_id, watcher);
  }

  /**
   * Process a newly detected file
   * @param {Object} facility - Facility record
   * @param {string} filePath - Absolute path to file
   * @param {Object} config - Local folder configuration
   */
  async processFile(facility, filePath, config) {
    const { facility_id, facility_code } = facility;
    const fileName = path.basename(filePath);
    const stagingPath = path.join(
      config.input_folder,
      ".processing",
      fileName
    );

    let fileId = null;
    const processingStartTime = Date.now();

    try {
      console.log(`[${facility_code}] Processing file: ${fileName}`);

      // Check if file still exists (may have been moved/deleted)
      try {
        await fs.access(filePath);
      } catch (error) {
        console.log(
          `[${facility_code}] File ${fileName} no longer exists, skipping`
        );
        return;
      }

      // Move to staging area (prevents re-triggering watcher)
      console.log(`[${facility_code}] Moving to staging area...`);
      await fs.rename(filePath, stagingPath);

      // Calculate checksum
      const fileBuffer = await fs.readFile(stagingPath);
      const checksum = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");
      const fileSize = fileBuffer.length;

      console.log(
        `[${facility_code}] File info: ${fileSize} bytes, checksum: ${checksum.substring(0, 16)}...`
      );

      // Check for duplicate
      const isDuplicate = await this.checkDuplicate(checksum);
      if (isDuplicate) {
        console.log(
          `[${facility_code}] Duplicate file detected: ${fileName} (skipping)`
        );
        await this.logIngestionError(
          facility_id,
          "LOCAL_FOLDER",
          fileName,
          "DUPLICATE",
          "File already processed (checksum match)",
          null,
          Date.now() - processingStartTime
        );

        // Move to archive if configured
        if (config.archive_folder) {
          const archivePath = path.join(config.archive_folder, fileName);
          await fs.rename(stagingPath, archivePath);
          console.log(
            `[${facility_code}] Moved duplicate to archive: ${fileName}`
          );
        } else {
          await fs.unlink(stagingPath);
        }

        return;
      }

      // Create file record
      fileId = await this.createFileRecord(
        facility_id,
        fileName,
        filePath,
        fileSize,
        checksum
      );

      console.log(
        `[${facility_code}] Created file record: ${fileId}`
      );

      // Trigger processing pipeline
      console.log(`[${facility_code}] Parsing 837 file...`);
      await parse837File(fileId, stagingPath);

      // Apply auto-corrections with resilient error handling
      console.log(`[${facility_code}] Applying auto-corrections...`);
      try {
        const correctionResult = await autoCorrectClaim(fileId, {
          isTestMode: false,
          userId: null,
        });
        console.log(
          `[${facility_code}] ✓ Auto-corrections applied: ${
            correctionResult.totalCorrections || 0
          } corrections`
        );
      } catch (autoCorrectError) {
        console.error(
          `[${facility_code}] ⚠️ Auto-correction failed (continuing with processing):`,
          autoCorrectError.message
        );
        // Log the error but continue processing
        // The file will still be generated, just without corrections
        await this.logIngestionError(
          facility_id,
          "LOCAL_FOLDER",
          fileName,
          "AUTO_CORRECTION_FAILED",
          `Auto-correction failed: ${autoCorrectError.message}`,
          fileId,
          null
        );
      }

      // Fetch parsed JSON for regeneration
      const client = await pool.connect();
      let parsedJson;
      try {
        const result = await client.query(
          "SELECT parsed_json FROM UploadFileDetail WHERE file_id = $1",
          [fileId]
        );

        if (result.rows.length === 0) {
          throw new Error("File record not found after processing");
        }

        parsedJson = result.rows[0].parsed_json;

        // Update processing completed timestamp
        await client.query(
          "UPDATE UploadFileDetail SET processing_completed_at = CURRENT_TIMESTAMP, upload_status = 'COMPLETED' WHERE file_id = $1",
          [fileId]
        );
      } finally {
        client.release();
      }

      // Generate corrected 837 file
      const outputFileName = `${path.parse(fileName).name}_CORRECTED_${Date.now()}.837`;
      const outputPath = path.join(config.output_folder, outputFileName);

      console.log(
        `[${facility_code}] Generating corrected 837 file...`
      );
      await generate837File(parsedJson, outputPath);
      console.log(
        `[${facility_code}] ✓ Generated corrected file: ${outputPath}`
      );

      // Archive original (if configured)
      if (config.archive_folder) {
        const archivePath = path.join(config.archive_folder, fileName);
        await fs.rename(stagingPath, archivePath);
        console.log(
          `[${facility_code}] ✓ Archived original file: ${archivePath}`
        );
      } else {
        await fs.unlink(stagingPath);
        console.log(
          `[${facility_code}] ✓ Deleted original file from staging`
        );
      }

      // Log success
      const processingDuration = Date.now() - processingStartTime;
      await this.logIngestionSuccess(
        facility_id,
        "LOCAL_FOLDER",
        fileName,
        filePath,
        fileSize,
        checksum,
        fileId,
        processingDuration
      );

      console.log(
        `[${facility_code}] ✓ Successfully processed ${fileName} in ${processingDuration}ms`
      );
    } catch (error) {
      console.error(
        `[${facility_code}] ✗ Error processing file ${fileName}:`,
        error.message
      );

      await this.quarantineFile(
        stagingPath,
        facility_id,
        fileName,
        error.message,
        config
      );

      const errorType = this.classifyError(error);
      await this.logIngestionError(
        facility_id,
        "LOCAL_FOLDER",
        fileName,
        errorType,
        error.message,
        fileId,
        Date.now() - processingStartTime
      );
    }
  }

  /**
   * Check if file checksum exists in database
   */
  async checkDuplicate(checksum) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT 1 FROM UploadFileDetail WHERE checksum = $1 AND is_deleted = FALSE LIMIT 1",
        [checksum]
      );
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Create file record in UploadFileDetail
   */
  async createFileRecord(
    facilityId,
    fileName,
    sourcePath,
    fileSize,
    checksum
  ) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        INSERT INTO UploadFileDetail (
          file_name, file_path, file_size_bytes, file_type, upload_method,
          upload_status, ingestion_mode, source_host, source_path, checksum, processing_started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        RETURNING file_id
      `,
        [
          fileName,
          sourcePath,
          fileSize,
          "X12_837",
          "LOCAL_FOLDER",
          "PARSING",
          "LOCAL_FOLDER",
          "localhost",
          sourcePath,
          checksum,
        ]
      );
      return result.rows[0].file_id;
    } finally {
      client.release();
    }
  }

  /**
   * Quarantine failed file
   */
  async quarantineFile(
    stagingPath,
    facilityId,
    fileName,
    errorMessage,
    config
  ) {
    try {
      // Check if staging file exists
      try {
        await fs.access(stagingPath);
      } catch {
        console.log(
          `Staging file ${fileName} does not exist, cannot quarantine`
        );
        return;
      }

      const quarantineFolder = path.join(config.input_folder, "quarantine");
      await fs.mkdir(quarantineFolder, { recursive: true });

      const timestamp = Date.now();
      const quarantinePath = path.join(
        quarantineFolder,
        `${fileName}_${timestamp}.quarantine`
      );

      await fs.rename(stagingPath, quarantinePath);

      // Create error file
      const errorData = JSON.stringify(
        {
          original_file: fileName,
          failed_at: new Date().toISOString(),
          facility_id: facilityId,
          ingestion_mode: "LOCAL_FOLDER",
          error_message: errorMessage,
        },
        null,
        2
      );

      const errorFilePath = `${quarantinePath}.error`;
      await fs.writeFile(errorFilePath, errorData, "utf8");

      console.log(`✓ Quarantined file: ${fileName}`);
    } catch (qError) {
      console.error(`Failed to quarantine file ${fileName}:`, qError.message);

      // Last resort: try to delete the staging file
      try {
        await fs.unlink(stagingPath);
      } catch {}
    }
  }

  /**
   * Log ingestion success
   */
  async logIngestionSuccess(
    facilityId,
    mode,
    fileName,
    sourcePath,
    fileSize,
    checksum,
    fileId,
    processingDuration
  ) {
    const client = await pool.connect();
    try {
      await client.query(
        `
        INSERT INTO IngestionLog (
          facility_id, ingestion_mode, file_name, source_path, file_size_bytes,
          checksum, status, file_id, processing_duration_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS', $7, $8, CURRENT_TIMESTAMP)
      `,
        [
          facilityId,
          mode,
          fileName,
          sourcePath,
          fileSize,
          checksum,
          fileId,
          processingDuration,
        ]
      );
    } catch (error) {
      console.error("Failed to log ingestion success:", error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Log ingestion error
   */
  async logIngestionError(
    facilityId,
    mode,
    fileName,
    errorType,
    errorMessage,
    fileId = null,
    processingDuration = null
  ) {
    const client = await pool.connect();
    try {
      await client.query(
        `
        INSERT INTO IngestionLog (
          facility_id, ingestion_mode, file_name, status, error_type, error_message,
          file_id, processing_duration_ms, created_at
        ) VALUES ($1, $2, $3, 'FAILED', $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `,
        [
          facilityId,
          mode,
          fileName,
          errorType,
          errorMessage,
          fileId,
          processingDuration,
        ]
      );
    } catch (error) {
      console.error("Failed to log ingestion error:", error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Classify error type
   */
  classifyError(error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("permission") ||
      message.includes("access") ||
      message.includes("eacces")
    ) {
      return "PERMISSION_ERROR";
    }

    if (message.includes("validation") || message.includes("invalid")) {
      return "VALIDATION_ERROR";
    }

    if (message.includes("enoent") || message.includes("not found")) {
      return "FILE_NOT_FOUND";
    }

    return "PROCESSING_ERROR";
  }

  /**
   * Stop watching for a specific facility
   */
  async stopWatching(facilityId) {
    const watcher = this.watchers.get(facilityId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(facilityId);
      console.log(`Stopped watching for facility ${facilityId}`);
    }
  }

  /**
   * Restart watching for a facility (useful when configuration changes)
   */
  async restartWatching(facilityId) {
    await this.stopWatching(facilityId);

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT facility_id, facility_code, facility_name, ingestion_config
        FROM Facilities
        WHERE facility_id = $1
          AND ingestion_mode = 'LOCAL_FOLDER'
          AND is_active = TRUE
      `,
        [facilityId]
      );

      if (result.rows.length > 0) {
        await this.startWatching(result.rows[0]);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log("Shutting down File Watcher Service...");
    this.isShuttingDown = true;

    // Wait for in-flight processing to complete (max 30 seconds)
    const shutdownTimeout = 30000;
    const startTime = Date.now();

    while (
      this.processingFiles.size > 0 &&
      Date.now() - startTime < shutdownTimeout
    ) {
      console.log(
        `Waiting for ${this.processingFiles.size} file(s) to finish processing...`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Close all watchers
    for (const [facilityId, watcher] of this.watchers) {
      try {
        await watcher.close();
        console.log(`Stopped watching for facility ${facilityId}`);
      } catch (error) {
        console.error(
          `Error closing watcher for facility ${facilityId}:`,
          error.message
        );
      }
    }

    console.log("File Watcher Service shut down");
  }
}

export default new FileWatcherService();
