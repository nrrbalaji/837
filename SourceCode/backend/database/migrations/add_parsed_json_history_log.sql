-- Migration: Add Parsed JSON History Log Table
-- Purpose: Track all changes to parsed_json column in UploadFileDetail table using a log-based approach
-- Created: 2025-10-15
-- Modified: 2025-10-15 (Refactored to use log table only, no column changes to UploadFileDetail)

-- =====================================================
-- CREATE HISTORY LOG TABLE
-- =====================================================

-- Create table to log parsed_json history
CREATE TABLE IF NOT EXISTS ParsedJsonHistoryLog (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES UploadFileDetail(file_id) ON DELETE CASCADE,

    -- Version tracking (computed from log entries)
    version INTEGER NOT NULL,

    -- JSON snapshots
    previous_value JSONB,
    new_value JSONB NOT NULL,

    -- Change metadata
    change_type VARCHAR(50), -- INITIAL_PARSE, AUTO_CORRECTION, MANUAL_EDIT, REGENERATION, VALIDATION_UPDATE
    change_description TEXT,
    changes_summary JSONB, -- Summary of what changed (field paths, counts, etc.)

    -- Who made the change
    changed_by UUID REFERENCES Users(user_id),
    changed_by_username VARCHAR(100), -- Denormalized for faster queries
    changed_via VARCHAR(50), -- WEB_UI, API, AUTO_CORRECTION, PARSING_SERVICE, BACKGROUND_JOB

    -- When
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Additional context
    correction_log_ids UUID[], -- Array of correction_log IDs if this was due to corrections
    related_validation_ids UUID[], -- Array of validation IDs that triggered this change
    related_file_validation_id UUID, -- Link to FileValidationLog if applicable

    -- Audit fields
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Constraints
    CONSTRAINT unique_file_version_log UNIQUE(file_id, version)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_parsed_json_history_log_file_id ON ParsedJsonHistoryLog(file_id);
CREATE INDEX idx_parsed_json_history_log_changed_at ON ParsedJsonHistoryLog(changed_at DESC);
CREATE INDEX idx_parsed_json_history_log_change_type ON ParsedJsonHistoryLog(change_type);
CREATE INDEX idx_parsed_json_history_log_changed_by ON ParsedJsonHistoryLog(changed_by);
CREATE INDEX idx_parsed_json_history_log_version ON ParsedJsonHistoryLog(file_id, version DESC);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get the current version for a file
CREATE OR REPLACE FUNCTION get_current_parsed_json_version(p_file_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_current_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0)
    INTO v_current_version
    FROM ParsedJsonHistoryLog
    WHERE file_id = p_file_id;

    RETURN v_current_version;
END;
$$ LANGUAGE plpgsql;

-- Function to get the next version for a file
CREATE OR REPLACE FUNCTION get_next_parsed_json_version(p_file_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN get_current_parsed_json_version(p_file_id) + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to log parsed_json changes (can be called from application code)
CREATE OR REPLACE FUNCTION log_parsed_json_change(
    p_file_id UUID,
    p_previous_value JSONB,
    p_new_value JSONB,
    p_change_type VARCHAR(50),
    p_change_description TEXT,
    p_changed_by UUID DEFAULT NULL,
    p_changed_by_username VARCHAR(100) DEFAULT NULL,
    p_changed_via VARCHAR(50) DEFAULT 'APPLICATION',
    p_changes_summary JSONB DEFAULT NULL,
    p_correction_log_ids UUID[] DEFAULT NULL,
    p_related_validation_ids UUID[] DEFAULT NULL,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_next_version INTEGER;
BEGIN
    -- Get next version
    v_next_version := get_next_parsed_json_version(p_file_id);

    -- Insert log entry
    INSERT INTO ParsedJsonHistoryLog (
        file_id,
        version,
        previous_value,
        new_value,
        change_type,
        change_description,
        changed_by,
        changed_by_username,
        changed_via,
        changes_summary,
        correction_log_ids,
        related_validation_ids,
        ip_address,
        user_agent,
        changed_at
    ) VALUES (
        p_file_id,
        v_next_version,
        p_previous_value,
        p_new_value,
        p_change_type,
        p_change_description,
        p_changed_by,
        p_changed_by_username,
        p_changed_via,
        p_changes_summary,
        p_correction_log_ids,
        p_related_validation_ids,
        p_ip_address,
        p_user_agent,
        CURRENT_TIMESTAMP
    )
    RETURNING log_id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- OPTIONAL: AUTOMATIC TRIGGER (Commented out by default)
-- =====================================================

-- Uncomment the following if you want automatic logging via trigger
-- Note: This requires setting session variables before UPDATE
/*
CREATE OR REPLACE FUNCTION trigger_log_parsed_json_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_next_version INTEGER;
    v_change_type VARCHAR(50);
    v_change_description TEXT;
    v_changed_by UUID;
    v_changed_by_username VARCHAR(100);
    v_changed_via VARCHAR(50);
BEGIN
    -- Only track if parsed_json actually changed
    IF (OLD.parsed_json IS DISTINCT FROM NEW.parsed_json) THEN
        -- Get next version
        v_next_version := get_next_parsed_json_version(NEW.file_id);

        -- Get context from session variables (set by application)
        BEGIN
            v_change_type := current_setting('app.change_type', true);
            v_change_description := current_setting('app.change_description', true);
            v_changed_by := NULLIF(current_setting('app.changed_by', true), '')::UUID;
            v_changed_by_username := current_setting('app.changed_by_username', true);
            v_changed_via := current_setting('app.changed_via', true);
        EXCEPTION
            WHEN OTHERS THEN
                -- If session variables not set, use defaults
                v_change_type := 'UNKNOWN';
                v_change_description := 'Parsed JSON updated';
                v_changed_by := NULL;
                v_changed_by_username := 'system';
                v_changed_via := 'UNKNOWN';
        END;

        -- Insert log entry
        INSERT INTO ParsedJsonHistoryLog (
            file_id,
            version,
            previous_value,
            new_value,
            change_type,
            change_description,
            changed_by,
            changed_by_username,
            changed_via,
            changed_at
        ) VALUES (
            NEW.file_id,
            v_next_version,
            OLD.parsed_json,
            NEW.parsed_json,
            v_change_type,
            v_change_description,
            v_changed_by,
            v_changed_by_username,
            v_changed_via,
            CURRENT_TIMESTAMP
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- If anything fails, log warning but don't block the update
        RAISE WARNING 'Failed to log parsed_json change: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (commented out - uncomment if you want automatic logging)
-- DROP TRIGGER IF EXISTS trigger_log_parsed_json_changes ON UploadFileDetail;
-- CREATE TRIGGER trigger_log_parsed_json_changes
--     AFTER UPDATE ON UploadFileDetail
--     FOR EACH ROW
--     WHEN (OLD.parsed_json IS DISTINCT FROM NEW.parsed_json)
--     EXECUTE FUNCTION trigger_log_parsed_json_changes();
*/

-- =====================================================
-- VIEWS FOR EASY ACCESS
-- =====================================================

-- View for history with computed statistics
CREATE OR REPLACE VIEW ParsedJsonHistoryLogView AS
SELECT
    pjhl.log_id,
    pjhl.file_id,
    ufd.file_name,
    pjhl.version,
    pjhl.change_type,
    pjhl.change_description,
    pjhl.changed_by,
    pjhl.changed_by_username,
    pjhl.changed_via,
    pjhl.changed_at,
    pjhl.changes_summary,
    -- JSON size comparison
    pg_column_size(pjhl.previous_value) as previous_size_bytes,
    pg_column_size(pjhl.new_value) as new_size_bytes,
    pg_column_size(pjhl.new_value) - COALESCE(pg_column_size(pjhl.previous_value), 0) as size_difference_bytes,
    -- Time since last change
    pjhl.changed_at - LAG(pjhl.changed_at) OVER (PARTITION BY pjhl.file_id ORDER BY pjhl.version) as time_since_last_change,
    -- Is this the current version?
    CASE
        WHEN pjhl.version = MAX(pjhl.version) OVER (PARTITION BY pjhl.file_id)
        THEN true
        ELSE false
    END as is_current_version
FROM ParsedJsonHistoryLog pjhl
JOIN UploadFileDetail ufd ON pjhl.file_id = ufd.file_id
ORDER BY pjhl.file_id, pjhl.version DESC;

-- View for summary statistics per file
CREATE OR REPLACE VIEW ParsedJsonHistorySummary AS
SELECT
    file_id,
    COUNT(*) as total_versions,
    MIN(changed_at) as first_change_at,
    MAX(changed_at) as last_change_at,
    MAX(changed_at) - MIN(changed_at) as total_time_span,
    MAX(version) as current_version,
    COUNT(DISTINCT changed_by) as unique_changers,
    jsonb_agg(DISTINCT change_type) as change_types_used
FROM ParsedJsonHistoryLog
GROUP BY file_id;

-- =====================================================
-- ROLLBACK FUNCTION
-- =====================================================

-- Function to rollback to a specific version
CREATE OR REPLACE FUNCTION rollback_to_parsed_json_version(
    p_file_id UUID,
    p_target_version INTEGER,
    p_rollback_by UUID DEFAULT NULL,
    p_rollback_by_username VARCHAR(100) DEFAULT 'system',
    p_rollback_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_target_json JSONB;
    v_current_json JSONB;
    v_log_id UUID;
    v_description TEXT;
BEGIN
    -- Get the target version JSON
    SELECT new_value INTO v_target_json
    FROM ParsedJsonHistoryLog
    WHERE file_id = p_file_id AND version = p_target_version;

    IF v_target_json IS NULL THEN
        RAISE EXCEPTION 'Version % not found for file %', p_target_version, p_file_id;
    END IF;

    -- Get current JSON
    SELECT parsed_json INTO v_current_json
    FROM UploadFileDetail
    WHERE file_id = p_file_id;

    -- Build description
    v_description := format('Rolled back to version %s', p_target_version);
    IF p_rollback_reason IS NOT NULL THEN
        v_description := v_description || ': ' || p_rollback_reason;
    END IF;

    -- Log the rollback
    v_log_id := log_parsed_json_change(
        p_file_id := p_file_id,
        p_previous_value := v_current_json,
        p_new_value := v_target_json,
        p_change_type := 'ROLLBACK',
        p_change_description := v_description,
        p_changed_by := p_rollback_by,
        p_changed_by_username := p_rollback_by_username,
        p_changed_via := 'ROLLBACK_FUNCTION',
        p_changes_summary := jsonb_build_object(
            'rollback_to_version', p_target_version,
            'rollback_reason', p_rollback_reason
        )
    );

    -- Update the file
    UPDATE UploadFileDetail
    SET parsed_json = v_target_json,
        updated_at = CURRENT_TIMESTAMP
    WHERE file_id = p_file_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER QUERIES (Examples)
-- =====================================================

-- Get current version for a file
-- SELECT get_current_parsed_json_version('your-file-id-here');

-- Get all history for a file
-- SELECT * FROM ParsedJsonHistoryLogView WHERE file_id = 'your-file-id-here';

-- Get summary for all files
-- SELECT * FROM ParsedJsonHistorySummary;

-- Log a change manually
-- SELECT log_parsed_json_change(
--     'file-id',
--     '{"old": "data"}'::jsonb,
--     '{"new": "data"}'::jsonb,
--     'MANUAL_EDIT',
--     'Updated claim data',
--     'user-id',
--     'username',
--     'WEB_UI'
-- );

-- Rollback to version 2
-- SELECT rollback_to_parsed_json_version(
--     'file-id',
--     2,
--     'user-id',
--     'username',
--     'Reverting incorrect auto-correction'
-- );

-- =====================================================
-- PERMISSIONS (adjust as needed)
-- =====================================================

-- GRANT SELECT ON ParsedJsonHistoryLog TO your_read_role;
-- GRANT SELECT ON ParsedJsonHistoryLogView TO your_read_role;
-- GRANT SELECT ON ParsedJsonHistorySummary TO your_read_role;
-- GRANT INSERT ON ParsedJsonHistoryLog TO your_write_role;
-- GRANT EXECUTE ON FUNCTION log_parsed_json_change TO your_write_role;
-- GRANT EXECUTE ON FUNCTION get_current_parsed_json_version TO your_read_role;
-- GRANT EXECUTE ON FUNCTION rollback_to_parsed_json_version TO your_admin_role;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE ParsedJsonHistoryLog IS 'Log table tracking all changes to parsed_json in UploadFileDetail. No column changes to UploadFileDetail required.';
COMMENT ON COLUMN ParsedJsonHistoryLog.version IS 'Incremental version number for each file, computed automatically';
COMMENT ON COLUMN ParsedJsonHistoryLog.change_type IS 'Type of change: INITIAL_PARSE, AUTO_CORRECTION, MANUAL_EDIT, REGENERATION, VALIDATION_UPDATE, ROLLBACK';
COMMENT ON COLUMN ParsedJsonHistoryLog.changes_summary IS 'JSON object containing summary of changes (fields modified, correction count, etc.)';
COMMENT ON FUNCTION log_parsed_json_change IS 'Main function to log parsed_json changes. Call this explicitly from application code after updating parsed_json.';
COMMENT ON FUNCTION get_current_parsed_json_version IS 'Get the current version number for a file based on log entries';
COMMENT ON FUNCTION rollback_to_parsed_json_version IS 'Rollback parsed_json to a specific version, creating a new log entry';

-- =====================================================
-- CLEANUP OLD MIGRATION (if you ran the previous one)
-- =====================================================

-- If you previously ran add_parsed_json_history.sql, uncomment these to clean up:
/*
DROP TRIGGER IF EXISTS track_parsed_json_changes_trigger ON UploadFileDetail;
DROP FUNCTION IF EXISTS track_parsed_json_changes();
DROP VIEW IF EXISTS ParsedJsonHistoryView;
DROP TABLE IF EXISTS ParsedJsonHistory;
ALTER TABLE UploadFileDetail DROP COLUMN IF EXISTS parsed_json_version;
*/
