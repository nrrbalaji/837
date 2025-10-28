import ftpIngestionService from "./ftpIngestionService.js";
import fileWatcherService from "./fileWatcherService.js";
import pool from "../config/database.js";

/**
 * Ingestion Manager Service
 * Orchestrates all ingestion services (SFTP and Local Folder)
 * Handles initialization, shutdown, and health monitoring
 */

class IngestionManager {
  constructor() {
    this.isInitialized = false;
    this.services = {
      sftp: ftpIngestionService,
      localFolder: fileWatcherService,
    };
    this.healthCheckInterval = null;
  }

  /**
   * Initialize all ingestion services
   */
  async init() {
    if (this.isInitialized) {
      console.warn("Ingestion Manager already initialized");
      return;
    }

    console.log("===========================================");
    console.log("  Initializing Ingestion Manager");
    console.log("===========================================");

    try {
      // Initialize SFTP service
      console.log("\n[1/2] Initializing SFTP Ingestion Service...");
      await ftpIngestionService.init();

      // Initialize File Watcher service
      console.log("\n[2/2] Initializing File Watcher Service...");
      await fileWatcherService.init();

      this.isInitialized = true;

      // Start health check monitoring
      this.startHealthMonitoring();

      console.log("\n===========================================");
      console.log("  ✓ Ingestion Manager Ready");
      console.log("===========================================\n");
    } catch (error) {
      console.error("Failed to initialize Ingestion Manager:", error);
      throw error;
    }
  }

  /**
   * Start health check monitoring
   */
  startHealthMonitoring() {
    // Check health every 5 minutes
    const intervalMs = 5 * 60 * 1000;

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealth();
        console.log("Ingestion services health check:", health);
      } catch (error) {
        console.error("Health check failed:", error.message);
      }
    }, intervalMs);
  }

  /**
   * Get health status of all ingestion services
   * @returns {Promise<Object>} Health status
   */
  async getHealth() {
    const client = await pool.connect();

    try {
      // Count active facilities by mode
      const facilitiesResult = await client.query(`
        SELECT
          ingestion_mode,
          COUNT(*) as count
        FROM Facilities
        WHERE is_active = TRUE
          AND ingestion_mode IN ('SFTP', 'LOCAL_FOLDER')
        GROUP BY ingestion_mode
      `);

      const activeFacilities = {};
      for (const row of facilitiesResult.rows) {
        activeFacilities[row.ingestion_mode] = parseInt(row.count);
      }

      // Get recent ingestion statistics (last hour)
      const statsResult = await client.query(`
        SELECT
          ingestion_mode,
          status,
          COUNT(*) as count,
          AVG(processing_duration_ms) as avg_duration_ms
        FROM IngestionLog
        WHERE created_at >= NOW() - INTERVAL '1 hour'
        GROUP BY ingestion_mode, status
      `);

      const recentStats = {};
      for (const row of statsResult.rows) {
        const mode = row.ingestion_mode;
        if (!recentStats[mode]) {
          recentStats[mode] = {};
        }
        recentStats[mode][row.status] = {
          count: parseInt(row.count),
          avg_duration_ms: row.avg_duration_ms
            ? Math.round(parseFloat(row.avg_duration_ms))
            : null,
        };
      }

      // Get last successful ingestion per mode
      const lastSuccessResult = await client.query(`
        SELECT DISTINCT ON (ingestion_mode)
          ingestion_mode,
          created_at as last_success
        FROM IngestionLog
        WHERE status = 'SUCCESS'
        ORDER BY ingestion_mode, created_at DESC
      `);

      const lastSuccess = {};
      for (const row of lastSuccessResult.rows) {
        lastSuccess[row.ingestion_mode] = row.last_success;
      }

      return {
        status: this.isInitialized ? "healthy" : "initializing",
        timestamp: new Date().toISOString(),
        services: {
          sftp: {
            status: "running",
            active_facilities: activeFacilities.SFTP || 0,
            active_pollers: ftpIngestionService.pollIntervals.size,
            last_successful_ingestion: lastSuccess.SFTP || null,
            recent_stats: recentStats.SFTP || {},
          },
          local_folder: {
            status: "running",
            active_facilities: activeFacilities.LOCAL_FOLDER || 0,
            active_watchers: fileWatcherService.watchers.size,
            last_successful_ingestion: lastSuccess.LOCAL_FOLDER || null,
            recent_stats: recentStats.LOCAL_FOLDER || {},
          },
        },
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get detailed status for a specific facility
   * @param {string} facilityId - Facility UUID
   * @returns {Promise<Object>} Facility status
   */
  async getFacilityStatus(facilityId) {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `
        SELECT * FROM get_facility_ingestion_status($1)
      `,
        [facilityId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Facility ${facilityId} not found`);
      }

      const status = result.rows[0];

      // Add service-specific status
      let serviceStatus = null;
      if (status.ingestion_mode === "SFTP") {
        serviceStatus = {
          polling_active: ftpIngestionService.pollIntervals.has(facilityId),
          is_processing: Array.from(
            ftpIngestionService.processingFiles
          ).some((key) => key.startsWith(facilityId)),
        };
      } else if (status.ingestion_mode === "LOCAL_FOLDER") {
        serviceStatus = {
          watcher_active: fileWatcherService.watchers.has(facilityId),
          is_processing: Array.from(fileWatcherService.processingFiles).some(
            (path) => path.includes(facilityId)
          ),
        };
      }

      return {
        ...status,
        service_status: serviceStatus,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Restart ingestion for a specific facility
   * Used when configuration changes
   * @param {string} facilityId - Facility UUID
   */
  async restartFacility(facilityId) {
    const client = await pool.connect();

    try {
      // Get facility configuration
      const result = await client.query(
        `
        SELECT facility_id, facility_code, ingestion_mode, is_active
        FROM Facilities
        WHERE facility_id = $1
      `,
        [facilityId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Facility ${facilityId} not found`);
      }

      const facility = result.rows[0];

      console.log(
        `Restarting ingestion for facility ${facility.facility_code} (mode: ${facility.ingestion_mode})...`
      );

      // Stop existing services
      await ftpIngestionService.stopPolling(facilityId);
      await fileWatcherService.stopWatching(facilityId);

      // Start appropriate service if active
      if (facility.is_active) {
        if (facility.ingestion_mode === "SFTP") {
          await ftpIngestionService.restartPolling(facilityId);
        } else if (facility.ingestion_mode === "LOCAL_FOLDER") {
          await fileWatcherService.restartWatching(facilityId);
        }
      }

      console.log(
        `✓ Ingestion restarted for facility ${facility.facility_code}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Stop ingestion for a specific facility
   * @param {string} facilityId - Facility UUID
   */
  async stopFacility(facilityId) {
    console.log(`Stopping ingestion for facility ${facilityId}...`);

    await ftpIngestionService.stopPolling(facilityId);
    await fileWatcherService.stopWatching(facilityId);

    console.log(`✓ Ingestion stopped for facility ${facilityId}`);
  }

  /**
   * Reload all facilities (useful after bulk configuration changes)
   */
  async reloadAllFacilities() {
    console.log("Reloading all facilities...");

    // Shutdown existing services
    await ftpIngestionService.shutdown();
    await fileWatcherService.shutdown();

    // Reinitialize
    this.isInitialized = false;
    await this.init();

    console.log("✓ All facilities reloaded");
  }

  /**
   * Get ingestion statistics
   * @param {Object} options - Filter options
   * @param {string} options.facilityId - Filter by facility
   * @param {string} options.mode - Filter by ingestion mode
   * @param {number} options.days - Number of days to look back (default: 7)
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics(options = {}) {
    const { facilityId, mode, days = 7 } = options;
    const client = await pool.connect();

    try {
      let query = `
        SELECT
          f.facility_id,
          f.facility_code,
          f.facility_name,
          f.ingestion_mode,
          COUNT(il.log_id) FILTER (WHERE il.status = 'SUCCESS') as successful_files,
          COUNT(il.log_id) FILTER (WHERE il.status = 'FAILED') as failed_files,
          COUNT(il.log_id) FILTER (WHERE il.status = 'DUPLICATE') as duplicate_files,
          COUNT(il.log_id) FILTER (WHERE il.status = 'QUARANTINED') as quarantined_files,
          COUNT(il.log_id) as total_files,
          AVG(il.processing_duration_ms) FILTER (WHERE il.status = 'SUCCESS') as avg_processing_ms,
          SUM(il.file_size_bytes) FILTER (WHERE il.status = 'SUCCESS') as total_bytes_processed,
          MAX(il.created_at) FILTER (WHERE il.status = 'SUCCESS') as last_successful_ingestion
        FROM Facilities f
        LEFT JOIN IngestionLog il ON f.facility_id = il.facility_id
          AND il.created_at >= NOW() - INTERVAL '${days} days'
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (facilityId) {
        query += ` AND f.facility_id = $${paramIndex++}`;
        params.push(facilityId);
      }

      if (mode) {
        query += ` AND f.ingestion_mode = $${paramIndex++}`;
        params.push(mode);
      }

      query += `
        GROUP BY f.facility_id, f.facility_code, f.facility_name, f.ingestion_mode
        ORDER BY successful_files DESC
      `;

      const result = await client.query(query, params);

      return {
        period_days: days,
        statistics: result.rows.map((row) => ({
          facility_id: row.facility_id,
          facility_code: row.facility_code,
          facility_name: row.facility_name,
          ingestion_mode: row.ingestion_mode,
          successful_files: parseInt(row.successful_files) || 0,
          failed_files: parseInt(row.failed_files) || 0,
          duplicate_files: parseInt(row.duplicate_files) || 0,
          quarantined_files: parseInt(row.quarantined_files) || 0,
          total_files: parseInt(row.total_files) || 0,
          avg_processing_ms: row.avg_processing_ms
            ? Math.round(parseFloat(row.avg_processing_ms))
            : null,
          total_bytes_processed: row.total_bytes_processed
            ? parseInt(row.total_bytes_processed)
            : 0,
          last_successful_ingestion: row.last_successful_ingestion,
        })),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Graceful shutdown of all ingestion services
   */
  async shutdown() {
    console.log("Shutting down Ingestion Manager...");

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown all services
    await Promise.all([
      ftpIngestionService.shutdown(),
      fileWatcherService.shutdown(),
    ]);

    this.isInitialized = false;
    console.log("✓ Ingestion Manager shut down");
  }
}

export default new IngestionManager();
