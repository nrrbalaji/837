-- Migration: Add revenue_code to ClaimLine table for institutional claims
-- Date: 2025-01-07
-- Description: Adds revenue_code column to support SV2 (837I - Institutional) claims

-- Add the revenue_code column
ALTER TABLE ClaimLine
ADD COLUMN IF NOT EXISTS revenue_code VARCHAR(4);

-- Add comment to document the column purpose
COMMENT ON COLUMN ClaimLine.revenue_code IS 'Revenue code from SV201 segment (Institutional claims only). Used for hospital/facility billing. E.g., 0300=Laboratory, 0450=Emergency Room';

-- Add index for revenue code lookups
CREATE INDEX IF NOT EXISTS idx_claimline_revenue_code ON ClaimLine(revenue_code);
