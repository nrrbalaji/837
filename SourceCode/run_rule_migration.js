// Script to run the validation/correction rules migration

import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "10.1.9.161",
  database: process.env.DB_NAME || "Claim837",
  password: process.env.DB_PASSWORD || "hlnotes",
  port: parseInt(process.env.DB_PORT) || 5434,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("🔄 Starting migration: add_validation_correction_columns");

    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      "backend",
      "database",
      "migrations",
      "add_validation_correction_columns.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    // Check if columns already exist
    const checkValidationRules = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'validationrules' AND column_name IN ('segment_code', 'element_position', 'loop_level', 'applies_to_claim_type')
    `);

    const checkCorrectionRules = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'correctionrules' AND column_name IN ('correction_source_type', 'is_test_mode', 'approved_by', 'approved_at')
    `);

    if (
      checkValidationRules.rows.length > 0 ||
      checkCorrectionRules.rows.length > 0
    ) {
      console.log(
        "⚠️  Some columns already exist. Migration may have been partially run."
      );
      console.log(
        "   Existing ValidationRules columns:",
        checkValidationRules.rows.map((r) => r.column_name).join(", ")
      );
      console.log(
        "   Existing CorrectionRules columns:",
        checkCorrectionRules.rows.map((r) => r.column_name).join(", ")
      );
      console.log("");
      console.log(
        "❓ Do you want to continue? This may cause errors for duplicate columns."
      );
      console.log(
        "   You can manually skip ALTER TABLE statements for existing columns in the migration file."
      );
      process.exit(0);
    }

    // Execute migration
    await client.query("BEGIN");
    await client.query(migrationSQL);
    await client.query("COMMIT");

    console.log("✅ Migration completed successfully!");
    console.log("");
    console.log("📊 Columns added to ValidationRules:");
    console.log("   - segment_code (VARCHAR(10))");
    console.log("   - element_position (INT)");
    console.log("   - loop_level (VARCHAR(50))");
    console.log("   - applies_to_claim_type (VARCHAR(30))");
    console.log("");
    console.log("📊 Columns added to CorrectionRules:");
    console.log("   - correction_source_type (VARCHAR(50))");
    console.log("   - is_test_mode (BOOL)");
    console.log("   - approved_by (UUID)");
    console.log("   - approved_at (TIMESTAMP)");
    console.log("");
    console.log("🎉 You can now use the Add/Edit Rule feature!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error.message);
    console.error("");
    console.error("Stack trace:", error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
