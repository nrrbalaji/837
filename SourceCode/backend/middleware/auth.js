import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user details from database
    const result = await pool.query(
      'SELECT user_id, username, email, first_name, last_name, is_active FROM Users WHERE user_id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      // Get user roles
      const result = await pool.query(`
        SELECT ur.role_name, ur.permissions
        FROM UserRoleMapping urm
        JOIN UserRole ur ON urm.role_id = ur.role_id
        WHERE urm.user_id = $1
      `, [req.user.user_id]);

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'No roles assigned to user' });
      }

      const userRoles = result.rows.map(r => r.role_name);
      const hasPermission = roles.some(role => userRoles.includes(role));

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.user.roles = result.rows;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({ error: 'Authorization failed' });
    }
  };
};
