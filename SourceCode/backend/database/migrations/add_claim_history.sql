-- Add ClaimHistory table
-- Migration for Claim History tracking

CREATE TABLE IF NOT EXISTS ClaimHistory (
    id SERIAL PRIMARY KEY,
    file_id UUID REFERENCES UploadFileDetail(file_id) ON DELETE CASCADE,
    notes TEXT,
    status VARCHAR(50),
    operation_type VARCHAR(50) NOT NULL,
    operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_detail UUID REFERENCES Users(user_id)
);

-- Add constraint for valid operation types
ALTER TABLE ClaimHistory ADD CONSTRAINT valid_operation_types
CHECK (operation_type IN ('Parsing', 'Validation', 'Auto Correction', 'Manual Correction', 'Export'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_claim_history_file_id ON ClaimHistory(file_id);
CREATE INDEX IF NOT EXISTS idx_claim_history_operation_type ON ClaimHistory(operation_type);
CREATE INDEX IF NOT EXISTS idx_claim_history_operation_date ON ClaimHistory(operation_date DESC);
CREATE INDEX IF NOT EXISTS idx_claim_history_status ON ClaimHistory(status);

-- Add comment for documentation
COMMENT ON TABLE ClaimHistory IS 'Tracks the history of operations performed on claims including parsing, validation, corrections, and exports';
COMMENT ON COLUMN ClaimHistory.id IS 'Primary key - auto increment';
COMMENT ON COLUMN ClaimHistory.file_id IS 'Reference to the uploaded file this history entry belongs to';
COMMENT ON COLUMN ClaimHistory.notes IS 'Additional notes about the operation';
COMMENT ON COLUMN ClaimHistory.status IS 'Status of the operation (e.g., SUCCESS, FAILED, PENDING)';
COMMENT ON COLUMN ClaimHistory.operation_type IS 'Type of operation performed';
COMMENT ON COLUMN ClaimHistory.operation_date IS 'When the operation was performed';
COMMENT ON COLUMN ClaimHistory.user_detail IS 'ID of the user who performed the operation';
