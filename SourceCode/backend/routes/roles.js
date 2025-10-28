import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/v1/roles
 * @desc    Get all roles
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const {
      page,
      limit,
      search = '',
      sortField = 'role_name',
      sortOrder = 'asc',
    } = req.query;

    const queryParams = [];
    let whereClause = '';
    let paramIndex = 1;

    // Search filter
    if (search) {
      queryParams.push(`%${search}%`, `%${search}%`);
      whereClause = `WHERE role_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex + 1}`;
      paramIndex += 2;
    }

    // Validate sort field
    const allowedSortFields = ['role_name', 'created_at'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'role_name';
    const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // If pagination is requested
    if (page && limit) {
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM UserRole ${whereClause}`;
      const countResult = await pool.query(countQuery, queryParams);
      const totalRoles = parseInt(countResult.rows[0].total);

      // Get roles with user count
      queryParams.push(parseInt(limit), offset);
      const rolesQuery = `
        SELECT
          ur.role_id,
          ur.role_name,
          ur.description,
          ur.permissions,
          ur.created_at,
          ur.updated_at,
          COUNT(urm.user_id) as user_count
        FROM UserRole ur
        LEFT JOIN UserRoleMapping urm ON ur.role_id = urm.role_id
        ${whereClause}
        GROUP BY ur.role_id, ur.role_name, ur.description, ur.permissions, ur.created_at, ur.updated_at
        ORDER BY ur.${validSortField} ${validSortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const rolesResult = await pool.query(rolesQuery, queryParams);

      return res.json({
        roles: rolesResult.rows,
        pagination: {
          total: totalRoles,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalRoles / parseInt(limit)),
        },
      });
    }

    // Return all roles without pagination (for dropdowns)
    const rolesQuery = `
      SELECT
        ur.role_id,
        ur.role_name,
        ur.description,
        ur.permissions,
        ur.created_at,
        ur.updated_at,
        COUNT(urm.user_id) as user_count
      FROM UserRole ur
      LEFT JOIN UserRoleMapping urm ON ur.role_id = urm.role_id
      ${whereClause}
      GROUP BY ur.role_id, ur.role_name, ur.description, ur.permissions, ur.created_at, ur.updated_at
      ORDER BY ur.${validSortField} ${validSortOrder}
    `;

    const rolesResult = await pool.query(rolesQuery, queryParams);

    res.json({ roles: rolesResult.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/roles/:id
 * @desc    Get single role by ID
 * @access  Private
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const roleQuery = `
      SELECT
        ur.*,
        COUNT(urm.user_id) as user_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'user_id', u.user_id,
              'username', u.username,
              'email', u.email,
              'first_name', u.first_name,
              'last_name', u.last_name
            )
          ) FILTER (WHERE u.user_id IS NOT NULL),
          '[]'
        ) as assigned_users
      FROM UserRole ur
      LEFT JOIN UserRoleMapping urm ON ur.role_id = urm.role_id
      LEFT JOIN Users u ON urm.user_id = u.user_id
      WHERE ur.role_id = $1
      GROUP BY ur.role_id
    `;

    const result = await pool.query(roleQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/roles
 * @desc    Create new role
 * @access  Private
 */
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { role_name, description, permissions = {} } = req.body;

    // Validation
    if (!role_name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Check if role name already exists
    const existingRole = await pool.query(
      'SELECT role_id FROM UserRole WHERE role_name = $1',
      [role_name]
    );

    if (existingRole.rows.length > 0) {
      return res.status(409).json({ error: 'Role name already exists' });
    }

    // Validate permissions is valid JSON
    let permissionsJson = permissions;
    if (typeof permissions === 'string') {
      try {
        permissionsJson = JSON.parse(permissions);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid permissions JSON format' });
      }
    }

    const insertQuery = `
      INSERT INTO UserRole (role_name, description, permissions)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      role_name,
      description,
      JSON.stringify(permissionsJson),
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/v1/roles/:id
 * @desc    Update role
 * @access  Private
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role_name, description, permissions } = req.body;

    // Check if role exists
    const roleExists = await pool.query('SELECT role_id FROM UserRole WHERE role_id = $1', [id]);
    if (roleExists.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Check for duplicate role name (excluding current role)
    if (role_name) {
      const duplicateCheck = await pool.query(
        'SELECT role_id FROM UserRole WHERE role_name = $1 AND role_id != $2',
        [role_name, id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Role name already exists' });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (role_name !== undefined) {
      updateFields.push(`role_name = $${paramIndex}`);
      updateValues.push(role_name);
      paramIndex++;
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(description);
      paramIndex++;
    }
    if (permissions !== undefined) {
      let permissionsJson = permissions;
      if (typeof permissions === 'string') {
        try {
          permissionsJson = JSON.parse(permissions);
        } catch (e) {
          return res.status(400).json({ error: 'Invalid permissions JSON format' });
        }
      }
      updateFields.push(`permissions = $${paramIndex}`);
      updateValues.push(JSON.stringify(permissionsJson));
      paramIndex++;
    }

    // Always update updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add role_id for WHERE clause
    updateValues.push(id);

    const updateQuery = `
      UPDATE UserRole
      SET ${updateFields.join(', ')}
      WHERE role_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/roles/:id
 * @desc    Delete role (only if no users assigned)
 * @access  Private
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if role has any users assigned
    const usersCount = await pool.query(
      'SELECT COUNT(*) as count FROM UserRoleMapping WHERE role_id = $1',
      [id]
    );

    if (parseInt(usersCount.rows[0].count) > 0) {
      return res.status(400).json({
        error: `Cannot delete role. ${usersCount.rows[0].count} user(s) are assigned to this role.`,
        user_count: parseInt(usersCount.rows[0].count),
      });
    }

    const result = await pool.query(
      'DELETE FROM UserRole WHERE role_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json({ message: 'Role deleted successfully', role: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/roles/:id/users
 * @desc    Get all users assigned to a role
 * @access  Private
 */
router.get('/:id/users', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const usersQuery = `
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        urm.assigned_at,
        assigner.username as assigned_by
      FROM UserRoleMapping urm
      JOIN Users u ON urm.user_id = u.user_id
      LEFT JOIN Users assigner ON urm.assigned_by = assigner.user_id
      WHERE urm.role_id = $1
      ORDER BY urm.assigned_at DESC
    `;

    const result = await pool.query(usersQuery, [id]);

    res.json({ users: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
