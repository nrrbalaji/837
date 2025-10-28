-- Add facility_id to Provider table to link providers to facilities

ALTER TABLE Provider
ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES Facilities(facility_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_provider_facility_id ON Provider(facility_id);

-- Comment
COMMENT ON COLUMN Provider.facility_id IS 'Links provider to a specific facility';
