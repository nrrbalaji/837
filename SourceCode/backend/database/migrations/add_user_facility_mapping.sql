-- User Facility Mapping Table
-- This table maps users to facilities for access control
-- Admin users can see all facilities, while standard users only see assigned facilities

CREATE TABLE IF NOT EXISTS UserFacilityMapping (
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    facility_id UUID REFERENCES Facilities(facility_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES Users(user_id),
    PRIMARY KEY (user_id, facility_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_facility_user ON UserFacilityMapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_facility_facility ON UserFacilityMapping(facility_id);

-- Add comment for documentation
COMMENT ON TABLE UserFacilityMapping IS 'Maps users to facilities for facility-level access control';
COMMENT ON COLUMN UserFacilityMapping.assigned_at IS 'Timestamp when facility was assigned to user';
COMMENT ON COLUMN UserFacilityMapping.assigned_by IS 'User who performed the assignment';
