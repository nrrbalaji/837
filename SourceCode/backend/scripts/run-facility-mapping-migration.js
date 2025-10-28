import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '10.1.9.161',
  database: process.env.DB_NAME || 'Claim837',
  password: process.env.DB_PASSWORD || 'hlnotes',
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting UserFacilityMapping table migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add_user_facility_mapping.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded from:', migrationPath);
    console.log('\n--- SQL to be executed ---');
    console.log(migrationSQL);
    console.log('--- End of SQL ---\n');

    // Execute the migration
    await client.query('BEGIN');

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        console.log('⚙️  Executing:', statement.substring(0, 50) + '...');
        await client.query(statement);
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!\n');

    // Verify the table was created
    const verifyQuery = `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'userfacilitymapping'
      ORDER BY ordinal_position;
    `;

    const result = await client.query(verifyQuery);

    console.log('📋 Verification - UserFacilityMapping table structure:');
    console.table(result.rows);

    // Check indexes
    const indexQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'userfacilitymapping';
    `;

    const indexes = await client.query(indexQuery);
    console.log('\n📊 Indexes created:');
    console.table(indexes.rows);

    console.log('\n🎉 UserFacilityMapping table is ready to use!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n✨ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error.message);
    process.exit(1);
  });
