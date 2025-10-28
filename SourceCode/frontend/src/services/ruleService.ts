// API Service for Validation and Correction Rules

import axios from 'axios';
import { ValidationRule, CorrectionRule, MasterTableOption } from '../types/rules';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

// =====================================================
// VALIDATION RULES API
// =====================================================

export const getValidationRules = async (): Promise<ValidationRule[]> => {
  const response = await axios.get(`${API_BASE}/rules/validation`);
  return response.data;
};

export const getValidationRuleById = async (id: string): Promise<ValidationRule> => {
  const response = await axios.get(`${API_BASE}/rules/validation/${id}`);
  return response.data;
};

export const createValidationRule = async (rule: ValidationRule): Promise<ValidationRule> => {
  const response = await axios.post(`${API_BASE}/rules/validation`, rule);
  return response.data;
};

export const updateValidationRule = async (
  id: string,
  rule: Partial<ValidationRule>
): Promise<ValidationRule> => {
  const response = await axios.put(`${API_BASE}/rules/validation/${id}`, rule);
  return response.data;
};

export const deleteValidationRule = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE}/rules/validation/${id}`);
};

// =====================================================
// CORRECTION RULES API
// =====================================================

export const getCorrectionRules = async (): Promise<CorrectionRule[]> => {
  const response = await axios.get(`${API_BASE}/rules/correction`);
  return response.data;
};

export const getCorrectionRuleById = async (id: string): Promise<CorrectionRule> => {
  const response = await axios.get(`${API_BASE}/rules/correction/${id}`);
  return response.data;
};

export const getCorrectionRuleByValidationId = async (
  validationRuleId: string
): Promise<CorrectionRule | null> => {
  try {
    const response = await axios.get(
      `${API_BASE}/rules/correction/by-validation/${validationRuleId}`
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const createCorrectionRule = async (rule: CorrectionRule): Promise<CorrectionRule> => {
  const response = await axios.post(`${API_BASE}/rules/correction`, rule);
  return response.data;
};

export const updateCorrectionRule = async (
  id: string,
  rule: Partial<CorrectionRule>
): Promise<CorrectionRule> => {
  const response = await axios.put(`${API_BASE}/rules/correction/${id}`, rule);
  return response.data;
};

export const deleteCorrectionRule = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE}/rules/correction/${id}`);
};

// =====================================================
// MASTER DATA LOOKUPS
// =====================================================

export const getMasterTables = async (): Promise<MasterTableOption[]> => {
  // Returns available master tables for lookup
  return [
    { value: 'facilities', label: 'Facilities', columns: ['facility_code', 'facility_name', 'npi', 'tax_id'] },
    { value: 'provider', label: 'Providers', columns: ['npi', 'first_name', 'last_name', 'taxonomy_code'] },
    { value: 'payer', label: 'Payers', columns: ['payer_code', 'payer_name', 'electronic_payer_id'] },
    { value: 'tradingpartner', label: 'Trading Partners', columns: ['partner_code', 'partner_name'] },
    { value: 'patient', label: 'Patients', columns: ['mrn', 'first_name', 'last_name'] },
  ];
};

export const getMasterTableColumns = async (tableName: string): Promise<string[]> => {
  const tables = await getMasterTables();
  const table = tables.find((t) => t.value === tableName);
  return table?.columns || [];
};

// =====================================================
// PAYER AND FACILITY LOOKUPS
// =====================================================

export const getPayers = async (): Promise<Array<{ payer_id: string; payer_name: string }>> => {
  const response = await axios.get(`${API_BASE}/payers`);
  // Response is a simple array when no pagination params are passed
  return Array.isArray(response.data) ? response.data : response.data.payers || [];
};

export const getFacilities = async (): Promise<Array<{ facility_id: string; facility_name: string }>> => {
  const response = await axios.get(`${API_BASE}/facilities`);
  // Response is a simple array when no pagination params are passed
  return Array.isArray(response.data) ? response.data : response.data.data || [];
};

// =====================================================
// RULE VALIDATION & PREVIEW
// =====================================================

export const previewRuleImpact = async (
  validationRule: ValidationRule,
  correctionRule?: CorrectionRule
): Promise<any> => {
  const response = await axios.post(`${API_BASE}/rules/preview`, {
    validation: validationRule,
    correction: correctionRule,
  });
  return response.data;
};

export const testCorrectionRule = async (
  ruleId: string,
  sampleData: any
): Promise<any> => {
  const response = await axios.post(`${API_BASE}/rules/correction/${ruleId}/test`, {
    sample_data: sampleData,
  });
  return response.data;
};
