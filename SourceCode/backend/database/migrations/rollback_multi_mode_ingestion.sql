-- =====================================================
-- Multi-Mode Ingestion Enhancement Rollback Migration
-- Version: 1.0
-- Date: 2025-10-14
-- Purpose: Rollback SFTP and Local Folder ingestion changes
-- =====================================================

-- WARNING: This will remove all ingestion configuration and logs
-- Ensure you have backups before proceeding

BEGIN;

-- =====================================================
-- PHASE 1: Drop Helper Functions
-- =====================================================

DROP FUNCTION IF EXISTS get_facility_ingestion_status(UUID);

-- =====================================================
-- PHASE 2: Drop Views
-- =====================================================

DROP VIEW IF EXISTS vw_ingestion_statistics;

-- =====================================================
-- PHASE 3: Drop IngestionLog Table
-- =====================================================

-- Drop indexes first
DROP INDEX IF EXISTS idx_ingestion_log_facility;
DROP INDEX IF EXISTS idx_ingestion_log_status;
DROP INDEX IF EXISTS idx_ingestion_log_mode;
DROP INDEX IF EXISTS idx_ingestion_log_created;

-- Drop table
DROP TABLE IF EXISTS IngestionLog;

-- =====================================================
-- PHASE 4: Remove UploadFileDetail Columns
-- =====================================================

-- Drop indexes
DROP INDEX IF EXISTS idx_upload_file_ingestion_mode;
DROP INDEX IF EXISTS idx_upload_file_processing_status;

-- Remove columns
ALTER TABLE UploadFileDetail DROP COLUMN IF EXISTS ingestion_mode;
ALTER TABLE UploadFileDetail DROP COLUMN IF EXISTS source_host;
ALTER TABLE UploadFileDetail DROP COLUMN IF EXISTS source_path;
ALTER TABLE UploadFileDetail DROP COLUMN IF EXISTS processing_started_at;
ALTER TABLE UploadFileDetail DROP COLUMN IF EXISTS processing_completed_at;

-- =====================================================
-- PHASE 5: Remove Facilities Columns
-- =====================================================

-- Drop index
DROP INDEX IF EXISTS idx_facilities_ingestion_mode;

-- Remove columns
ALTER TABLE Facilities DROP COLUMN IF EXISTS ingestion_mode;
ALTER TABLE Facilities DROP COLUMN IF EXISTS ingestion_config;

-- =====================================================
-- PHASE 6: Verification
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Rollback completed successfully!';
    RAISE NOTICE 'All multi-mode ingestion changes removed';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- =====================================================
-- END OF ROLLBACK
-- =====================================================
