import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * @route   GET /api/v1/rules/validation
 * @desc    Get all validation rules
 * @access  Private
 */
router.get('/validation', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT * FROM ValidationRules
      ORDER BY priority DESC, rule_code ASC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/rules/validation/:id
 * @desc    Get single validation rule by ID
 * @access  Private
 */
router.get('/validation/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT * FROM ValidationRules
      WHERE rule_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Validation rule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/rules/validation
 * @desc    Create new validation rule
 * @access  Admin only
 */
router.post('/validation', authorizeRoles('Admin'), async (req, res, next) => {
  try {
    const {
      rule_code,
      rule_name,
      rule_category,
      rule_type,
      description,
      field_name,
      field_path,
      segment_code,
      element_position,
      loop_level,
      applies_to_claim_type,
      validation_logic,
      error_message_template,
      severity,
      is_active,
      auto_correct_enabled,
      applies_to_payer,
      applies_to_facility,
      priority
    } = req.body;

    // Check if rule_code already exists
    const existingRule = await pool.query(
      'SELECT rule_id, rule_code FROM ValidationRules WHERE rule_code = $1',
      [rule_code]
    );

    if (existingRule.rows.length > 0) {
      return res.status(409).json({
        error: 'Duplicate rule code',
        message: `A validation rule with code '${rule_code}' already exists`,
        existing_rule_id: existingRule.rows[0].rule_id
      });
    }

    const result = await pool.query(`
      INSERT INTO ValidationRules (
        rule_code, rule_name, rule_category, rule_type, description,
        field_name, field_path, segment_code, element_position, loop_level,
        applies_to_claim_type, validation_logic, error_message_template,
        severity, is_active, auto_correct_enabled, applies_to_payer, applies_to_facility, priority,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      rule_code,
      rule_name,
      rule_category,
      rule_type,
      description,
      field_name,
      field_path,
      segment_code,
      element_position,
      loop_level,
      applies_to_claim_type || 'ALL',
      validation_logic ? JSON.stringify(validation_logic) : null,
      error_message_template,
      severity,
      is_active !== undefined ? is_active : true,
      auto_correct_enabled !== undefined ? auto_correct_enabled : false,
      applies_to_payer,
      applies_to_facility,
      priority || 100,
      req.user.user_id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Handle PostgreSQL unique constraint violation
    if (error.code === '23505' && error.constraint === 'validationrules_rule_code_key') {
      return res.status(409).json({
        error: 'Duplicate rule code',
        message: `A validation rule with this code already exists`
      });
    }
    next(error);
  }
});

/**
 * @route   PUT /api/v1/rules/validation/:id
 * @desc    Update validation rule
 * @access  Admin only
 */
router.put('/validation/:id', authorizeRoles('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      rule_name,
      rule_category,
      rule_type,
      description,
      field_name,
      field_path,
      segment_code,
      element_position,
      loop_level,
      applies_to_claim_type,
      validation_logic,
      error_message_template,
      severity,
      is_active,
      auto_correct_enabled,
      applies_to_payer,
      applies_to_facility,
      priority
    } = req.body;

    const result = await pool.query(`
      UPDATE ValidationRules
      SET
        rule_name = COALESCE($1, rule_name),
        rule_category = COALESCE($2, rule_category),
        rule_type = COALESCE($3, rule_type),
        description = COALESCE($4, description),
        field_name = COALESCE($5, field_name),
        field_path = COALESCE($6, field_path),
        segment_code = COALESCE($7, segment_code),
        element_position = COALESCE($8, element_position),
        loop_level = COALESCE($9, loop_level),
        applies_to_claim_type = COALESCE($10, applies_to_claim_type),
        validation_logic = COALESCE($11, validation_logic),
        error_message_template = COALESCE($12, error_message_template),
        severity = COALESCE($13, severity),
        is_active = COALESCE($14, is_active),
        auto_correct_enabled = COALESCE($15, auto_correct_enabled),
        applies_to_payer = COALESCE($16, applies_to_payer),
        applies_to_facility = COALESCE($17, applies_to_facility),
        priority = COALESCE($18, priority),
        updated_by = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE rule_id = $20
      RETURNING *
    `, [
      rule_name,
      rule_category,
      rule_type,
      description,
      field_name,
      field_path,
      segment_code,
      element_position,
      loop_level,
      applies_to_claim_type,
      validation_logic ? JSON.stringify(validation_logic) : null,
      error_message_template,
      severity,
      is_active,
      auto_correct_enabled,
      applies_to_payer,
      applies_to_facility,
      priority,
      req.user.user_id,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/rules/validation/:id
 * @desc    Delete validation rule
 * @access  Admin only
 */
router.delete('/validation/:id', authorizeRoles('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // First delete associated correction rules
    await pool.query(`
      DELETE FROM CorrectionRules
      WHERE validation_rule_id = $1
    `, [id]);

    // Then delete the validation rule
    const result = await pool.query(`
      DELETE FROM ValidationRules
      WHERE rule_id = $1
      RETURNING rule_id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Validation rule not found' });
    }

    res.json({ message: 'Validation rule deleted successfully', rule_id: result.rows[0].rule_id });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/rules/correction
 * @desc    Get all correction rules
 * @access  Private
 */
router.get('/correction', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, vr.rule_name as validation_rule_name
      FROM CorrectionRules cr
      LEFT JOIN ValidationRules vr ON cr.validation_rule_id = vr.rule_id
      ORDER BY cr.priority DESC, cr.rule_code ASC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/rules/correction/:id
 * @desc    Get single correction rule by ID
 * @access  Private
 */
router.get('/correction/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT cr.*, vr.rule_name as validation_rule_name
      FROM CorrectionRules cr
      LEFT JOIN ValidationRules vr ON cr.validation_rule_id = vr.rule_id
      WHERE cr.rule_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Correction rule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/rules/correction/by-validation/:id
 * @desc    Get correction rule by validation rule ID
 * @access  Private
 */
router.get('/correction/by-validation/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT * FROM CorrectionRules
      WHERE validation_rule_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Correction rule not found for this validation rule' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/rules/correction
 * @desc    Create new correction rule
 * @access  Admin only
 */
router.post('/correction', authorizeRoles('Admin'), async (req, res, next) => {
  try {
    const {
      rule_code,
      rule_name,
      validation_rule_id,
      correction_type,
      correction_source_type,
      correction_logic,
      lookup_table,
      lookup_column,
      default_value,
      fallback_strategy,
      requires_approval,
      is_test_mode,
      priority,
      is_active
    } = req.body;

    // Check if rule_code already exists
    const existingRule = await pool.query(
      'SELECT rule_id, rule_code FROM CorrectionRules WHERE rule_code = $1',
      [rule_code]
    );

    if (existingRule.rows.length > 0) {
      return res.status(409).json({
        error: 'Duplicate rule code',
        message: `A correction rule with code '${rule_code}' already exists`,
        existing_rule_id: existingRule.rows[0].rule_id
      });
    }

    const result = await pool.query(`
      INSERT INTO CorrectionRules (
        rule_code, rule_name, validation_rule_id, correction_type,
        correction_source_type, correction_logic, lookup_table, lookup_column,
        default_value, fallback_strategy, requires_approval, is_test_mode,
        priority, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      rule_code,
      rule_name,
      validation_rule_id,
      correction_type,
      correction_source_type,
      correction_logic ? JSON.stringify(correction_logic) : null,
      lookup_table,
      lookup_column,
      default_value,
      fallback_strategy,
      requires_approval !== undefined ? requires_approval : false,
      is_test_mode !== undefined ? is_test_mode : true,
      priority || 100,
      is_active !== undefined ? is_active : true,
      req.user.user_id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Handle PostgreSQL unique constraint violation
    if (error.code === '23505' && error.constraint === 'correctionrules_rule_code_key') {
      return res.status(409).json({
        error: 'Duplicate rule code',
        message: `A correction rule with this code already exists`
      });
    }
    next(error);
  }
});

/**
 * @route   PUT /api/v1/rules/correction/:id
 * @desc    Update correction rule
 * @access  Admin only
 */
router.put('/correction/:id', authorizeRoles('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      rule_name,
      correction_type,
      correction_source_type,
      correction_logic,
      lookup_table,
      lookup_column,
      default_value,
      fallback_strategy,
      requires_approval,
      is_test_mode,
      priority,
      is_active
    } = req.body;

    const result = await pool.query(`
      UPDATE CorrectionRules
      SET
        rule_name = COALESCE($1, rule_name),
        correction_type = COALESCE($2, correction_type),
        correction_source_type = COALESCE($3, correction_source_type),
        correction_logic = COALESCE($4, correction_logic),
        lookup_table = COALESCE($5, lookup_table),
        lookup_column = COALESCE($6, lookup_column),
        default_value = COALESCE($7, default_value),
        fallback_strategy = COALESCE($8, fallback_strategy),
        requires_approval = COALESCE($9, requires_approval),
        is_test_mode = COALESCE($10, is_test_mode),
        priority = COALESCE($11, priority),
        is_active = COALESCE($12, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE rule_id = $13
      RETURNING *
    `, [
      rule_name,
      correction_type,
      correction_source_type,
      correction_logic ? JSON.stringify(correction_logic) : null,
      lookup_table,
      lookup_column,
      default_value,
      fallback_strategy,
      requires_approval,
      is_test_mode,
      priority,
      is_active,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Correction rule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/rules/correction/:id
 * @desc    Delete correction rule
 * @access  Admin only
 */
router.delete('/correction/:id', authorizeRoles('Admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM CorrectionRules
      WHERE rule_id = $1
      RETURNING rule_id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Correction rule not found' });
    }

    res.json({ message: 'Correction rule deleted successfully', rule_id: result.rows[0].rule_id });
  } catch (error) {
    next(error);
  }
});

export default router;
