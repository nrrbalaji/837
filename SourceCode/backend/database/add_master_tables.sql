-- Additional Master Tables for RCM Application
-- Trading Partner Master and Audit Tables

-- =====================================================
-- TRADING PARTNER MASTER TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS TradingPartnerMaster (
    trading_partner_id VARCHAR(50) PRIMARY KEY,
    partner_name VARCHAR(255) NOT NULL,
    partner_type VARCHAR(50) NOT NULL, -- Sender, Receiver, Both
    sender_qualifier VARCHAR(10),
    sender_id VARCHAR(50),
    receiver_qualifier VARCHAR(10),
    receiver_id VARCHAR(50),
    direction VARCHAR(20), -- Inbound, Outbound, Bidirectional
    default_payer_id UUID REFERENCES Payer(payer_id),
    channel_type VARCHAR(20), -- SFTP, API, HL7, FHIR
    endpoint_url TEXT,
    sftp_config JSONB, -- SFTP credentials, paths, etc.
    api_config JSONB, -- API keys, authentication details
    edi_version VARCHAR(20) DEFAULT '5010', -- X12 version
    test_mode BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'Active', -- Active, Inactive, Testing
    effective_from DATE,
    effective_to DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id),
    UNIQUE(sender_qualifier, sender_id, receiver_qualifier, receiver_id)
);

-- =====================================================
-- PROVIDER-PAYER MAPPING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ProviderPayerMapping (
    mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES Provider(provider_id) ON DELETE CASCADE,
    payer_id UUID REFERENCES Payer(payer_id) ON DELETE CASCADE,
    payer_provider_id VARCHAR(50), -- Payer-specific provider ID
    enrollment_status VARCHAR(50) DEFAULT 'Active', -- Active, Pending, Inactive, Terminated
    effective_date DATE NOT NULL,
    termination_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id),
    UNIQUE(provider_id, payer_id)
);

-- =====================================================
-- FACILITY-PAYER MAPPING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS FacilityPayerMapping (
    link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID REFERENCES Facilities(facility_id) ON DELETE CASCADE,
    payer_id UUID REFERENCES Payer(payer_id) ON DELETE CASCADE,
    payer_facility_id VARCHAR(50), -- Payer-specific facility ID
    enrollment_status VARCHAR(50) DEFAULT 'Active', -- Active, Pending, Inactive, Terminated
    effective_date DATE NOT NULL,
    termination_date DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id),
    UNIQUE(facility_id, payer_id)
);

-- =====================================================
-- MASTER DATA AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS MasterDataAuditLog (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES Users(user_id),
    table_name VARCHAR(100) NOT NULL, -- Provider, Payer, Facility, TradingPartnerMaster
    record_id VARCHAR(100) NOT NULL, -- UUID or ID of the record
    action VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE, IMPORT, EXPORT
    old_values JSONB, -- Previous state
    new_values JSONB, -- New state
    changes JSONB, -- Specific field changes
    ip_address VARCHAR(45),
    user_agent TEXT,
    reason TEXT, -- Optional reason for change
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Trading Partner indexes
CREATE INDEX idx_trading_partner_name ON TradingPartnerMaster(partner_name);
CREATE INDEX idx_trading_partner_type ON TradingPartnerMaster(partner_type);
CREATE INDEX idx_trading_partner_status ON TradingPartnerMaster(status);
CREATE INDEX idx_trading_partner_direction ON TradingPartnerMaster(direction);

-- Provider-Payer Mapping indexes
CREATE INDEX idx_provider_payer_provider_id ON ProviderPayerMapping(provider_id);
CREATE INDEX idx_provider_payer_payer_id ON ProviderPayerMapping(payer_id);
CREATE INDEX idx_provider_payer_status ON ProviderPayerMapping(enrollment_status);
CREATE INDEX idx_provider_payer_active ON ProviderPayerMapping(is_active);

-- Facility-Payer Mapping indexes
CREATE INDEX idx_facility_payer_facility_id ON FacilityPayerMapping(facility_id);
CREATE INDEX idx_facility_payer_payer_id ON FacilityPayerMapping(payer_id);
CREATE INDEX idx_facility_payer_status ON FacilityPayerMapping(enrollment_status);
CREATE INDEX idx_facility_payer_active ON FacilityPayerMapping(is_active);

-- Master Audit Log indexes
CREATE INDEX idx_master_audit_user_id ON MasterDataAuditLog(user_id);
CREATE INDEX idx_master_audit_table_record ON MasterDataAuditLog(table_name, record_id);
CREATE INDEX idx_master_audit_action ON MasterDataAuditLog(action);
CREATE INDEX idx_master_audit_timestamp ON MasterDataAuditLog(action_timestamp DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE TRIGGER update_trading_partner_updated_at
    BEFORE UPDATE ON TradingPartnerMaster
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_payer_mapping_updated_at
    BEFORE UPDATE ON ProviderPayerMapping
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_facility_payer_mapping_updated_at
    BEFORE UPDATE ON FacilityPayerMapping
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ADD facility_id TO Provider TABLE (if not exists)
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'provider' AND column_name = 'facility_id'
    ) THEN
        ALTER TABLE Provider ADD COLUMN facility_id UUID REFERENCES Facilities(facility_id);
        CREATE INDEX idx_provider_facility_id ON Provider(facility_id);
    END IF;
END $$;

-- =====================================================
-- SEED DEFAULT ROLES FOR RBAC
-- =====================================================

INSERT INTO UserRole (role_name, description, permissions)
VALUES
    ('Admin', 'Full system access with all permissions',
     '{"masters": ["create", "read", "update", "delete", "import", "export"],
       "claims": ["create", "read", "update", "delete", "process"],
       "users": ["create", "read", "update", "delete"],
       "settings": ["read", "update"]}'::jsonb),
    ('Ops', 'Operations team with claim processing and master data read access',
     '{"masters": ["read"],
       "claims": ["create", "read", "update", "process"],
       "users": ["read"],
       "settings": ["read"]}'::jsonb),
    ('Analyst', 'Read-only access for reporting and analysis',
     '{"masters": ["read", "export"],
       "claims": ["read", "export"],
       "users": ["read"],
       "settings": ["read"]}'::jsonb)
ON CONFLICT (role_name) DO NOTHING;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE TradingPartnerMaster IS 'Stores trading partner configurations for EDI transmission';
COMMENT ON TABLE ProviderPayerMapping IS 'Maps providers to payers with enrollment details';
COMMENT ON TABLE FacilityPayerMapping IS 'Maps facilities to payers with enrollment details';
COMMENT ON TABLE MasterDataAuditLog IS 'Audit trail for all master data changes';
