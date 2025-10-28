-- Migration: Add PatientControlNumber column to Patient table
-- Date: 2025-10-07
-- Description: Adds PatientControlNumber VARCHAR(50) column to track patient records across changes

-- Add the column
ALTER TABLE Patient
ADD COLUMN IF NOT EXISTS PatientControlNumber VARCHAR(50);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_patient_control_number ON Patient(PatientControlNumber);

-- Add comment to document the column purpose
COMMENT ON COLUMN Patient.PatientControlNumber IS 'UUID column for tracking patient records across changes. When patient details change, a new record is created with the same PatientControlNumber but different patient_id';
