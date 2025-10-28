import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

async function runMigration() {
    try {
        console.log('Connecting to database...');
        console.log(`Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
        console.log(`Database: ${process.env.DB_NAME}`);

        const migrationFile = path.join(__dirname, 'migrations', 'add_patient_control_number.sql');
        const sql = fs.readFileSync(migrationFile, 'utf8');

        console.log('\nExecuting migration...');
        await pool.query(sql);

        console.log('\n✓ Migration completed successfully!');
        console.log('✓ PatientControlNumber column added to Patient table');
        console.log('✓ Index created on PatientControlNumber');

        // Verify the column was added
        const result = await pool.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'patient' AND column_name = 'patientcontrolnumber'
        `);

        if (result.rows.length > 0) {
            console.log('\nColumn details:');
            console.log(result.rows[0]);
        }

    } catch (err) {
        console.error('\n✗ Migration failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
