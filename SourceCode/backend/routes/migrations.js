import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/v1/migrations/add-facility-to-provider
 * @desc    Run migration to add facility_id to Provider table
 * @access  Private (Admin only)
 */
router.post('/add-facility-to-provider', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Running migration: add_facility_to_provider');

    // Check if column already exists
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'provider' AND column_name = 'facility_id'
    `;

    const checkResult = await client.query(checkQuery);

    if (checkResult.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Migration already applied - facility_id column already exists',
        alreadyExists: true
      });
    }

    // Run the migration
    await client.query('BEGIN');

    // Add facility_id column
    await client.query(`
      ALTER TABLE Provider
      ADD COLUMN facility_id UUID REFERENCES Facilities(facility_id)
    `);

    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_provider_facility_id ON Provider(facility_id)
    `);

    await client.query('COMMIT');

    console.log('✅ Migration completed successfully');

    res.json({
      success: true,
      message: 'Migration completed successfully - facility_id column added to Provider table',
      changes: [
        'Added facility_id column to Provider table',
        'Created index on facility_id'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * @route   GET /api/v1/migrations/status
 * @desc    Check migration status
 * @access  Private
 */
router.get('/status', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const query = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'provider' AND column_name = 'facility_id'
    `;

    const result = await client.query(query);

    res.json({
      facility_id_exists: result.rows.length > 0,
      message: result.rows.length > 0
        ? 'facility_id column exists in Provider table'
        : 'facility_id column NOT found in Provider table'
    });

  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
});

export default router;
