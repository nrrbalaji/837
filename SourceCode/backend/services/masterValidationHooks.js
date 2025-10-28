import pool from '../config/database.js';

/**
 * Master Data Validation Hooks
 * Validates claims against master data and triggers revalidation when masters change
 */

/**
 * Validate provider exists and is active
 */
export async function validateProvider(npi) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT provider_id, npi, first_name, last_name, is_active FROM Provider WHERE npi = $1',
      [npi]
    );

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'PROVIDER_NOT_FOUND',
        message: `Provider with NPI ${npi} not found in master data`
      };
    }

    const provider = result.rows[0];

    if (!provider.is_active) {
      return {
        valid: false,
        error: 'PROVIDER_INACTIVE',
        message: `Provider ${provider.first_name} ${provider.last_name} (NPI: ${npi}) is inactive`
      };
    }

    return {
      valid: true,
      provider: provider
    };
  } finally {
    client.release();
  }
}

/**
 * Validate payer exists and is active
 */
export async function validatePayer(payerCode) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT payer_id, payer_code, payer_name, is_active FROM Payer WHERE payer_code = $1',
      [payerCode]
    );

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'PAYER_NOT_FOUND',
        message: `Payer with code ${payerCode} not found in master data`
      };
    }

    const payer = result.rows[0];

    if (!payer.is_active) {
      return {
        valid: false,
        error: 'PAYER_INACTIVE',
        message: `Payer ${payer.payer_name} (${payerCode}) is inactive`
      };
    }

    return {
      valid: true,
      payer: payer
    };
  } finally {
    client.release();
  }
}

/**
 * Validate facility exists and is active
 */
export async function validateFacility(facilityCode) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT facility_id, facility_code, facility_name, is_active FROM Facilities WHERE facility_code = $1',
      [facilityCode]
    );

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'FACILITY_NOT_FOUND',
        message: `Facility with code ${facilityCode} not found in master data`
      };
    }

    const facility = result.rows[0];

    if (!facility.is_active) {
      return {
        valid: false,
        error: 'FACILITY_INACTIVE',
        message: `Facility ${facility.facility_name} (${facilityCode}) is inactive`
      };
    }

    return {
      valid: true,
      facility: facility
    };
  } finally {
    client.release();
  }
}

/**
 * Validate provider-payer enrollment
 */
export async function validateProviderPayerEnrollment(providerId, payerId) {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        ppm.*,
        p.payer_name
      FROM ProviderPayerMapping ppm
      JOIN Payer p ON ppm.payer_id = p.payer_id
      WHERE ppm.provider_id = $1 AND ppm.payer_id = $2 AND ppm.is_active = true
    `, [providerId, payerId]);

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'ENROLLMENT_NOT_FOUND',
        message: 'Provider is not enrolled with this payer'
      };
    }

    const enrollment = result.rows[0];

    // Check if enrollment is within effective dates
    const now = new Date();
    const effectiveDate = new Date(enrollment.effective_date);
    const terminationDate = enrollment.termination_date ? new Date(enrollment.termination_date) : null;

    if (now < effectiveDate) {
      return {
        valid: false,
        error: 'ENROLLMENT_NOT_EFFECTIVE',
        message: `Enrollment not effective until ${effectiveDate.toDateString()}`
      };
    }

    if (terminationDate && now > terminationDate) {
      return {
        valid: false,
        error: 'ENROLLMENT_TERMINATED',
        message: `Enrollment terminated on ${terminationDate.toDateString()}`
      };
    }

    if (enrollment.enrollment_status !== 'Active' && enrollment.enrollment_status !== 'Approved') {
      return {
        valid: false,
        error: 'ENROLLMENT_NOT_ACTIVE',
        message: `Enrollment status is ${enrollment.enrollment_status}`
      };
    }

    return {
      valid: true,
      enrollment: enrollment
    };
  } finally {
    client.release();
  }
}

/**
 * Validate claim envelope against master data
 */
export async function validateClaimEnvelope(claimData) {
  const errors = [];
  const warnings = [];

  // Validate provider
  if (claimData.provider_npi) {
    const providerValidation = await validateProvider(claimData.provider_npi);
    if (!providerValidation.valid) {
      errors.push(providerValidation);
    }
  } else {
    errors.push({
      error: 'PROVIDER_NPI_MISSING',
      message: 'Provider NPI is required'
    });
  }

  // Validate payer
  if (claimData.payer_code) {
    const payerValidation = await validatePayer(claimData.payer_code);
    if (!payerValidation.valid) {
      errors.push(payerValidation);
    }
  } else {
    errors.push({
      error: 'PAYER_CODE_MISSING',
      message: 'Payer code is required'
    });
  }

  // Validate facility
  if (claimData.facility_code) {
    const facilityValidation = await validateFacility(claimData.facility_code);
    if (!facilityValidation.valid) {
      errors.push(facilityValidation);
    }
  }

  // Validate provider-payer enrollment if both are valid
  if (claimData.provider_id && claimData.payer_id) {
    const enrollmentValidation = await validateProviderPayerEnrollment(
      claimData.provider_id,
      claimData.payer_id
    );
    if (!enrollmentValidation.valid) {
      warnings.push(enrollmentValidation);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Mark claims for revalidation when master data changes
 */
export async function markClaimsForRevalidation(tableName, recordId, changeType) {
  const client = await pool.connect();

  try {
    let query;
    let params = [recordId];

    switch (tableName) {
      case 'Provider':
        query = `
          UPDATE ClaimHeader
          SET validation_status = 'NEEDS_REVALIDATION',
              updated_at = CURRENT_TIMESTAMP
          WHERE provider_id = $1
            AND claim_status IN ('PENDING', 'VALIDATED')
        `;
        break;

      case 'Payer':
        query = `
          UPDATE ClaimHeader
          SET validation_status = 'NEEDS_REVALIDATION',
              updated_at = CURRENT_TIMESTAMP
          WHERE payer_id = $1
            AND claim_status IN ('PENDING', 'VALIDATED')
        `;
        break;

      case 'Facilities':
        query = `
          UPDATE ClaimHeader
          SET validation_status = 'NEEDS_REVALIDATION',
              updated_at = CURRENT_TIMESTAMP
          WHERE facility_id = $1
            AND claim_status IN ('PENDING', 'VALIDATED')
        `;
        break;

      case 'ProviderPayerMapping':
        // Get provider_id and payer_id from mapping
        const mappingResult = await client.query(
          'SELECT provider_id, payer_id FROM ProviderPayerMapping WHERE mapping_id = $1',
          [recordId]
        );

        if (mappingResult.rows.length > 0) {
          const { provider_id, payer_id } = mappingResult.rows[0];
          query = `
            UPDATE ClaimHeader
            SET validation_status = 'NEEDS_REVALIDATION',
                updated_at = CURRENT_TIMESTAMP
            WHERE provider_id = $1 AND payer_id = $2
              AND claim_status IN ('PENDING', 'VALIDATED')
          `;
          params = [provider_id, payer_id];
        }
        break;

      default:
        return { affected: 0 };
    }

    if (query) {
      const result = await client.query(query, params);
      return {
        affected: result.rowCount,
        tableName,
        recordId,
        changeType
      };
    }

    return { affected: 0 };
  } catch (error) {
    console.error('Error marking claims for revalidation:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Re-link claims to updated master data
 */
export async function relinkClaimsToMaster(tableName, oldValue, newValue) {
  const client = await pool.connect();

  try {
    let query;
    let params = [newValue, oldValue];

    switch (tableName) {
      case 'Provider':
        // Re-link claims by NPI
        query = `
          UPDATE ClaimHeader ch
          SET provider_id = p.provider_id,
              validation_status = 'NEEDS_REVALIDATION',
              updated_at = CURRENT_TIMESTAMP
          FROM Provider p
          WHERE p.npi = $1
            AND ch.provider_id IN (
              SELECT provider_id FROM Provider WHERE npi = $2
            )
        `;
        break;

      case 'Payer':
        // Re-link claims by payer code
        query = `
          UPDATE ClaimHeader ch
          SET payer_id = p.payer_id,
              validation_status = 'NEEDS_REVALIDATION',
              updated_at = CURRENT_TIMESTAMP
          FROM Payer p
          WHERE p.payer_code = $1
            AND ch.payer_id IN (
              SELECT payer_id FROM Payer WHERE payer_code = $2
            )
        `;
        break;

      case 'Facilities':
        // Re-link claims by facility code
        query = `
          UPDATE ClaimHeader ch
          SET facility_id = f.facility_id,
              validation_status = 'NEEDS_REVALIDATION',
              updated_at = CURRENT_TIMESTAMP
          FROM Facilities f
          WHERE f.facility_code = $1
            AND ch.facility_id IN (
              SELECT facility_id FROM Facilities WHERE facility_code = $2
            )
        `;
        break;

      default:
        return { relinked: 0 };
    }

    if (query) {
      const result = await client.query(query, params);
      return {
        relinked: result.rowCount,
        tableName,
        oldValue,
        newValue
      };
    }

    return { relinked: 0 };
  } catch (error) {
    console.error('Error relinking claims:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default {
  validateProvider,
  validatePayer,
  validateFacility,
  validateProviderPayerEnrollment,
  validateClaimEnvelope,
  markClaimsForRevalidation,
  relinkClaimsToMaster
};
