import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 */
router.post('/login', validateRequest(schemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Find user
    const userResult = await pool.query(
      'SELECT user_id, username, email, password_hash, first_name, last_name, is_active FROM Users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'User account is inactive' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user roles
    const rolesResult = await pool.query(`
      SELECT ur.role_name, ur.permissions
      FROM UserRoleMapping urm
      JOIN UserRole ur ON urm.role_id = ur.role_id
      WHERE urm.user_id = $1
    `, [user.user_id]);

    // Get user assigned facilities
    const facilitiesResult = await pool.query(`
      SELECT f.facility_id, f.facility_code, f.facility_name
      FROM UserFacilityMapping ufm
      JOIN Facilities f ON ufm.facility_id = f.facility_id
      WHERE ufm.user_id = $1 AND f.is_active = true
      ORDER BY f.facility_name ASC
    `, [user.user_id]);

    // Update last login
    await pool.query(
      'UPDATE Users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Check if user is admin
    const roles = rolesResult.rows.map(r => r.role_name);
    const isAdmin = roles.some(role => role.toLowerCase().includes('admin'));

    res.json({
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roles: roles,
        permissions: rolesResult.rows[0]?.permissions || {},
        assignedFacilities: facilitiesResult.rows,
        isAdmin: isAdmin
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user details
 * @access  Private
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    // Get user roles
    const rolesResult = await pool.query(`
      SELECT ur.role_name, ur.permissions
      FROM UserRoleMapping urm
      JOIN UserRole ur ON urm.role_id = ur.role_id
      WHERE urm.user_id = $1
    `, [req.user.user_id]);

    // Get user assigned facilities
    const facilitiesResult = await pool.query(`
      SELECT f.facility_id, f.facility_code, f.facility_name
      FROM UserFacilityMapping ufm
      JOIN Facilities f ON ufm.facility_id = f.facility_id
      WHERE ufm.user_id = $1 AND f.is_active = true
      ORDER BY f.facility_name ASC
    `, [req.user.user_id]);

    // Check if user is admin
    const roles = rolesResult.rows.map(r => r.role_name);
    const isAdmin = roles.some(role => role.toLowerCase().includes('admin'));

    res.json({
      user: {
        id: req.user.user_id,
        username: req.user.username,
        email: req.user.email,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        roles: roles,
        permissions: rolesResult.rows[0]?.permissions || {},
        assignedFacilities: facilitiesResult.rows,
        isAdmin: isAdmin
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', (req, res) => {
  // Token is removed on client side
  // Can implement token blacklist here if needed
  res.json({ message: 'Logged out successfully' });
});

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Generate new token
    const newToken = jwt.sign(
      { userId: decoded.userId, username: decoded.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({ token: newToken });
  } catch (error) {
    next(error);
  }
});

export default router;
