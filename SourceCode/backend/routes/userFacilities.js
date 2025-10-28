import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/v1/user-facilities/:userId
 * @desc    Get all facilities assigned to a specific user
 * @access  Private
 */
router.get('/:userId', authenticateToken, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const facilitiesQuery = `
      SELECT
        f.facility_id,
        f.facility_code,
        f.facility_name,
        f.facility_type,
        f.city,
        f.state,
        ufm.assigned_at,
        assigner.user_id as assigned_by_id,
        assigner.username as assigned_by_username,
        assigner.first_name as assigned_by_first_name,
        assigner.last_name as assigned_by_last_name
      FROM UserFacilityMapping ufm
      JOIN Facilities f ON ufm.facility_id = f.facility_id
      LEFT JOIN Users assigner ON ufm.assigned_by = assigner.user_id
      WHERE ufm.user_id = $1
      ORDER BY f.facility_name ASC
    `;

    const result = await pool.query(facilitiesQuery, [userId]);

    res.json({ facilities: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/user-facilities/:userId/assign
 * @desc    Assign facilities to a user
 * @access  Private (Admin only)
 */
router.post('/:userId/assign', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { facility_ids } = req.body;

    if (!facility_ids || !Array.isArray(facility_ids)) {
      return res.status(400).json({ error: 'facility_ids array is required' });
    }

    await client.query('BEGIN');

    // Check if user exists
    const userExists = await client.query('SELECT user_id FROM Users WHERE user_id = $1', [userId]);
    if (userExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if all facilities exist
    if (facility_ids.length > 0) {
      const facilitiesExist = await client.query(
        'SELECT facility_id FROM Facilities WHERE facility_id = ANY($1::uuid[])',
        [facility_ids]
      );

      if (facilitiesExist.rows.length !== facility_ids.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'One or more facilities not found' });
      }
    }

    const assignedFacilities = [];

    for (const facility_id of facility_ids) {
      // Check if facility is already assigned
      const existingAssignment = await client.query(
        'SELECT * FROM UserFacilityMapping WHERE user_id = $1 AND facility_id = $2',
        [userId, facility_id]
      );

      if (existingAssignment.rows.length === 0) {
        // Assign facility
        const result = await client.query(
          `INSERT INTO UserFacilityMapping (user_id, facility_id, assigned_by)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [userId, facility_id, req.user.user_id]
        );
        assignedFacilities.push(result.rows[0]);
      }
    }

    await client.query('COMMIT');

    // Fetch updated user facilities with full details
    const updatedFacilitiesQuery = `
      SELECT
        f.facility_id,
        f.facility_code,
        f.facility_name,
        f.facility_type,
        f.city,
        f.state,
        ufm.assigned_at,
        assigner.username as assigned_by_username
      FROM UserFacilityMapping ufm
      JOIN Facilities f ON ufm.facility_id = f.facility_id
      LEFT JOIN Users assigner ON ufm.assigned_by = assigner.user_id
      WHERE ufm.user_id = $1
      ORDER BY f.facility_name ASC
    `;

    const updatedFacilities = await pool.query(updatedFacilitiesQuery, [userId]);

    res.json({
      message: `${assignedFacilities.length} facility(ies) assigned successfully`,
      assigned_count: assignedFacilities.length,
      facilities: updatedFacilities.rows,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   DELETE /api/v1/user-facilities/:userId/facilities/:facilityId
 * @desc    Remove a facility from a user
 * @access  Private (Admin only)
 */
router.delete('/:userId/facilities/:facilityId', authenticateToken, async (req, res, next) => {
  try {
    const { userId, facilityId } = req.params;

    // Check if assignment exists
    const assignmentExists = await pool.query(
      'SELECT * FROM UserFacilityMapping WHERE user_id = $1 AND facility_id = $2',
      [userId, facilityId]
    );

    if (assignmentExists.rows.length === 0) {
      return res.status(404).json({ error: 'Facility assignment not found' });
    }

    // Delete the assignment
    await pool.query(
      'DELETE FROM UserFacilityMapping WHERE user_id = $1 AND facility_id = $2',
      [userId, facilityId]
    );

    // Fetch remaining facilities
    const remainingFacilitiesQuery = `
      SELECT
        f.facility_id,
        f.facility_code,
        f.facility_name,
        f.facility_type,
        f.city,
        f.state,
        ufm.assigned_at,
        assigner.username as assigned_by_username
      FROM UserFacilityMapping ufm
      JOIN Facilities f ON ufm.facility_id = f.facility_id
      LEFT JOIN Users assigner ON ufm.assigned_by = assigner.user_id
      WHERE ufm.user_id = $1
      ORDER BY f.facility_name ASC
    `;

    const remainingFacilities = await pool.query(remainingFacilitiesQuery, [userId]);

    res.json({
      message: 'Facility removed successfully',
      facilities: remainingFacilities.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/v1/user-facilities/:userId/replace
 * @desc    Replace all user facilities with new set
 * @access  Private (Admin only)
 */
router.put('/:userId/replace', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { facility_ids } = req.body;

    if (!Array.isArray(facility_ids)) {
      return res.status(400).json({ error: 'facility_ids must be an array' });
    }

    await client.query('BEGIN');

    // Check if user exists
    const userExists = await client.query('SELECT user_id FROM Users WHERE user_id = $1', [userId]);
    if (userExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove all existing facilities
    await client.query('DELETE FROM UserFacilityMapping WHERE user_id = $1', [userId]);

    // Add new facilities
    if (facility_ids.length > 0) {
      // Check if all facilities exist
      const facilitiesExist = await client.query(
        'SELECT facility_id FROM Facilities WHERE facility_id = ANY($1::uuid[])',
        [facility_ids]
      );

      if (facilitiesExist.rows.length !== facility_ids.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'One or more facilities not found' });
      }

      for (const facility_id of facility_ids) {
        await client.query(
          `INSERT INTO UserFacilityMapping (user_id, facility_id, assigned_by)
           VALUES ($1, $2, $3)`,
          [userId, facility_id, req.user.user_id]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch new facilities with full details
    const newFacilitiesQuery = `
      SELECT
        f.facility_id,
        f.facility_code,
        f.facility_name,
        f.facility_type,
        f.city,
        f.state,
        ufm.assigned_at,
        assigner.username as assigned_by_username
      FROM UserFacilityMapping ufm
      JOIN Facilities f ON ufm.facility_id = f.facility_id
      LEFT JOIN Users assigner ON ufm.assigned_by = assigner.user_id
      WHERE ufm.user_id = $1
      ORDER BY f.facility_name ASC
    `;

    const newFacilities = await pool.query(newFacilitiesQuery, [userId]);

    res.json({
      message: 'User facilities updated successfully',
      facilities: newFacilities.rows,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   GET /api/v1/user-facilities/:userId/available
 * @desc    Get facilities that are NOT assigned to the user
 * @access  Private
 */
router.get('/:userId/available', authenticateToken, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const availableFacilitiesQuery = `
      SELECT
        f.facility_id,
        f.facility_code,
        f.facility_name,
        f.facility_type,
        f.city,
        f.state
      FROM Facilities f
      WHERE f.facility_id NOT IN (
        SELECT facility_id
        FROM UserFacilityMapping
        WHERE user_id = $1
      )
      AND f.is_active = true
      ORDER BY f.facility_name ASC
    `;

    const result = await pool.query(availableFacilitiesQuery, [userId]);

    res.json({ facilities: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/user-facilities/my-facilities
 * @desc    Get facilities accessible by the currently logged-in user
 * @access  Private
 */
router.get('/my-facilities/list', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    // Check if user is admin (has admin role)
    const rolesQuery = `
      SELECT ur.role_name
      FROM UserRoleMapping urm
      JOIN UserRole ur ON urm.role_id = ur.role_id
      WHERE urm.user_id = $1
    `;

    const rolesResult = await pool.query(rolesQuery, [userId]);
    const roles = rolesResult.rows.map(r => r.role_name.toLowerCase());
    const isAdmin = roles.some(role => role.includes('admin'));

    let facilitiesQuery;
    let queryParams;

    if (isAdmin) {
      // Admin sees all facilities
      facilitiesQuery = `
        SELECT
          facility_id,
          facility_code,
          facility_name,
          facility_type,
          city,
          state,
          is_active
        FROM Facilities
        WHERE is_active = true
        ORDER BY facility_name ASC
      `;
      queryParams = [];
    } else {
      // Non-admin sees only assigned facilities
      facilitiesQuery = `
        SELECT
          f.facility_id,
          f.facility_code,
          f.facility_name,
          f.facility_type,
          f.city,
          f.state,
          f.is_active
        FROM UserFacilityMapping ufm
        JOIN Facilities f ON ufm.facility_id = f.facility_id
        WHERE ufm.user_id = $1 AND f.is_active = true
        ORDER BY f.facility_name ASC
      `;
      queryParams = [userId];
    }

    const result = await pool.query(facilitiesQuery, queryParams);

    res.json({
      facilities: result.rows,
      is_admin: isAdmin,
      total: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
