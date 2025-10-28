import pool from '../config/database.js';

/**
 * Audit Service for Master Data Changes
 * Tracks all CREATE, UPDATE, DELETE operations on master tables
 */

/**
 * Log an audit entry for master data changes
 * @param {Object} params - Audit parameters
 * @param {string} params.userId - User performing the action
 * @param {string} params.tableName - Name of the table being modified
 * @param {string} params.recordId - ID of the record being modified
 * @param {string} params.action - Action type (CREATE, UPDATE, DELETE, IMPORT, EXPORT)
 * @param {Object} params.oldValues - Previous state of the record
 * @param {Object} params.newValues - New state of the record
 * @param {string} params.ipAddress - User's IP address
 * @param {string} params.userAgent - User's browser/client info
 * @param {string} params.reason - Optional reason for the change
 */
export async function logAudit({
  userId,
  tableName,
  recordId,
  action,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  reason = null
}) {
  const client = await pool.connect();

  try {
    // Calculate specific changes between old and new values
    const changes = calculateChanges(oldValues, newValues);

    const query = `
      INSERT INTO MasterDataAuditLog (
        user_id, table_name, record_id, action,
        old_values, new_values, changes,
        ip_address, user_agent, reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING audit_id, action_timestamp
    `;

    const result = await client.query(query, [
      userId,
      tableName,
      recordId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      changes ? JSON.stringify(changes) : null,
      ipAddress,
      userAgent,
      reason
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error logging audit:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calculate specific field changes between old and new values
 */
function calculateChanges(oldValues, newValues) {
  if (!oldValues || !newValues) return null;

  const changes = {};
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    // Skip metadata fields
    if (['created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)) {
      continue;
    }

    const oldVal = oldValues[key];
    const newVal = newValues[key];

    // Deep comparison for objects
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = {
        from: oldVal,
        to: newVal
      };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Get audit history for a specific record
 */
export async function getAuditHistory(tableName, recordId, options = {}) {
  const { limit = 50, offset = 0 } = options;
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        mal.audit_id,
        mal.action,
        mal.old_values,
        mal.new_values,
        mal.changes,
        mal.reason,
        mal.action_timestamp,
        mal.ip_address,
        u.username,
        u.first_name,
        u.last_name,
        u.email
      FROM MasterDataAuditLog mal
      LEFT JOIN Users u ON mal.user_id = u.user_id
      WHERE mal.table_name = $1 AND mal.record_id = $2
      ORDER BY mal.action_timestamp DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await client.query(query, [tableName, recordId, limit, offset]);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Get audit summary by table
 */
export async function getAuditSummary(tableName, dateFrom, dateTo) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        mal.action,
        COUNT(*) as count,
        COUNT(DISTINCT mal.user_id) as unique_users,
        COUNT(DISTINCT mal.record_id) as unique_records
      FROM MasterDataAuditLog mal
      WHERE mal.table_name = $1
        AND mal.action_timestamp >= $2
        AND mal.action_timestamp <= $3
      GROUP BY mal.action
      ORDER BY mal.action
    `;

    const result = await client.query(query, [tableName, dateFrom, dateTo]);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Get recent audit activity across all master tables
 */
export async function getRecentActivity(limit = 100) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        mal.audit_id,
        mal.table_name,
        mal.record_id,
        mal.action,
        mal.changes,
        mal.action_timestamp,
        u.username,
        u.first_name || ' ' || u.last_name as user_full_name
      FROM MasterDataAuditLog mal
      LEFT JOIN Users u ON mal.user_id = u.user_id
      WHERE mal.table_name IN ('Provider', 'Payer', 'Facilities', 'TradingPartnerMaster')
      ORDER BY mal.action_timestamp DESC
      LIMIT $1
    `;

    const result = await client.query(query, [limit]);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Middleware to automatically log audit for master data operations
 */
export function auditMiddleware(tableName) {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;

    // Override send to capture response
    res.send = function (data) {
      // Restore original send
      res.send = originalSend;

      // Log audit if operation was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const action = getActionFromMethod(req.method);
        const recordId = req.params.id || (typeof data === 'object' && data?.id);

        if (action && recordId) {
          // Log audit asynchronously (don't block response)
          logAudit({
            userId: req.user?.user_id,
            tableName,
            recordId: String(recordId),
            action,
            oldValues: req.auditOldValues || null,
            newValues: req.body || null,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            reason: req.body?.audit_reason || null
          }).catch(err => {
            console.error('Failed to log audit:', err);
          });
        }
      }

      // Send response
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Helper to map HTTP methods to audit actions
 */
function getActionFromMethod(method) {
  const methodMap = {
    'POST': 'CREATE',
    'PUT': 'UPDATE',
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE'
  };
  return methodMap[method] || null;
}

/**
 * Middleware to fetch old values before update/delete
 */
export function captureOldValues(tableName, idField = 'id') {
  return async (req, res, next) => {
    if (!['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const recordId = req.params[idField];
    if (!recordId) {
      return next();
    }

    const client = await pool.connect();
    try {
      const query = `SELECT * FROM ${tableName} WHERE ${idField} = $1`;
      const result = await client.query(query, [recordId]);

      if (result.rows.length > 0) {
        req.auditOldValues = result.rows[0];
      }
    } catch (error) {
      console.error('Error capturing old values:', error);
    } finally {
      client.release();
    }

    next();
  };
}

export default {
  logAudit,
  getAuditHistory,
  getAuditSummary,
  getRecentActivity,
  auditMiddleware,
  captureOldValues
};
