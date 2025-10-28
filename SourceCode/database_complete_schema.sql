-- =====================================================
-- 837 Claim Processing Platform - Complete Database Schema
-- PostgreSQL 14+
-- Last Updated: 2025-10-22
--
-- This file contains the complete database schema including:
-- - All master tables
-- - All transaction tables
-- - All migration updates
-- - Indexes, triggers, functions, and views
--
-- Usage: Run this on a fresh PostgreSQL database
-- psql -U postgres -h localhost -p 5434 -d Claim837 -f database_complete_schema.sql
-- =====================================================

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
    -- Multi-mode ingestion columns
    ingestion_mode VARCHAR(20) DEFAULT 'REST_API' CHECK (ingestion_mode IN ('REST_API', 'SFTP', 'LOCAL_FOLDER')),
    data_format VARCHAR(10) DEFAULT 'FHIR' CHECK (data_format IN ('FHIR', 'HL7')),
    ingestion_config JSONB DEFAULT '{}',
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
    facility_id UUID REFERENCES Facilities(facility_id), -- Links provider to facility
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
    date_of_birth DATE, -- Nullable since it may not be available in all data sources
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
-- MAPPING TABLES
-- =====================================================

-- Trading Partner Master Table
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

-- Provider-Payer Mapping Table
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

-- Facility-Payer Mapping Table
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

-- User Facility Mapping Table
CREATE TABLE IF NOT EXISTS UserFacilityMapping (
    user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE,
    facility_id UUID REFERENCES Facilities(facility_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES Users(user_id),
    PRIMARY KEY (user_id, facility_id)
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
    -- Multi-mode ingestion columns
    ingestion_mode VARCHAR(20) DEFAULT 'REST_API',
    source_host VARCHAR(255),
    source_path TEXT,
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
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
    claim_number VARCHAR(50) NOT NULL, -- NOT UNIQUE (allows same claim number across different files)
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

-- Claim History Table
CREATE TABLE IF NOT EXISTS ClaimHistory (
    id SERIAL PRIMARY KEY,
    file_id UUID REFERENCES UploadFileDetail(file_id) ON DELETE CASCADE,
    notes TEXT,
    status VARCHAR(50),
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('Parsing', 'Validation', 'Auto Correction', 'Manual Correction', 'Export')),
    operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_detail UUID REFERENCES Users(user_id)
);

-- Control Number Tracker Table
CREATE TABLE IF NOT EXISTS ControlNumberTracker (
    tracker_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    control_number VARCHAR(50) NOT NULL,
    control_type VARCHAR(10) NOT NULL, -- ISA13, GS06, ST02
    file_name VARCHAR(255),
    file_id UUID REFERENCES UploadFileDetail(file_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(control_number, control_type)
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

-- Parsed JSON History Log Table
CREATE TABLE IF NOT EXISTS ParsedJsonHistoryLog (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES UploadFileDetail(file_id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    previous_value JSONB,
    new_value JSONB NOT NULL,
    change_type VARCHAR(50), -- INITIAL_PARSE, AUTO_CORRECTION, MANUAL_EDIT, REGENERATION, VALIDATION_UPDATE, ROLLBACK
    change_description TEXT,
    changes_summary JSONB, -- Summary of what changed (field paths, counts, etc.)
    changed_by UUID REFERENCES Users(user_id),
    changed_by_username VARCHAR(100), -- Denormalized for faster queries
    changed_via VARCHAR(50), -- WEB_UI, API, AUTO_CORRECTION, PARSING_SERVICE, BACKGROUND_JOB
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    correction_log_ids UUID[], -- Array of correction_log IDs if this was due to corrections
    related_validation_ids UUID[], -- Array of validation IDs that triggered this change
    related_file_validation_id UUID, -- Link to FileValidationLog if applicable
    ip_address VARCHAR(45),
    user_agent TEXT,
    CONSTRAINT unique_file_version_log UNIQUE(file_id, version)
);

-- Ingestion Log Table
CREATE TABLE IF NOT EXISTS IngestionLog (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID REFERENCES Facilities(facility_id) ON DELETE CASCADE,
    ingestion_mode VARCHAR(20) NOT NULL CHECK (ingestion_mode IN ('REST_API', 'SFTP', 'LOCAL_FOLDER')),
    file_name VARCHAR(255),
    source_path TEXT,
    file_size_bytes BIGINT,
    checksum VARCHAR(64),
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'DUPLICATE', 'QUARANTINED')),
    error_message TEXT,
    error_type VARCHAR(50),
    retry_count INTEGER DEFAULT 0,
    processing_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_id UUID REFERENCES UploadFileDetail(file_id)
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
    -- Enhanced columns for EDI validation
    segment_code VARCHAR(10) NULL,
    element_position INT NULL,
    loop_level VARCHAR(50) NULL,
    applies_to_claim_type VARCHAR(30) NULL DEFAULT 'BOTH',
    auto_correct_enabled BOOLEAN NULL DEFAULT FALSE,
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
    -- Enhanced columns for correction tracking
    correction_source_type VARCHAR(50) NULL,      -- MASTER_LOOKUP / STATIC / FORMAT
    is_test_mode BOOL NULL DEFAULT false,
    approved_by UUID REFERENCES Users(user_id),
    approved_at TIMESTAMP NULL,
    fallback_strategy VARCHAR(50) NULL,
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

-- Master Data Audit Log Table
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

-- UploadFileDetail indexes
CREATE INDEX IF NOT EXISTS idx_upload_file_status ON UploadFileDetail(upload_status);
CREATE INDEX IF NOT EXISTS idx_upload_file_uploaded_at ON UploadFileDetail(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_file_type ON UploadFileDetail(file_type);
CREATE INDEX IF NOT EXISTS idx_upload_file_ingestion_mode ON UploadFileDetail(ingestion_mode);
CREATE INDEX IF NOT EXISTS idx_upload_file_processing_status ON UploadFileDetail(upload_status, ingestion_mode, uploaded_at);

-- ClaimHeader indexes
CREATE INDEX IF NOT EXISTS idx_claim_status ON ClaimHeader(claim_status);
CREATE INDEX IF NOT EXISTS idx_claim_validation_status ON ClaimHeader(validation_status);
CREATE INDEX IF NOT EXISTS idx_claim_patient_id ON ClaimHeader(patient_id);
CREATE INDEX IF NOT EXISTS idx_claim_facility_id ON ClaimHeader(facility_id);
CREATE INDEX IF NOT EXISTS idx_claim_provider_id ON ClaimHeader(provider_id);
CREATE INDEX IF NOT EXISTS idx_claim_payer_id ON ClaimHeader(payer_id);
CREATE INDEX IF NOT EXISTS idx_claim_service_date ON ClaimHeader(service_date_from, service_date_to);
CREATE INDEX IF NOT EXISTS idx_claim_created_at ON ClaimHeader(created_at DESC);

-- ClaimLine indexes
CREATE INDEX IF NOT EXISTS idx_claimline_revenue_code ON ClaimLine(revenue_code);

-- Patient indexes
CREATE INDEX IF NOT EXISTS idx_patient_control_number ON Patient(PatientControlNumber);

-- Provider indexes
CREATE INDEX IF NOT EXISTS idx_provider_facility_id ON Provider(facility_id);

-- Facilities indexes
CREATE INDEX IF NOT EXISTS idx_facilities_ingestion_mode ON Facilities(ingestion_mode) WHERE is_active = TRUE;

-- UserFacilityMapping indexes
CREATE INDEX IF NOT EXISTS idx_user_facility_user ON UserFacilityMapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_facility_facility ON UserFacilityMapping(facility_id);

-- Validation logs indexes
CREATE INDEX IF NOT EXISTS idx_file_validation_file_id ON FileValidationLog(file_id);
CREATE INDEX IF NOT EXISTS idx_edi_validation_claim_id ON EDIValidationLog(claim_id);
CREATE INDEX IF NOT EXISTS idx_business_validation_claim_id ON BusinessValidationLog(claim_id);
CREATE INDEX IF NOT EXISTS idx_business_validation_severity ON BusinessValidationLog(severity);

-- Correction log indexes
CREATE INDEX IF NOT EXISTS idx_correction_claim_id ON CorrectionLog(claim_id);
CREATE INDEX IF NOT EXISTS idx_correction_type ON CorrectionLog(correction_type);
CREATE INDEX IF NOT EXISTS idx_correction_corrected_at ON CorrectionLog(corrected_at DESC);

-- ClaimHistory indexes
CREATE INDEX IF NOT EXISTS idx_claim_history_file_id ON ClaimHistory(file_id);
CREATE INDEX IF NOT EXISTS idx_claim_history_operation_type ON ClaimHistory(operation_type);
CREATE INDEX IF NOT EXISTS idx_claim_history_operation_date ON ClaimHistory(operation_date DESC);
CREATE INDEX IF NOT EXISTS idx_claim_history_status ON ClaimHistory(status);

-- ControlNumberTracker indexes
CREATE INDEX IF NOT EXISTS idx_control_number ON ControlNumberTracker(control_number, control_type);
CREATE INDEX IF NOT EXISTS idx_control_created_at ON ControlNumberTracker(created_at DESC);

-- ParsedJsonHistoryLog indexes
CREATE INDEX IF NOT EXISTS idx_parsed_json_history_log_file_id ON ParsedJsonHistoryLog(file_id);
CREATE INDEX IF NOT EXISTS idx_parsed_json_history_log_changed_at ON ParsedJsonHistoryLog(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_parsed_json_history_log_change_type ON ParsedJsonHistoryLog(change_type);
CREATE INDEX IF NOT EXISTS idx_parsed_json_history_log_changed_by ON ParsedJsonHistoryLog(changed_by);
CREATE INDEX IF NOT EXISTS idx_parsed_json_history_log_version ON ParsedJsonHistoryLog(file_id, version DESC);

-- IngestionLog indexes
CREATE INDEX IF NOT EXISTS idx_ingestion_log_facility ON IngestionLog(facility_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_status ON IngestionLog(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_mode ON IngestionLog(ingestion_mode, status);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_created ON IngestionLog(created_at DESC);

-- Transmission indexes
CREATE INDEX IF NOT EXISTS idx_transmission_claim_id ON TransmissionLog(claim_id);
CREATE INDEX IF NOT EXISTS idx_transmission_status ON TransmissionLog(transmission_status);
CREATE INDEX IF NOT EXISTS idx_transmission_payer_id ON TransmissionLog(payer_id);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON AuditLog(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type ON AuditLog(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON AuditLog(action_timestamp DESC);

-- Master Audit Log indexes
CREATE INDEX IF NOT EXISTS idx_master_audit_user_id ON MasterDataAuditLog(user_id);
CREATE INDEX IF NOT EXISTS idx_master_audit_table_record ON MasterDataAuditLog(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_master_audit_action ON MasterDataAuditLog(action);
CREATE INDEX IF NOT EXISTS idx_master_audit_timestamp ON MasterDataAuditLog(action_timestamp DESC);

-- Trading Partner indexes
CREATE INDEX IF NOT EXISTS idx_trading_partner_name ON TradingPartnerMaster(partner_name);
CREATE INDEX IF NOT EXISTS idx_trading_partner_type ON TradingPartnerMaster(partner_type);
CREATE INDEX IF NOT EXISTS idx_trading_partner_status ON TradingPartnerMaster(status);
CREATE INDEX IF NOT EXISTS idx_trading_partner_direction ON TradingPartnerMaster(direction);

-- Provider-Payer Mapping indexes
CREATE INDEX IF NOT EXISTS idx_provider_payer_provider_id ON ProviderPayerMapping(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_payer_payer_id ON ProviderPayerMapping(payer_id);
CREATE INDEX IF NOT EXISTS idx_provider_payer_status ON ProviderPayerMapping(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_provider_payer_active ON ProviderPayerMapping(is_active);
CREATE INDEX IF NOT EXISTS idx_provider_payer_mapping_provider ON ProviderPayerMapping(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_payer_mapping_payer ON ProviderPayerMapping(payer_id);
CREATE INDEX IF NOT EXISTS idx_provider_payer_mapping_status ON ProviderPayerMapping(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_provider_payer_mapping_dates ON ProviderPayerMapping(effective_date, termination_date);

-- Facility-Payer Mapping indexes
CREATE INDEX IF NOT EXISTS idx_facility_payer_facility_id ON FacilityPayerMapping(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_payer_payer_id ON FacilityPayerMapping(payer_id);
CREATE INDEX IF NOT EXISTS idx_facility_payer_status ON FacilityPayerMapping(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_facility_payer_active ON FacilityPayerMapping(is_active);

-- ValidationRules indexes
CREATE INDEX IF NOT EXISTS idx_validationrules_segment_code ON ValidationRules(segment_code);
CREATE INDEX IF NOT EXISTS idx_validationrules_claim_type ON ValidationRules(applies_to_claim_type);
CREATE INDEX IF NOT EXISTS idx_validationrules_auto_correct ON ValidationRules(auto_correct_enabled);

-- CorrectionRules indexes
CREATE INDEX IF NOT EXISTS idx_correctionrules_source_type ON CorrectionRules(correction_source_type);
CREATE INDEX IF NOT EXISTS idx_correctionrules_test_mode ON CorrectionRules(is_test_mode);
CREATE INDEX IF NOT EXISTS idx_correctionrules_approved_by ON CorrectionRules(approved_by);

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
CREATE TRIGGER update_trading_partner_updated_at BEFORE UPDATE ON TradingPartnerMaster FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_provider_payer_mapping_updated_at BEFORE UPDATE ON ProviderPayerMapping FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facility_payer_mapping_updated_at BEFORE UPDATE ON FacilityPayerMapping FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get the current version for a file
CREATE OR REPLACE FUNCTION get_current_parsed_json_version(p_file_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_current_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0)
    INTO v_current_version
    FROM ParsedJsonHistoryLog
    WHERE file_id = p_file_id;

    RETURN v_current_version;
END;
$$ LANGUAGE plpgsql;

-- Function to get the next version for a file
CREATE OR REPLACE FUNCTION get_next_parsed_json_version(p_file_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN get_current_parsed_json_version(p_file_id) + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to log parsed_json changes
CREATE OR REPLACE FUNCTION log_parsed_json_change(
    p_file_id UUID,
    p_previous_value JSONB,
    p_new_value JSONB,
    p_change_type VARCHAR(50),
    p_change_description TEXT,
    p_changed_by UUID DEFAULT NULL,
    p_changed_by_username VARCHAR(100) DEFAULT NULL,
    p_changed_via VARCHAR(50) DEFAULT 'APPLICATION',
    p_changes_summary JSONB DEFAULT NULL,
    p_correction_log_ids UUID[] DEFAULT NULL,
    p_related_validation_ids UUID[] DEFAULT NULL,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_next_version INTEGER;
BEGIN
    -- Get next version
    v_next_version := get_next_parsed_json_version(p_file_id);

    -- Insert log entry
    INSERT INTO ParsedJsonHistoryLog (
        file_id,
        version,
        previous_value,
        new_value,
        change_type,
        change_description,
        changed_by,
        changed_by_username,
        changed_via,
        changes_summary,
        correction_log_ids,
        related_validation_ids,
        ip_address,
        user_agent,
        changed_at
    ) VALUES (
        p_file_id,
        v_next_version,
        p_previous_value,
        p_new_value,
        p_change_type,
        p_change_description,
        p_changed_by,
        p_changed_by_username,
        p_changed_via,
        p_changes_summary,
        p_correction_log_ids,
        p_related_validation_ids,
        p_ip_address,
        p_user_agent,
        CURRENT_TIMESTAMP
    )
    RETURNING log_id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback to a specific version
CREATE OR REPLACE FUNCTION rollback_to_parsed_json_version(
    p_file_id UUID,
    p_target_version INTEGER,
    p_rollback_by UUID DEFAULT NULL,
    p_rollback_by_username VARCHAR(100) DEFAULT 'system',
    p_rollback_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_target_json JSONB;
    v_current_json JSONB;
    v_log_id UUID;
    v_description TEXT;
BEGIN
    -- Get the target version JSON
    SELECT new_value INTO v_target_json
    FROM ParsedJsonHistoryLog
    WHERE file_id = p_file_id AND version = p_target_version;

    IF v_target_json IS NULL THEN
        RAISE EXCEPTION 'Version % not found for file %', p_target_version, p_file_id;
    END IF;

    -- Get current JSON
    SELECT parsed_json INTO v_current_json
    FROM UploadFileDetail
    WHERE file_id = p_file_id;

    -- Build description
    v_description := format('Rolled back to version %s', p_target_version);
    IF p_rollback_reason IS NOT NULL THEN
        v_description := v_description || ': ' || p_rollback_reason;
    END IF;

    -- Log the rollback
    v_log_id := log_parsed_json_change(
        p_file_id := p_file_id,
        p_previous_value := v_current_json,
        p_new_value := v_target_json,
        p_change_type := 'ROLLBACK',
        p_change_description := v_description,
        p_changed_by := p_rollback_by,
        p_changed_by_username := p_rollback_by_username,
        p_changed_via := 'ROLLBACK_FUNCTION',
        p_changes_summary := jsonb_build_object(
            'rollback_to_version', p_target_version,
            'rollback_reason', p_rollback_reason
        )
    );

    -- Update the file
    UPDATE UploadFileDetail
    SET parsed_json = v_target_json,
        updated_at = CURRENT_TIMESTAMP
    WHERE file_id = p_file_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get facility ingestion status
CREATE OR REPLACE FUNCTION get_facility_ingestion_status(p_facility_id UUID)
RETURNS TABLE (
    facility_id UUID,
    facility_code VARCHAR,
    ingestion_mode VARCHAR,
    is_enabled BOOLEAN,
    last_successful_ingestion TIMESTAMP,
    total_files_processed BIGINT,
    total_files_failed BIGINT,
    avg_processing_time_ms NUMERIC,
    quarantined_files BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.facility_id,
        f.facility_code,
        f.ingestion_mode,
        f.is_active as is_enabled,
        MAX(il.created_at) FILTER (WHERE il.status = 'SUCCESS') as last_successful_ingestion,
        COUNT(*) FILTER (WHERE il.status = 'SUCCESS') as total_files_processed,
        COUNT(*) FILTER (WHERE il.status = 'FAILED') as total_files_failed,
        AVG(il.processing_duration_ms) FILTER (WHERE il.status = 'SUCCESS') as avg_processing_time_ms,
        COUNT(*) FILTER (WHERE il.status = 'QUARANTINED') as quarantined_files
    FROM Facilities f
    LEFT JOIN IngestionLog il ON f.facility_id = il.facility_id
    WHERE f.facility_id = p_facility_id
    GROUP BY f.facility_id, f.facility_code, f.ingestion_mode, f.is_active;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS
-- =====================================================

-- ParsedJsonHistoryLog View
CREATE OR REPLACE VIEW ParsedJsonHistoryLogView AS
SELECT
    pjhl.log_id,
    pjhl.file_id,
    ufd.file_name,
    pjhl.version,
    pjhl.change_type,
    pjhl.change_description,
    pjhl.changed_by,
    pjhl.changed_by_username,
    pjhl.changed_via,
    pjhl.changed_at,
    pjhl.changes_summary,
    pg_column_size(pjhl.previous_value) as previous_size_bytes,
    pg_column_size(pjhl.new_value) as new_size_bytes,
    pg_column_size(pjhl.new_value) - COALESCE(pg_column_size(pjhl.previous_value), 0) as size_difference_bytes,
    pjhl.changed_at - LAG(pjhl.changed_at) OVER (PARTITION BY pjhl.file_id ORDER BY pjhl.version) as time_since_last_change,
    CASE
        WHEN pjhl.version = MAX(pjhl.version) OVER (PARTITION BY pjhl.file_id)
        THEN true
        ELSE false
    END as is_current_version
FROM ParsedJsonHistoryLog pjhl
JOIN UploadFileDetail ufd ON pjhl.file_id = ufd.file_id
ORDER BY pjhl.file_id, pjhl.version DESC;

-- ParsedJsonHistorySummary View
CREATE OR REPLACE VIEW ParsedJsonHistorySummary AS
SELECT
    file_id,
    COUNT(*) as total_versions,
    MIN(changed_at) as first_change_at,
    MAX(changed_at) as last_change_at,
    MAX(changed_at) - MIN(changed_at) as total_time_span,
    MAX(version) as current_version,
    COUNT(DISTINCT changed_by) as unique_changers,
    jsonb_agg(DISTINCT change_type) as change_types_used
FROM ParsedJsonHistoryLog
GROUP BY file_id;

-- Ingestion Statistics View
CREATE OR REPLACE VIEW vw_ingestion_statistics AS
SELECT
    f.facility_id,
    f.facility_code,
    f.facility_name,
    f.ingestion_mode,
    f.is_active,
    COUNT(il.log_id) FILTER (WHERE il.status = 'SUCCESS') as successful_files,
    COUNT(il.log_id) FILTER (WHERE il.status = 'FAILED') as failed_files,
    COUNT(il.log_id) FILTER (WHERE il.status = 'DUPLICATE') as duplicate_files,
    COUNT(il.log_id) FILTER (WHERE il.status = 'QUARANTINED') as quarantined_files,
    COUNT(il.log_id) as total_files,
    AVG(il.processing_duration_ms) FILTER (WHERE il.status = 'SUCCESS') as avg_processing_ms,
    MAX(il.created_at) FILTER (WHERE il.status = 'SUCCESS') as last_successful_ingestion,
    SUM(il.file_size_bytes) FILTER (WHERE il.status = 'SUCCESS') as total_bytes_processed
FROM Facilities f
LEFT JOIN IngestionLog il ON f.facility_id = il.facility_id
    AND il.created_at >= NOW() - INTERVAL '30 days'
GROUP BY f.facility_id, f.facility_code, f.facility_name, f.ingestion_mode, f.is_active;

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
COMMENT ON TABLE UserFacilityMapping IS 'Maps users to facilities for facility-level access control';
COMMENT ON TABLE ClaimHistory IS 'Tracks the history of operations performed on claims including parsing, validation, corrections, and exports';
COMMENT ON TABLE ParsedJsonHistoryLog IS 'Log table tracking all changes to parsed_json in UploadFileDetail. No column changes to UploadFileDetail required.';
COMMENT ON TABLE IngestionLog IS 'Audit trail for all file ingestion attempts across all modes (REST API, SFTP, Local Folder)';

COMMENT ON COLUMN Facilities.ingestion_mode IS 'Ingestion method: REST_API (default), SFTP, LOCAL_FOLDER';
COMMENT ON COLUMN Facilities.data_format IS 'Data format expected and supported: FHIR or HL7';
COMMENT ON COLUMN Facilities.ingestion_config IS 'Mode-specific configuration (SFTP/Local settings) stored as JSONB';
COMMENT ON COLUMN Patient.PatientControlNumber IS 'UUID column for tracking patient records across changes. When patient details change, a new record is created with the same PatientControlNumber but different patient_id';
COMMENT ON COLUMN Patient.date_of_birth IS 'Patient date of birth - nullable since it may not be available in all data sources';
COMMENT ON COLUMN ClaimLine.revenue_code IS 'Revenue code from SV201 segment (Institutional claims only). Used for hospital/facility billing. E.g., 0300=Laboratory, 0450=Emergency Room';
COMMENT ON COLUMN FileValidationLog.llmsummary IS 'LLM-generated summary of validation errors and warnings';
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
COMMENT ON COLUMN UploadFileDetail.ingestion_mode IS 'Source ingestion method for this file: REST_API, SFTP, LOCAL_FOLDER';
COMMENT ON COLUMN UploadFileDetail.source_host IS 'SFTP hostname or "localhost" for local files';
COMMENT ON COLUMN UploadFileDetail.source_path IS 'Original file path (remote SFTP path or local filesystem path)';
COMMENT ON COLUMN UploadFileDetail.processing_started_at IS 'Timestamp when file processing began';
COMMENT ON COLUMN UploadFileDetail.processing_completed_at IS 'Timestamp when file processing completed (success or failure)';
COMMENT ON COLUMN IngestionLog.status IS 'SUCCESS: File processed successfully, FAILED: Processing error, DUPLICATE: File already exists, QUARANTINED: Moved to quarantine';
COMMENT ON COLUMN IngestionLog.error_type IS 'Error classification: CONNECTION_ERROR, AUTHENTICATION_ERROR, VALIDATION_ERROR, PROCESSING_ERROR, PERMISSION_ERROR';
COMMENT ON COLUMN ParsedJsonHistoryLog.version IS 'Incremental version number for each file, computed automatically';
COMMENT ON COLUMN ParsedJsonHistoryLog.change_type IS 'Type of change: INITIAL_PARSE, AUTO_CORRECTION, MANUAL_EDIT, REGENERATION, VALIDATION_UPDATE, ROLLBACK';
COMMENT ON COLUMN ParsedJsonHistoryLog.changes_summary IS 'JSON object containing summary of changes (fields modified, correction count, etc.)';
COMMENT ON COLUMN UserFacilityMapping.assigned_at IS 'Timestamp when facility was assigned to user';
COMMENT ON COLUMN UserFacilityMapping.assigned_by IS 'User who performed the assignment';
COMMENT ON COLUMN ClaimHistory.id IS 'Primary key - auto increment';
COMMENT ON COLUMN ClaimHistory.file_id IS 'Reference to the uploaded file this history entry belongs to';
COMMENT ON COLUMN ClaimHistory.notes IS 'Additional notes about the operation';
COMMENT ON COLUMN ClaimHistory.status IS 'Status of the operation (e.g., SUCCESS, FAILED, PENDING)';
COMMENT ON COLUMN ClaimHistory.operation_type IS 'Type of operation performed';
COMMENT ON COLUMN ClaimHistory.operation_date IS 'When the operation was performed';
COMMENT ON COLUMN ClaimHistory.user_detail IS 'ID of the user who performed the operation';
COMMENT ON COLUMN Provider.facility_id IS 'Links provider to a specific facility';
COMMENT ON COLUMN ProviderPayerMapping.enrollment_status IS 'Current enrollment status: Active, Pending, Inactive, Terminated';
COMMENT ON COLUMN ProviderPayerMapping.provider_payer_id IS 'Provider ID as recognized by the specific payer';
COMMENT ON COLUMN ProviderPayerMapping.effective_date IS 'Date when provider enrollment became effective';
COMMENT ON COLUMN ProviderPayerMapping.termination_date IS 'Date when provider enrollment was terminated (if applicable)';

COMMENT ON VIEW vw_ingestion_statistics IS 'Aggregated ingestion statistics per facility for the last 30 days';

COMMENT ON FUNCTION log_parsed_json_change IS 'Main function to log parsed_json changes. Call this explicitly from application code after updating parsed_json.';
COMMENT ON FUNCTION get_current_parsed_json_version IS 'Get the current version number for a file based on log entries';
COMMENT ON FUNCTION rollback_to_parsed_json_version IS 'Rollback parsed_json to a specific version, creating a new log entry';
COMMENT ON FUNCTION get_facility_ingestion_status IS 'Returns ingestion statistics and status for a specific facility';

-- =====================================================
-- CLEANUP ORPHANED CONTROL NUMBERS
-- =====================================================

DELETE FROM ControlNumberTracker WHERE file_id IS NULL;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '  DATABASE SCHEMA CREATED SUCCESSFULLY  ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '  - Master Tables (Users, Facilities, Providers, Payers, Patients)';
    RAISE NOTICE '  - Mapping Tables (User-Facility, Provider-Payer, Facility-Payer)';
    RAISE NOTICE '  - Transaction Tables (Upload, Batch, Claims, Lines, Diagnoses)';
    RAISE NOTICE '  - Validation & Correction Logs';
    RAISE NOTICE '  - Rule Engine Tables';
    RAISE NOTICE '  - Transmission & Acknowledgment Tables';
    RAISE NOTICE '  - Audit Trail Tables';
    RAISE NOTICE '  - Helper Functions & Views';
    RAISE NOTICE '  - Indexes & Triggers';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Run seed script to populate initial data';
    RAISE NOTICE '  2. Configure application environment variables';
    RAISE NOTICE '  3. Start the backend and frontend servers';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;
