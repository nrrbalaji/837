import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/v1/user-roles/:userId
 * @desc    Get all roles for a specific user with audit info
 * @access  Private
 */
router.get('/:userId', authenticateToken, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const rolesQuery = `
      SELECT
        ur.role_id,
        ur.role_name,
        ur.description,
        ur.permissions,
        urm.assigned_at,
        assigner.user_id as assigned_by_id,
        assigner.username as assigned_by_username,
        assigner.first_name as assigned_by_first_name,
        assigner.last_name as assigned_by_last_name
      FROM UserRoleMapping urm
      JOIN UserRole ur ON urm.role_id = ur.role_id
      LEFT JOIN Users assigner ON urm.assigned_by = assigner.user_id
      WHERE urm.user_id = $1
      ORDER BY urm.assigned_at DESC
    `;

    const result = await pool.query(rolesQuery, [userId]);

    res.json({ roles: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/user-roles/:userId/assign
 * @desc    Assign role(s) to a user
 * @access  Private
 */
router.post('/:userId/assign', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { role_ids } = req.body;

    if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
      return res.status(400).json({ error: 'role_ids array is required' });
    }

    await client.query('BEGIN');

    // Check if user exists
    const userExists = await client.query('SELECT user_id FROM Users WHERE user_id = $1', [userId]);
    if (userExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if all roles exist
    const rolesExist = await client.query(
      'SELECT role_id FROM UserRole WHERE role_id = ANY($1::uuid[])',
      [role_ids]
    );

    if (rolesExist.rows.length !== role_ids.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or more roles not found' });
    }

    const assignedRoles = [];

    for (const role_id of role_ids) {
      // Check if role is already assigned
      const existingAssignment = await client.query(
        'SELECT * FROM UserRoleMapping WHERE user_id = $1 AND role_id = $2',
        [userId, role_id]
      );

      if (existingAssignment.rows.length === 0) {
        // Assign role
        const result = await client.query(
          `INSERT INTO UserRoleMapping (user_id, role_id, assigned_by)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [userId, role_id, req.user.user_id]
        );
        assignedRoles.push(result.rows[0]);
      }
    }

    await client.query('COMMIT');

    // Fetch updated user roles with full details
    const updatedRolesQuery = `
      SELECT
        ur.role_id,
        ur.role_name,
        ur.description,
        ur.permissions,
        urm.assigned_at,
        assigner.username as assigned_by_username
      FROM UserRoleMapping urm
      JOIN UserRole ur ON urm.role_id = ur.role_id
      LEFT JOIN Users assigner ON urm.assigned_by = assigner.user_id
      WHERE urm.user_id = $1
      ORDER BY urm.assigned_at DESC
    `;

    const updatedRoles = await pool.query(updatedRolesQuery, [userId]);

    res.json({
      message: `${assignedRoles.length} role(s) assigned successfully`,
      assigned_count: assignedRoles.length,
      roles: updatedRoles.rows,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   DELETE /api/v1/user-roles/:userId/roles/:roleId
 * @desc    Remove a role from a user
 * @access  Private
 */
router.delete('/:userId/roles/:roleId', authenticateToken, async (req, res, next) => {
  try {
    const { userId, roleId } = req.params;

    // Check if assignment exists
    const assignmentExists = await pool.query(
      'SELECT * FROM UserRoleMapping WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );

    if (assignmentExists.rows.length === 0) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }

    // Delete the assignment
    await pool.query(
      'DELETE FROM UserRoleMapping WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );

    // Fetch remaining roles
    const remainingRolesQuery = `
      SELECT
        ur.role_id,
        ur.role_name,
        ur.description,
        ur.permissions,
        urm.assigned_at,
        assigner.username as assigned_by_username
      FROM UserRoleMapping urm
      JOIN UserRole ur ON urm.role_id = ur.role_id
      LEFT JOIN Users assigner ON urm.assigned_by = assigner.user_id
      WHERE urm.user_id = $1
      ORDER BY urm.assigned_at DESC
    `;

    const remainingRoles = await pool.query(remainingRolesQuery, [userId]);

    res.json({
      message: 'Role removed successfully',
      roles: remainingRoles.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/v1/user-roles/:userId/replace
 * @desc    Replace all user roles with new set
 * @access  Private
 */
router.put('/:userId/replace', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { role_ids } = req.body;

    if (!Array.isArray(role_ids)) {
      return res.status(400).json({ error: 'role_ids must be an array' });
    }

    await client.query('BEGIN');

    // Check if user exists
    const userExists = await client.query('SELECT user_id FROM Users WHERE user_id = $1', [userId]);
    if (userExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove all existing roles
    await client.query('DELETE FROM UserRoleMapping WHERE user_id = $1', [userId]);

    // Add new roles
    if (role_ids.length > 0) {
      // Check if all roles exist
      const rolesExist = await client.query(
        'SELECT role_id FROM UserRole WHERE role_id = ANY($1::uuid[])',
        [role_ids]
      );

      if (rolesExist.rows.length !== role_ids.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'One or more roles not found' });
      }

      for (const role_id of role_ids) {
        await client.query(
          `INSERT INTO UserRoleMapping (user_id, role_id, assigned_by)
           VALUES ($1, $2, $3)`,
          [userId, role_id, req.user.user_id]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch new roles with full details
    const newRolesQuery = `
      SELECT
        ur.role_id,
        ur.role_name,
        ur.description,
        ur.permissions,
        urm.assigned_at,
        assigner.username as assigned_by_username
      FROM UserRoleMapping urm
      JOIN UserRole ur ON urm.role_id = ur.role_id
      LEFT JOIN Users assigner ON urm.assigned_by = assigner.user_id
      WHERE urm.user_id = $1
      ORDER BY urm.assigned_at DESC
    `;

    const newRoles = await pool.query(newRolesQuery, [userId]);

    res.json({
      message: 'User roles updated successfully',
      roles: newRoles.rows,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   GET /api/v1/user-roles/:userId/available
 * @desc    Get roles that are NOT assigned to the user
 * @access  Private
 */
router.get('/:userId/available', authenticateToken, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const availableRolesQuery = `
      SELECT
        ur.role_id,
        ur.role_name,
        ur.description
      FROM UserRole ur
      WHERE ur.role_id NOT IN (
        SELECT role_id
        FROM UserRoleMapping
        WHERE user_id = $1
      )
      ORDER BY ur.role_name ASC
    `;

    const result = await pool.query(availableRolesQuery, [userId]);

    res.json({ roles: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
