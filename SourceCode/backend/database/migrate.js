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
  password: process.env.DB_PASSWORD || "admin",
  port: parseInt(process.env.DB_PORT) || 5434,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("🚀 Starting database migration...");

    // Read the schema file
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    // Execute the schema
    await client.query(schema);

    console.log("✅ Database schema created successfully!");
    console.log("\nCreated tables:");
    console.log(
      "  - Master Tables: Users, UserRole, Facilities, Provider, Payer, Patient"
    );
    console.log(
      "  - Transaction Tables: UploadFileDetail, BatchDetail, ClaimHeader, ClaimLine, etc."
    );
    console.log(
      "  - Validation Logs: FileValidationLog, EDIValidationLog, BusinessValidationLog"
    );
    console.log("  - Correction & Audit: CorrectionLog, AuditLog");
    console.log("  - Rules: ValidationRules, CorrectionRules");
    console.log("  - Transmission: TransmissionLog, AcknowledgmentLog");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
