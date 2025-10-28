import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting database migration...\n');

    // Read the SQL file
    const sqlFilePath = join(__dirname, 'add_master_tables.sql');
    const sql = readFileSync(sqlFilePath, 'utf8');

    console.log('📄 Executing SQL migration script...\n');

    // Execute the SQL
    await client.query(sql);

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Tables created:');
    console.log('   - TradingPartnerMaster');
    console.log('   - ProviderPayerMapping');
    console.log('   - FacilityPayerMapping');
    console.log('   - MasterDataAuditLog');
    console.log('\n✅ Indexes created');
    console.log('✅ Triggers created');
    console.log('✅ RBAC roles seeded (Admin, Ops, Analyst)\n');

    // Verify tables
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('tradingpartnermaster', 'masterdataauditlog', 'providerpayermapping', 'facilitypayermapping')
      ORDER BY table_name
    `);

    console.log('📋 Verification - Tables created:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Check roles
    const rolesResult = await client.query('SELECT role_name, description FROM UserRole ORDER BY role_name');
    console.log('\n🔐 RBAC Roles:');
    rolesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.role_name} - ${row.description}`);
    });

    console.log('\n🎉 Migration complete! Next step: run seed script');
    console.log('   node backend/database/seed_master_data.js\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Tables already exist. This is okay - they were created previously.');
      console.log('   You can proceed to seed the data:\n');
      console.log('   node backend/database/seed_master_data.js\n');
    } else {
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
