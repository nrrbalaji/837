import fs from "fs";
import path from "path";
import pool from "./config/database.js";

/**
 * Simple migration runner for applying SQL migrations
 * Usage: node run_simple_migration.js <migration_file>
 */

async function runMigration(migrationFile) {
  console.log(`🚀 Running migration: ${migrationFile}\n`);

  try {
    // Read the migration file
    const sqlPath = path.join(
      process.cwd(),
      "backend/database/migrations",
      migrationFile
    );

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    console.log(`📄 Executing ${migrationFile}...\n`);

    // Execute the migration
    await pool.query(sqlContent);

    console.log(`✅ Migration completed successfully: ${migrationFile}\n`);
  } catch (error) {
    console.error(`❌ Migration failed:`, error.message);
    if (error.message.includes("already exists")) {
      console.log(`⚠️  Table(s) already exist - this is okay!`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check command line arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error("Usage: node run_simple_migration.js <migration_file>");
  console.error("Example: node run_simple_migration.js add_claim_history.sql");
  process.exit(1);
}

runMigration(migrationFile).catch((error) => {
  console.error("Migration execution error:", error);
  process.exit(1);
});
