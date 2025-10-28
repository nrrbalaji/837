-- Cleanup script for ControlNumberTracker table
-- Run this after clearing other tables to remove orphaned control number records

-- Delete all control numbers where the referenced file no longer exists
DELETE FROM ControlNumberTracker
WHERE file_id IS NULL
   OR file_id NOT IN (SELECT file_id FROM UploadFileDetail WHERE is_deleted = false);

-- Or simply clear all control numbers (use this for testing/development)
-- DELETE FROM ControlNumberTracker;
