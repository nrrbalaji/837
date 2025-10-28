import pool from '../config/database.js';
import { logAudit } from './auditService.js';

/**
 * Trading Partner Master Service
 * Manages trading partner configurations for EDI transmission
 */

/**
 * Get all trading partners with filtering, sorting, and pagination
 */
export async function getAllTradingPartners({ page, limit, sortField, sortOrder, filters }) {
  const client = await pool.connect();

  try {
    const offset = (page - 1) * limit;
    const validSortFields = ['partner_name', 'partner_type', 'direction', 'channel_type', 'status', 'created_at'];
    const orderByField = validSortFields.includes(sortField) ? sortField : 'partner_name';
    const orderByDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Build WHERE clause
    const whereClauses = [];
    const queryParams = [];
    let paramCount = 1;

    if (filters.partnerName) {
      whereClauses.push(`partner_name ILIKE $${paramCount}`);
      queryParams.push(`%${filters.partnerName}%`);
      paramCount++;
    }

    if (filters.partnerType) {
      whereClauses.push(`partner_type = $${paramCount}`);
      queryParams.push(filters.partnerType);
      paramCount++;
    }

    if (filters.direction) {
      whereClauses.push(`direction = $${paramCount}`);
      queryParams.push(filters.direction);
      paramCount++;
    }

    if (filters.channelType) {
      whereClauses.push(`channel_type = $${paramCount}`);
      queryParams.push(filters.channelType);
      paramCount++;
    }

    if (filters.status) {
      whereClauses.push(`status = $${paramCount}`);
      queryParams.push(filters.status);
      paramCount++;
    }

    if (filters.isActive !== null && filters.isActive !== undefined) {
      whereClauses.push(`is_active = $${paramCount}`);
      queryParams.push(filters.isActive);
      paramCount++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM TradingPartnerMaster ${whereClause}`;
    const countResult = await client.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get trading partners
    const query = `
      SELECT
        tp.trading_partner_id,
        tp.partner_name,
        tp.partner_type,
        tp.sender_qualifier,
        tp.sender_id,
        tp.receiver_qualifier,
        tp.receiver_id,
        tp.direction,
        tp.default_payer_id,
        p.payer_name as default_payer_name,
        tp.channel_type,
        tp.endpoint_url,
        tp.edi_version,
        tp.test_mode,
        tp.status,
        tp.effective_from,
        tp.effective_to,
        tp.is_active,
        tp.created_at,
        tp.updated_at
      FROM TradingPartnerMaster tp
      LEFT JOIN Payer p ON tp.default_payer_id = p.payer_id
      ${whereClause}
      ORDER BY ${orderByField} ${orderByDirection}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    queryParams.push(limit, offset);
    const result = await client.query(query, queryParams);

    return {
      tradingPartners: result.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit
      }
    };
  } finally {
    client.release();
  }
}

/**
 * Get trading partner by ID
 */
export async function getTradingPartnerById(tradingPartnerId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        tp.*,
        p.payer_name as default_payer_name,
        p.payer_code as default_payer_code
      FROM TradingPartnerMaster tp
      LEFT JOIN Payer p ON tp.default_payer_id = p.payer_id
      WHERE tp.trading_partner_id = $1
    `;

    const result = await client.query(query, [tradingPartnerId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Create new trading partner
 */
export async function createTradingPartner(tradingPartnerData, userId, auditInfo = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      trading_partner_id,
      partner_name,
      partner_type,
      sender_qualifier,
      sender_id,
      receiver_qualifier,
      receiver_id,
      direction,
      default_payer_id,
      channel_type,
      endpoint_url,
      sftp_config,
      api_config,
      edi_version = '5010',
      test_mode = false,
      status = 'Active',
      effective_from,
      effective_to,
      notes
    } = tradingPartnerData;

    const insertQuery = `
      INSERT INTO TradingPartnerMaster (
        trading_partner_id, partner_name, partner_type,
        sender_qualifier, sender_id, receiver_qualifier, receiver_id,
        direction, default_payer_id, channel_type, endpoint_url,
        sftp_config, api_config, edi_version, test_mode, status,
        effective_from, effective_to, notes, is_active,
        created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, true, $20, $21)
      RETURNING *
    `;

    const values = [
      trading_partner_id,
      partner_name,
      partner_type,
      sender_qualifier,
      sender_id,
      receiver_qualifier,
      receiver_id,
      direction,
      default_payer_id || null,
      channel_type,
      endpoint_url,
      sftp_config ? JSON.stringify(sftp_config) : null,
      api_config ? JSON.stringify(api_config) : null,
      edi_version,
      test_mode,
      status,
      effective_from,
      effective_to,
      notes,
      userId,
      userId
    ];

    const result = await client.query(insertQuery, values);
    const tradingPartner = result.rows[0];

    // Log audit
    await logAudit({
      userId,
      tableName: 'TradingPartnerMaster',
      recordId: trading_partner_id,
      action: 'CREATE',
      newValues: tradingPartner,
      ...auditInfo
    });

    await client.query('COMMIT');
    return tradingPartner;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update trading partner
 */
export async function updateTradingPartner(tradingPartnerId, tradingPartnerData, userId, auditInfo = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get old values for audit
    const oldResult = await client.query(
      'SELECT * FROM TradingPartnerMaster WHERE trading_partner_id = $1',
      [tradingPartnerId]
    );

    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const oldValues = oldResult.rows[0];

    const {
      partner_name,
      partner_type,
      sender_qualifier,
      sender_id,
      receiver_qualifier,
      receiver_id,
      direction,
      default_payer_id,
      channel_type,
      endpoint_url,
      sftp_config,
      api_config,
      edi_version,
      test_mode,
      status,
      effective_from,
      effective_to,
      notes
    } = tradingPartnerData;

    const updateQuery = `
      UPDATE TradingPartnerMaster
      SET
        partner_name = $1,
        partner_type = $2,
        sender_qualifier = $3,
        sender_id = $4,
        receiver_qualifier = $5,
        receiver_id = $6,
        direction = $7,
        default_payer_id = $8,
        channel_type = $9,
        endpoint_url = $10,
        sftp_config = $11,
        api_config = $12,
        edi_version = $13,
        test_mode = $14,
        status = $15,
        effective_from = $16,
        effective_to = $17,
        notes = $18,
        updated_by = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE trading_partner_id = $20
      RETURNING *
    `;

    const values = [
      partner_name,
      partner_type,
      sender_qualifier,
      sender_id,
      receiver_qualifier,
      receiver_id,
      direction,
      default_payer_id || null,
      channel_type,
      endpoint_url,
      sftp_config ? JSON.stringify(sftp_config) : null,
      api_config ? JSON.stringify(api_config) : null,
      edi_version,
      test_mode,
      status,
      effective_from,
      effective_to,
      notes,
      userId,
      tradingPartnerId
    ];

    const result = await client.query(updateQuery, values);
    const tradingPartner = result.rows[0];

    // Log audit
    await logAudit({
      userId,
      tableName: 'TradingPartnerMaster',
      recordId: tradingPartnerId,
      action: 'UPDATE',
      oldValues,
      newValues: tradingPartner,
      ...auditInfo
    });

    await client.query('COMMIT');
    return tradingPartner;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete trading partner (soft delete)
 */
export async function deleteTradingPartner(tradingPartnerId, userId, auditInfo = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get old values for audit
    const oldResult = await client.query(
      'SELECT * FROM TradingPartnerMaster WHERE trading_partner_id = $1',
      [tradingPartnerId]
    );

    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const query = `
      UPDATE TradingPartnerMaster
      SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE trading_partner_id = $2
      RETURNING *
    `;

    const result = await client.query(query, [userId, tradingPartnerId]);

    // Log audit
    await logAudit({
      userId,
      tableName: 'TradingPartnerMaster',
      recordId: tradingPartnerId,
      action: 'DELETE',
      oldValues: oldResult.rows[0],
      newValues: result.rows[0],
      ...auditInfo
    });

    await client.query('COMMIT');
    return result.rows.length > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Bulk import trading partners
 */
export async function bulkImportTradingPartners(tradingPartners, userId, auditInfo = {}) {
  const client = await pool.connect();
  const results = { success: [], failed: [] };

  try {
    await client.query('BEGIN');

    for (const tp of tradingPartners) {
      try {
        const result = await createTradingPartner(tp, userId, { ...auditInfo, skipAudit: true });
        results.success.push({ id: tp.trading_partner_id, data: result });
      } catch (error) {
        results.failed.push({
          id: tp.trading_partner_id,
          error: error.message
        });
      }
    }

    // Log bulk import audit
    await logAudit({
      userId,
      tableName: 'TradingPartnerMaster',
      recordId: 'BULK_IMPORT',
      action: 'IMPORT',
      newValues: { successCount: results.success.length, failedCount: results.failed.length },
      ...auditInfo
    });

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default {
  getAllTradingPartners,
  getTradingPartnerById,
  createTradingPartner,
  updateTradingPartner,
  deleteTradingPartner,
  bulkImportTradingPartners
};
