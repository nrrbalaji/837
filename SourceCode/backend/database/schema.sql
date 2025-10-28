-- 837 Claim Processing Platform Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- MASTER TABLES
-- =====================================================

-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id)
);

-- User Roles Table
CREATE TABLE IF NOT EXISTS UserRole (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Role Mapping
CREATE TABLE IF NOT EXISTS UserRoleMapping (
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    role_id UUID REFERENCES UserRole(role_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES Users(user_id),
    PRIMARY KEY (user_id, role_id)
);

-- Facilities Table
CREATE TABLE IF NOT EXISTS Facilities (
    facility_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_code VARCHAR(50) UNIQUE NOT NULL,
    facility_name VARCHAR(255) NOT NULL,
    npi VARCHAR(10),
    tax_id VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    phone VARCHAR(20),
    fax VARCHAR(20),
    email VARCHAR(255),
    facility_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id)
);

-- Providers Table
CREATE TABLE IF NOT EXISTS Provider (
    provider_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    npi VARCHAR(10) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    middle_name VARCHAR(50),
    taxonomy_code VARCHAR(20),
    specialty VARCHAR(100),
    license_number VARCHAR(50),
    license_state VARCHAR(2),
    dea_number VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    phone VARCHAR(20),
    fax VARCHAR(20),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id)
);

-- Payers Table
CREATE TABLE IF NOT EXISTS Payer (
    payer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payer_code VARCHAR(50) UNIQUE NOT NULL,
    payer_name VARCHAR(255) NOT NULL,
    payer_type VARCHAR(50), -- Medicare, Medicaid, Commercial, etc.
    trading_partner_id VARCHAR(50),
    electronic_payer_id VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    phone VARCHAR(20),
    fax VARCHAR(20),
    email VARCHAR(255),
    transmission_method VARCHAR(20), -- SFTP, API, HL7, FHIR
    endpoint_url TEXT,
    sftp_config JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id)
);

-- Patients Table
CREATE TABLE IF NOT EXISTS Patient (
    patient_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    PatientControlNumber VARCHAR(50), -- UUID column for tracking patient records across changes
    mrn VARCHAR(50) NOT NULL, -- Medical Record Number
    facility_id UUID REFERENCES Facilities(facility_id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(1), -- M, F, U
    ssn_encrypted VARCHAR(255), -- Encrypted SSN
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    insurance_id VARCHAR(50),
    insurance_group VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id),
    UNIQUE(mrn, facility_id)
);

-- =====================================================
-- TRANSACTION TABLES
-- =====================================================

-- Upload File Detail Table
CREATE TABLE IF NOT EXISTS UploadFileDetail (
    file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    file_type VARCHAR(20), -- X12_837, HL7, FHIR
    upload_method VARCHAR(20), -- API, SFTP, WEB_UI
    upload_status VARCHAR(20) DEFAULT 'UPLOADED', -- UPLOADED, PARSING, PARSED, FAILED
    parsed_json JSONB, -- Structured claim data
    parsing_errors JSONB,
    parsing_summary JSONB, -- Counts, totals, breakdowns
    uploaded_by UUID REFERENCES Users(user_id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parsed_at TIMESTAMP,
    checksum VARCHAR(64), -- SHA-256 hash for integrity
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID REFERENCES Users(user_id)
);

-- Batch Detail Table
CREATE TABLE IF NOT EXISTS BatchDetail (
    batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES UploadFileDetail(file_id),
    batch_number VARCHAR(50) NOT NULL,
    control_number VARCHAR(50),
    claim_count INTEGER DEFAULT 0,
    total_amount DECIMAL(12, 2),
    batch_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Claim Header Table
CREATE TABLE IF NOT EXISTS ClaimHeader (
    claim_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES UploadFileDetail(file_id),
    batch_id UUID REFERENCES BatchDetail(batch_id),
    claim_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID REFERENCES Patient(patient_id),
    facility_id UUID REFERENCES Facilities(facility_id),
    provider_id UUID REFERENCES Provider(provider_id),
    payer_id UUID REFERENCES Payer(payer_id),
    claim_type VARCHAR(20), -- Professional, Institutional
    claim_frequency_code VARCHAR(1),
    service_date_from DATE,
    service_date_to DATE,
    admission_date DATE,
    discharge_date DATE,
    statement_date DATE,
    total_charge DECIMAL(12, 2),
    patient_paid_amount DECIMAL(12, 2),
    place_of_service VARCHAR(2),
    claim_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VALIDATED, CORRECTED, TRANSMITTED, ACKNOWLEDGED, REJECTED
    validation_status VARCHAR(20) DEFAULT 'NOT_VALIDATED', -- NOT_VALIDATED, VALIDATING, PASSED, FAILED
    correction_status VARCHAR(20) DEFAULT 'NOT_CORRECTED', -- NOT_CORRECTED, AUTO_CORRECTED, MANUAL_REVIEW, CORRECTED
    transmission_status VARCHAR(20), -- PENDING, TRANSMITTED, ACKNOWLEDGED, REJECTED
    raw_claim_data JSONB,
    version INTEGER DEFAULT 1,
    parent_claim_id UUID REFERENCES ClaimHeader(claim_id), -- For corrections
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transmitted_at TIMESTAMP,
    acknowledged_at TIMESTAMP
);

-- Claim Line Table
CREATE TABLE IF NOT EXISTS ClaimLine (
    line_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES ClaimHeader(claim_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    service_date_from DATE,
    service_date_to DATE,
    place_of_service VARCHAR(2),
    revenue_code VARCHAR(4), -- For institutional claims (SV2) - e.g., 0300=Lab, 0450=ER
    procedure_code VARCHAR(10),
    procedure_modifier1 VARCHAR(2),
    procedure_modifier2 VARCHAR(2),
    procedure_modifier3 VARCHAR(2),
    procedure_modifier4 VARCHAR(2),
    quantity DECIMAL(10, 2),
    unit_charge DECIMAL(12, 2),
    total_charge DECIMAL(12, 2),
    diagnosis_pointer VARCHAR(10),
    rendering_provider_id UUID REFERENCES Provider(provider_id),
    line_status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(claim_id, line_number)
);

-- Claim Diagnosis Table
CREATE TABLE IF NOT EXISTS ClaimDiagnosis (
    diagnosis_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES ClaimHeader(claim_id) ON DELETE CASCADE,
    diagnosis_sequence INTEGER NOT NULL,
    diagnosis_code VARCHAR(10) NOT NULL,
    diagnosis_type VARCHAR(3), -- ICD-10-CM
    is_principal BOOLEAN DEFAULT FALSE,
    present_on_admission VARCHAR(1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(claim_id, diagnosis_sequence)
);

-- Claim Procedure Table
CREATE TABLE IF NOT EXISTS ClaimProcedure (
    procedure_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES ClaimHeader(claim_id) ON DELETE CASCADE,
    procedure_sequence INTEGER NOT NULL,
    procedure_code VARCHAR(10) NOT NULL,
    procedure_date DATE,
    procedure_type VARCHAR(10), -- ICD-10-PCS, CPT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(claim_id, procedure_sequence)
);

-- Claim Attachment Table
CREATE TABLE IF NOT EXISTS ClaimAttachment (
    attachment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES ClaimHeader(claim_id) ON DELETE CASCADE,
    attachment_type VARCHAR(50), -- Medical Records, Lab Results, etc.
    file_name VARCHAR(255),
    file_path TEXT,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES Users(user_id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- VALIDATION & CORRECTION LOGS
-- =====================================================

-- File Validation Log
CREATE TABLE IF NOT EXISTS FileValidationLog (
    validation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES UploadFileDetail(file_id) ON DELETE CASCADE,
    validation_type VARCHAR(50) DEFAULT 'FILE_LEVEL',
    validation_rule VARCHAR(100),
    severity VARCHAR(20), -- ERROR, WARNING, INFO
    error_code VARCHAR(20),
    error_message TEXT,
    error_location TEXT,
    llmsummary TEXT, -- LLM-generated summary of validation errors and warnings
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EDI Validation Log (X12 Structural)
CREATE TABLE IF NOT EXISTS EDIValidationLog (
    validation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES UploadFileDetail(file_id),
    claim_id UUID REFERENCES ClaimHeader(claim_id),
    validation_type VARCHAR(50) DEFAULT 'EDI_STRUCTURAL',
    segment_id VARCHAR(10),
    element_id VARCHAR(10),
    validation_rule VARCHAR(100),
    severity VARCHAR(20),
    error_code VARCHAR(20),
    error_message TEXT,
    error_location TEXT,
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Business Validation Log
CREATE TABLE IF NOT EXISTS BusinessValidationLog (
    validation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES ClaimHeader(claim_id) ON DELETE CASCADE,
    validation_type VARCHAR(50) DEFAULT 'BUSINESS_RULE',
    rule_id UUID,
    rule_name VARCHAR(100),
    field_name VARCHAR(100),
    current_value TEXT,
    severity VARCHAR(20),
    error_code VARCHAR(20),
    error_message TEXT,
    suggestion TEXT,
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Correction Log
CREATE TABLE IF NOT EXISTS CorrectionLog (
    correction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES ClaimHeader(claim_id) ON DELETE CASCADE,
    validation_id UUID, -- Links to specific validation error
    correction_type VARCHAR(20), -- AUTO, MANUAL
    field_name VARCHAR(100),
    field_path TEXT, -- JSON path for nested fields
    old_value TEXT,
    new_value TEXT,
    correction_reason TEXT,
    correction_rule VARCHAR(100),
    ai_confidence_score DECIMAL(5, 4), -- For AI-assisted corrections
    ai_reasoning TEXT,
    corrected_by UUID REFERENCES Users(user_id),
    corrected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by UUID REFERENCES Users(user_id),
    approved_at TIMESTAMP,
    is_approved BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- RULE ENGINE
-- =====================================================

-- Validation Rules
CREATE TABLE IF NOT EXISTS ValidationRules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_code VARCHAR(50) UNIQUE NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    rule_category VARCHAR(50), -- FILE, STRUCTURAL, BUSINESS, PAYER_SPECIFIC
    rule_type VARCHAR(50), -- REQUIRED_FIELD, FORMAT, RANGE, LOOKUP, CUSTOM
    description TEXT,
    field_name VARCHAR(100),
    field_path TEXT,
    validation_logic JSONB, -- Condition, operators, expected values
    error_message_template TEXT,
    severity VARCHAR(20) DEFAULT 'ERROR',
    is_active BOOLEAN DEFAULT TRUE,
    applies_to_payer UUID REFERENCES Payer(payer_id), -- NULL for all payers
    applies_to_facility UUID REFERENCES Facilities(facility_id), -- NULL for all facilities
    priority INTEGER DEFAULT 100,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id),
    updated_by UUID REFERENCES Users(user_id)
);

-- Correction Rules
CREATE TABLE IF NOT EXISTS CorrectionRules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_code VARCHAR(50) UNIQUE NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    validation_rule_id UUID REFERENCES ValidationRules(rule_id),
    correction_type VARCHAR(50), -- LOOKUP, CALCULATION, DEFAULT_VALUE, AI_ASSISTED
    correction_logic JSONB,
    lookup_table VARCHAR(100),
    lookup_column VARCHAR(100),
    default_value TEXT,
    requires_approval BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES Users(user_id)
);

-- =====================================================
-- TRANSMISSION & ACKNOWLEDGMENT
-- =====================================================

-- Transmission Log
CREATE TABLE IF NOT EXISTS TransmissionLog (
    transmission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID REFERENCES ClaimHeader(claim_id),
    batch_id UUID REFERENCES BatchDetail(batch_id),
    payer_id UUID REFERENCES Payer(payer_id),
    transmission_method VARCHAR(20),
    transmission_format VARCHAR(20), -- X12, FHIR, HL7
    file_path TEXT,
    transmission_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, SENT, FAILED
    attempt_number INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    transmitted_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Acknowledgment Log (999, 277CA)
CREATE TABLE IF NOT EXISTS AcknowledgmentLog (
    acknowledgment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transmission_id UUID REFERENCES TransmissionLog(transmission_id),
    claim_id UUID REFERENCES ClaimHeader(claim_id),
    acknowledgment_type VARCHAR(10), -- 999, 277CA
    acknowledgment_status VARCHAR(20), -- ACCEPTED, REJECTED, PARTIALLY_ACCEPTED
    acknowledgment_code VARCHAR(10),
    acknowledgment_message TEXT,
    raw_acknowledgment JSONB,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AUDIT TRAIL
-- =====================================================

-- Audit Log
CREATE TABLE IF NOT EXISTS AuditLog (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES Users(user_id),
    action VARCHAR(50), -- CREATE, UPDATE, DELETE, VIEW, EXPORT
    entity_type VARCHAR(50), -- CLAIM, USER, PROVIDER, etc.
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- UploadFileDetail indexes
CREATE INDEX idx_upload_file_status ON UploadFileDetail(upload_status);
CREATE INDEX idx_upload_file_uploaded_at ON UploadFileDetail(uploaded_at DESC);
CREATE INDEX idx_upload_file_type ON UploadFileDetail(file_type);

-- ClaimHeader indexes
CREATE INDEX idx_claim_status ON ClaimHeader(claim_status);
CREATE INDEX idx_claim_validation_status ON ClaimHeader(validation_status);
CREATE INDEX idx_claim_patient_id ON ClaimHeader(patient_id);
CREATE INDEX idx_claim_facility_id ON ClaimHeader(facility_id);
CREATE INDEX idx_claim_provider_id ON ClaimHeader(provider_id);
CREATE INDEX idx_claim_payer_id ON ClaimHeader(payer_id);
CREATE INDEX idx_claim_service_date ON ClaimHeader(service_date_from, service_date_to);
CREATE INDEX idx_claim_created_at ON ClaimHeader(created_at DESC);

-- Validation logs indexes
CREATE INDEX idx_file_validation_file_id ON FileValidationLog(file_id);
CREATE INDEX idx_edi_validation_claim_id ON EDIValidationLog(claim_id);
CREATE INDEX idx_business_validation_claim_id ON BusinessValidationLog(claim_id);
CREATE INDEX idx_business_validation_severity ON BusinessValidationLog(severity);

-- Correction log indexes
CREATE INDEX idx_correction_claim_id ON CorrectionLog(claim_id);
CREATE INDEX idx_correction_type ON CorrectionLog(correction_type);
CREATE INDEX idx_correction_corrected_at ON CorrectionLog(corrected_at DESC);

-- Transmission indexes
CREATE INDEX idx_transmission_claim_id ON TransmissionLog(claim_id);
CREATE INDEX idx_transmission_status ON TransmissionLog(transmission_status);
CREATE INDEX idx_transmission_payer_id ON TransmissionLog(payer_id);

-- Audit log indexes
CREATE INDEX idx_audit_user_id ON AuditLog(user_id);
CREATE INDEX idx_audit_entity_type ON AuditLog(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON AuditLog(action_timestamp DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON Users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON Facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_provider_updated_at BEFORE UPDATE ON Provider FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payer_updated_at BEFORE UPDATE ON Payer FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patient_updated_at BEFORE UPDATE ON Patient FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_claim_header_updated_at BEFORE UPDATE ON ClaimHeader FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_claim_line_updated_at BEFORE UPDATE ON ClaimLine FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
