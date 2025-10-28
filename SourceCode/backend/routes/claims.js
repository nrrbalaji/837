import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { validateClaim, validateX12Structure, validateWithLLM } from '../services/validation.js';
import { autoCorrectClaim, manualCorrection } from '../services/correction.js';
import parsing837 from '../services/parsing837.js';
import fs from 'fs/promises';

const { extractClaims } = parsing837;

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/v1/claims
 * @desc    Get all claims with filters and pagination
 * @access  Private
 */
router.get('/', validateRequest(schemas.pagination), async (req, res, next) => {
  try {
    const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const { status, facilityId, payerId, dateFrom, dateTo } = req.query;
    const offset = (page - 1) * limit;

    // Build query with filters
    let query = `
      SELECT
        ch.claim_id,
        ch.claim_number,
        ch.claim_type,
        ch.claim_status,
        ch.validation_status,
        ch.correction_status,
        ch.transmission_status,
        ch.total_charge,
        ch.service_date_from,
        ch.service_date_to,
        ch.created_at,
        f.facility_name,
        p.payer_name,
        pr.first_name || ' ' || pr.last_name as provider_name
      FROM ClaimHeader ch
      LEFT JOIN Facilities f ON ch.facility_id = f.facility_id
      LEFT JOIN Payer p ON ch.payer_id = p.payer_id
      LEFT JOIN Provider pr ON ch.provider_id = pr.provider_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND ch.claim_status = $${paramCount}`;
      params.push(status);
    }

    if (facilityId) {
      paramCount++;
      query += ` AND ch.facility_id = $${paramCount}`;
      params.push(facilityId);
    }

    if (payerId) {
      paramCount++;
      query += ` AND ch.payer_id = $${paramCount}`;
      params.push(payerId);
    }

    if (dateFrom) {
      paramCount++;
      query += ` AND ch.service_date_from >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      query += ` AND ch.service_date_to <= $${paramCount}`;
      params.push(dateTo);
    }

    query += ` ORDER BY ch.${sortBy} ${sortOrder}`;
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = query.split('ORDER BY')[0].replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params.slice(0, paramCount));

    res.json({
      claims: result.rows,
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

/**
 * @route   GET /api/v1/claims/:id
 * @desc    Get single claim details
 * @access  Private
 */
router.get('/:id', validateRequest(schemas.uuidParam), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        ch.*,
        json_agg(DISTINCT cl.*) FILTER (WHERE cl.line_id IS NOT NULL) as service_lines,
        json_agg(DISTINCT cd.*) FILTER (WHERE cd.diagnosis_id IS NOT NULL) as diagnoses,
        f.facility_name,
        p.payer_name,
        pr.first_name || ' ' || pr.last_name as provider_name
      FROM ClaimHeader ch
      LEFT JOIN ClaimLine cl ON ch.claim_id = cl.claim_id
      LEFT JOIN ClaimDiagnosis cd ON ch.claim_id = cd.claim_id
      LEFT JOIN Facilities f ON ch.facility_id = f.facility_id
      LEFT JOIN Payer p ON ch.payer_id = p.payer_id
      LEFT JOIN Provider pr ON ch.provider_id = pr.provider_id
      WHERE ch.claim_id = $1
      GROUP BY ch.claim_id, f.facility_name, p.payer_name, pr.first_name, pr.last_name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/claims/:id/validate
 * @desc    Validate a claim
 * @access  Private
 */
router.post('/:id/validate', validateRequest(schemas.uuidParam), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await validateClaim(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/claims/:id/revalidate
 * @desc    Re-validate a claim by clearing validation logs and running validations from parsed JSON
 * @access  Private
 */
router.post('/:id/revalidate', validateRequest(schemas.uuidParam), async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Step 1: Get claim and file information
    const claimResult = await client.query(
      `SELECT ch.claim_id, ch.file_id, ufd.file_id, ufd.file_name, ufd.file_path, ufd.parsed_json
       FROM ClaimHeader ch
       JOIN UploadFileDetail ufd ON ch.file_id = ufd.file_id
       WHERE ch.claim_id = $1`,
      [id]
    );

    if (claimResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Claim not found' });
    }

    const claimData = claimResult.rows[0];
    const fileId = claimData.file_id;
    const fileName = claimData.file_name;
    const filePath = claimData.file_path;
    const parsedJson = claimData.parsed_json;

    if (!parsedJson) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No parsed JSON found for this claim' });
    }

    // Step 2: Clear existing validation logs
    console.log(`Clearing validation logs for claim ${id} and file ${fileId}`);

    await client.query(
      'DELETE FROM EDIValidationLog WHERE file_id = $1 OR claim_id = $2',
      [fileId, id]
    );

    await client.query(
      'DELETE FROM BusinessValidationLog WHERE claim_id = $1',
      [id]
    );

    await client.query('COMMIT');

    console.log('Validation logs cleared successfully');

    // Step 3: Read file content for X12 validation
    let fileContent = null;
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch (fileError) {
      console.warn(`Could not read file from path: ${filePath}. Will skip X12 structure validation.`);
    }

    // Step 4: Run validations
    const validationResults = {
      x12Validation: null,
      llmValidation: null,
      businessValidation: null,
      success: true,
      message: 'Re-validation completed'
    };

    // 4a. X12 Structure Validation (if file content is available)
    if (fileContent) {
      try {
        console.log('Running X12 structure validation...');
        validationResults.x12Validation = await validateX12Structure(fileContent, fileId);
        console.log(`X12 validation completed: ${validationResults.x12Validation.summary.errorCount} errors found`);
      } catch (x12Error) {
        console.error('X12 validation error:', x12Error);
        validationResults.x12Validation = {
          error: x12Error.message,
          isValid: false
        };
      }
    } else {
      validationResults.x12Validation = {
        skipped: true,
        message: 'File content not available'
      };
    }

    // 4b. LLM Validation
    try {
      console.log('Running LLM validation...');
      // Check if parsedJson has claims array, if not provide empty array
      let claims = [];
      if (parsedJson && parsedJson.claims && Array.isArray(parsedJson.claims)) {
        claims = extractClaims(parsedJson);
      } else {
        console.warn('Parsed JSON does not have valid claims array structure');
      }

      // Ensure parsedJson has required structure for LLM validation
      if (!parsedJson.isa) {
        parsedJson.isa = { interchangeControlVersion: '00501' };
      } else if (!parsedJson.isa.interchangeControlVersion) {
        parsedJson.isa.interchangeControlVersion = '00501';
      }

      validationResults.llmValidation = await validateWithLLM(
        fileName,
        fileId,
        parsedJson,
        claims
      );
      console.log(`LLM validation completed: ${validationResults.llmValidation.issues?.length || 0} issues found`);
    } catch (llmError) {
      console.error('LLM validation error:', llmError);
      validationResults.llmValidation = {
        error: llmError.message,
        isValid: false
      };
    }

    // 4c. Business Rule Validation
    try {
      console.log('Running business rule validation...');
      validationResults.businessValidation = await validateClaim(id);
      console.log(`Business validation completed: ${validationResults.businessValidation.status}`);
    } catch (businessError) {
      console.error('Business validation error:', businessError);
      validationResults.businessValidation = {
        error: businessError.message,
        status: 'ERROR'
      };
    }

    // Step 5: Return results
    res.json(validationResults);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Re-validation error:', error);
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   POST /api/v1/claims/:id/auto-correct
 * @desc    Auto-correct a claim
 * @access  Private
 */
router.post('/:id/auto-correct', validateRequest(schemas.uuidParam), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await autoCorrectClaim(id, req.user.user_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/v1/claims/:id/correct
 * @desc    Manually correct a claim field
 * @access  Private
 */
router.put('/:id/correct', validateRequest(schemas.claimCorrection), authorizeRoles('Admin', 'Analyst'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fieldName, newValue, correctionReason } = req.body;

    const result = await manualCorrection(
      id,
      fieldName,
      newValue,
      correctionReason || 'Manual correction',
      req.user.user_id
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/claims/:id/history
 * @desc    Get claim correction history
 * @access  Private
 */
router.get('/:id/history', validateRequest(schemas.uuidParam), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        cl.*,
        u.username as corrected_by_username
      FROM CorrectionLog cl
      LEFT JOIN Users u ON cl.corrected_by = u.user_id
      WHERE cl.claim_id = $1
      ORDER BY cl.corrected_at DESC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/claims/:id
 * @desc    Delete a claim (soft delete)
 * @access  Admin only
 */
router.delete('/:id', validateRequest(schemas.uuidParam), authorizeRoles('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    await pool.query(
      'UPDATE ClaimHeader SET claim_status = $1 WHERE claim_id = $2',
      ['DELETED', id]
    );

    res.json({ message: 'Claim deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
