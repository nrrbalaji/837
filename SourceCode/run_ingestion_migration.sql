-- =====================================================
-- QUICK FIX: Add Missing Columns to Facilities Table
-- Run this SQL directly in your PostgreSQL database
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

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'facilities'
  AND column_name IN ('ingestion_mode', 'data_format', 'ingestion_config')
ORDER BY column_name;

-- Success message
SELECT 'Migration completed! Columns added to Facilities table.' as status;
