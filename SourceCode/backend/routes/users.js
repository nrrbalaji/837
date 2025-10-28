import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with pagination and filters
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      isActive = '',
      sortField = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const queryParams = [];
    let whereConditions = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (search) {
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      whereConditions.push(
        `(u.username ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex + 1} OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIndex + 2})`
      );
      paramIndex += 3;
    }

    if (isActive !== '') {
      queryParams.push(isActive === 'true');
      whereConditions.push(`u.is_active = $${paramIndex}`);
      paramIndex += 1;
    }

    // Role filter - join with UserRoleMapping
    let roleJoin = '';
    if (role) {
      roleJoin = `
        INNER JOIN UserRoleMapping urm ON u.user_id = urm.user_id
        INNER JOIN UserRole ur ON urm.role_id = ur.role_id
      `;
      queryParams.push(role);
      whereConditions.push(`ur.role_id = $${paramIndex}`);
      paramIndex += 1;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validate sort field to prevent SQL injection
    const allowedSortFields = ['username', 'email', 'first_name', 'last_name', 'created_at', 'last_login', 'is_active'];
    const validSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';
    const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT u.user_id) as total
      FROM Users u
      ${roleJoin}
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const totalUsers = parseInt(countResult.rows[0].total);

    // Get users with their roles and facilities
    queryParams.push(parseInt(limit), offset);
    const usersQuery = `
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'role_id', ur.role_id,
              'role_name', ur.role_name
            )
          ) FILTER (WHERE ur.role_id IS NOT NULL),
          '[]'
        ) as roles,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'facility_id', f.facility_id,
              'facility_code', f.facility_code,
              'facility_name', f.facility_name
            )
          ) FILTER (WHERE f.facility_id IS NOT NULL),
          '[]'
        ) as facilities
      FROM Users u
      ${roleJoin}
      LEFT JOIN UserRoleMapping urm2 ON u.user_id = urm2.user_id
      LEFT JOIN UserRole ur ON urm2.role_id = ur.role_id
      LEFT JOIN UserFacilityMapping ufm ON u.user_id = ufm.user_id
      LEFT JOIN Facilities f ON ufm.facility_id = f.facility_id
      ${whereClause}
      GROUP BY u.user_id, u.username, u.email, u.first_name, u.last_name, u.is_active, u.last_login, u.created_at, u.updated_at
      ORDER BY u.${validSortField} ${validSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const usersResult = await pool.query(usersQuery, queryParams);

    res.json({
      users: usersResult.rows,
      pagination: {
        total: totalUsers,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get single user by ID
 * @access  Private
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const userQuery = `
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        creator.username as created_by_username,
        updater.username as updated_by_username,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'role_id', ur.role_id,
              'role_name', ur.role_name,
              'description', ur.description,
              'permissions', ur.permissions
            )
          ) FILTER (WHERE ur.role_id IS NOT NULL),
          '[]'
        ) as roles
      FROM Users u
      LEFT JOIN Users creator ON u.created_by = creator.user_id
      LEFT JOIN Users updater ON u.updated_by = updater.user_id
      LEFT JOIN UserRoleMapping urm ON u.user_id = urm.user_id
      LEFT JOIN UserRole ur ON urm.role_id = ur.role_id
      WHERE u.user_id = $1
      GROUP BY u.user_id, creator.username, updater.username
    `;

    const result = await pool.query(userQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/users
 * @desc    Create new user
 * @access  Private
 */
router.post('/', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      username,
      email,
      password,
      first_name,
      last_name,
      is_active = true,
      role_ids = [],
    } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password strength validation (minimum 8 characters)
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    await client.query('BEGIN');

    // Check if username or email already exists
    const existingUser = await client.query(
      'SELECT user_id FROM Users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const insertUserQuery = `
      INSERT INTO Users (
        username, email, password_hash, first_name, last_name, is_active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING user_id, username, email, first_name, last_name, is_active, created_at
    `;

    const userResult = await client.query(insertUserQuery, [
      username,
      email,
      password_hash,
      first_name,
      last_name,
      is_active,
      req.user.user_id,
    ]);

    const newUser = userResult.rows[0];

    // Assign roles if provided
    if (role_ids && role_ids.length > 0) {
      for (const role_id of role_ids) {
        await client.query(
          'INSERT INTO UserRoleMapping (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
          [newUser.user_id, role_id, req.user.user_id]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch complete user data with roles
    const completeUserQuery = `
      SELECT
        u.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'role_id', ur.role_id,
              'role_name', ur.role_name
            )
          ) FILTER (WHERE ur.role_id IS NOT NULL),
          '[]'
        ) as roles
      FROM Users u
      LEFT JOIN UserRoleMapping urm ON u.user_id = urm.user_id
      LEFT JOIN UserRole ur ON urm.role_id = ur.role_id
      WHERE u.user_id = $1
      GROUP BY u.user_id
    `;

    const completeUser = await pool.query(completeUserQuery, [newUser.user_id]);

    res.status(201).json(completeUser.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user
 * @access  Private
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      username,
      email,
      first_name,
      last_name,
      is_active,
      password, // Optional - only if changing password
      role_ids,
    } = req.body;

    await client.query('BEGIN');

    // Check if user exists
    const userExists = await client.query('SELECT user_id FROM Users WHERE user_id = $1', [id]);
    if (userExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for duplicate username/email (excluding current user)
    if (username || email) {
      const duplicateCheck = await client.query(
        'SELECT user_id FROM Users WHERE (username = $1 OR email = $2) AND user_id != $3',
        [username, email, id]
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Username or email already exists' });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (username !== undefined) {
      updateFields.push(`username = $${paramIndex}`);
      updateValues.push(username);
      paramIndex++;
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex}`);
      updateValues.push(email);
      paramIndex++;
    }
    if (first_name !== undefined) {
      updateFields.push(`first_name = $${paramIndex}`);
      updateValues.push(first_name);
      paramIndex++;
    }
    if (last_name !== undefined) {
      updateFields.push(`last_name = $${paramIndex}`);
      updateValues.push(last_name);
      paramIndex++;
    }
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      updateValues.push(is_active);
      paramIndex++;
    }
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updateFields.push(`password_hash = $${paramIndex}`);
      updateValues.push(password_hash);
      paramIndex++;
    }

    // Always update updated_by and updated_at
    updateFields.push(`updated_by = $${paramIndex}`);
    updateValues.push(req.user.user_id);
    paramIndex++;

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add user_id for WHERE clause
    updateValues.push(id);

    const updateQuery = `
      UPDATE Users
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING *
    `;

    await client.query(updateQuery, updateValues);

    // Update roles if provided
    if (role_ids !== undefined) {
      // Remove existing roles
      await client.query('DELETE FROM UserRoleMapping WHERE user_id = $1', [id]);

      // Add new roles
      if (role_ids.length > 0) {
        for (const role_id of role_ids) {
          await client.query(
            'INSERT INTO UserRoleMapping (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
            [id, role_id, req.user.user_id]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Fetch updated user with roles
    const updatedUserQuery = `
      SELECT
        u.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'role_id', ur.role_id,
              'role_name', ur.role_name
            )
          ) FILTER (WHERE ur.role_id IS NOT NULL),
          '[]'
        ) as roles
      FROM Users u
      LEFT JOIN UserRoleMapping urm ON u.user_id = urm.user_id
      LEFT JOIN UserRole ur ON urm.role_id = ur.role_id
      WHERE u.user_id = $1
      GROUP BY u.user_id
    `;

    const result = await pool.query(updatedUserQuery, [id]);

    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Deactivate user (soft delete)
 * @access  Private
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.user_id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const result = await pool.query(
      'UPDATE Users SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING *',
      [req.user.user_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deactivated successfully', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/users/:id/audit
 * @desc    Get audit trail for user
 * @access  Private
 */
router.get('/:id/audit', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const auditQuery = `
      SELECT
        u.created_at,
        u.updated_at,
        creator.username as created_by,
        updater.username as updated_by
      FROM Users u
      LEFT JOIN Users creator ON u.created_by = creator.user_id
      LEFT JOIN Users updater ON u.updated_by = updater.user_id
      WHERE u.user_id = $1
    `;

    const result = await pool.query(auditQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
