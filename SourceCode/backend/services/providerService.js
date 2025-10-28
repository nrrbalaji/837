import pool from '../config/database.js';

/**
 * Get all providers with filtering, sorting, and pagination
 */
export async function getAllProviders({ page, limit, sortField, sortOrder, filters }) {
  const client = await pool.connect();

  try {
    const offset = (page - 1) * limit;
    const validSortFields = ['first_name', 'last_name', 'npi', 'taxonomy_code', 'specialty', 'city', 'state', 'is_active'];
    const orderByField = validSortFields.includes(sortField) ? sortField : 'first_name';
    const orderByDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Build WHERE clause
    const whereClauses = [];
    const queryParams = [];
    let paramCount = 1;

    if (filters.providerName) {
      whereClauses.push(`(first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`);
      queryParams.push(`%${filters.providerName}%`);
      paramCount++;
    }

    if (filters.npi) {
      whereClauses.push(`npi ILIKE $${paramCount}`);
      queryParams.push(`%${filters.npi}%`);
      paramCount++;
    }

    if (filters.taxId) {
      whereClauses.push(`license_number ILIKE $${paramCount}`);
      queryParams.push(`%${filters.taxId}%`);
      paramCount++;
    }

    if (filters.facilityType) {
      whereClauses.push(`specialty = $${paramCount}`);
      queryParams.push(filters.facilityType);
      paramCount++;
    }

    if (filters.status !== null) {
      whereClauses.push(`is_active = $${paramCount}`);
      queryParams.push(filters.status);
      paramCount++;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM Provider ${whereClause}`;
    const countResult = await client.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get providers
    const query = `
      SELECT
        p.provider_id,
        p.npi,
        p.first_name,
        p.last_name,
        p.middle_name,
        p.first_name || ' ' || p.last_name as provider_name,
        p.taxonomy_code,
        p.specialty as facility_type,
        p.license_number as tax_id,
        p.address_line1 as address,
        p.city,
        p.state,
        p.zip_code as zip,
        p.phone as contact_phone,
        p.email as contact_email,
        p.facility_id,
        f.facility_name,
        CASE WHEN p.is_active THEN 'Active' ELSE 'Inactive' END as status,
        p.created_at,
        p.updated_at
      FROM Provider p
      LEFT JOIN Facilities f ON p.facility_id = f.facility_id
      ${whereClause}
      ORDER BY ${orderByField} ${orderByDirection}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    queryParams.push(limit, offset);
    const result = await client.query(query, queryParams);

    return {
      providers: result.rows,
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
 * Get provider by ID with payer mappings
 */
export async function getProviderById(providerId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        p.provider_id,
        p.npi,
        p.first_name,
        p.last_name,
        p.middle_name,
        p.first_name || ' ' || p.last_name as provider_name,
        p.taxonomy_code,
        p.specialty as facility_type,
        p.license_number as tax_id,
        p.license_state,
        p.dea_number,
        p.address_line1 as address,
        p.address_line2,
        p.city,
        p.state,
        p.zip_code as zip,
        'USA' as country,
        p.phone as contact_phone,
        p.fax,
        p.email as contact_email,
        p.facility_id,
        f.facility_name,
        CASE WHEN p.is_active THEN 'Active' ELSE 'Inactive' END as status,
        p.created_at,
        p.updated_at,
        p.created_by,
        p.updated_by
      FROM Provider p
      LEFT JOIN Facilities f ON p.facility_id = f.facility_id
      WHERE p.provider_id = $1
    `;

    const result = await client.query(query, [providerId]);

    if (result.rows.length === 0) {
      return null;
    }

    const provider = result.rows[0];

    // Get payer mappings
    const mappingsQuery = `
      SELECT
        ppm.mapping_id as payer_mapping_id,
        pay.payer_name,
        pay.payer_code as payer_id,
        ppm.enrollment_status,
        ppm.effective_date,
        ppm.termination_date
      FROM ProviderPayerMapping ppm
      JOIN Payer pay ON ppm.payer_id = pay.payer_id
      WHERE ppm.provider_id = $1 AND ppm.is_active = true
      ORDER BY ppm.effective_date DESC
    `;

    const mappingsResult = await client.query(mappingsQuery, [providerId]);
    provider.payer_mappings = mappingsResult.rows;

    return provider;
  } finally {
    client.release();
  }
}

/**
 * Create new provider
 */
export async function createProvider(providerData) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      provider_name,
      npi,
      tax_id,
      facility_type,
      facility_id,
      taxonomy_code,
      status,
      address,
      city,
      state,
      zip,
      country,
      contact_name,
      contact_email,
      contact_phone,
      payer_mappings = [],
      notes,
      created_by,
      updated_by
    } = providerData;

    // Split provider_name into first_name and last_name
    const nameParts = provider_name.trim().split(' ');
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(' ') || nameParts[0];

    const insertQuery = `
      INSERT INTO Provider (
        npi,
        first_name,
        last_name,
        taxonomy_code,
        specialty,
        license_number,
        facility_id,
        address_line1,
        city,
        state,
        zip_code,
        phone,
        email,
        is_active,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING provider_id, npi, first_name, last_name, taxonomy_code,
                specialty as facility_type, license_number as tax_id,
                facility_id,
                address_line1 as address, city, state, zip_code as zip,
                phone as contact_phone, email as contact_email,
                CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END as status,
                created_at, updated_at
    `;

    const values = [
      npi,
      first_name,
      last_name,
      taxonomy_code,
      facility_type,
      tax_id,
      facility_id || null,
      address,
      city,
      state,
      zip,
      contact_phone,
      contact_email,
      status === 'Active',
      created_by,
      updated_by
    ];

    const result = await client.query(insertQuery, values);
    const provider = result.rows[0];
    provider.provider_name = `${first_name} ${last_name}`;

    // Insert payer mappings
    if (payer_mappings && payer_mappings.length > 0) {
      for (const mapping of payer_mappings) {
        if (mapping.payer_name && mapping.payer_id) {
          // First, check if payer exists, if not create it
          const payerCheck = await client.query(
            'SELECT payer_id FROM Payer WHERE payer_code = $1',
            [mapping.payer_id]
          );

          let payerId;
          if (payerCheck.rows.length === 0) {
            const payerInsert = await client.query(
              `INSERT INTO Payer (payer_code, payer_name, is_active, created_by, updated_by)
               VALUES ($1, $2, true, $3, $4) RETURNING payer_id`,
              [mapping.payer_id, mapping.payer_name, created_by, updated_by]
            );
            payerId = payerInsert.rows[0].payer_id;
          } else {
            payerId = payerCheck.rows[0].payer_id;
          }

          // Insert provider-payer mapping
          await client.query(
            `INSERT INTO ProviderPayerMapping (
              provider_id, payer_id, enrollment_status, effective_date,
              termination_date, is_active, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, true, $6, $7)`,
            [
              provider.provider_id,
              payerId,
              mapping.enrollment_status || 'Active',
              mapping.effective_date,
              mapping.termination_date || null,
              created_by,
              updated_by
            ]
          );
        }
      }
    }

    await client.query('COMMIT');
    return provider;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update provider
 */
export async function updateProvider(providerId, providerData) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      provider_name,
      npi,
      tax_id,
      facility_type,
      facility_id,
      taxonomy_code,
      status,
      address,
      city,
      state,
      zip,
      contact_phone,
      contact_email,
      payer_mappings = [],
      updated_by
    } = providerData;

    // Split provider_name
    const nameParts = provider_name.trim().split(' ');
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(' ') || nameParts[0];

    const updateQuery = `
      UPDATE Provider
      SET
        npi = $1,
        first_name = $2,
        last_name = $3,
        taxonomy_code = $4,
        specialty = $5,
        license_number = $6,
        facility_id = $7,
        address_line1 = $8,
        city = $9,
        state = $10,
        zip_code = $11,
        phone = $12,
        email = $13,
        is_active = $14,
        updated_by = $15,
        updated_at = CURRENT_TIMESTAMP
      WHERE provider_id = $16
      RETURNING provider_id, npi, first_name, last_name, taxonomy_code,
                specialty as facility_type, license_number as tax_id,
                facility_id,
                address_line1 as address, city, state, zip_code as zip,
                phone as contact_phone, email as contact_email,
                CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END as status,
                created_at, updated_at
    `;

    const values = [
      npi,
      first_name,
      last_name,
      taxonomy_code,
      facility_type,
      tax_id,
      facility_id || null,
      address,
      city,
      state,
      zip,
      contact_phone,
      contact_email,
      status === 'Active',
      updated_by,
      providerId
    ];

    const result = await client.query(updateQuery, values);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const provider = result.rows[0];
    provider.provider_name = `${first_name} ${last_name}`;

    // Update payer mappings - delete old ones and insert new ones
    await client.query(
      'UPDATE ProviderPayerMapping SET is_active = false WHERE provider_id = $1',
      [providerId]
    );

    if (payer_mappings && payer_mappings.length > 0) {
      for (const mapping of payer_mappings) {
        if (mapping.payer_name && mapping.payer_id) {
          const payerCheck = await client.query(
            'SELECT payer_id FROM Payer WHERE payer_code = $1',
            [mapping.payer_id]
          );

          let payerId;
          if (payerCheck.rows.length === 0) {
            const payerInsert = await client.query(
              `INSERT INTO Payer (payer_code, payer_name, is_active, created_by, updated_by)
               VALUES ($1, $2, true, $3, $4) RETURNING payer_id`,
              [mapping.payer_id, mapping.payer_name, updated_by, updated_by]
            );
            payerId = payerInsert.rows[0].payer_id;
          } else {
            payerId = payerCheck.rows[0].payer_id;
          }

          await client.query(
            `INSERT INTO ProviderPayerMapping (
              provider_id, payer_id, enrollment_status, effective_date,
              termination_date, is_active, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, true, $6, $7)
            ON CONFLICT (provider_id, payer_id) DO UPDATE
            SET enrollment_status = $3, effective_date = $4, termination_date = $5,
                is_active = true, updated_by = $7, updated_at = CURRENT_TIMESTAMP`,
            [
              providerId,
              payerId,
              mapping.enrollment_status || 'Active',
              mapping.effective_date,
              mapping.termination_date || null,
              updated_by,
              updated_by
            ]
          );
        }
      }
    }

    await client.query('COMMIT');
    return provider;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete provider (soft delete)
 */
export async function deleteProvider(providerId, userId) {
  const client = await pool.connect();

  try {
    const query = `
      UPDATE Provider
      SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE provider_id = $2
      RETURNING provider_id
    `;

    const result = await client.query(query, [userId, providerId]);
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

/**
 * Get provider payer mappings
 */
export async function getProviderPayerMappings(providerId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        ppm.mapping_id as payer_mapping_id,
        pay.payer_name,
        pay.payer_code as payer_id,
        ppm.enrollment_status,
        ppm.effective_date,
        ppm.termination_date
      FROM ProviderPayerMapping ppm
      JOIN Payer pay ON ppm.payer_id = pay.payer_id
      WHERE ppm.provider_id = $1 AND ppm.is_active = true
      ORDER BY ppm.effective_date DESC
    `;

    const result = await client.query(query, [providerId]);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Add provider payer mapping
 */
export async function addProviderPayerMapping(mappingData) {
  const client = await pool.connect();

  try {
    const { provider_id, payer_id, payer_name, enrollment_status, effective_date, termination_date, created_by } = mappingData;

    // Check if payer exists
    const payerCheck = await client.query('SELECT payer_id FROM Payer WHERE payer_code = $1', [payer_id]);

    let payerUuid;
    if (payerCheck.rows.length === 0) {
      const payerInsert = await client.query(
        `INSERT INTO Payer (payer_code, payer_name, is_active, created_by, updated_by)
         VALUES ($1, $2, true, $3, $4) RETURNING payer_id`,
        [payer_id, payer_name, created_by, created_by]
      );
      payerUuid = payerInsert.rows[0].payer_id;
    } else {
      payerUuid = payerCheck.rows[0].payer_id;
    }

    const query = `
      INSERT INTO ProviderPayerMapping (
        provider_id, payer_id, enrollment_status, effective_date, termination_date,
        is_active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, true, $6, $7)
      RETURNING mapping_id as payer_mapping_id, enrollment_status, effective_date, termination_date
    `;

    const result = await client.query(query, [
      provider_id,
      payerUuid,
      enrollment_status,
      effective_date,
      termination_date,
      created_by,
      created_by
    ]);

    return { ...result.rows[0], payer_name, payer_id };
  } finally {
    client.release();
  }
}

/**
 * Update provider payer mapping
 */
export async function updateProviderPayerMapping(mappingId, mappingData) {
  const client = await pool.connect();

  try {
    const { enrollment_status, effective_date, termination_date, updated_by } = mappingData;

    const query = `
      UPDATE ProviderPayerMapping
      SET
        enrollment_status = $1,
        effective_date = $2,
        termination_date = $3,
        updated_by = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE mapping_id = $5
      RETURNING mapping_id as payer_mapping_id, enrollment_status, effective_date, termination_date
    `;

    const result = await client.query(query, [
      enrollment_status,
      effective_date,
      termination_date,
      updated_by,
      mappingId
    ]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Delete provider payer mapping
 */
export async function deleteProviderPayerMapping(mappingId) {
  const client = await pool.connect();

  try {
    const query = `
      UPDATE ProviderPayerMapping
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE mapping_id = $1
      RETURNING mapping_id
    `;

    const result = await client.query(query, [mappingId]);
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}
