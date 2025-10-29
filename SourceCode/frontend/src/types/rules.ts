// Type definitions for Validation and Correction Rules

export interface ValidationRule {
  rule_id?: string;
  rule_code: string;
  rule_name: string;
  rule_category: 'FILE' | 'STRUCTURAL' | 'BUSINESS' | 'PAYER_SPECIFIC';
  rule_type: 'REQUIRED_FIELD' | 'FORMAT' | 'RANGE' | 'LOOKUP' | 'CUSTOM';
  description?: string;
  field_name?: string;
  field_path?: string;
  segment_code?: string;
  element_position?: number;
  loop_level?: string;
  applies_to_claim_type?: 'PROFESSIONAL' | 'INSTITUTIONAL' | 'BOTH';
  validation_logic?: Record<string, any>;
  error_message_template?: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  is_active: boolean;
  auto_correct_enabled?: boolean;
  applies_to_payer?: string | null;
  applies_to_facility?: string | null;
  priority: number;
  version?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface CorrectionRule {
  rule_id?: string;
  rule_code: string;
  rule_name: string;
  validation_rule_id: string;
  correction_type: 'MASTER_LOOKUP' | 'STATIC_VALUE' | 'FORMAT_CORRECTION' | 'FIELD_COPY' | 'MAPPING_TABLE' | 'CALCULATION' | 'PREPEND_APPEND' | 'AI_ASSISTED_SUGGESTION' | 'REMOVE_INVALID_SEGMENT' | 'CLEAN_UP';
  correction_source_type?: 'MASTER_PROVIDER' | 'MASTER_FACILITY' | 'MASTER_PAYER' | 'MASTER_TRADING_PARTNER' | 'MASTER_GENERIC_LOOKUP' | 'STATIC' | 'FORMAT_RULE' | 'SQL_MAPPING_LOOKUP' | 'FIELD_REFERENCE' | 'AI_SUGGESTION';
  correction_logic?: Record<string, any>;
  lookup_table?: string;
  lookup_column?: string;
  default_value?: string;
  fallback_strategy?: string;
  requires_approval: boolean;
  is_test_mode: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  priority: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface RuleFormData {
  validation: ValidationRule;
  correction?: CorrectionRule;
}

export interface MasterTableOption {
  value: string;
  label: string;
  columns?: string[];
}

export interface RulePreview {
  validationSummary: string;
  correctionSummary?: string;
  impactedFields: string[];
  testMode: boolean;
}
