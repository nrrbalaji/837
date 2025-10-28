-- Migration: Add llmsummary column to FileValidationLog table
-- Date: 2025-10-09
-- Description: Adds a nullable TEXT column to store LLM-generated summaries of validation logs

ALTER TABLE FileValidationLog
ADD COLUMN IF NOT EXISTS llmsummary TEXT;

-- Add comment to document the column
COMMENT ON COLUMN FileValidationLog.llmsummary IS 'LLM-generated summary of validation errors and warnings';
