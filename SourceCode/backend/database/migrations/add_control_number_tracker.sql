-- Control Number Tracker Table
-- Tracks ISA13, GS06, ST02 control numbers to prevent duplicates

CREATE TABLE IF NOT EXISTS ControlNumberTracker (
    tracker_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    control_number VARCHAR(50) NOT NULL,
    control_type VARCHAR(10) NOT NULL, -- ISA13, GS06, ST02
    file_name VARCHAR(255),
    file_id UUID REFERENCES UploadFileDetail(file_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(control_number, control_type)
);

-- Index for faster lookups
CREATE INDEX idx_control_number ON ControlNumberTracker(control_number, control_type);
CREATE INDEX idx_control_created_at ON ControlNumberTracker(created_at DESC);

-- Clean up any existing orphaned control numbers (where file_id is NULL)
DELETE FROM ControlNumberTracker WHERE file_id IS NULL;
