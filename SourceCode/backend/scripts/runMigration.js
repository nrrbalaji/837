import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting migration: add_user_facility_mapping.sql');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add_user_facility_mapping.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL loaded successfully\n');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - Created UserFacilityMapping table');
    console.log('   - Added indexes for faster queries');
    console.log('   - Added table and column comments');

    // Verify the table was created
    const verifyQuery = `
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name = 'userfacilitymapping'
    `;
    const result = await client.query(verifyQuery);

    if (result.rows[0].count === '1') {
      console.log('✅ Verified: UserFacilityMapping table exists in database');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n✨ All migrations completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
