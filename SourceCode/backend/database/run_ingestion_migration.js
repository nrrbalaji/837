import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "10.1.9.161",
  database: process.env.DB_NAME || "Claim837",
  password: process.env.DB_PASSWORD || "hlnotes",
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function runIngestionMigration() {
  const client = await pool.connect();

  try {
    console.log("🚀 Starting ingestion migration...");

    // Read the migration file
    const migrationPath = path.join(__dirname, "migrations", "add_multi_mode_ingestion.sql");
    const migration = fs.readFileSync(migrationPath, "utf8");

    // Execute the migration
    await client.query(migration);

    console.log("✅ Ingestion migration completed successfully!");
    console.log("\nAdded columns to Facilities table:");
    console.log("  - ingestion_mode (VARCHAR)");
    console.log("  - data_format (VARCHAR)");
    console.log("  - ingestion_config (JSONB)");
    console.log("\nCreated IngestionLog table for audit trail");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runIngestionMigration();
