-- Migration: Make date_of_birth nullable in Patient table
-- Date: 2025-10-07
-- Description: Allow NULL values for date_of_birth since it may not always be available in parsed 837 files

ALTER TABLE Patient
ALTER COLUMN date_of_birth DROP NOT NULL;

COMMENT ON COLUMN Patient.date_of_birth IS 'Patient date of birth - nullable since it may not be available in all data sources';
