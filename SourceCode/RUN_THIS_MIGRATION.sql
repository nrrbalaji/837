-- ===============================================
-- UserFacilityMapping Table Migration
-- Run this file directly on your PostgreSQL server
-- ===============================================

-- This script creates the UserFacilityMapping table
-- for facility-level access control

-- Usage:
-- Option 1: Run from psql command line on the database server
--   psql -U postgres -d Claim837 -f RUN_THIS_MIGRATION.sql

-- Option 2: Copy and paste into pgAdmin query window

-- Option 3: Connect via psql and run:
--   \i 'path/to/RUN_THIS_MIGRATION.sql'

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

-- Verification query (optional - uncomment to run)
-- SELECT
--     table_name,
--     column_name,
--     data_type,
--     is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'userfacilitymapping'
-- ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ UserFacilityMapping table created successfully!';
    RAISE NOTICE '   - Table: UserFacilityMapping';
    RAISE NOTICE '   - Indexes: idx_user_facility_user, idx_user_facility_facility';
    RAISE NOTICE '   - Ready for facility-level access control';
END $$;
