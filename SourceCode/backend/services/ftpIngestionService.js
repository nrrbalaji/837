import Client from "ssh2-sftp-client";
import pool from "../config/database.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { parse837File } from "./parsing837.js";
import { autoCorrectClaim } from "./autoCorrection.js";
import { generate837File } from "./generate837.js";
import { decryptPassword } from "../utils/encryption.js";
import dotenv from "dotenv";
dotenv.config();

/**
 * SFTP Ingestion Service
 * Handles SFTP polling, download, processing, and upload
 * Supports password and SSH key authentication
 */

class FTPIngestionService {
  constructor() {
    this.connections = new Map(); // Facility ID → SFTP Client
    this.pollIntervals = new Map(); // Facility ID → Interval
    this.isShuttingDown = false;
    this.processingFiles = new Set(); // Track files currently being processed
    this.maxRetries = parseInt(process.env.SFTP_MAX_RETRIES || "3");
    this.baseRetryDelay = parseInt(
      process.env.SFTP_BASE_RETRY_DELAY_MS || "5000"
    );
  }

  /**
   * Initialize SFTP polling for all enabled facilities
   */
  async init() {
    console.log("=== Initializing SFTP Ingestion Service ===");

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT facility_id, facility_code, facility_name, ingestion_config
        FROM Facilities
        WHERE ingestion_mode = 'SFTP'
          AND is_active = TRUE
          AND ingestion_config IS NOT NULL
          AND ingestion_config->>'mode' = 'SFTP'
          AND (ingestion_config->'sftp'->>'enabled')::boolean = TRUE
      `);

      if (result.rows.length === 0) {
        console.log(
          "No facilities configured for SFTP ingestion. Service idle."
        );
        return;
      }

      for (const facility of result.rows) {
        try {
          await this.startPolling(facility);
        } catch (error) {
          console.error(
            `Failed to start polling for facility ${facility.facility_code}:`,
            error.message
          );
        }
      }

      console.log(
        `✓ SFTP polling started for ${result.rows.length} facilities`
      );
    } catch (error) {
      console.error("Failed to initialize SFTP service:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start polling for a specific facility
   * @param {Object} facility - Facility record with config
   */
  async startPolling(facility) {
    const { facility_id, facility_code, ingestion_config } = facility;
    const sftpConfig = ingestion_config.sftp;

    // Validate configuration
    if (
      !sftpConfig.host ||
      !sftpConfig.input_folder ||
      !sftpConfig.output_folder
    ) {
      console.error(
        `Invalid SFTP config for facility ${facility_code}: Missing required fields (host, input_folder, output_folder)`
      );
      return;
    }

    // Validate authentication
    if (!sftpConfig.password_encrypted && !sftpConfig.private_key_path) {
      console.error(
        `Invalid SFTP config for facility ${facility_code}: No authentication method configured`
      );
      return;
    }

    // Test connection before starting polling
    try {
      console.log(`Testing SFTP connection for facility ${facility_code}...`);
      const testSftp = await this.connect(sftpConfig);
      await testSftp.end();
      console.log(`✓ Connection test successful for ${facility_code}`);
    } catch (error) {
      console.error(
        `Connection test failed for facility ${facility_code}:`,
        error.message
      );
      await this.logIngestionError(
        facility_id,
        "SFTP",
        null,
        "AUTHENTICATION_ERROR",
        `Initial connection failed: ${error.message}`
      );
      return;
    }

    // Schedule polling
    const intervalSeconds = sftpConfig.poll_interval_seconds || 300;
    const intervalMs = intervalSeconds * 1000;

    const interval = setInterval(async () => {
      if (this.isShuttingDown) return;
      await this.pollFacility(facility);
    }, intervalMs);

    this.pollIntervals.set(facility_id, interval);

    // Immediate first poll
    setTimeout(() => this.pollFacility(facility), 5000); // 5s delay to allow service startup

    console.log(
      `✓ Polling scheduled for facility ${facility_code} (interval: ${intervalSeconds}s)`
    );
  }

  /**
   * Poll SFTP server for new files
   * @param {Object} facility - Facility record
   */
  async pollFacility(facility) {
    const { facility_id, facility_code, ingestion_config } = facility;
    const sftpConfig = ingestion_config.sftp;

    let sftp = null;
    const startTime = Date.now();

    try {
      console.log(`[${facility_code}] Starting SFTP poll...`);

      // Connect to SFTP
      sftp = await this.connect(sftpConfig);

      // List files in input folder
      const files = await sftp.list(sftpConfig.input_folder);
      const validExtensions = [".837", ".edi", ".txt", ".x12", ".dat"];

      const targetFiles = files.filter(
        (file) =>
          file.type === "-" && // Regular file
          validExtensions.some((ext) =>
            file.name.toLowerCase().endsWith(ext)
          ) &&
          !file.name.startsWith(".") // Ignore hidden files
      );

      console.log(
        `[${facility_code}] Found ${targetFiles.length} file(s) in input folder`
      );

      if (targetFiles.length === 0) {
        await sftp.end();
        return;
      }

      // Sort by modification time (oldest first)
      targetFiles.sort((a, b) => a.modifyTime - b.modifyTime);

      // Process each file
      for (const file of targetFiles) {
        // Check if already processing
        const fileKey = `${facility_id}:${file.name}`;
        if (this.processingFiles.has(fileKey)) {
          console.log(
            `[${facility_code}] File ${file.name} is already being processed, skipping`
          );
          continue;
        }

        this.processingFiles.add(fileKey);

        try {
          await this.processFile(sftp, facility, file, sftpConfig);
        } catch (error) {
          console.error(
            `[${facility_code}] Error processing file ${file.name}:`,
            error.message
          );
        } finally {
          this.processingFiles.delete(fileKey);
        }
      }
    } catch (error) {
      console.error(
        `[${facility_code}] SFTP poll error:`,
        error.message
      );
      await this.logIngestionError(
        facility_id,
        "SFTP",
        null,
        "CONNECTION_ERROR",
        error.message
      );
    } finally {
      if (sftp) {
        try {
          await sftp.end();
        } catch (error) {
          console.error("Error closing SFTP connection:", error.message);
        }
      }
      const duration = Date.now() - startTime;
      console.log(`[${facility_code}] Poll completed in ${duration}ms`);
    }
  }

  /**
   * Establish SFTP connection with retry logic
   * @param {Object} config - SFTP configuration
   * @returns {Promise<Client>} Connected SFTP client
   */
  async connect(config) {
    const sftp = new Client();

    const connectionConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: (config.connection_timeout_seconds || 30) * 1000,
      retries: 0, // We handle retries manually
      retry_minTimeout: 1000,
    };

    // Authentication: password or private key
    if (config.private_key_path) {
      try {
        connectionConfig.privateKey = await fs.readFile(
          config.private_key_path,
          "utf8"
        );
      } catch (error) {
        throw new Error(
          `Failed to read private key from ${config.private_key_path}: ${error.message}`
        );
      }
    } else if (config.password_encrypted) {
      connectionConfig.password = decryptPassword(config.password_encrypted);
    } else {
      throw new Error("No authentication method configured");
    }

    // Retry logic
    let lastError = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await sftp.connect(connectionConfig);
        return sftp;
      } catch (error) {
        lastError = error;
        console.warn(
          `SFTP connection attempt ${attempt}/${this.maxRetries} failed: ${error.message}`
        );

        if (attempt < this.maxRetries) {
          const delay = this.baseRetryDelay * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to connect after ${this.maxRetries} attempts: ${lastError.message}`
    );
  }

  /**
   * Process a single file from SFTP
   * @param {Client} sftp - Connected SFTP client
   * @param {Object} facility - Facility record
   * @param {Object} file - File metadata from SFTP
   * @param {Object} config - SFTP configuration
   */
  async processFile(sftp, facility, file, config) {
    const { facility_id, facility_code } = facility;
    const remotePath = `${config.input_folder}/${file.name}`;
    const stagingDir = path.join(
      process.cwd(),
      "temp",
      "sftp",
      facility_id
    );
    const localPath = path.join(stagingDir, file.name);

    let fileId = null;
    const processingStartTime = Date.now();

    try {
      console.log(`[${facility_code}] Processing file: ${file.name}`);

      // Ensure staging directory exists
      await fs.mkdir(stagingDir, { recursive: true });

      // Check file stability (avoid downloading incomplete files)
      await this.waitForFileStability(sftp, remotePath, 10000); // 10s timeout

      // Download file
      console.log(`[${facility_code}] Downloading ${file.name}...`);
      await sftp.get(remotePath, localPath);

      // Calculate checksum
      const fileBuffer = await fs.readFile(localPath);
      const checksum = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");
      const fileSize = fileBuffer.length;

      console.log(
        `[${facility_code}] Downloaded ${file.name} (${fileSize} bytes, checksum: ${checksum.substring(0, 16)}...)`
      );

      // Check for duplicate
      const isDuplicate = await this.checkDuplicate(checksum);
      if (isDuplicate) {
        console.log(
          `[${facility_code}] Duplicate file detected: ${file.name} (skipping)`
        );
        await this.logIngestionError(
          facility_id,
          "SFTP",
          file.name,
          "DUPLICATE",
          "File already processed (checksum match)",
          null,
          Date.now() - processingStartTime
        );

        // Move to archive if configured
        if (config.archive_folder) {
          const archivePath = `${config.archive_folder}/${file.name}`;
          await sftp.rename(remotePath, archivePath);
          console.log(
            `[${facility_code}] Moved duplicate to archive: ${file.name}`
          );
        } else {
          await sftp.delete(remotePath);
        }

        await fs.unlink(localPath); // Cleanup local file
        return;
      }

      // Insert file record
      fileId = await this.createFileRecord(
        facility_id,
        file.name,
        remotePath,
        fileSize,
        checksum,
        config.host
      );

      console.log(
        `[${facility_code}] Created file record: ${fileId}`
      );

      // Trigger processing pipeline
      console.log(`[${facility_code}] Parsing 837 file...`);
      await parse837File(fileId, localPath);

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
          "SFTP",
          file.name,
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
      const outputFileName = `${path.parse(file.name).name}_CORRECTED_${Date.now()}.837`;
      const outputPath = path.join(stagingDir, outputFileName);

      console.log(
        `[${facility_code}] Generating corrected 837 file...`
      );
      await generate837File(parsedJson, outputPath);

      // Upload corrected file to output folder
      const remoteOutputPath = `${config.output_folder}/${outputFileName}`;
      console.log(
        `[${facility_code}] Uploading corrected file to ${remoteOutputPath}...`
      );

      let uploadSuccess = false;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          await sftp.put(outputPath, remoteOutputPath);
          uploadSuccess = true;
          console.log(
            `[${facility_code}] ✓ Uploaded corrected file: ${outputFileName}`
          );
          break;
        } catch (error) {
          console.error(
            `Upload attempt ${attempt}/${this.maxRetries} failed:`,
            error.message
          );
          if (attempt < this.maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.baseRetryDelay)
            );
          }
        }
      }

      if (!uploadSuccess) {
        throw new Error(
          `Failed to upload corrected file after ${this.maxRetries} attempts`
        );
      }

      // Archive original file (if configured)
      if (config.archive_folder) {
        const archivePath = `${config.archive_folder}/${file.name}`;
        await sftp.rename(remotePath, archivePath);
        console.log(
          `[${facility_code}] ✓ Archived original file: ${file.name}`
        );
      } else {
        await sftp.delete(remotePath);
        console.log(
          `[${facility_code}] ✓ Deleted original file from input folder`
        );
      }

      // Cleanup local files
      await fs.unlink(localPath);
      await fs.unlink(outputPath);

      // Log success
      const processingDuration = Date.now() - processingStartTime;
      await this.logIngestionSuccess(
        facility_id,
        "SFTP",
        file.name,
        remotePath,
        fileSize,
        checksum,
        fileId,
        processingDuration
      );

      console.log(
        `[${facility_code}] ✓ Successfully processed ${file.name} in ${processingDuration}ms`
      );
    } catch (error) {
      console.error(
        `[${facility_code}] ✗ Error processing file ${file.name}:`,
        error.message
      );

      await this.quarantineFile(
        sftp,
        remotePath,
        facility_id,
        file.name,
        error.message,
        config
      );

      const errorType = this.classifyError(error);
      await this.logIngestionError(
        facility_id,
        "SFTP",
        file.name,
        errorType,
        error.message,
        fileId,
        Date.now() - processingStartTime
      );

      // Cleanup local file if it exists
      try {
        await fs.unlink(localPath);
      } catch {}
    }
  }

  /**
   * Wait for file to stabilize (no size change)
   * @param {Client} sftp - SFTP client
   * @param {string} remotePath - Remote file path
   * @param {number} timeout - Max wait time in ms
   */
  async waitForFileStability(sftp, remotePath, timeout = 10000) {
    const startTime = Date.now();
    let previousSize = -1;

    while (Date.now() - startTime < timeout) {
      const stat = await sftp.stat(remotePath);
      const currentSize = stat.size;

      if (currentSize === previousSize && currentSize > 0) {
        return true; // Stable
      }

      previousSize = currentSize;
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s
    }

    throw new Error(
      `File ${remotePath} did not stabilize within ${timeout}ms`
    );
  }

  /**
   * Check if file checksum exists in database
   * @param {string} checksum - SHA-256 checksum
   * @returns {Promise<boolean>} True if duplicate
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
    checksum,
    sourceHost
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
          sourcePath, // Remote path as file_path
          fileSize,
          "X12_837",
          "SFTP",
          "PARSING",
          "SFTP",
          sourceHost,
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
    sftp,
    remotePath,
    facilityId,
    fileName,
    errorMessage,
    config
  ) {
    try {
      const quarantineFolder = `${config.input_folder}/quarantine`;

      // Create quarantine folder if it doesn't exist
      try {
        await sftp.mkdir(quarantineFolder, true);
      } catch (error) {
        // Folder may already exist, ignore error
      }

      const timestamp = Date.now();
      const quarantinePath = `${quarantineFolder}/${fileName}_${timestamp}.quarantine`;

      try {
        await sftp.rename(remotePath, quarantinePath);
      } catch (error) {
        console.error("Failed to move file to quarantine:", error.message);
        // If rename fails, try to delete the original
        try {
          await sftp.delete(remotePath);
        } catch {}
      }

      // Create error file
      const errorData = JSON.stringify(
        {
          original_file: fileName,
          failed_at: new Date().toISOString(),
          facility_id: facilityId,
          ingestion_mode: "SFTP",
          error_message: errorMessage,
        },
        null,
        2
      );

      const errorFilePath = `${quarantinePath}.error`;
      await sftp.put(Buffer.from(errorData), errorFilePath);

      console.log(`✓ Quarantined file: ${fileName}`);
    } catch (qError) {
      console.error(`Failed to quarantine file ${fileName}:`, qError.message);
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
      message.includes("authentication") ||
      message.includes("permission") ||
      message.includes("denied")
    ) {
      return "AUTHENTICATION_ERROR";
    }

    if (
      message.includes("connection") ||
      message.includes("timeout") ||
      message.includes("econnrefused")
    ) {
      return "CONNECTION_ERROR";
    }

    if (message.includes("validation") || message.includes("invalid")) {
      return "VALIDATION_ERROR";
    }

    return "PROCESSING_ERROR";
  }

  /**
   * Stop polling for a specific facility
   */
  async stopPolling(facilityId) {
    const interval = this.pollIntervals.get(facilityId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(facilityId);
      console.log(`Stopped polling for facility ${facilityId}`);
    }
  }

  /**
   * Restart polling for a facility (useful when configuration changes)
   */
  async restartPolling(facilityId) {
    await this.stopPolling(facilityId);

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT facility_id, facility_code, facility_name, ingestion_config
        FROM Facilities
        WHERE facility_id = $1
          AND ingestion_mode = 'SFTP'
          AND is_active = TRUE
      `,
        [facilityId]
      );

      if (result.rows.length > 0) {
        await this.startPolling(result.rows[0]);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log("Shutting down SFTP Ingestion Service...");
    this.isShuttingDown = true;

    // Clear all polling intervals
    for (const [facilityId, interval] of this.pollIntervals) {
      clearInterval(interval);
      console.log(`Stopped polling for facility ${facilityId}`);
    }

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

    // Close all SFTP connections
    for (const [facilityId, connection] of this.connections) {
      try {
        await connection.end();
        console.log(`Closed SFTP connection for facility ${facilityId}`);
      } catch (error) {
        console.error(
          `Error closing connection for facility ${facilityId}:`,
          error.message
        );
      }
    }

    console.log("SFTP Ingestion Service shut down");
  }
}

export default new FTPIngestionService();
