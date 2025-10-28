-- Remove UNIQUE constraint from claim_number column in ClaimHeader table
-- This allows the same claim number to exist across different files

-- Drop the unique constraint
ALTER TABLE ClaimHeader DROP CONSTRAINT IF EXISTS claimheader_claim_number_key;

-- Optionally, create a composite unique constraint if you want claim_number to be unique within a file
-- ALTER TABLE ClaimHeader ADD CONSTRAINT claimheader_file_claim_number_key UNIQUE (file_id, claim_number);
