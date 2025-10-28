import pool from '../config/database.js';

async function checkData() {
  const client = await pool.connect();

  try {
    console.log('🔍 Checking seeded data...\n');

    // Check Trading Partners
    const tpResult = await client.query('SELECT trading_partner_id, partner_name, status FROM TradingPartnerMaster');
    console.log('📊 Trading Partners:', tpResult.rows.length, 'records');
    tpResult.rows.forEach(row => {
      console.log(`   ✓ ${row.trading_partner_id} - ${row.partner_name} (${row.status})`);
    });

    // Check Payers
    const payerResult = await client.query('SELECT payer_code, payer_name, payer_type FROM Payer ORDER BY payer_code');
    console.log('\n📊 Payers:', payerResult.rows.length, 'records');
    payerResult.rows.forEach(row => {
      console.log(`   ✓ ${row.payer_code} - ${row.payer_name} (${row.payer_type})`);
    });

    // Check Facilities
    const facilityResult = await client.query('SELECT facility_code, facility_name FROM Facilities ORDER BY facility_code');
    console.log('\n📊 Facilities:', facilityResult.rows.length, 'records');
    facilityResult.rows.forEach(row => {
      console.log(`   ✓ ${row.facility_code} - ${row.facility_name}`);
    });

    // Check Providers
    const providerResult = await client.query('SELECT npi, first_name, last_name FROM Provider ORDER BY npi');
    console.log('\n📊 Providers:', providerResult.rows.length, 'records');
    providerResult.rows.forEach(row => {
      console.log(`   ✓ ${row.npi} - ${row.first_name} ${row.last_name}`);
    });

    // Check Provider-Payer Mappings
    const mappingResult = await client.query(`
      SELECT p.npi, pay.payer_code, ppm.enrollment_status
      FROM ProviderPayerMapping ppm
      JOIN Provider p ON ppm.provider_id = p.provider_id
      JOIN Payer pay ON ppm.payer_id = pay.payer_id
    `);
    console.log('\n📊 Provider-Payer Mappings:', mappingResult.rows.length, 'records');
    mappingResult.rows.forEach(row => {
      console.log(`   ✓ Provider ${row.npi} → Payer ${row.payer_code} (${row.enrollment_status})`);
    });

    console.log('\n✅ Data verification complete!\n');

  } catch (error) {
    console.error('❌ Error checking data:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkData();
