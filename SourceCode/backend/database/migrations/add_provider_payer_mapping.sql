-- Provider-Payer Mapping Table
-- Tracks provider enrollment with different payers

CREATE TABLE IF NOT EXISTS ProviderPayerMapping (
    mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES Provider(provider_id) ON DELETE CASCADE,
    payer_id UUID REFERENCES Payer(payer_id) ON DELETE CASCADE,
    enrollment_status VARCHAR(50) DEFAULT 'Active', -- Active, Pending, Inactive, Terminated
    effective_date DATE NOT NULL,
    termination_date DATE,
    provider_payer_id VARCHAR(50), -- Provider's ID with this specific payer
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id),
    UNIQUE(provider_id, payer_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_provider_payer_mapping_provider ON ProviderPayerMapping(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_payer_mapping_payer ON ProviderPayerMapping(payer_id);
CREATE INDEX IF NOT EXISTS idx_provider_payer_mapping_status ON ProviderPayerMapping(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_provider_payer_mapping_dates ON ProviderPayerMapping(effective_date, termination_date);

-- Comments
COMMENT ON TABLE ProviderPayerMapping IS 'Tracks provider enrollment and credentialing status with different payers';
COMMENT ON COLUMN ProviderPayerMapping.enrollment_status IS 'Current enrollment status: Active, Pending, Inactive, Terminated';
COMMENT ON COLUMN ProviderPayerMapping.provider_payer_id IS 'Provider ID as recognized by the specific payer';
COMMENT ON COLUMN ProviderPayerMapping.effective_date IS 'Date when provider enrollment became effective';
COMMENT ON COLUMN ProviderPayerMapping.termination_date IS 'Date when provider enrollment was terminated (if applicable)';
