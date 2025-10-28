import express from "express";
import pool from "../config/database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Helper function to calculate differences between two JSON objects
function calculateJsonDifferences(oldJson, newJson) {
  const modifiedFields = [];
  const addedFields = [];
  const removedFields = [];

  function deepCompare(oldObj, newObj, path = "") {
    // Handle null/undefined cases
    if (oldObj === null || oldObj === undefined) {
      if (newObj !== null && newObj !== undefined) {
        addedFields.push(path);
      }
      return;
    }
    if (newObj === null || newObj === undefined) {
      removedFields.push(path);
      return;
    }

    // Handle primitive types
    if (typeof oldObj !== "object" || typeof newObj !== "object") {
      if (oldObj !== newObj) {
        modifiedFields.push(path);
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(oldObj) || Array.isArray(newObj)) {
      if (
        Array.isArray(oldObj) !== Array.isArray(newObj) ||
        oldObj.length !== newObj.length ||
        JSON.stringify(oldObj) !== JSON.stringify(newObj)
      ) {
        modifiedFields.push(path);
      }
      return;
    }

    // Compare objects
    const oldKeys = Object.keys(oldObj);
    const newKeys = Object.keys(newObj);

    // Check for added keys
    for (const key of newKeys) {
      if (!oldKeys.includes(key)) {
        addedFields.push(path ? `${path}.${key}` : key);
      }
    }

    // Check for removed keys
    for (const key of oldKeys) {
      if (!newKeys.includes(key)) {
        removedFields.push(path ? `${path}.${key}` : key);
      }
    }

    // Recursively compare common keys
    for (const key of oldKeys) {
      if (newKeys.includes(key)) {
        deepCompare(oldObj[key], newObj[key], path ? `${path}.${key}` : key);
      }
    }
  }

  // Normalize the JSON objects to ensure consistent comparison
  const normalizedOld =
    typeof oldJson === "string" ? JSON.parse(oldJson) : oldJson;
  const normalizedNew =
    typeof newJson === "string" ? JSON.parse(newJson) : newJson;

  deepCompare(normalizedOld, normalizedNew);

  const totalChanges =
    modifiedFields.length + addedFields.length + removedFields.length;

  return {
    modifiedFields,
    addedFields,
    removedFields,
    totalChanges,
  };
}

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/v1/files/:fileId/parsed-json
 * @desc    Get parsed JSON data for a specific file
 * @access  Private
 */
router.get("/:fileId/parsed-json", async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const result = await pool.query(
      `
      SELECT
        file_id,
        file_name,
        parsed_json,
        upload_status
      FROM UploadFileDetail
      WHERE file_id = $1 AND is_deleted = false
    `,
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = result.rows[0];

    if (!file.parsed_json) {
      return res.status(400).json({
        error: "File has not been parsed yet",
        upload_status: file.upload_status,
      });
    }

    res.json({
      file_id: file.file_id,
      file_name: file.file_name,
      parsed_json: file.parsed_json,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/files/:fileId/validation-errors
 * @desc    Get all validation errors for a specific file (for highlighting in editor)
 * @access  Private
 */
router.get("/:fileId/validation-errors", async (req, res, next) => {
  try {
    const { fileId } = req.params;

    // Get EDI validation errors
    const ediErrors = await pool.query(
      `
      SELECT
        validation_id,
        segment_id,
        element_id,
        error_message,
        error_location,
        severity,
        validated_at
      FROM EDIValidationLog
      WHERE file_id = $1
      ORDER BY validated_at DESC
    `,
      [fileId]
    );

    // Get file validation errors
    const fileErrors = await pool.query(
      `
      SELECT
        validation_id,
        validation_rule,
        error_message,
        error_location,
        severity,
        validated_at
      FROM FileValidationLog
      WHERE file_id = $1
      ORDER BY validated_at DESC
    `,
      [fileId]
    );

    res.json({
      ediErrors: ediErrors.rows,
      fileErrors: fileErrors.rows,
      totalErrors: ediErrors.rows.length + fileErrors.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/v1/files/:fileId/parsed-json
 * @desc    Update parsed JSON data for a specific file and regenerate 837 file
 * @access  Private
 */
router.put("/:fileId/parsed-json", async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { fileId } = req.params;
    const { parsed_json } = req.body;

    if (!parsed_json) {
      return res.status(400).json({ error: "parsed_json is required" });
    }

    // Validate that parsed_json is an object
    if (typeof parsed_json !== "object") {
      return res
        .status(400)
        .json({ error: "parsed_json must be a valid JSON object" });
    }

    await client.query("BEGIN");

    // Check if file exists and get current parsed_json
    const fileCheck = await client.query(
      "SELECT file_id, file_name, file_path, parsed_json FROM UploadFileDetail WHERE file_id = $1 AND is_deleted = false",
      [fileId]
    );

    if (fileCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "File not found" });
    }

    const originalFileName = fileCheck.rows[0].file_name;
    const previousParsedJson = fileCheck.rows[0].parsed_json;

    // Update parsed_json
    const result = await client.query(
      `
      UPDATE UploadFileDetail
      SET parsed_json = $1
      WHERE file_id = $2 AND is_deleted = false
      RETURNING file_id, file_name, parsed_json, file_path
    `,
      [JSON.stringify(parsed_json), fileId]
    );

    // Get username for history log
    const userResult = await client.query(
      "SELECT username FROM Users WHERE user_id = $1",
      [req.user.user_id]
    );
    const username = userResult.rows[0]?.username || "unknown";

    // Calculate changes summary for manual edits
    let changesSummary = null;
    if (previousParsedJson && parsed_json) {
      try {
        const changes = calculateJsonDifferences(
          previousParsedJson,
          parsed_json
        );
        changesSummary = {
          totalFieldsChanged: changes.modifiedFields.length,
          fieldsAdded: changes.addedFields.length,
          fieldsRemoved: changes.removedFields.length,
          modifiedFields: changes.modifiedFields.slice(0, 10), // Limit to first 10 fields
          fieldsAdded: changes.addedFields.slice(0, 5),
          fieldsRemoved: changes.removedFields.slice(0, 5),
          changeTimestamp: new Date().toISOString(),
          totalChanges: changes.totalChanges,
        };
      } catch (error) {
        console.warn("Failed to calculate changes summary:", error);
      }
    }

    // Log the manual correction in ParsedJsonHistoryLog
    await client.query(
      `
      SELECT log_parsed_json_change(
        $1::uuid,
        $2::jsonb,
        $3::jsonb,
        $4::varchar,
        $5::text,
        $6::uuid,
        $7::varchar,
        $8::varchar,
        $9::jsonb,
        NULL::uuid[],
        NULL::uuid[],
        $10::varchar,
        NULL::text
      )
    `,
      [
        fileId,
        previousParsedJson,
        parsed_json,
        "MANUAL_EDIT",
        "Manual correction applied via Manual Correction page",
        req.user.user_id,
        username,
        "WEB_UI",
        changesSummary,
        req.ip || req.connection?.remoteAddress || null,
      ]
    );

    // Log the manual correction in audit log
    await client.query(
      `
      INSERT INTO AuditLog (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
      [
        req.user.user_id,
        "UPDATE",
        "PARSED_JSON",
        fileId,
        null,
        { message: "Manual correction applied to parsed_json" },
        req.ip || req.connection?.remoteAddress || null,
      ]
    );

    await client.query("COMMIT");

    // Regenerate 837 file from updated parsed_json (async, don't wait)
    const generate837 = async () => {
      try {
        const { default: generate837Service } = await import(
          "../services/generate837.js"
        );
        const filePath = result.rows[0].file_path;
        await generate837Service.generate837File(parsed_json, filePath);
        console.log(
          `✓ Successfully regenerated 837 file for ${originalFileName}`
        );
      } catch (error) {
        console.error(
          `✗ Failed to regenerate 837 file for ${originalFileName}:`,
          error
        );
      }
    };

    // Start regeneration in background (don't await)
    generate837().catch((err) =>
      console.error("Background 837 regeneration error:", err)
    );

    res.json({
      message:
        "Parsed JSON updated successfully. 837 file regeneration started.",
      file_id: result.rows[0].file_id,
      file_name: result.rows[0].file_name,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating parsed JSON:", error);
    next(error);
  } finally {
    client.release();
  }
});

export default router;
