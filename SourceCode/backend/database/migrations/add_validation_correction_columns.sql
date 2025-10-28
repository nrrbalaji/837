-- Migration: Add new columns to ValidationRules and CorrectionRules tables
-- Date: 2025-10-12

-- =====================================================
-- Add columns to ValidationRules table
-- =====================================================

ALTER TABLE public.ValidationRules
ADD COLUMN IF NOT EXISTS segment_code VARCHAR(10) NULL,
ADD COLUMN IF NOT EXISTS element_position INT NULL,
ADD COLUMN IF NOT EXISTS loop_level VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS applies_to_claim_type VARCHAR(30) NULL DEFAULT 'BOTH',
ADD COLUMN IF NOT EXISTS auto_correct_enabled BOOLEAN NULL DEFAULT FALSE;

-- =====================================================
-- Add columns to CorrectionRules table
-- =====================================================

ALTER TABLE public.CorrectionRules
ADD COLUMN IF NOT EXISTS correction_source_type VARCHAR(50) NULL,      -- MASTER_LOOKUP / STATIC / FORMAT
ADD COLUMN IF NOT EXISTS is_test_mode BOOL NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by UUID NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS fallback_strategy VARCHAR(50) NULL;

-- Add foreign key constraint for approved_by column
ALTER TABLE public.CorrectionRules
ADD CONSTRAINT fk_correctionrules_approved_by
FOREIGN KEY (approved_by) REFERENCES Users(user_id);

-- =====================================================
-- Create indexes for new columns
-- =====================================================

-- ValidationRules indexes
CREATE INDEX IF NOT EXISTS idx_validationrules_segment_code ON ValidationRules(segment_code);
CREATE INDEX IF NOT EXISTS idx_validationrules_claim_type ON ValidationRules(applies_to_claim_type);
CREATE INDEX IF NOT EXISTS idx_validationrules_auto_correct ON ValidationRules(auto_correct_enabled);

-- CorrectionRules indexes
CREATE INDEX IF NOT EXISTS idx_correctionrules_source_type ON CorrectionRules(correction_source_type);
CREATE INDEX IF NOT EXISTS idx_correctionrules_test_mode ON CorrectionRules(is_test_mode);
CREATE INDEX IF NOT EXISTS idx_correctionrules_approved_by ON CorrectionRules(approved_by);

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON COLUMN ValidationRules.segment_code IS 'X12 segment code (e.g., NM1, REF, DTP)';
COMMENT ON COLUMN ValidationRules.element_position IS 'Position of element within segment';
COMMENT ON COLUMN ValidationRules.loop_level IS 'X12 loop identifier (e.g., 2000A, 2010AA)';
COMMENT ON COLUMN ValidationRules.applies_to_claim_type IS 'Claim type filter: PROFESSIONAL, INSTITUTIONAL, DENTAL, BOTH_PROFESSIONAL_AND_INSTITUTIONAL, or ALL';
COMMENT ON COLUMN ValidationRules.auto_correct_enabled IS 'Flag indicating if auto-correction is enabled for this validation rule';

COMMENT ON COLUMN CorrectionRules.correction_source_type IS 'Source type for correction: MASTER_LOOKUP, STATIC, or FORMAT';
COMMENT ON COLUMN CorrectionRules.is_test_mode IS 'Flag indicating if rule is in test mode';
COMMENT ON COLUMN CorrectionRules.approved_by IS 'User who approved the correction rule';
COMMENT ON COLUMN CorrectionRules.approved_at IS 'Timestamp when rule was approved';
COMMENT ON COLUMN CorrectionRules.fallback_strategy IS 'Fallback strategy when correction fails';
