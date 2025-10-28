// Import dotenv first - before any other imports
import dotenv from "dotenv";
dotenv.config();
if (dotenv.config().error) {
  console.error("❌ Error loading .env file:", dotenv.config().error);
}

// Now import other modules
import pg from "pg";

// Debug logging to verify environment variables
console.log("Database Configuration Debug:");
console.log("DB_HOST:", process.env.DB_HOST || "NOT_SET");
console.log("DB_PORT:", process.env.DB_PORT || "NOT_SET");
console.log("DB_USER:", process.env.DB_USER || "NOT_SET");
console.log("DB_NAME:", process.env.DB_NAME || "NOT_SET");
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "[REDACTED]" : "NOT_SET");

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "10.1.9.161",
  database: process.env.DB_NAME || "Claim837",
  password: process.env.DB_PASSWORD || "hlnotes",
  port: parseInt(process.env.DB_PORT) || 5432, // Fixed default port to match PostgreSQL standard
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  keepAlive: true, // Enable keep-alive for connection stability
});

// Test database connection
pool.on("connect", () => {
  console.log("✅ Database connected successfully");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected database error:", err);
  process.exit(-1);
});

export default pool;
