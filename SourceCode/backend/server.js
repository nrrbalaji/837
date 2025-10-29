// Suppress punycode deprecation warning (from eslint dependency chain)
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" &&
    warning.message.includes("punycode")
  ) {
    return; // Ignore punycode deprecation warnings
  }
  console.warn(warning.name, warning.message);
});

// Load environment variables FIRST - before any other imports
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Import middleware
import { hipaaAuditLog, hipaaHeaders } from "./middleware/hipaa.js";
import {
  errorHandler,
  notFoundHandler,
  logger,
} from "./middleware/errorHandler.js";

// Import services
import ingestionManager from "./services/ingestionManager.js";

// Import routes
import authRoutes from "./routes/auth.js";
import claimRoutes from "./routes/claims.js";
import validationRoutes from "./routes/validations.js";
import validationLogRoutes from "./routes/validationLogs.js";
import dashboardRoutes from "./routes/dashboard.js";
import ruleRoutes from "./routes/rules.js";
import uploadRoutes from "./routes/upload.js";
import providerRoutes from "./routes/providers.js";
import facilityRoutes from "./routes/facilities.js";
import payerRoutes from "./routes/payers.js";
import tradingPartnerRoutes from "./routes/tradingPartners.js";
import migrationRoutes from "./routes/migrations.js";
import ingestionRoutes from "./routes/ingestion.js";
import fileRoutes from "./routes/files.js";
import userRoutes from "./routes/users.js";
import roleRoutes from "./routes/roles.js";
import userRoleRoutes from "./routes/userRoles.js";
import userFacilityRoutes from "./routes/userFacilities.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || "v1";

// Create required directories
const directories = ["logs", "uploads", "processed", "temp"];
directories.forEach((dir) => {
  const dirPath = path.join(__dirname, "..", dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// =====================================================
// MIDDLEWARE
// =====================================================

// Security middleware
app.use(helmet());
app.use(hipaaHeaders);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      process.env.CORS_ORIGIN
    ].filter(Boolean); // Remove undefined values

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow all localhost origins
    if (process.env.NODE_ENV !== "production" && origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }

    // In production, be more restrictive
    if (process.env.NODE_ENV === "production") {
      return callback(new Error("Not allowed by CORS"));
    }

    // For development, allow the origin
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(`/api/${API_VERSION}/`, limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression
app.use(compression());

// HIPAA audit logging
app.use(hipaaAuditLog);

// Request logging
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  next();
});

// =====================================================
// ROUTES
// =====================================================

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Ingestion services health check
app.get("/health/ingestion", async (req, res) => {
  try {
    const health = await ingestionManager.getHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// API routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/claims`, claimRoutes);
app.use(`/api/${API_VERSION}/validations`, validationRoutes);
app.use(`/api/${API_VERSION}/validation-logs`, validationLogRoutes);
app.use(`/api/${API_VERSION}/dashboard`, dashboardRoutes);
app.use(`/api/${API_VERSION}/rules`, ruleRoutes);
app.use(`/api/${API_VERSION}/upload`, uploadRoutes);
app.use(`/api/${API_VERSION}/providers`, providerRoutes);
app.use(`/api/${API_VERSION}/facilities`, facilityRoutes);
app.use(`/api/${API_VERSION}/payers`, payerRoutes);
app.use(`/api/${API_VERSION}/trading-partners`, tradingPartnerRoutes);
app.use(`/api/${API_VERSION}/migrations`, migrationRoutes);
app.use(`/api/${API_VERSION}/ingestion`, ingestionRoutes);
app.use(`/api/${API_VERSION}/files`, fileRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/roles`, roleRoutes);
app.use(`/api/${API_VERSION}/user-roles`, userRoleRoutes);
app.use(`/api/${API_VERSION}/user-facilities`, userFacilityRoutes);

// Serve frontend static files in production
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "..", "frontend", "dist");
  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// =====================================================
// ERROR HANDLING
// =====================================================

app.use(notFoundHandler);
app.use(errorHandler);

// =====================================================
// START SERVER
// =====================================================

const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log("");
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║   837 Claim Processing Platform                    ║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api/${API_VERSION}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log("");
  console.log("📊 Available endpoints:");
  console.log(`   - POST /api/${API_VERSION}/auth/login`);
  console.log(`   - POST /api/${API_VERSION}/upload`);
  console.log(`   - POST /api/${API_VERSION}/upload/fhir`);
  console.log(`   - GET  /api/${API_VERSION}/claims`);
  console.log(`   - GET  /api/${API_VERSION}/dashboard/metrics`);
  console.log("");
  logger.info("Server started successfully");

  // Initialize ingestion services
  try {
    await ingestionManager.init();
  } catch (error) {
    logger.error("Failed to initialize ingestion services:", error);
    console.error("⚠️  Warning: Ingestion services failed to start");
    console.error("   SFTP and Local Folder ingestion may not be available");
  }
});

// Handle graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} signal received: initiating graceful shutdown`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed");

    // Shutdown ingestion services
    try {
      await ingestionManager.shutdown();
    } catch (error) {
      logger.error("Error during ingestion services shutdown:", error);
    }

    logger.info("Graceful shutdown complete");
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
