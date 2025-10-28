import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import fs from "fs/promises";
import pool from "../config/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { parse837File } from "../services/parsing837.js";
import { parseFHIRFile } from "../services/parsingFHIR.js";
import { generate837File } from "../services/generate837.js";
import { autoCorrectClaim } from "../services/autoCorrection.js";
import openai from "../config/openai.js";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// Parse file size from env (supports formats like "100MB", "50MB", etc.)
const parseFileSize = (sizeStr) => {
  if (!sizeStr) return 100 * 1024 * 1024; // Default 100MB

  const match = sizeStr.match(/^(\d+)(MB|KB|GB)?$/i);
  if (!match) return 100 * 1024 * 1024;

  const value = parseInt(match[1]);
  const unit = (match[2] || "MB").toUpperCase();

  switch (unit) {
    case "KB":
      return value * 1024;
    case "MB":
      return value * 1024 * 1024;
    case "GB":
      return value * 1024 * 1024 * 1024;
    default:
      return value * 1024 * 1024; // Default to MB
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseFileSize(process.env.MAX_FILE_SIZE), // Default 100MB
  },
  fileFilter: (req, file, cb) => {
    // Accept X12 files (commonly .txt, .x12, .edi, .837)
    const allowedExtensions = [".txt", ".x12", ".edi", ".837", ".dat"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only X12 EDI files are allowed."));
    }
  },
});

/**
 * @route   POST /api/v1/upload
 * @desc    Upload 837 claim file
 * @access  Private
 */
router.post(
  "/",
  authenticateToken,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          const maxSize = parseFileSize(process.env.MAX_FILE_SIZE);
          const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
          return res.status(400).json({
            error: `File too large. Maximum file size is ${maxSizeMB}MB`,
          });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res, next) => {
    const client = await pool.connect();

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { originalname, filename, path: filePath, size } = req.file;

      // Calculate file checksum (will be used in validation)
      const fileBuffer = await fs.readFile(filePath);
      const checksum = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

      await client.query("BEGIN");

      // Insert file record
      const fileResult = await client.query(
        `
      INSERT INTO UploadFileDetail (
        file_name, file_path, file_size_bytes, file_type,
        upload_method, upload_status, uploaded_by, checksum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING file_id, file_name, upload_status, uploaded_at
    `,
        [
          originalname,
          filePath,
          size,
          "X12_837",
          "WEB_UI",
          "PARSING",
          req.user.user_id,
          checksum,
        ]
      );

      const fileId = fileResult.rows[0].file_id;

      await client.query("COMMIT");

      // Parse file asynchronously
      setImmediate(async () => {
        try {
          await parse837File(fileId, filePath);

          // Apply auto-correction with proper error handling
          try {
            const result = await autoCorrectClaim(fileId, {
              isTestMode: false,
              userId: req.user.user_id,
            });
            console.log(
              `✅ Auto-correction completed for file ${fileId}: ${
                result.totalCorrectionsApplied || 0
              } corrections applied`
            );
          } catch (autoCorrectError) {
            console.error(
              `❌ Auto-correction failed for file ${fileId}:`,
              autoCorrectError.message
            );

            // Update file status to indicate auto-correction failure
            try {
              await pool.query(
                `UPDATE UploadFileDetail
                 SET upload_status = 'AUTO_CORRECT_FAILED',
                     parsing_errors = COALESCE(parsing_errors, '{}'::jsonb) ||
                                     jsonb_build_object('autoCorrection', jsonb_build_object(
                                       'error', $1,
                                       'timestamp', NOW()
                                     ))
                 WHERE file_id = $2`,
                [autoCorrectError.message, fileId]
              );
            } catch (updateError) {
              console.error(
                `Failed to update file status for ${fileId}:`,
                updateError.message
              );
            }
          }
        } catch (error) {
          console.error("File parsing error:", error);
        }
      });

      res.status(201).json({
        message: "File uploaded successfully",
        file: fileResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      // Clean up uploaded file on error
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }

      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * @route   POST /api/v1/upload/fhir
 * @desc    Upload FHIR claim data (JSON format)
 * @access  Private
 */
router.post("/fhir", authenticateToken, async (req, res, next) => {
  const client = await pool.connect();

  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res
        .status(400)
        .json({ error: "No FHIR data provided in request body" });
    }

    const fhirData = req.body;

    // Validate FHIR resource type
    if (!fhirData.resourceType) {
      return res.status(400).json({
        error: "Invalid FHIR data: resourceType is required",
      });
    }

    if (
      fhirData.resourceType !== "Bundle" &&
      fhirData.resourceType !== "Claim"
    ) {
      return res.status(400).json({
        error: `Unsupported FHIR resource type: ${fhirData.resourceType}. Expected Bundle or Claim.`,
      });
    }

    // Generate unique file ID and name
    const fileId = crypto.randomUUID();
    const fileName = `FHIR_${fhirData.resourceType}_${Date.now()}.json`;

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, "../../uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // Save FHIR data to file
    const filePath = path.join(uploadDir, `${fileId}.json`);
    const fileContent = JSON.stringify(fhirData, null, 2);
    await fs.writeFile(filePath, fileContent, "utf8");

    const fileSize = Buffer.byteLength(fileContent, "utf8");

    // Calculate checksum
    const checksum = crypto
      .createHash("sha256")
      .update(fileContent)
      .digest("hex");

    await client.query("BEGIN");

    // Insert file record
    const fileResult = await client.query(
      `
      INSERT INTO UploadFileDetail (
        file_id, file_name, file_path, file_size_bytes, file_type,
        upload_method, upload_status, uploaded_by, checksum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING file_id, file_name, upload_status, uploaded_at
    `,
      [
        fileId,
        fileName,
        filePath,
        fileSize,
        "FHIR_837",
        "REST_API",
        "PARSING",
        req.user.user_id,
        checksum,
      ]
    );

    await client.query("COMMIT");

    // Parse FHIR file asynchronously
    setImmediate(async () => {
      try {
        await parseFHIRFile(fileId, filePath);

        // Apply auto-correction with proper error handling
        try {
          const result = await autoCorrectClaim(fileId, {
            isTestMode: false,
            userId: req.user.user_id,
          });
          console.log(
            `✅ Auto-correction completed for FHIR file ${fileId}: ${
              result.totalCorrectionsApplied || 0
            } corrections applied`
          );
        } catch (autoCorrectError) {
          console.error(
            `❌ Auto-correction failed for FHIR file ${fileId}:`,
            autoCorrectError.message
          );

          // Update file status to indicate auto-correction failure
          try {
            await pool.query(
              `UPDATE UploadFileDetail
               SET upload_status = 'AUTO_CORRECT_FAILED',
                   parsing_errors = COALESCE(parsing_errors, '{}'::jsonb) ||
                                   jsonb_build_object('autoCorrection', jsonb_build_object(
                                     'error', $1,
                                     'timestamp', NOW()
                                   ))
               WHERE file_id = $2`,
              [autoCorrectError.message, fileId]
            );
          } catch (updateError) {
            console.error(
              `Failed to update file status for ${fileId}:`,
              updateError.message
            );
          }
        }

        console.log(`FHIR file ${fileId} processed successfully`);
      } catch (error) {
        console.error("FHIR file parsing error:", error);
      }
    });

    res.status(201).json({
      message: "FHIR data uploaded successfully",
      file: fileResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    // Clean up file on error if it was created
    if (error.filePath) {
      try {
        await fs.unlink(error.filePath);
      } catch (err) {
        console.error("Error deleting file:", err);
      }
    }

    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   GET /api/v1/upload/history
 * @desc    Get upload history
 * @access  Private
 */
router.get("/history", authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `
      SELECT
        ufd.file_id,
        ufd.file_name,
        ufd.file_size_bytes,
        ufd.upload_status,
        ufd.uploaded_at,
        ufd.parsed_at,
        ufd.parsing_summary,
        u.username as uploaded_by_username
      FROM UploadFileDetail ufd
      LEFT JOIN Users u ON ufd.uploaded_by = u.user_id
      WHERE ufd.is_deleted = false
      ORDER BY ufd.uploaded_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    const countResult = await pool.query(
      "SELECT COUNT(*) FROM UploadFileDetail WHERE is_deleted = false"
    );

    res.json({
      files: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/get837
 * @desc    Generate and return 837 EDI file from parsed data
 * @access  Private
 * @queryParam {string} fileId - File ID to generate EDI from
 */
router.get("/get837", authenticateToken, async (req, res, next) => {
  try {
    const { fileId } = req.query;

    if (!fileId) {
      return res.status(400).json({ error: "fileId parameter is required" });
    }

    // Fetch parsed_json from database
    const result = await pool.query(
      `
      SELECT parsed_json, upload_status
      FROM uploadfiledetail
      WHERE file_id = $1 AND is_deleted = false
    `,
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const { parsed_json, upload_status } = result.rows[0];

    if (upload_status !== "PARSED") {
      return res.status(400).json({
        error: "File has not been successfully parsed yet",
        status: upload_status,
      });
    }

    if (!parsed_json) {
      return res.status(400).json({ error: "No parsed data available" });
    }

    // Generate EDI content
    const outputPath = `${fileId}.txt`;
    const ediContent = await generate837File(parsed_json, outputPath);

    // Return the EDI content directly with appropriate headers
    res.set({
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="${fileId}.txt"`,
    });

    res.send(ediContent);
  } catch (error) {
    console.error("Error generating 837 EDI file:", error);
    next(error);
  }
});

/**
 * @route   GET /api/v1/upload/getLogs
 * @desc    Get validation logs from FileValidationLog, EDIValidationLog, and BusinessValidationLog
 * @access  Private
 * @queryParam {string} fileId - File ID to get logs for
 * @queryParam {string} format - Response format: 'json' or 'html' (default: json)
 */
router.get("/getLogs", authenticateToken, async (req, res, next) => {
  try {
    const { fileId, format = "json" } = req.query;

    if (!fileId) {
      if (format === "html") {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Error</title></head>
          <body><h1>Error</h1><p>fileId parameter is required</p></body>
          </html>
        `);
      }
      return res.status(400).json({ error: "fileId parameter is required" });
    }

    // File validation logs
    const fileLogs = await pool.query(
      `
      SELECT
        fvl.validation_type,
        fvl.validation_rule,
        fvl.severity,
        fvl.error_code,
        fvl.error_message,
        'FILE_VALIDATION' as log_type
      FROM FileValidationLog fvl
      WHERE fvl.file_id = $1
      ORDER BY fvl.validated_at DESC
    `,
      [fileId]
    );

    // EDI validation logs
    const ediLogs = await pool.query(
      `
      SELECT
        ch.claim_number,
        evl.validation_type,
        evl.segment_id,
        evl.element_id,
        evl.validation_rule,
        evl.severity,
        evl.error_code,
        evl.error_message,
        'EDI_VALIDATION' as log_type
      FROM EDIValidationLog evl
      LEFT JOIN ClaimHeader ch ON evl.claim_id = ch.claim_id
      WHERE evl.file_id = $1
      ORDER BY evl.validated_at DESC, evl.claim_id, evl.segment_id
    `,
      [fileId]
    );

    // Business validation logs
    const businessLogs = await pool.query(
      `
      SELECT
        ch.claim_number,
        vr.rule_name,
        vr.rule_code,
        vr.rule_type,
        bvl.field_name,
        bvl.current_value,
        bvl.severity,
        bvl.error_code,
        bvl.error_message,
        bvl.suggestion,
        'BUSINESS_VALIDATION' as log_type
      FROM BusinessValidationLog bvl
      JOIN ClaimHeader ch ON bvl.claim_id = ch.claim_id
      LEFT JOIN ValidationRules vr ON bvl.rule_id = vr.rule_id
      WHERE ch.file_id = $1
      ORDER BY bvl.severity DESC, bvl.validated_at DESC
    `,
      [fileId]
    );

    // Return HTML format if requested
    if (format === "html") {
      const htmlContent = generateValidationLogsHTML(
        fileId,
        fileLogs.rows,
        ediLogs.rows,
        businessLogs.rows
      );
      res.set("Content-Type", "text/html");
      return res.send(htmlContent);
    }

    // Default JSON response
    res.json({
      fileValidationLogs: fileLogs.rows,
      ediValidationLogs: ediLogs.rows,
      businessValidationLogs: businessLogs.rows,
    });
  } catch (error) {
    console.error("Error fetching validation logs:", error);

    if (format === "html") {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body><h1>Error</h1><p>Error fetching validation logs: ${error.message}</p></body>
        </html>
      `);
    }

    next(error);
  }
});

/**
 * Generate HTML content for validation logs display
 */
function generateValidationLogsHTML(fileId, fileLogs, ediLogs, businessLogs) {
  // Calculate summary statistics
  const fileStats = {
    total: fileLogs.length,
    errors: fileLogs.filter((l) => l.severity === "ERROR").length,
    warnings: fileLogs.filter((l) => l.severity === "WARNING").length,
    info: fileLogs.filter((l) => l.severity === "INFO").length,
  };

  const ediStats = {
    total: ediLogs.length,
    errors: ediLogs.filter((l) => l.severity === "ERROR").length,
    warnings: ediLogs.filter((l) => l.severity === "WARNING").length,
    info: ediLogs.filter((l) => l.severity === "INFO").length,
  };

  const businessStats = {
    total: businessLogs.length,
    errors: businessLogs.filter((l) => l.severity === "ERROR").length,
    warnings: businessLogs.filter((l) => l.severity === "WARNING").length,
    info: businessLogs.filter((l) => l.severity === "INFO").length,
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case "ERROR":
        return "table-danger";
      case "WARNING":
        return "table-warning";
      case "INFO":
        return "table-info";
      default:
        return "";
    }
  };

  const formatTimestamp = (timestamp) => {
    // Assuming timestamps are already formatted properly in the query results
    return timestamp || "N/A";
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Validation Logs - File ${fileId}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .severity-error { background-color: #f8d7da; }
        .severity-warning { background-color: #fff3cd; }
        .severity-info { background-color: #d1ecf1; }
        .summary-card { border-left: 4px solid; }
        .summary-card.error { border-color: #dc3545; }
        .summary-card.warning { border-color: #ffc107; }
        .summary-card.info { border-color: #0dcaf0; }
    </style>
</head>
<body class="bg-light">
    <div class="container-fluid py-4">
        <div class="row mb-4">
            <div class="col-12">
                <h1 class="mb-3">Validation Logs</h1>
                <h5 class="text-muted">File ID: <code>${fileId}</code></h5>
                <button onclick="window.close()" class="btn btn-secondary">Close Window</button>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="row mb-4">
            <div class="col-md-4">
                <div class="card summary-card error h-100">
                    <div class="card-body">
                        <h5 class="card-title">File Validation</h5>
                        <p class="card-text">
                            Total: <strong>${fileStats.total}</strong><br>
                            Errors: <strong class="text-danger">${
                              fileStats.errors
                            }</strong><br>
                            Warnings: <strong class="text-warning">${
                              fileStats.warnings
                            }</strong><br>
                            Info: <strong class="text-info">${
                              fileStats.info
                            }</strong>
                        </p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card summary-card warning h-100">
                    <div class="card-body">
                        <h5 class="card-title">EDI Validation</h5>
                        <p class="card-text">
                            Total: <strong>${ediStats.total}</strong><br>
                            Errors: <strong class="text-danger">${
                              ediStats.errors
                            }</strong><br>
                            Warnings: <strong class="text-warning">${
                              ediStats.warnings
                            }</strong><br>
                            Info: <strong class="text-info">${
                              ediStats.info
                            }</strong>
                        </p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card summary-card info h-100">
                    <div class="card-body">
                        <h5 class="card-title">Business Validation</h5>
                        <p class="card-text">
                            Total: <strong>${businessStats.total}</strong><br>
                            Errors: <strong class="text-danger">${
                              businessStats.errors
                            }</strong><br>
                            Warnings: <strong class="text-warning">${
                              businessStats.warnings
                            }</strong><br>
                            Info: <strong class="text-info">${
                              businessStats.info
                            }</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- File Validation Logs -->
        ${
          fileLogs.length > 0
            ? `
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">File Validation Logs</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead class="table-dark">
                                    <tr>
                                        <th>Type</th>
                                        <th>Rule</th>
                                        <th>Severity</th>
                                        <th>Error Code</th>
                                        <th>Message</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${fileLogs
                                      .map(
                                        (log) => `
                                        <tr class="${getSeverityClass(
                                          log.severity
                                        )}">
                                            <td><code>${
                                              log.validation_type
                                            }</code></td>
                                            <td><code>${
                                              log.validation_rule
                                            }</code></td>
                                            <td>
                                                <span class="badge bg-${
                                                  log.severity === "ERROR"
                                                    ? "danger"
                                                    : log.severity === "WARNING"
                                                    ? "warning"
                                                    : "info"
                                                }">
                                                    ${log.severity}
                                                </span>
                                            </td>
                                            <td>${log.error_code}</td>
                                            <td>${log.error_message}</td>
                                        </tr>
                                    `
                                      )
                                      .join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `
            : ""
        }

        <!-- EDI Validation Logs -->
        ${
          ediLogs.length > 0
            ? `
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header bg-warning">
                        <h5 class="mb-0 text-white">EDI Validation Logs</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead class="table-dark">
                                    <tr>
                                        <th>Claim #</th>
                                        <th>Type</th>
                                        <th>Segment</th>
                                        <th>Element</th>
                                        <th>Severity</th>
                                        <th>Error Code</th>
                                        <th>Message</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ediLogs
                                      .map(
                                        (log) => `
                                        <tr class="${getSeverityClass(
                                          log.severity
                                        )}">
                                            <td><code>${
                                              log.claim_number || "N/A"
                                            }</code></td>
                                            <td><code>${
                                              log.validation_type
                                            }</code></td>
                                            <td><code>${
                                              log.segment_id
                                            }</code></td>
                                            <td><code>${
                                              log.element_id
                                            }</code></td>
                                            <td>
                                                <span class="badge bg-${
                                                  log.severity === "ERROR"
                                                    ? "danger"
                                                    : log.severity === "WARNING"
                                                    ? "warning"
                                                    : "info"
                                                }">
                                                    ${log.severity}
                                                </span>
                                            </td>
                                            <td>${log.error_code}</td>
                                            <td>${log.error_message}</td>
                                        </tr>
                                    `
                                      )
                                      .join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `
            : ""
        }

        <!-- Business Validation Logs -->
        ${
          businessLogs.length > 0
            ? `
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header bg-info">
                        <h5 class="mb-0 text-white">Business Validation Logs</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead class="table-dark">
                                    <tr>
                                        <th>Claim #</th>
                                        <th>Rule Name</th>
                                        <th>Rule Code</th>
                                        <th>Type</th>
                                        <th>Field</th>
                                        <th>Current Value</th>
                                        <th>Severity</th>
                                        <th>Message</th>
                                        <th>Suggestion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${businessLogs
                                      .map(
                                        (log) => `
                                        <tr class="${getSeverityClass(
                                          log.severity
                                        )}">
                                            <td><code>${
                                              log.claim_number
                                            }</code></td>
                                            <td>${log.rule_name || "N/A"}</td>
                                            <td><code>${
                                              log.rule_code || "N/A"
                                            }</code></td>
                                            <td>${log.rule_type || "N/A"}</td>
                                            <td><code>${
                                              log.field_name
                                            }</code></td>
                                            <td><code>${
                                              log.current_value
                                            }</code></td>
                                            <td>
                                                <span class="badge bg-${
                                                  log.severity === "ERROR"
                                                    ? "danger"
                                                    : log.severity === "WARNING"
                                                    ? "warning"
                                                    : "info"
                                                }">
                                                    ${log.severity}
                                                </span>
                                            </td>
                                            <td>${log.error_message}</td>
                                            <td>${log.suggestion || "N/A"}</td>
                                        </tr>
                                    `
                                      )
                                      .join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `
            : ""
        }

        ${
          fileLogs.length === 0 &&
          ediLogs.length === 0 &&
          businessLogs.length === 0
            ? `
        <div class="row">
            <div class="col-12">
                <div class="alert alert-success text-center">
                    <h4>🎉 All Clear!</h4>
                    <p>No validation issues found for this file.</p>
                </div>
            </div>
        </div>
        `
            : ""
        }
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
  `;
}

/**
 * @route   GET /api/v1/upload/:fileId
 * @desc    Get upload details
 * @access  Private
 */
router.get("/:fileId", authenticateToken, async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const result = await pool.query(
      `
      SELECT
        ufd.*,
        u.username as uploaded_by_username
      FROM UploadFileDetail ufd
      LEFT JOIN Users u ON ufd.uploaded_by = u.user_id
      WHERE ufd.file_id = $1 AND ufd.is_deleted = false
    `,
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/upload/:fileId/auto-correct
 * @desc    Apply auto-correction rules to a parsed claim file
 * @access  Private
 * @body    {boolean} isTestMode - If true, returns preview without updating DB (default: false)
 */
router.post(
  "/:fileId/auto-correct",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { fileId } = req.params;
      const { isTestMode = false } = req.body;

      // Validate fileId format (UUID)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(fileId)) {
        return res.status(400).json({ error: "Invalid file ID format" });
      }

      // Check if file exists and has parsed_json
      const fileCheck = await pool.query(
        `SELECT file_id, file_name, parsed_json, upload_status
       FROM UploadFileDetail
       WHERE file_id = $1 AND is_deleted = false`,
        [fileId]
      );

      if (fileCheck.rows.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      const file = fileCheck.rows[0];

      if (!file.parsed_json) {
        return res.status(400).json({
          error:
            "File has not been parsed yet. Please parse the file before applying corrections.",
          upload_status: file.upload_status,
        });
      }

      // Apply auto-correction
      console.log(
        `Starting auto-correction for file ${fileId} (test mode: ${isTestMode})`
      );

      const correctionResult = await autoCorrectClaim(fileId, {
        isTestMode,
        userId: req.user.user_id,
      });

      res.json({
        message: isTestMode
          ? "Auto-correction preview completed (no changes saved)"
          : "Auto-correction completed successfully",
        ...correctionResult,
      });
    } catch (error) {
      console.error("Auto-correction error:", error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/upload/claim-history/:fileId
 * @desc    Get claim history for a specific file
 * @access  Private
 */
router.get(
  "/claim-history/:fileId",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { fileId } = req.params;

      // Validate fileId format (UUID)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(fileId)) {
        return res.status(400).json({ error: "Invalid file ID format" });
      }

      // Check if file exists
      const fileCheck = await pool.query(
        "SELECT file_name FROM UploadFileDetail WHERE file_id = $1 AND is_deleted = false",
        [fileId]
      );

      if (fileCheck.rows.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      // Get history records for this file
      const historyResult = await pool.query(
        `
      SELECT
        ch.id,
        ch.operation_type,
        ch.status,
        ch.notes,
        ch.operation_date,
        u.username as user_detail
      FROM ClaimHistory ch
      LEFT JOIN Users u ON ch.user_detail = u.user_id
      WHERE ch.file_id = $1
      ORDER BY ch.operation_date DESC
    `,
        [fileId]
      );

      res.json({
        fileId,
        fileName: fileCheck.rows[0].file_name,
        totalEntries: historyResult.rows.length,
        history: historyResult.rows,
      });
    } catch (error) {
      console.error("Error fetching claim history:", error);
      next(error);
    }
  }
);

/**
 * @route   POST /api/v1/upload/genAckSummary/:fileId
 * @desc    Generate acknowledgement summary with AI-powered summary for validated and auto-corrected claims
 * @access  Private
 */
router.get(
  "/genAckSummary/:fileId",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { fileId } = req.params;

      const result = await pool.query(
        `
      SELECT
        cl.*,
        u.username as corrected_by_username
      FROM CorrectionLog cl
      LEFT JOIN Users u ON cl.corrected_by = u.user_id
      WHERE cl.claim_id IN (
        SELECT claim_id FROM ClaimHeader WHERE file_id = $1
      )
      ORDER BY cl.corrected_at DESC
    `,
        [fileId]
      );

      res.json({
        fileId,
        totalCorrections: result.rows.length,
        corrections: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/upload/:fileId/parsed-json-history
 * @desc    Get parsed_json change history for a file
 * @access  Private
 */
router.get(
  "/:fileId/parsed-json-history",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { fileId } = req.params;
      const { includeJson = "false" } = req.query;

      // Validate fileId format (UUID)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(fileId)) {
        return res.status(400).json({ error: "Invalid file ID format" });
      }

      // Check if file exists
      const fileCheck = await pool.query(
        `SELECT file_id, file_name FROM UploadFileDetail WHERE file_id = $1 AND is_deleted = false`,
        [fileId]
      );

      if (fileCheck.rows.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      const file = fileCheck.rows[0];

      // Get current version from log table
      const versionResult = await pool.query(
        `SELECT get_current_parsed_json_version($1) as current_version`,
        [fileId]
      );
      const currentVersion = versionResult.rows[0]?.current_version || 0;

      // Determine which columns to select based on includeJson parameter
      const jsonColumns =
        includeJson === "true"
          ? `pjhl.previous_value, pjhl.new_value,`
          : `
          pg_column_size(pjhl.previous_value) as previous_value_size,
          pg_column_size(pjhl.new_value) as new_value_size,
        `;

      // Query history from log table
      const result = await pool.query(
        `
      SELECT
        pjhl.log_id as history_id,
        pjhl.file_id,
        pjhl.version,
        ${jsonColumns}
        pjhl.change_type,
        pjhl.change_description,
        pjhl.changes_summary,
        pjhl.changed_by,
        pjhl.changed_by_username,
        pjhl.changed_via,
        pjhl.changed_at,
        pjhl.correction_log_ids,
        pjhl.related_validation_ids
      FROM ParsedJsonHistoryLog pjhl
      WHERE pjhl.file_id = $1
      ORDER BY pjhl.version DESC
    `,
        [fileId]
      );

      res.json({
        fileId,
        fileName: file.file_name,
        currentVersion,
        totalChanges: result.rows.length,
        history: result.rows,
      });
    } catch (error) {
      console.error("Error fetching parsed_json history:", error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/upload/:fileId/parsed-json-history/:version
 * @desc    Get specific version of parsed_json
 * @access  Private
 */
router.get(
  "/:fileId/parsed-json-history/:version",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { fileId, version } = req.params;

      // Validate inputs
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(fileId)) {
        return res.status(400).json({ error: "Invalid file ID format" });
      }

      const versionNum = parseInt(version);
      if (isNaN(versionNum) || versionNum < 1) {
        return res.status(400).json({ error: "Invalid version number" });
      }

      // Query specific version from log table
      const result = await pool.query(
        `
      SELECT
        pjhl.log_id as history_id,
        pjhl.file_id,
        pjhl.version,
        pjhl.previous_value,
        pjhl.new_value,
        pjhl.change_type,
        pjhl.change_description,
        pjhl.changes_summary,
        pjhl.changed_by,
        pjhl.changed_by_username,
        pjhl.changed_via,
        pjhl.changed_at,
        pjhl.correction_log_ids,
        pjhl.related_validation_ids,
        ufd.file_name
      FROM ParsedJsonHistoryLog pjhl
      JOIN UploadFileDetail ufd ON pjhl.file_id = ufd.file_id
      WHERE pjhl.file_id = $1 AND pjhl.version = $2
    `,
        [fileId, versionNum]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Version not found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching specific version:", error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/upload/genAckSummary/:fileId
 * @desc    Generate acknowledgement summary with AI-powered summary for validated and auto-corrected claims
 * @access  Private
 */
router.get(
  "/genAckSummary/:fileId",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { fileId } = req.params;

      // Validate fileId format (UUID)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(fileId)) {
        return res.status(400).json({ error: "Invalid file ID format" });
      }

      // Get file details
      const fileResult = await pool.query(
        `
        SELECT
          ufd.file_id, ufd.file_name, ufd.upload_status, ufd.uploaded_at,
          ufd.parsed_at, ufd.parsing_summary,
          u.username as uploaded_by_username
        FROM UploadFileDetail ufd
        LEFT JOIN Users u ON ufd.uploaded_by = u.user_id
        WHERE ufd.file_id = $1 AND ufd.is_deleted = false
      `,
        [fileId]
      );

      if (fileResult.rows.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      const fileInfo = fileResult.rows[0];

      // Get counts from different log tables
      const [fileLogStats, ediLogStats, businessLogStats, correctionStats] =
        await Promise.all([
          pool.query(
            `
            SELECT
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE severity = 'ERROR') as errors,
              COUNT(*) FILTER (WHERE severity = 'WARNING') as warnings,
              COUNT(*) FILTER (WHERE severity = 'INFO') as info
            FROM FileValidationLog WHERE file_id = $1
          `,
            [fileId]
          ),
          pool.query(
            `
            SELECT
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE severity = 'ERROR') as errors,
              COUNT(*) FILTER (WHERE severity = 'WARNING') as warnings,
              COUNT(*) FILTER (WHERE severity = 'INFO') as info
            FROM EDIValidationLog WHERE file_id = $1
          `,
            [fileId]
          ),
          pool.query(
            `
            SELECT
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE severity = 'ERROR') as errors,
              COUNT(*) FILTER (WHERE severity = 'WARNING') as warnings,
              COUNT(*) FILTER (WHERE severity = 'INFO') as info
            FROM BusinessValidationLog bvl
            JOIN ClaimHeader ch ON bvl.claim_id = ch.claim_id
            WHERE ch.file_id = $1
          `,
            [fileId]
          ),
          pool.query(
            `
            SELECT COUNT(*) as total_corrections
            FROM CorrectionLog cl
            WHERE cl.claim_id IN (SELECT claim_id FROM ClaimHeader WHERE file_id = $1)
          `,
            [fileId]
          ),
        ]);

      // Fetch current upload file error details for AI summary
      const [allFileLogs, allEdiLogs, allBusinessLogs] = await Promise.all([
        pool.query(
          `
          SELECT error_message, severity, validation_rule, llmsummary, validated_at
          FROM FileValidationLog
          WHERE file_id = $1 AND severity = 'ERROR'
          ORDER BY validated_at DESC
        `,
          [fileId]
        ),
        pool.query(
          `
          SELECT evl.error_message, evl.severity, evl.segment_id, evl.element_id,
                 evl.validation_rule, evl.validated_at, ch.claim_number
          FROM EDIValidationLog evl
          LEFT JOIN ClaimHeader ch ON evl.claim_id = ch.claim_id
          WHERE evl.file_id = $1 AND evl.severity = 'ERROR'
          ORDER BY evl.validated_at DESC
        `,
          [fileId]
        ),
        pool.query(
          `
          SELECT bvl.error_message, bvl.severity, bvl.field_name, bvl.current_value,
                 bvl.suggestion, bvl.validated_at, ch.claim_number, vr.rule_name
          FROM BusinessValidationLog bvl
          JOIN ClaimHeader ch ON bvl.claim_id = ch.claim_id
          LEFT JOIN ValidationRules vr ON bvl.rule_id = vr.rule_id
          WHERE ch.file_id = $1 AND bvl.severity = 'ERROR'
          ORDER BY bvl.validated_at DESC
        `,
          [fileId]
        ),
      ]);

      // Get applied corrections count only (not details to reduce token size)
      const allCorrections = [];

      // Generate AI-powered summary with ALL validation data and corrections
      const aiSummary = await generateAcknowledgementSummary(
        fileInfo,
        {
          file: fileLogStats.rows[0],
          edi: ediLogStats.rows[0],
          business: businessLogStats.rows[0],
        },
        correctionStats.rows[0].total_corrections,
        {
          allFileLogs: allFileLogs.rows,
          allEdiLogs: allEdiLogs.rows,
          allBusinessLogs: allBusinessLogs.rows,
          allCorrections: allCorrections.rows,
        }
      );

      // Generate HTML response
      const htmlContent = generateAcknowledgementHTML(
        fileInfo,
        {
          file: fileLogStats.rows[0],
          edi: ediLogStats.rows[0],
          business: businessLogStats.rows[0],
        },
        correctionStats.rows[0].total_corrections,
        aiSummary
      );

      res.set("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error) {
      console.error("Error generating acknowledgement summary:", error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body>
          <div class="container mt-5">
            <div class="alert alert-danger">
              <h4>Error generating acknowledgement summary</h4>
              <p>${error.message}</p>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  }
);

/**
 * Generate AI-powered acknowledgement summary using Azure OpenAI
 */
async function generateAcknowledgementSummary(
  fileInfo,
  validationStats,
  totalCorrections,
  sampleData
) {
  const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
  const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
  const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
  const AZURE_OPENAI_API_VERSION =
    process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (
    !AZURE_OPENAI_API_KEY &&
    !AZURE_OPENAI_ENDPOINT &&
    !AZURE_OPENAI_DEPLOYMENT &&
    !OPENAI_API_KEY
  ) {
    console.warn("No AI service configured, returning basic summary");
    return {
      summary: `File ${fileInfo.file_name} processed. ${
        validationStats.file.errors +
        validationStats.edi.errors +
        validationStats.business.errors
      } total issues found across all validation stages. ${totalCorrections} corrections applied automatically.`,
      assessment:
        "Processing completed successfully. Review validation details above for specific findings.",
      recommendations:
        "Please review the detailed validation results and correction history above.",
    };
  }

  try {
    const prompt = `
You are a medical claims processing expert analyzing a completed 837 file validation and auto-correction process.

Create a professional acknowledgement summary for the user who submitted this claim file. Analyze ALL the validation data and corrections provided and generate a meaningful summary. The summary should be:
- Professional and clear
- Focused on the overall status and key findings
- Written in natural language (not bullet points)
- Approximately 2-3 sentences long

FILE INFORMATION:
- File Name: ${fileInfo.file_name}
- Status: ${fileInfo.upload_status}
- Processed: ${fileInfo.uploaded_at}

VALIDATION SUMMARY:
- File-level validation: ${validationStats.file.total} total (${
      validationStats.file.errors
    } errors, ${validationStats.file.warnings} warnings)
- EDI structure validation: ${validationStats.edi.total} total (${
      validationStats.edi.errors
    } errors, ${validationStats.edi.warnings} warnings)
- Business rule validation: ${validationStats.business.total} total (${
      validationStats.business.errors
    } errors, ${validationStats.business.warnings} warnings)
- Total auto-corrections applied: ${totalCorrections}

COMPLETE VALIDATION DETAILS:
${JSON.stringify(sampleData, null, 2)}

INSTRUCTIONS:
Analyze all the validation logs and correction data above to understand the complete processing results. Write a concise, professional summary that acknowledges receipt of the claim file and summarizes the overall validation outcome and key findings. Focus on the overall status, what was accomplished, and readiness for submission. Consider patterns in the errors and what they indicate about the file quality.

OUTPUT FORMAT: Return JSON with three fields:
{
  "summary": "Your professional summary text here based on analyzing ALL data",
  "assessment": "Brief assessment of the file status and quality",
  "recommendations": "Any next steps or recommendations based on the complete analysis"
}
`;

    let rawResponse = "";

    // Use Azure OpenAI if available
    if (
      AZURE_OPENAI_API_KEY &&
      AZURE_OPENAI_ENDPOINT &&
      AZURE_OPENAI_DEPLOYMENT
    ) {
      const url = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

      const body = {
        messages: [
          {
            role: "system",
            content:
              "You are a medical claims processing expert providing professional summaries.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "api-key": AZURE_OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const responseData = await response.json();
      const choices = responseData?.choices;
      if (Array.isArray(choices)) {
        rawResponse = choices
          .map(
            (c) => c.message?.content?.trim() || c.delta?.content?.trim() || ""
          )
          .join("\n");
      }
    }
    // Fallback to OpenAI
    else if (OPENAI_API_KEY) {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are a medical claims processing expert providing professional summaries.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
        }
      );

      const responseData = await response.json();
      const choices = responseData?.choices;
      if (Array.isArray(choices)) {
        rawResponse = choices
          .map(
            (c) => c.message?.content?.trim() || c.delta?.content?.trim() || ""
          )
          .join("\n");
      }
    }

    // Parse and return the summary
    try {
      const parsed = JSON.parse(rawResponse || "{}");
      return {
        summary:
          parsed.summary ||
          "Processing complete. Review validation details above.",
        assessment: parsed.assessment || "File processed successfully.",
        recommendations:
          parsed.recommendations || "None required at this time.",
      };
    } catch (parseError) {
      console.warn("Failed to parse AI response, returning fallback summary");
      return {
        summary: `File ${
          fileInfo.file_name
        } has been processed and validated. ${
          validationStats.file.errors +
          validationStats.edi.errors +
          validationStats.business.errors
        } issues were identified and addressed. ${totalCorrections} automatic corrections were applied.`,
        assessment: "Processing completed successfully.",
        recommendations:
          "Please review the detailed validation results above for any follow-up actions.",
      };
    }
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return {
      summary: `File processing completed. ${
        validationStats.file.errors +
        validationStats.edi.errors +
        validationStats.business.errors
      } total issues identified. ${totalCorrections} corrections applied.`,
      assessment: "Processing completed with results shown above.",
      recommendations:
        "Review validation details and correction history for next steps.",
    };
  }
}

/**
 * Generate HTML content for acknowledgement summary
 */
function generateAcknowledgementHTML(
  fileInfo,
  validationStats,
  totalCorrections,
  aiSummary
) {
  const totalErrors =
    validationStats.file.errors +
    validationStats.edi.errors +
    validationStats.business.errors;
  const totalWarnings =
    validationStats.file.warnings +
    validationStats.edi.warnings +
    validationStats.business.warnings;
  const totalValidation = totalErrors + totalWarnings;

  const getStatusBadge = (status) => {
    const statusClasses = {
      PARSED: "success",
      CORRECTED: "primary",
      VALIDATION_FAILED: "danger",
      AUTO_CORRECT_FAILED: "warning",
      PARSING: "info",
      default: "secondary",
    };
    const cssClass = statusClasses[status] || statusClasses.default;
    return `<span class="badge bg-${cssClass}">${status}</span>`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString();
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claim Processing Acknowledgement - ${fileInfo.file_name}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .summary-card { border-left: 4px solid; margin-bottom: 1rem; }
        .summary-card.success { border-color: #198754; }
        .summary-card.warning { border-color: #ffc107; }
        .summary-card.danger { border-color: #dc3545; }
        .summary-card.info { border-color: #0dcaf0; }
        .ai-summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; padding: 20px; margin: 20px 0; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-number { font-size: 2rem; font-weight: bold; }
        .stat-label { font-size: 0.9rem; color: #666; text-transform: uppercase; }
    </style>
</head>
<body class="bg-light">
    <div class="container-fluid py-4">
        <!-- Header -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h1 class="mb-2">✅ Claim Processing Complete</h1>
                        <h5 class="text-muted">Acknowledgement Summary</h5>
                    </div>
                    <div class="text-end">
                        <button onclick="window.close()" class="btn btn-secondary">Close Window</button>
                        <button onclick="window.print()" class="btn btn-outline-primary ms-2">Print Summary</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- File Information Card -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">📄 File Information</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3">
                                <strong>File Name:</strong><br>
                                <code>${fileInfo.file_name}</code>
                            </div>
                            <div class="col-md-3">
                                <strong>Status:</strong><br>
                                ${getStatusBadge(fileInfo.upload_status)}
                            </div>
                            <div class="col-md-3">
                                <strong>Uploaded:</strong><br>
                                ${formatDateTime(fileInfo.uploaded_at)}
                            </div>
                            <div class="col-md-3">
                                <strong>Uploaded By:</strong><br>
                                ${fileInfo.uploaded_by_username || "System"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Statistics Grid -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number text-danger">${
                  validationStats.file.errors +
                  validationStats.edi.errors +
                  validationStats.business.errors
                }</div>
                <div class="stat-label">Total Errors</div>
            </div>
            <div class="stat-card">
                <div class="stat-number text-warning">${
                  validationStats.file.warnings +
                  validationStats.edi.warnings +
                  validationStats.business.warnings
                }</div>
                <div class="stat-label">Total Warnings</div>
            </div>
            <div class="stat-card">
                <div class="stat-number text-info">${
                  validationStats.file.info +
                  validationStats.edi.info +
                  validationStats.business.info
                }</div>
                <div class="stat-label">Total Info</div>
            </div>
            <div class="stat-card">
                <div class="stat-number text-success">${totalCorrections}</div>
                <div class="stat-label">Auto-Corrections</div>
            </div>
        </div>

        <!-- Validation Summary Cards -->
        <div class="row mb-4">
            <div class="col-md-4">
                <div class="card summary-card ${
                  validationStats.file.errors > 0
                    ? "danger"
                    : validationStats.file.warnings > 0
                    ? "warning"
                    : "success"
                }">
                    <div class="card-body">
                        <h5 class="card-title">📁 File Validation</h5>
                        <p class="card-text">
                            <strong>Total Issues:</strong> ${
                              validationStats.file.total
                            }<br>
                            <span class="text-danger">Errors: ${
                              validationStats.file.errors
                            }</span><br>
                            <span class="text-warning">Warnings: ${
                              validationStats.file.warnings
                            }</span><br>
                            <span class="text-info">Info: ${
                              validationStats.file.info
                            }</span>
                        </p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card summary-card ${
                  validationStats.edi.errors > 0
                    ? "danger"
                    : validationStats.edi.warnings > 0
                    ? "warning"
                    : "success"
                }">
                    <div class="card-body">
                        <h5 class="card-title">🔧 EDI Validation</h5>
                        <p class="card-text">
                            <strong>Total Issues:</strong> ${
                              validationStats.edi.total
                            }<br>
                            <span class="text-danger">Errors: ${
                              validationStats.edi.errors
                            }</span><br>
                            <span class="text-warning">Warnings: ${
                              validationStats.edi.warnings
                            }</span><br>
                            <span class="text-info">Info: ${
                              validationStats.edi.info
                            }</span>
                        </p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card summary-card ${
                  validationStats.business.errors > 0
                    ? "danger"
                    : validationStats.business.warnings > 0
                    ? "warning"
                    : "success"
                }">
                    <div class="card-body">
                        <h5 class="card-title">📋 Business Rules</h5>
                        <p class="card-text">
                            <strong>Total Issues:</strong> ${
                              validationStats.business.total
                            }<br>
                            <span class="text-danger">Errors: ${
                              validationStats.business.errors
                            }</span><br>
                            <span class="text-warning">Warnings: ${
                              validationStats.business.warnings
                            }</span><br>
                            <span class="text-info">Info: ${
                              validationStats.business.info
                            }</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- AI-Generated Summary -->
        ${
          aiSummary
            ? `
        <div class="row mb-4">
            <div class="col-12">
                <div class="ai-summary">
                    <h4>🤖 AI Summary & Assessment</h4>
                    <p class="mb-3">${aiSummary.summary}</p>
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Assessment:</strong><br>
                            ${aiSummary.assessment}
                        </div>
                        <div class="col-md-6">
                            <strong>Recommendations:</strong><br>
                            ${aiSummary.recommendations}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `
            : ""
        }

        <!-- Overall Status -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card ${
                  totalErrors === 0
                    ? "border-success"
                    : totalErrors > 5
                    ? "border-danger"
                    : "border-warning"
                }">
                    <div class="card-body text-center">
                        <h4 class="card-title">
                            ${
                              totalErrors === 0
                                ? "🎉 Processing Successful!"
                                : totalErrors > 5
                                ? "⚠️ Review Required"
                                : "✅ Ready for Submission"
                            }
                        </h4>
                        <p class="card-text">
                            ${
                              totalErrors === 0
                                ? "All validations passed. The claim file is ready for submission."
                                : `Found ${totalValidation} validation issues. ${totalCorrections} auto-corrections were applied automatically.`
                            }
                        </p>
                        <div class="mt-3">
                            <button onclick="location.reload()" class="btn btn-outline-primary">Refresh Status</button>
                            <a href="/api/v1/upload/getLogs?fileId=${
                              fileInfo.file_id
                            }&format=html" class="btn btn-info ms-2" target="_blank">View Detailed Logs</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="row">
            <div class="col-12">
                <div class="text-center text-muted">
                    <small>
                        Generated on ${new Date().toLocaleString()} |
                        File ID: ${fileInfo.file_id} |
                        System: Claim Accelerator
                    </small>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
  `;
}

export default router;
