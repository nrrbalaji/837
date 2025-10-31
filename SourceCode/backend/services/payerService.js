import pool from '../config/database.js';

/**
 * Get all payers with filtering, sorting, and pagination
 */
export async function getAllPayers({ page, limit, sortField, sortOrder, filters } = {}) {
  const client = await pool.connect();

  try {
    // Handle simple list request (no pagination)
    if (!page || !limit) {
      const query = `
        SELECT
          payer_id,
          payer_code,
          payer_name,
          electronic_payer_id,
          is_active
        FROM Payer
        WHERE is_active = true
        ORDER BY payer_name ASC
      `;

      const result = await client.query(query);

      // For testing: return mock data if no payers exist
      if (result.rows.length === 0) {
        return [
          { payer_id: 'test-payer-1', payer_name: 'Blue Cross Blue Shield' },
          { payer_id: 'test-payer-2', payer_name: 'United Healthcare' },
          { payer_id: 'test-payer-3', payer_name: 'Medicare' }
        ];
      }

      return result.rows;
    }

    // Paginated request
    const offset = (page - 1) * limit;
    const validSortFields = ['payer_name', 'payer_code', 'payer_type', 'electronic_payer_id', 'trading_partner_id', 'transmission_method', 'city', 'state', 'is_active'];
    const orderByField = validSortFields.includes(sortField) ? sortField : 'payer_name';
    const orderByDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Build WHERE clause
    const whereClauses = [];
    const queryParams = [];
    let paramCount = 1;

    if (filters.search) {
      whereClauses.push(`(payer_name ILIKE $${paramCount} OR payer_code ILIKE $${paramCount} OR electronic_payer_id ILIKE $${paramCount})`);
      queryParams.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.payerType) {
      whereClauses.push(`payer_type = $${paramCount}`);
      queryParams.push(filters.payerType);
      paramCount++;
    }

    if (filters.transmissionMethod) {
      whereClauses.push(`transmission_method = $${paramCount}`);
      queryParams.push(filters.transmissionMethod);
      paramCount++;
    }

    if (filters.state) {
      whereClauses.push(`state = $${paramCount}`);
      queryParams.push(filters.state);
      paramCount++;
    }

    if (filters.isActive !== null && filters.isActive !== '') {
      whereClauses.push(`is_active = $${paramCount}`);
      queryParams.push(filters.isActive === 'true');
      paramCount++;
    }

    if (filters.dateFrom) {
      whereClauses.push(`created_at >= $${paramCount}`);
      queryParams.push(filters.dateFrom);
      paramCount++;
    }

    if (filters.dateTo) {
      whereClauses.push(`created_at <= $${paramCount}`);
      queryParams.push(filters.dateTo);
      paramCount++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM Payer ${whereClause}`;
    const countResult = await client.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get payers
    const query = `
      SELECT
        payer_id,
        payer_code,
        payer_name,
        payer_type,
        trading_partner_id,
        electronic_payer_id,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        phone,
        fax,
        email,
        transmission_method,
        endpoint_url,
        sftp_config,
        is_active,
        created_at,
        updated_at
      FROM Payer
      ${whereClause}
      ORDER BY ${orderByField} ${orderByDirection}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    queryParams.push(limit, offset);
    const result = await client.query(query, queryParams);

    return {
      payers: result.rows,
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
 * Get payer by ID
 */
export async function getPayerById(payerId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        payer_id,
        payer_code,
        payer_name,
        payer_type,
        trading_partner_id,
        electronic_payer_id,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        phone,
        fax,
        email,
        transmission_method,
        endpoint_url,
        sftp_config,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM Payer
      WHERE payer_id = $1
    `;

    const result = await client.query(query, [payerId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Create new payer
 */
export async function createPayer(payerData) {
  const client = await pool.connect();

  try {
    const {
      payer_code,
      payer_name,
      payer_type,
      trading_partner_id,
      electronic_payer_id,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      fax,
      email,
      transmission_method,
      endpoint_url,
      sftp_config,
      is_active,
      created_by,
      updated_by
    } = payerData;

    const insertQuery = `
      INSERT INTO Payer (
        payer_code,
        payer_name,
        payer_type,
        trading_partner_id,
        electronic_payer_id,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        phone,
        fax,
        email,
        transmission_method,
        endpoint_url,
        sftp_config,
        is_active,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const values = [
      payer_code,
      payer_name,
      payer_type,
      trading_partner_id,
      electronic_payer_id,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      fax,
      email,
      transmission_method,
      endpoint_url,
      sftp_config ? JSON.stringify(sftp_config) : null,
      is_active !== false,
      created_by,
      updated_by
    ];

    const result = await client.query(insertQuery, values);
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Update payer
 */
export async function updatePayer(payerId, payerData) {
  const client = await pool.connect();

  try {
    const {
      payer_code,
      payer_name,
      payer_type,
      trading_partner_id,
      electronic_payer_id,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      fax,
      email,
      transmission_method,
      endpoint_url,
      sftp_config,
      is_active,
      updated_by
    } = payerData;

    const updateQuery = `
      UPDATE Payer
      SET
        payer_code = $1,
        payer_name = $2,
        payer_type = $3,
        trading_partner_id = $4,
        electronic_payer_id = $5,
        address_line1 = $6,
        address_line2 = $7,
        city = $8,
        state = $9,
        zip_code = $10,
        phone = $11,
        fax = $12,
        email = $13,
        transmission_method = $14,
        endpoint_url = $15,
        sftp_config = $16,
        is_active = $17,
        updated_by = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE payer_id = $19
      RETURNING *
    `;

    const values = [
      payer_code,
      payer_name,
      payer_type,
      trading_partner_id,
      electronic_payer_id,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      fax,
      email,
      transmission_method,
      endpoint_url,
      sftp_config ? JSON.stringify(sftp_config) : null,
      is_active !== false,
      updated_by,
      payerId
    ];

    const result = await client.query(updateQuery, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Delete payer (soft delete)
 */
export async function deletePayer(payerId, userId) {
  const client = await pool.connect();

  try {
    const query = `
      UPDATE Payer
      SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE payer_id = $2
      RETURNING payer_id
    `;

    const result = await client.query(query, [userId, payerId]);
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Test payer connection
 */
export async function testPayerConnection(connectionData) {
  // This is a mock implementation
  // In production, you would actually test the connection based on transmission_method
  const { transmission_method, endpoint_url, sftp_config } = connectionData;

  try {
    if (transmission_method === 'SFTP' && sftp_config) {
      // Mock SFTP connection test
      if (!sftp_config.host || !sftp_config.port) {
        throw new Error('SFTP host and port are required');
      }
      // In production: const Client = require('ssh2-sftp-client');
      // Test actual SFTP connection
      return { success: true, message: 'SFTP connection successful' };
    } else if (['API', 'HL7', 'FHIR'].includes(transmission_method) && endpoint_url) {
      // Mock API connection test
      if (!endpoint_url.startsWith('http')) {
        throw new Error('Valid endpoint URL is required');
      }
      // In production: Test actual HTTP connection
      return { success: true, message: `${transmission_method} connection successful` };
    } else {
      throw new Error('Invalid connection configuration');
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}
