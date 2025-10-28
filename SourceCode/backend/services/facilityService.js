import pool from "../config/database.js";

/**
 * Get all facilities with filtering, sorting, and pagination
 */
export async function getAllFacilities({
  page,
  limit,
  sortField,
  sortOrder,
  filters,
  userId = null,
  isAdmin = false,
} = {}) {
  const client = await pool.connect();

  try {
    // Handle simple list request (no pagination)
    if (!page || !limit) {
      let query;
      let queryParams = [];

      if (isAdmin || !userId) {
        // Admin or no user context - show all active facilities
        query = `
          SELECT
            facility_id,
            facility_code,
            facility_name,
            npi,
            tax_id,
            city,
            state,
            facility_type,
            is_active
          FROM Facilities
          WHERE is_active = true
          ORDER BY facility_name ASC
        `;
      } else {
        // Non-admin - show only assigned facilities
        query = `
          SELECT DISTINCT
            f.facility_id,
            f.facility_code,
            f.facility_name,
            f.npi,
            f.tax_id,
            f.city,
            f.state,
            f.facility_type,
            f.is_active
          FROM Facilities f
          INNER JOIN UserFacilityMapping ufm ON f.facility_id = ufm.facility_id
          WHERE f.is_active = true AND ufm.user_id = $1
          ORDER BY f.facility_name ASC
        `;
        queryParams = [userId];
      }

      const result = await client.query(query, queryParams);
      return result.rows;
    }

    // Paginated request
    const offset = (page - 1) * limit;
    const validSortFields = [
      "facility_name",
      "facility_code",
      "npi",
      "tax_id",
      "facility_type",
      "city",
      "state",
      "is_active",
    ];
    const orderByField = validSortFields.includes(sortField)
      ? sortField
      : "facility_name";
    const orderByDirection = sortOrder === "desc" ? "DESC" : "ASC";

    // Build WHERE clause
    const whereClauses = [];
    const queryParams = [];
    let paramCount = 1;

    // Add user-based filtering
    let fromClause = "FROM Facilities";
    let joinClause = "";

    if (!isAdmin && userId) {
      // Non-admin: join with UserFacilityMapping
      joinClause = "INNER JOIN UserFacilityMapping ufm ON Facilities.facility_id = ufm.facility_id";
      whereClauses.push(`ufm.user_id = $${paramCount}`);
      queryParams.push(userId);
      paramCount++;
    }

    if (filters?.search) {
      whereClauses.push(
        `(facility_name ILIKE $${paramCount} OR facility_code ILIKE $${paramCount} OR npi ILIKE $${paramCount} OR tax_id ILIKE $${paramCount})`
      );
      queryParams.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters?.facilityType) {
      whereClauses.push(`facility_type = $${paramCount}`);
      queryParams.push(filters.facilityType);
      paramCount++;
    }

    if (filters?.state) {
      whereClauses.push(`state = $${paramCount}`);
      queryParams.push(filters.state);
      paramCount++;
    }

    if (filters?.isActive !== null && filters?.isActive !== "") {
      whereClauses.push(`is_active = $${paramCount}`);
      queryParams.push(filters.isActive === "true");
      paramCount++;
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Get total count
    const countQuery = `SELECT COUNT(DISTINCT Facilities.facility_id) ${fromClause} ${joinClause} ${whereClause}`;
    const countResult = await client.query(countQuery, queryParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get facilities
    const query = `
      SELECT DISTINCT
        Facilities.facility_id,
        Facilities.facility_code,
        Facilities.facility_name,
        Facilities.npi,
        Facilities.tax_id,
        Facilities.address_line1,
        Facilities.address_line2,
        Facilities.city,
        Facilities.state,
        Facilities.zip_code,
        Facilities.phone,
        Facilities.fax,
        Facilities.email,
        Facilities.facility_type,
        Facilities.is_active,
        Facilities.ingestion_mode,
        Facilities.data_format,
        Facilities.ingestion_config,
        Facilities.created_at,
        Facilities.updated_at
      ${fromClause}
      ${joinClause}
      ${whereClause}
      ORDER BY Facilities.${orderByField} ${orderByDirection}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    queryParams.push(limit, offset);
    const result = await client.query(query, queryParams);

    return {
      facilities: result.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    };
  } finally {
    client.release();
  }
}

/**
 * Get facility by ID
 */
export async function getFacilityById(facilityId) {
  const client = await pool.connect();

  try {
    const query = `
      SELECT
        facility_id,
        facility_code,
        facility_name,
        npi,
        tax_id,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        phone,
        fax,
        email,
        facility_type,
        is_active,
        ingestion_mode,
        data_format,
        ingestion_config,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM Facilities
      WHERE facility_id = $1
    `;

    const result = await client.query(query, [facilityId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Create new facility
 */
export async function createFacility(facilityData) {
  const client = await pool.connect();

  try {
    const {
      facility_code,
      facility_name,
      npi,
      tax_id,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      fax,
      email,
      facility_type,
      is_active,
      ingestion_mode,
      data_format,
      ingestion_config,
      created_by,
      updated_by,
    } = facilityData;

    const insertQuery = `
      INSERT INTO Facilities (
        facility_code,
        facility_name,
        npi,
        tax_id,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        phone,
        fax,
        email,
        facility_type,
        is_active,
        ingestion_mode,
        data_format,
        ingestion_config,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const values = [
      facility_code,
      facility_name,
      npi,
      tax_id,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      fax,
      email,
      facility_type,
      is_active !== false,
      ingestion_mode || null,
      data_format || null,
      ingestion_config ? JSON.stringify(ingestion_config) : null,
      created_by,
      updated_by,
    ];

    const result = await client.query(insertQuery, values);
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Update facility
 */
export async function updateFacility(facilityId, facilityData) {
  const client = await pool.connect();

  try {
    const {
      facility_code,
      facility_name,
      npi,
      tax_id,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      fax,
      email,
      facility_type,
      is_active,
      ingestion_mode,
      data_format,
      ingestion_config,
      updated_by,
    } = facilityData;

    const updateQuery = `
      UPDATE Facilities
      SET
        facility_code = $1,
        facility_name = $2,
        npi = $3,
        tax_id = $4,
        address_line1 = $5,
        address_line2 = $6,
        city = $7,
        state = $8,
        zip_code = $9,
        phone = $10,
        fax = $11,
        email = $12,
        facility_type = $13,
        is_active = $14,
        ingestion_mode = $15,
        data_format = $16,
        ingestion_config = $17,
        updated_by = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE facility_id = $19
      RETURNING *
    `;

    const values = [
      facility_code,
      facility_name,
      npi,
      tax_id,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      phone,
      fax,
      email,
      facility_type,
      is_active !== false,
      ingestion_mode || null,
      data_format || null,
      ingestion_config ? JSON.stringify(ingestion_config) : null,
      updated_by,
      facilityId,
    ];

    const result = await client.query(updateQuery, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  } finally {
    client.release();
  }
}

/**
 * Delete facility (soft delete)
 */
export async function deleteFacility(facilityId, userId) {
  const client = await pool.connect();

  try {
    const query = `
      UPDATE Facilities
      SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
      WHERE facility_id = $2
      RETURNING facility_id
    `;

    const result = await client.query(query, [userId, facilityId]);
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}
