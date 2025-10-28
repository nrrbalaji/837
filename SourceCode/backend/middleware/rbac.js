import pool from '../config/database.js';

/**
 * RBAC Middleware for Role-Based Access Control
 * Supports Admin, Ops, and Analyst roles with granular permissions
 */

/**
 * Check if user has required permission for a resource
 * @param {string} resource - Resource name (e.g., 'masters', 'claims', 'users')
 * @param {string} action - Action name (e.g., 'create', 'read', 'update', 'delete', 'import', 'export')
 */
export function requirePermission(resource, action) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Fetch user roles and permissions
      const result = await pool.query(`
        SELECT ur.role_name, ur.permissions
        FROM UserRoleMapping urm
        JOIN UserRole ur ON urm.role_id = ur.role_id
        WHERE urm.user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'No roles assigned to user' });
      }

      // Check if any role has the required permission
      const hasPermission = result.rows.some(role => {
        const permissions = role.permissions;
        if (!permissions || !permissions[resource]) {
          return false;
        }

        const allowedActions = permissions[resource];
        return Array.isArray(allowedActions) && allowedActions.includes(action);
      });

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: `${resource}:${action}`,
          message: `You need '${action}' permission on '${resource}' to perform this action`
        });
      }

      // Attach roles to request for further use
      req.user.roles = result.rows;
      next();
    } catch (error) {
      console.error('RBAC error:', error);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

/**
 * Check if user has any of the specified roles
 * @param {...string} roleNames - Role names to check
 */
export function requireRole(...roleNames) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await pool.query(`
        SELECT ur.role_name
        FROM UserRoleMapping urm
        JOIN UserRole ur ON urm.role_id = ur.role_id
        WHERE urm.user_id = $1 AND ur.role_name = ANY($2)
      `, [userId, roleNames]);

      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required_roles: roleNames,
          message: `You need one of these roles: ${roleNames.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

/**
 * Check if user is Admin
 */
export function requireAdmin() {
  return requireRole('Admin');
}

/**
 * Check if user is Admin or Ops
 */
export function requireAdminOrOps() {
  return requireRole('Admin', 'Ops');
}

/**
 * Master data CRUD permissions
 */
export const masterPermissions = {
  create: requirePermission('masters', 'create'),
  read: requirePermission('masters', 'read'),
  update: requirePermission('masters', 'update'),
  delete: requirePermission('masters', 'delete'),
  import: requirePermission('masters', 'import'),
  export: requirePermission('masters', 'export')
};

/**
 * Claims permissions
 */
export const claimPermissions = {
  create: requirePermission('claims', 'create'),
  read: requirePermission('claims', 'read'),
  update: requirePermission('claims', 'update'),
  delete: requirePermission('claims', 'delete'),
  process: requirePermission('claims', 'process'),
  export: requirePermission('claims', 'export')
};

/**
 * User management permissions
 */
export const userPermissions = {
  create: requirePermission('users', 'create'),
  read: requirePermission('users', 'read'),
  update: requirePermission('users', 'update'),
  delete: requirePermission('users', 'delete')
};

/**
 * Get user permissions summary
 */
export async function getUserPermissions(userId) {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        ur.role_name,
        ur.permissions
      FROM UserRoleMapping urm
      JOIN UserRole ur ON urm.role_id = ur.role_id
      WHERE urm.user_id = $1
    `, [userId]);

    // Merge permissions from all roles
    const mergedPermissions = {};

    result.rows.forEach(role => {
      const permissions = role.permissions;

      Object.keys(permissions).forEach(resource => {
        if (!mergedPermissions[resource]) {
          mergedPermissions[resource] = new Set();
        }

        permissions[resource].forEach(action => {
          mergedPermissions[resource].add(action);
        });
      });
    });

    // Convert Sets back to arrays
    Object.keys(mergedPermissions).forEach(resource => {
      mergedPermissions[resource] = Array.from(mergedPermissions[resource]);
    });

    return {
      roles: result.rows.map(r => r.role_name),
      permissions: mergedPermissions
    };
  } finally {
    client.release();
  }
}

/**
 * Middleware to attach user permissions to request
 */
export async function attachPermissions(req, res, next) {
  if (!req.user?.user_id) {
    return next();
  }

  try {
    const permissions = await getUserPermissions(req.user.user_id);
    req.user.permissions = permissions.permissions;
    req.user.roleNames = permissions.roles;
  } catch (error) {
    console.error('Error attaching permissions:', error);
  }

  next();
}

/**
 * Check permission utility function
 */
export function hasPermission(userPermissions, resource, action) {
  if (!userPermissions || !userPermissions[resource]) {
    return false;
  }

  return userPermissions[resource].includes(action);
}

export default {
  requirePermission,
  requireRole,
  requireAdmin,
  requireAdminOrOps,
  masterPermissions,
  claimPermissions,
  userPermissions,
  getUserPermissions,
  attachPermissions,
  hasPermission
};
