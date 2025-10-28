import pool from '../config/database.js';

/**
 * HIPAA Compliance Middleware
 * - Logs all PHI access
 * - Adds security headers
 * - Implements audit trail
 */

export const hipaaAuditLog = async (req, res, next) => {
  const startTime = Date.now();

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override res.json to capture response data
  res.json = (data) => {
    const duration = Date.now() - startTime;

    // Log to audit trail asynchronously
    setImmediate(async () => {
      try {
        const userId = req.user?.user_id || null;

        // Extract action from path - limit to 50 chars for DB column
        let action = req.method; // GET, POST, PUT, DELETE, etc.

        // Extract meaningful action from path
        const pathParts = req.path.split('/').filter(p => p && !p.match(/^[0-9a-f-]{36}$/i));
        if (pathParts.length > 0) {
          const actionPart = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || 'API';
          action = `${req.method}_${actionPart.toUpperCase()}`;
        }

        // Ensure action fits in VARCHAR(50)
        action = action.substring(0, 50);

        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await pool.query(`
          INSERT INTO AuditLog (
            user_id, action, entity_type, entity_id,
            new_values, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          action,
          req.params.entityType || 'GENERAL',
          req.params.id || null,
          JSON.stringify({
            duration,
            method: req.method,
            path: req.path,
            query: req.query
          }),
          ipAddress,
          userAgent
        ]);
      } catch (error) {
        console.error('Audit log error:', error);
      }
    });

    return originalJson(data);
  };

  next();
};

export const hipaaHeaders = (req, res, next) => {
  // Add HIPAA-compliant security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  // Remove server information
  res.removeHeader('X-Powered-By');

  next();
};

export const sanitizePhiResponse = (data) => {
  /**
   * Sanitize PHI data based on user permissions
   * For now, this is a placeholder - implement based on specific requirements
   */
  if (!data) return data;

  // Example: Mask SSN, DOB in certain contexts
  if (Array.isArray(data)) {
    return data.map(item => sanitizePhiResponse(item));
  }

  if (typeof data === 'object') {
    const sanitized = { ...data };

    // Mask sensitive fields if they exist
    if (sanitized.ssn) {
      sanitized.ssn = '***-**-' + sanitized.ssn.slice(-4);
    }

    return sanitized;
  }

  return data;
};
