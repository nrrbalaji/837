import pool from '../config/database.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Seed Master Data from Excel Export (via Python conversion to JSON)
 */

async function seedMasterData() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting master data seed...\n');

    // You can convert the Excel file to JSON using pandas and import it
    // For now, we'll use the sample data from the Excel preview

    await client.query('BEGIN');

    // Seed Trading Partners
    console.log('📊 Seeding Trading Partners...');
    const tradingPartners = [
      {
        trading_partner_id: 'TP0001',
        partner_name: 'Epic_EHR_System',
        partner_type: 'Sender',
        sender_qualifier: 'ZZ',
        sender_id: 'EPIC_EHR_CA',
        receiver_qualifier: 'ZZ',
        receiver_id: 'RCM_SYSTEM',
        direction: 'Inbound',
        channel_type: 'SFTP',
        endpoint_url: 'sftp://ehr.epic.com/inbound',
        status: 'Active',
        effective_from: '2024-01-01',
        effective_to: '2026-12-31'
      },
      {
        trading_partner_id: 'TP0002',
        partner_name: 'ChangeHealthcare',
        partner_type: 'Receiver',
        sender_qualifier: '30',
        sender_id: 'RCM_SYSTEM',
        receiver_qualifier: '30',
        receiver_id: 'CHC_CLEARNET',
        direction: 'Outbound',
        channel_type: 'API',
        endpoint_url: 'https://api.changehealthcare.com/claims',
        status: 'Active',
        effective_from: '2024-01-01',
        effective_to: '2027-12-31'
      }
    ];

    for (const tp of tradingPartners) {
      await client.query(`
        INSERT INTO TradingPartnerMaster (
          trading_partner_id, partner_name, partner_type, sender_qualifier,
          sender_id, receiver_qualifier, receiver_id, direction, channel_type,
          endpoint_url, status, effective_from, effective_to, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
        ON CONFLICT (trading_partner_id) DO NOTHING
      `, [
        tp.trading_partner_id, tp.partner_name, tp.partner_type, tp.sender_qualifier,
        tp.sender_id, tp.receiver_qualifier, tp.receiver_id, tp.direction,
        tp.channel_type, tp.endpoint_url, tp.status, tp.effective_from, tp.effective_to
      ]);
    }
    console.log(`✅ Seeded ${tradingPartners.length} trading partners\n`);

    // Seed Payers
    console.log('📊 Seeding Payers...');
    const payers = [
      {
        payer_code: 'MED_A',
        payer_name: 'Medicare Part A',
        payer_type: 'Medicare',
        electronic_payer_id: '12345',
        city: 'Baltimore',
        state: 'MD',
        transmission_method: 'SFTP',
        endpoint_url: 'sftp://medicare.gov/inbound'
      },
      {
        payer_code: 'BC_CA',
        payer_name: 'BlueCross California',
        payer_type: 'Commercial',
        electronic_payer_id: 'BCAL001',
        city: 'Los Angeles',
        state: 'CA',
        transmission_method: 'API',
        endpoint_url: 'https://api.bluecrossca.com/claims'
      }
    ];

    for (const payer of payers) {
      const result = await client.query(`
        INSERT INTO Payer (
          payer_code, payer_name, payer_type, electronic_payer_id,
          city, state, transmission_method, endpoint_url, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT (payer_code) DO NOTHING
        RETURNING payer_id
      `, [
        payer.payer_code, payer.payer_name, payer.payer_type, payer.electronic_payer_id,
        payer.city, payer.state, payer.transmission_method, payer.endpoint_url
      ]);
    }
    console.log(`✅ Seeded ${payers.length} payers\n`);

    // Seed Facilities
    console.log('📊 Seeding Facilities...');
    const facilities = [
      {
        facility_code: 'METRO_MAIN',
        facility_name: 'Metro Health Main Campus',
        npi: '1234567890',
        tax_id: '98-7654321',
        facility_type: 'Clinic',
        city: 'Los Angeles',
        state: 'CA'
      },
      {
        facility_code: 'METRO_EAST',
        facility_name: 'Metro Health East Wing',
        npi: '1234567891',
        tax_id: '98-7654321',
        facility_type: 'Satellite Clinic',
        city: 'Pasadena',
        state: 'CA'
      }
    ];

    for (const facility of facilities) {
      await client.query(`
        INSERT INTO Facilities (
          facility_code, facility_name, npi, tax_id, facility_type,
          city, state, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        ON CONFLICT (facility_code) DO NOTHING
      `, [
        facility.facility_code, facility.facility_name, facility.npi, facility.tax_id,
        facility.facility_type, facility.city, facility.state
      ]);
    }
    console.log(`✅ Seeded ${facilities.length} facilities\n`);

    // Seed Providers
    console.log('📊 Seeding Providers...');
    const providers = [
      {
        npi: '1234567890',
        first_name: 'Metro',
        last_name: 'Health Clinic',
        taxonomy_code: '207Q00000X',
        specialty: 'Clinic',
        tax_id: '98-7654321',
        address: '100 Main St',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001'
      },
      {
        npi: '2233445566',
        first_name: 'Samuel',
        last_name: 'Joseph',
        taxonomy_code: '207R00000X',
        specialty: 'Physician',
        tax_id: '11-2233445',
        address: '25 First Ave',
        city: 'Sacramento',
        state: 'CA',
        zip: '94203'
      }
    ];

    for (const provider of providers) {
      await client.query(`
        INSERT INTO Provider (
          npi, first_name, last_name, taxonomy_code, specialty, license_number,
          address_line1, city, state, zip_code, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        ON CONFLICT (npi) DO NOTHING
      `, [
        provider.npi, provider.first_name, provider.last_name, provider.taxonomy_code,
        provider.specialty, provider.tax_id, provider.address, provider.city,
        provider.state, provider.zip
      ]);
    }
    console.log(`✅ Seeded ${providers.length} providers\n`);

    // Seed Provider-Payer Mappings
    console.log('📊 Seeding Provider-Payer Mappings...');
    const providerPayerMappings = [
      {
        provider_npi: '1234567890',
        payer_code: 'MED_A',
        payer_provider_id: '87654MEDA',
        enrollment_status: 'Approved',
        effective_date: '2024-01-01',
        termination_date: '2025-12-31'
      },
      {
        provider_npi: '1234567890',
        payer_code: 'BC_CA',
        payer_provider_id: '998877BCAL',
        enrollment_status: 'Approved',
        effective_date: '2024-03-01',
        termination_date: '2025-12-31'
      }
    ];

    for (const mapping of providerPayerMappings) {
      const providerResult = await client.query(
        'SELECT provider_id FROM Provider WHERE npi = $1',
        [mapping.provider_npi]
      );
      const payerResult = await client.query(
        'SELECT payer_id FROM Payer WHERE payer_code = $1',
        [mapping.payer_code]
      );

      if (providerResult.rows.length > 0 && payerResult.rows.length > 0) {
        await client.query(`
          INSERT INTO ProviderPayerMapping (
            provider_id, payer_id, enrollment_status,
            effective_date, termination_date, is_active
          )
          VALUES ($1, $2, $3, $4, $5, true)
          ON CONFLICT (provider_id, payer_id) DO NOTHING
        `, [
          providerResult.rows[0].provider_id,
          payerResult.rows[0].payer_id,
          mapping.enrollment_status,
          mapping.effective_date,
          mapping.termination_date
        ]);
      }
    }
    console.log(`✅ Seeded ${providerPayerMappings.length} provider-payer mappings\n`);

    await client.query('COMMIT');
    console.log('✅ Master data seed completed successfully!\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding master data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Always run seed when imported
seedMasterData()
  .then(() => {
    console.log('✅ Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });

export default seedMasterData;
