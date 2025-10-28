-- =====================================================
-- Multi-Mode Ingestion Enhancement Migration
-- Version: 1.0
-- Date: 2025-10-14
-- Purpose: Add SFTP and Local Folder ingestion capabilities
-- =====================================================

-- =====================================================
-- PHASE 1: Facilities Table Enhancement
-- =====================================================

-- Add ingestion mode column
ALTER TABLE Facilities
ADD COLUMN IF NOT EXISTS ingestion_mode VARCHAR(20) DEFAULT 'REST_API'
    CHECK (ingestion_mode IN ('REST_API', 'SFTP', 'LOCAL_FOLDER'));

-- Add data_format column
ALTER TABLE Facilities
ADD COLUMN IF NOT EXISTS data_format VARCHAR(10) DEFAULT 'FHIR'
    CHECK (data_format IN ('FHIR', 'HL7'));

-- Add ingestion configuration JSONB column
ALTER TABLE Facilities
ADD COLUMN IF NOT EXISTS ingestion_config JSONB DEFAULT '{}';

-- Create index for filtering by mode
CREATE INDEX IF NOT EXISTS idx_facilities_ingestion_mode
ON Facilities(ingestion_mode)
WHERE is_active = TRUE;

-- Add column comments
COMMENT ON COLUMN Facilities.ingestion_mode IS
'Ingestion method: REST_API (default), SFTP, LOCAL_FOLDER';

COMMENT ON COLUMN Facilities.data_format IS
'Data format expected and supported: FHIR or HL7';

COMMENT ON COLUMN Facilities.ingestion_config IS
'Mode-specific configuration (SFTP/Local settings) stored as JSONB';

-- =====================================================
-- PHASE 2: UploadFileDetail Table Enhancement
-- =====================================================

-- Add source tracking columns
ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS ingestion_mode VARCHAR(20) DEFAULT 'REST_API';

ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS source_host VARCHAR(255);

ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS source_path TEXT;

ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP;

ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP;

-- Create indexes for reporting and filtering
CREATE INDEX IF NOT EXISTS idx_upload_file_ingestion_mode
ON UploadFileDetail(ingestion_mode);

CREATE INDEX IF NOT EXISTS idx_upload_file_processing_status
ON UploadFileDetail(upload_status, ingestion_mode, uploaded_at);

-- Add column comments
COMMENT ON COLUMN UploadFileDetail.ingestion_mode IS
'Source ingestion method for this file: REST_API, SFTP, LOCAL_FOLDER';

COMMENT ON COLUMN UploadFileDetail.source_host IS
'SFTP hostname or "localhost" for local files';

COMMENT ON COLUMN UploadFileDetail.source_path IS
'Original file path (remote SFTP path or local filesystem path)';

COMMENT ON COLUMN UploadFileDetail.processing_started_at IS
'Timestamp when file processing began';

COMMENT ON COLUMN UploadFileDetail.processing_completed_at IS
'Timestamp when file processing completed (success or failure)';

-- =====================================================
-- PHASE 3: Create IngestionLog Table
-- =====================================================

CREATE TABLE IF NOT EXISTS IngestionLog (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID REFERENCES Facilities(facility_id) ON DELETE CASCADE,
    ingestion_mode VARCHAR(20) NOT NULL
        CHECK (ingestion_mode IN ('REST_API', 'SFTP', 'LOCAL_FOLDER')),
    file_name VARCHAR(255),
    source_path TEXT,
    file_size_bytes BIGINT,
    checksum VARCHAR(64),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('SUCCESS', 'FAILED', 'DUPLICATE', 'QUARANTINED')),
    error_message TEXT,
    error_type VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    processing_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_id UUID REFERENCES UploadFileDetail(file_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ingestion_log_facility
ON IngestionLog(facility_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_status
ON IngestionLog(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_mode
ON IngestionLog(ingestion_mode, status);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_created
ON IngestionLog(created_at DESC);

-- Add table comment
COMMENT ON TABLE IngestionLog IS
'Audit trail for all file ingestion attempts across all modes (REST API, SFTP, Local Folder)';

COMMENT ON COLUMN IngestionLog.status IS
'SUCCESS: File processed successfully, FAILED: Processing error, DUPLICATE: File already exists, QUARANTINED: Moved to quarantine';

COMMENT ON COLUMN IngestionLog.error_type IS
'Error classification: CONNECTION_ERROR, AUTHENTICATION_ERROR, VALIDATION_ERROR, PROCESSING_ERROR, PERMISSION_ERROR';

-- =====================================================
-- PHASE 4: Create Ingestion Statistics View
-- =====================================================

CREATE OR REPLACE VIEW vw_ingestion_statistics AS
SELECT
    f.facility_id,
    f.facility_code,
    f.facility_name,
    f.ingestion_mode,
    f.is_active,
    COUNT(il.log_id) FILTER (WHERE il.status = 'SUCCESS') as successful_files,
    COUNT(il.log_id) FILTER (WHERE il.status = 'FAILED') as failed_files,
    COUNT(il.log_id) FILTER (WHERE il.status = 'DUPLICATE') as duplicate_files,
    COUNT(il.log_id) FILTER (WHERE il.status = 'QUARANTINED') as quarantined_files,
    COUNT(il.log_id) as total_files,
    AVG(il.processing_duration_ms) FILTER (WHERE il.status = 'SUCCESS') as avg_processing_ms,
    MAX(il.created_at) FILTER (WHERE il.status = 'SUCCESS') as last_successful_ingestion,
    SUM(il.file_size_bytes) FILTER (WHERE il.status = 'SUCCESS') as total_bytes_processed
FROM Facilities f
LEFT JOIN IngestionLog il ON f.facility_id = il.facility_id
    AND il.created_at >= NOW() - INTERVAL '30 days'
GROUP BY f.facility_id, f.facility_code, f.facility_name, f.ingestion_mode, f.is_active;

COMMENT ON VIEW vw_ingestion_statistics IS
'Aggregated ingestion statistics per facility for the last 30 days';

-- =====================================================
-- PHASE 5: Sample Configuration Data
-- =====================================================

-- Example: Update a facility to use SFTP mode (commented out - for reference)
/*
UPDATE Facilities
SET
    ingestion_mode = 'SFTP',
    ingestion_config = '{
        "mode": "SFTP",
        "sftp": {
            "enabled": true,
            "host": "ftp.example.com",
            "port": 22,
            "username": "facility_user",
            "auth_method": "ssh_key",
            "password_encrypted": null,
            "private_key_path": "/keys/facility.pem",
            "input_folder": "/inbound/837",
            "output_folder": "/outbound/837",
            "archive_folder": "/archive",
            "poll_interval_seconds": 300,
            "connection_timeout_seconds": 30,
            "max_retries": 3
        }
    }'::jsonb
WHERE facility_code = 'FAC001';
*/

-- Example: Update a facility to use Local Folder mode (commented out - for reference)
/*
UPDATE Facilities
SET
    ingestion_mode = 'LOCAL_FOLDER',
    ingestion_config = '{
        "mode": "LOCAL_FOLDER",
        "local": {
            "enabled": true,
            "input_folder": "/data/837/input",
            "output_folder": "/data/837/output",
            "archive_folder": "/data/837/archive",
            "watch_recursive": false,
            "debounce_milliseconds": 2000
        }
    }'::jsonb
WHERE facility_code = 'FAC002';
*/

-- =====================================================
-- PHASE 6: Create Helper Functions
-- =====================================================

-- Function to get facility ingestion status
CREATE OR REPLACE FUNCTION get_facility_ingestion_status(p_facility_id UUID)
RETURNS TABLE (
    facility_id UUID,
    facility_code VARCHAR,
    ingestion_mode VARCHAR,
    is_enabled BOOLEAN,
    last_successful_ingestion TIMESTAMP,
    total_files_processed BIGINT,
    total_files_failed BIGINT,
    avg_processing_time_ms NUMERIC,
    quarantined_files BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.facility_id,
        f.facility_code,
        f.ingestion_mode,
        f.is_active as is_enabled,
        MAX(il.created_at) FILTER (WHERE il.status = 'SUCCESS') as last_successful_ingestion,
        COUNT(*) FILTER (WHERE il.status = 'SUCCESS') as total_files_processed,
        COUNT(*) FILTER (WHERE il.status = 'FAILED') as total_files_failed,
        AVG(il.processing_duration_ms) FILTER (WHERE il.status = 'SUCCESS') as avg_processing_time_ms,
        COUNT(*) FILTER (WHERE il.status = 'QUARANTINED') as quarantined_files
    FROM Facilities f
    LEFT JOIN IngestionLog il ON f.facility_id = il.facility_id
    WHERE f.facility_id = p_facility_id
    GROUP BY f.facility_id, f.facility_code, f.ingestion_mode, f.is_active;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_facility_ingestion_status IS
'Returns ingestion statistics and status for a specific facility';

-- =====================================================
-- PHASE 7: Verification Queries
-- =====================================================

-- Verify table alterations
DO $$
DECLARE
    v_facilities_cols INTEGER;
    v_upload_cols INTEGER;
    v_ingestion_table BOOLEAN;
BEGIN
    -- Check Facilities columns
    SELECT COUNT(*) INTO v_facilities_cols
    FROM information_schema.columns
    WHERE table_name = 'facilities'
        AND column_name IN ('ingestion_mode', 'data_format', 'ingestion_config');

    -- Check UploadFileDetail columns
    SELECT COUNT(*) INTO v_upload_cols
    FROM information_schema.columns
    WHERE table_name = 'uploadfiledetail'
        AND column_name IN ('ingestion_mode', 'source_host', 'source_path',
                           'processing_started_at', 'processing_completed_at');

    -- Check IngestionLog table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'ingestionlog'
    ) INTO v_ingestion_table;

    -- Report results
    RAISE NOTICE '✓ Facilities table: % new columns added', v_facilities_cols;
    RAISE NOTICE '✓ UploadFileDetail table: % new columns added', v_upload_cols;

    IF v_ingestion_table THEN
        RAISE NOTICE '✓ IngestionLog table created successfully';
    ELSE
        RAISE WARNING '✗ IngestionLog table NOT created';
    END IF;

    -- Success message
    IF v_facilities_cols = 3 AND v_upload_cols = 5 AND v_ingestion_table THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Migration completed successfully!';
        RAISE NOTICE '========================================';
    ELSE
        RAISE WARNING 'Migration may have issues. Please verify manually.';
    END IF;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
