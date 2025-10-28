-- ===============================================
-- COPY THIS ENTIRE SCRIPT AND RUN IN PGADMIN OR PSQL
-- ===============================================

-- Create the UserFacilityMapping table
CREATE TABLE IF NOT EXISTS UserFacilityMapping (
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    facility_id UUID REFERENCES Facilities(facility_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES Users(user_id),
    PRIMARY KEY (user_id, facility_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_facility_user ON UserFacilityMapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_facility_facility ON UserFacilityMapping(facility_id);

-- Add comments for documentation
COMMENT ON TABLE UserFacilityMapping IS 'Maps users to facilities for facility-level access control';
COMMENT ON COLUMN UserFacilityMapping.assigned_at IS 'Timestamp when facility was assigned to user';
COMMENT ON COLUMN UserFacilityMapping.assigned_by IS 'User who performed the assignment';

-- Verify table was created
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'userfacilitymapping'
ORDER BY ordinal_position;
