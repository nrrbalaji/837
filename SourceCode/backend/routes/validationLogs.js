import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/v1/validation-logs/file/:fileId
 * @desc    Get file validation logs for a specific file
 * @access  Private
 */
router.get('/file/:fileId', async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const result = await pool.query(`
      SELECT
        fvl.validation_id,
        fvl.file_id,
        ufd.file_name,
        fvl.validation_type,
        fvl.validation_rule,
        fvl.severity,
        fvl.error_code,
        fvl.error_message,
        fvl.error_location,
        fvl.llmsummary,
        fvl.validated_at
      FROM FileValidationLog fvl
      JOIN UploadFileDetail ufd ON fvl.file_id = ufd.file_id
      WHERE fvl.file_id = $1
      ORDER BY fvl.validated_at DESC
    `, [fileId]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/validation-logs/edi/:fileId
 * @desc    Get EDI validation logs for a specific file
 * @access  Private
 */
router.get('/edi/:fileId', async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const result = await pool.query(`
      SELECT
        evl.validation_id,
        evl.file_id,
        evl.claim_id,
        ch.claim_number,
        evl.validation_type,
        evl.segment_id,
        evl.element_id,
        evl.validation_rule,
        evl.severity,
        evl.error_code,
        evl.error_message,
        evl.error_location,
        evl.validated_at
      FROM EDIValidationLog evl
      LEFT JOIN ClaimHeader ch ON evl.claim_id = ch.claim_id
      WHERE evl.file_id = $1
      ORDER BY evl.validated_at DESC, evl.claim_id, evl.segment_id
    `, [fileId]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/validation-logs/business/:claimId
 * @desc    Get business rule validation logs for a specific claim
 * @access  Private
 */
router.get('/business/:claimId', async (req, res, next) => {
  try {
    const { claimId } = req.params;

    const result = await pool.query(`
      SELECT
        bvl.validation_id,
        bvl.claim_id,
        ch.claim_number,
        bvl.rule_id,
        vr.rule_name,
        vr.rule_code,
        vr.rule_type,
        bvl.field_name,
        bvl.current_value,
        bvl.severity,
        bvl.error_code,
        bvl.error_message,
        bvl.suggestion,
        bvl.validated_at,
        cl.correction_id,
        cl.new_value,
        cl.correction_type,
        cl.is_approved,
        cl.corrected_at
      FROM BusinessValidationLog bvl
      JOIN ClaimHeader ch ON bvl.claim_id = ch.claim_id
      LEFT JOIN ValidationRules vr ON bvl.rule_id = vr.rule_id
      LEFT JOIN CorrectionLog cl ON bvl.validation_id = cl.validation_id
      WHERE bvl.claim_id = $1
      ORDER BY bvl.severity DESC, bvl.validated_at DESC
    `, [claimId]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/validation-logs/summary/:fileId
 * @desc    Get validation summary for a file (all three types)
 * @access  Private
 */
router.get('/summary/:fileId', async (req, res, next) => {
  try {
    const { fileId } = req.params;

    // Get file validation logs
    const fileValidations = await pool.query(`
      SELECT
        validation_type,
        validation_rule,
        severity,
        COUNT(*) as count
      FROM FileValidationLog
      WHERE file_id = $1
      GROUP BY validation_type, validation_rule, severity
    `, [fileId]);

    // Get EDI validation logs
    const ediValidations = await pool.query(`
      SELECT
        validation_type,
        segment_id,
        severity,
        COUNT(*) as count
      FROM EDIValidationLog
      WHERE file_id = $1
      GROUP BY validation_type, segment_id, severity
    `, [fileId]);

    // Get business validation logs for claims in this file
    const businessValidations = await pool.query(`
      SELECT
        bvl.severity,
        COUNT(*) as count,
        COUNT(DISTINCT bvl.claim_id) as affected_claims
      FROM BusinessValidationLog bvl
      JOIN ClaimHeader ch ON bvl.claim_id = ch.claim_id
      WHERE ch.file_id = $1
      GROUP BY bvl.severity
    `, [fileId]);

    // Get overall counts
    const totalCounts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM FileValidationLog WHERE file_id = $1) as file_validations,
        (SELECT COUNT(*) FROM EDIValidationLog WHERE file_id = $1) as edi_validations,
        (SELECT COUNT(*) FROM BusinessValidationLog bvl
         JOIN ClaimHeader ch ON bvl.claim_id = ch.claim_id
         WHERE ch.file_id = $1) as business_validations
    `, [fileId]);

    res.json({
      summary: totalCounts.rows[0],
      fileValidations: fileValidations.rows,
      ediValidations: ediValidations.rows,
      businessValidations: businessValidations.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/validation-logs/all/:fileId
 * @desc    Get all validation logs for a file (combined view)
 * @access  Private
 */
router.get('/all/:fileId', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { page = 1, limit = 50, severity, type } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE file_id = $1';
    const params = [fileId];
    let paramCount = 1;

    if (severity) {
      paramCount++;
      whereClause += ` AND severity = $${paramCount}`;
      params.push(severity);
    }

    if (type) {
      paramCount++;
      whereClause += ` AND log_type = $${paramCount}`;
      params.push(type);
    }

    // Combined query using UNION ALL
    const query = `
      SELECT * FROM (
        SELECT
          validation_id,
          file_id,
          NULL::uuid as claim_id,
          'FILE' as log_type,
          validation_type,
          validation_rule as rule_name,
          NULL as segment_id,
          NULL as field_name,
          error_message,
          severity,
          error_location as details,
          llmsummary,
          validated_at
        FROM FileValidationLog
        WHERE file_id = $1

        UNION ALL

        SELECT
          validation_id,
          file_id,
          claim_id,
          'EDI' as log_type,
          validation_type,
          validation_rule as rule_name,
          segment_id,
          NULL as field_name,
          error_message,
          severity,
          error_location as details,
          NULL as llmsummary,
          validated_at
        FROM EDIValidationLog
        WHERE file_id = $1

        UNION ALL

        SELECT
          bvl.validation_id,
          ch.file_id,
          bvl.claim_id,
          'BUSINESS' as log_type,
          'BUSINESS_RULE' as validation_type,
          vr.rule_name,
          NULL as segment_id,
          bvl.field_name,
          bvl.error_message,
          bvl.severity,
          bvl.current_value as details,
          NULL as llmsummary,
          bvl.validated_at
        FROM BusinessValidationLog bvl
        JOIN ClaimHeader ch ON bvl.claim_id = ch.claim_id
        LEFT JOIN ValidationRules vr ON bvl.rule_id = vr.rule_id
        WHERE ch.file_id = $1
      ) combined
      ${severity ? `WHERE severity = $2` : ''}
      ${type ? `${severity ? 'AND' : 'WHERE'} log_type = $${severity ? 3 : 2}` : ''}
      ORDER BY validated_at DESC, severity DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) FROM (
        SELECT validation_id FROM FileValidationLog WHERE file_id = $1
        UNION ALL
        SELECT validation_id FROM EDIValidationLog WHERE file_id = $1
        UNION ALL
        SELECT bvl.validation_id
        FROM BusinessValidationLog bvl
        JOIN ClaimHeader ch ON bvl.claim_id = ch.claim_id
        WHERE ch.file_id = $1
      ) total
    `;

    const countResult = await pool.query(countQuery, [fileId]);

    res.json({
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
