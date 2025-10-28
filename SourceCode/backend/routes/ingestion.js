import express from "express";
import pool from "../config/database.js";
import { authenticateToken } from "../middleware/auth.js";
import ingestionManager from "../services/ingestionManager.js";
import { encryptPassword, testEncryption } from "../utils/encryption.js";
import fs from "fs/promises";
import path from "path";

const router = express.Router();

/**
 * @route   GET /api/v1/ingestion/health
 * @desc    Get health status of ingestion services
 * @access  Private
 */
router.get("/health", authenticateToken, async (req, res) => {
  try {
    const health = await ingestionManager.getHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get health status",
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/v1/ingestion/facility/:facilityId/status
 * @desc    Get ingestion status for a specific facility
 * @access  Private
 */
router.get(
  "/facility/:facilityId/status",
  authenticateToken,
  async (req, res) => {
    try {
      const { facilityId } = req.params;
      const status = await ingestionManager.getFacilityStatus(facilityId);
      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: "Failed to get facility status",
        message: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/v1/ingestion/facility/:facilityId/config
 * @desc    Get ingestion configuration for a facility
 * @access  Private
 */
router.get(
  "/facility/:facilityId/config",
  authenticateToken,
  async (req, res) => {
    try {
      const { facilityId } = req.params;
      const client = await pool.connect();

      try {
        const result = await client.query(
          `
          SELECT facility_id, facility_code, facility_name, ingestion_mode, ingestion_config, is_active
          FROM Facilities
          WHERE facility_id = $1
        `,
          [facilityId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "Facility not found" });
        }

        const facility = result.rows[0];

        // Remove sensitive data (passwords) before sending
        if (facility.ingestion_config && facility.ingestion_config.sftp) {
          facility.ingestion_config.sftp.password_encrypted = facility
            .ingestion_config.sftp.password_encrypted
            ? "********"
            : null;
        }

        res.json(facility);
      } finally {
        client.release();
      }
    } catch (error) {
      res.status(500).json({
        error: "Failed to get facility configuration",
        message: error.message,
      });
    }
  }
);

/**
 * @route   PUT /api/v1/ingestion/facility/:facilityId/config
 * @desc    Update ingestion configuration for a facility
 * @access  Private
 */
router.put(
  "/facility/:facilityId/config",
  authenticateToken,
  async (req, res) => {
    try {
      const { facilityId } = req.params;
      const { ingestion_mode, ingestion_config } = req.body;

      // Validate ingestion mode
      const validModes = ["REST_API", "SFTP", "LOCAL_FOLDER"];
      if (ingestion_mode && !validModes.includes(ingestion_mode)) {
        return res.status(400).json({
          error: "Invalid ingestion mode",
          message: `Must be one of: ${validModes.join(", ")}`,
        });
      }

      // Validate data format if provided
      const validFormats = ["FHIR", "HL7"];
      if (
        ingestion_config &&
        ingestion_config.data_format &&
        !validFormats.includes(ingestion_config.data_format)
      ) {
        return res.status(400).json({
          error: "Invalid data format",
          message: `Must be one of: ${validFormats.join(", ")}`,
        });
      }

      // Validate configuration based on mode
      if (ingestion_mode === "SFTP") {
        const validationResult = validateSftpConfig(ingestion_config);
        if (!validationResult.valid) {
          return res.status(400).json({
            error: "Invalid SFTP configuration",
            message: validationResult.message,
          });
        }

        // Encrypt password if provided
        if (
          ingestion_config.sftp &&
          ingestion_config.sftp.password &&
          ingestion_config.sftp.password !== "********"
        ) {
          ingestion_config.sftp.password_encrypted = encryptPassword(
            ingestion_config.sftp.password
          );
          delete ingestion_config.sftp.password; // Remove plain text
        }

        // Validate private key path if provided
        if (ingestion_config.sftp && ingestion_config.sftp.private_key_path) {
          try {
            await fs.access(ingestion_config.sftp.private_key_path);
          } catch (error) {
            return res.status(400).json({
              error: "Invalid private key path",
              message: `Cannot access file: ${ingestion_config.sftp.private_key_path}`,
            });
          }
        }
      } else if (ingestion_mode === "LOCAL_FOLDER") {
        const validationResult = validateLocalConfig(ingestion_config);
        if (!validationResult.valid) {
          return res.status(400).json({
            error: "Invalid local folder configuration",
            message: validationResult.message,
          });
        }

        // Validate paths exist and are writable
        try {
          await fs.access(
            ingestion_config.local.input_folder,
            fs.constants.R_OK | fs.constants.W_OK
          );
          await fs.access(
            ingestion_config.local.output_folder,
            fs.constants.R_OK | fs.constants.W_OK
          );
        } catch (error) {
          return res.status(400).json({
            error: "Invalid folder paths",
            message:
              "Ensure input and output folders exist and have read/write permissions",
          });
        }
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Update facility configuration
        const result = await client.query(
          `
          UPDATE Facilities
          SET ingestion_mode = $1, ingestion_config = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3
          WHERE facility_id = $4
          RETURNING facility_id, facility_code, ingestion_mode
        `,
          [
            ingestion_mode || "REST_API",
            ingestion_config || {},
            req.user.user_id,
            facilityId,
          ]
        );

        if (result.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Facility not found" });
        }

        await client.query("COMMIT");

        const facility = result.rows[0];

        // Restart ingestion services for this facility
        await ingestionManager.restartFacility(facilityId);

        res.json({
          message: "Configuration updated successfully",
          facility_id: facility.facility_id,
          facility_code: facility.facility_code,
          ingestion_mode: facility.ingestion_mode,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      res.status(500).json({
        error: "Failed to update configuration",
        message: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/v1/ingestion/facility/:facilityId/test-connection
 * @desc    Test SFTP connection or local folder access
 * @access  Private
 */
router.post(
  "/facility/:facilityId/test-connection",
  authenticateToken,
  async (req, res) => {
    try {
      const { facilityId } = req.params;
      const { ingestion_mode, ingestion_config } = req.body;

      if (ingestion_mode === "SFTP") {
        // Test SFTP connection
        const Client = (await import("ssh2-sftp-client")).default;
        const sftp = new Client();

        const connectionConfig = {
          host: ingestion_config.sftp.host,
          port: ingestion_config.sftp.port || 22,
          username: ingestion_config.sftp.username,
          readyTimeout:
            (ingestion_config.sftp.connection_timeout_seconds || 30) * 1000,
        };

        // Authentication
        if (ingestion_config.sftp.password) {
          connectionConfig.password = ingestion_config.sftp.password;
        } else if (ingestion_config.sftp.private_key_path) {
          connectionConfig.privateKey = await fs.readFile(
            ingestion_config.sftp.private_key_path,
            "utf8"
          );
        }

        try {
          await sftp.connect(connectionConfig);

          // Test listing input folder
          await sftp.list(ingestion_config.sftp.input_folder);

          await sftp.end();

          res.json({
            success: true,
            message: "SFTP connection successful",
          });
        } catch (error) {
          res.status(400).json({
            success: false,
            error: "SFTP connection failed",
            message: error.message,
          });
        }
      } else if (ingestion_mode === "LOCAL_FOLDER") {
        // Test local folder access
        try {
          await fs.access(
            ingestion_config.local.input_folder,
            fs.constants.R_OK | fs.constants.W_OK
          );
          await fs.access(
            ingestion_config.local.output_folder,
            fs.constants.R_OK | fs.constants.W_OK
          );

          // Test write permission
          const testFile = path.join(
            ingestion_config.local.output_folder,
            ".write_test"
          );
          await fs.writeFile(testFile, "test");
          await fs.unlink(testFile);

          res.json({
            success: true,
            message: "Local folder access successful",
          });
        } catch (error) {
          res.status(400).json({
            success: false,
            error: "Local folder access failed",
            message: error.message,
          });
        }
      } else {
        res.status(400).json({
          error: "Invalid ingestion mode",
          message: "Mode must be SFTP or LOCAL_FOLDER",
        });
      }
    } catch (error) {
      res.status(500).json({
        error: "Test failed",
        message: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/v1/ingestion/facility/:facilityId/restart
 * @desc    Restart ingestion services for a facility
 * @access  Private
 */
router.post(
  "/facility/:facilityId/restart",
  authenticateToken,
  async (req, res) => {
    try {
      const { facilityId } = req.params;
      await ingestionManager.restartFacility(facilityId);

      res.json({
        message: "Ingestion services restarted successfully",
        facility_id: facilityId,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to restart ingestion services",
        message: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/v1/ingestion/facility/:facilityId/stop
 * @desc    Stop ingestion services for a facility
 * @access  Private
 */
router.post(
  "/facility/:facilityId/stop",
  authenticateToken,
  async (req, res) => {
    try {
      const { facilityId } = req.params;
      await ingestionManager.stopFacility(facilityId);

      res.json({
        message: "Ingestion services stopped successfully",
        facility_id: facilityId,
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to stop ingestion services",
        message: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/v1/ingestion/statistics
 * @desc    Get ingestion statistics
 * @access  Private
 */
router.get("/statistics", authenticateToken, async (req, res) => {
  try {
    const { facilityId, mode, days = 7 } = req.query;

    const statistics = await ingestionManager.getStatistics({
      facilityId,
      mode,
      days: parseInt(days),
    });

    res.json(statistics);
  } catch (error) {
    res.status(500).json({
      error: "Failed to get statistics",
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/v1/ingestion/logs
 * @desc    Get ingestion logs
 * @access  Private
 */
router.get("/logs", authenticateToken, async (req, res) => {
  try {
    const { facilityId, mode, status, page = 1, limit = 50 } = req.query;

    const client = await pool.connect();

    try {
      let query = `
        SELECT
          il.*,
          f.facility_code,
          f.facility_name
        FROM IngestionLog il
        LEFT JOIN Facilities f ON il.facility_id = f.facility_id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (facilityId) {
        query += ` AND il.facility_id = $${paramIndex++}`;
        params.push(facilityId);
      }

      if (mode) {
        query += ` AND il.ingestion_mode = $${paramIndex++}`;
        params.push(mode);
      }

      if (status) {
        query += ` AND il.status = $${paramIndex++}`;
        params.push(status);
      }

      // Count total
      const countResult = await client.query(
        `SELECT COUNT(*) FROM (${query}) AS count_query`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Add pagination
      query += ` ORDER BY il.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

      const result = await client.query(query, params);

      res.json({
        logs: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          total_pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({
      error: "Failed to get logs",
      message: error.message,
    });
  }
});

// ======================================
// Helper Functions
// ======================================

function validateSftpConfig(config) {
  if (!config || !config.sftp) {
    return { valid: false, message: "SFTP configuration is required" };
  }

  const sftp = config.sftp;

  if (!sftp.host) {
    return { valid: false, message: "SFTP host is required" };
  }

  if (!sftp.username) {
    return { valid: false, message: "SFTP username is required" };
  }

  if (!sftp.password && !sftp.password_encrypted && !sftp.private_key_path) {
    return {
      valid: false,
      message: "Either password or private key path is required",
    };
  }

  if (!sftp.input_folder) {
    return { valid: false, message: "Input folder is required" };
  }

  if (!sftp.output_folder) {
    return { valid: false, message: "Output folder is required" };
  }

  if (sftp.port && (sftp.port < 1 || sftp.port > 65535)) {
    return { valid: false, message: "Port must be between 1 and 65535" };
  }

  if (sftp.poll_interval_seconds && sftp.poll_interval_seconds < 60) {
    return {
      valid: false,
      message: "Poll interval must be at least 60 seconds",
    };
  }

  return { valid: true };
}

function validateLocalConfig(config) {
  if (!config || !config.local) {
    return { valid: false, message: "Local folder configuration is required" };
  }

  const local = config.local;

  if (!local.input_folder) {
    return { valid: false, message: "Input folder is required" };
  }

  if (!local.output_folder) {
    return { valid: false, message: "Output folder is required" };
  }

  if (!path.isAbsolute(local.input_folder)) {
    return {
      valid: false,
      message: "Input folder must be an absolute path",
    };
  }

  if (!path.isAbsolute(local.output_folder)) {
    return {
      valid: false,
      message: "Output folder must be an absolute path",
    };
  }

  if (local.archive_folder && !path.isAbsolute(local.archive_folder)) {
    return {
      valid: false,
      message: "Archive folder must be an absolute path",
    };
  }

  return { valid: true };
}

export default router;
