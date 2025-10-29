// Main Add/Edit Rule Page Component

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ValidationRule, CorrectionRule } from '../types/rules';
import ValidationRuleForm from '../components/ValidationRuleForm';
import CorrectionRuleForm from '../components/CorrectionRuleForm';
import RulePreview from '../components/RulePreview';
import {
  getValidationRuleById,
  getCorrectionRuleByValidationId,
  createValidationRule,
  updateValidationRule,
  createCorrectionRule,
  updateCorrectionRule,
  getPayers,
  getFacilities,
} from '../services/ruleService';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader,
} from 'lucide-react';

const AddEditRule: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // Form state
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Data state
  const [validationRule, setValidationRule] = useState<ValidationRule>({
    rule_code: '',
    rule_name: '',
    rule_category: 'BUSINESS',
    rule_type: 'REQUIRED_FIELD',
    severity: 'ERROR',
    is_active: true,
    auto_correct_enabled: false,
    priority: 100,
    applies_to_claim_type: 'BOTH',
  });

  const [correctionRule, setCorrectionRule] = useState<CorrectionRule>({
    rule_code: '',
    rule_name: '',
    validation_rule_id: '',
    correction_type: 'MASTER_LOOKUP',
    requires_approval: false,
    is_test_mode: true,
    priority: 100,
    is_active: true,
  });

  const [payers, setPayers] = useState<Array<{ payer_id: string; payer_name: string }>>([]);
  const [facilities, setFacilities] = useState<Array<{ facility_id: string; facility_name: string }>>([]);

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load payers and facilities - handle errors gracefully
      try {
        const payersData = await getPayers();
        setPayers(Array.isArray(payersData) ? payersData : []);
      } catch (error) {
        console.error('Error loading payers:', error);
        setPayers([]);
      }

      try {
        const facilitiesData = await getFacilities();
        setFacilities(Array.isArray(facilitiesData) ? facilitiesData : []);
      } catch (error) {
        console.error('Error loading facilities:', error);
        setFacilities([]);
      }

      // If editing, load existing rule
      if (isEditMode && id) {
        const validationData = await getValidationRuleById(id);
        setValidationRule(validationData);

        // Load correction rule if auto-correction is enabled
        if (validationData.auto_correct_enabled) {
          try {
            const correctionData = await getCorrectionRuleByValidationId(id);
            if (correctionData) {
              setCorrectionRule(correctionData);
            }
          } catch (error) {
            console.error('No correction rule found:', error);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert('Failed to load rule data: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Validation handlers
  const handleValidationRuleChange = (field: keyof ValidationRule, value: any) => {
    setValidationRule((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Sync rule_code to correction rule
    if (field === 'rule_code') {
      setCorrectionRule((prev) => ({ ...prev, rule_code: value, rule_name: validationRule.rule_name }));
    }
    if (field === 'rule_name') {
      setCorrectionRule((prev) => ({ ...prev, rule_name: value }));
    }
  };

  const handleCorrectionRuleChange = (field: keyof CorrectionRule, value: any) => {
    setCorrectionRule((prev) => ({ ...prev, [field]: value }));
  };

  // Validation
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!validationRule.rule_code?.trim()) {
      newErrors.rule_code = 'Rule code is required';
    }
    if (!validationRule.rule_name?.trim()) {
      newErrors.rule_name = 'Rule name is required';
    }
    if (!validationRule.rule_category) {
      newErrors.rule_category = 'Rule category is required';
    }
    if (!validationRule.rule_type) {
      newErrors.rule_type = 'Rule type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    if (!validationRule.auto_correct_enabled) return true;

    const newErrors: Record<string, string> = {};

    if (!correctionRule.correction_type) {
      newErrors.correction_type = 'Correction type is required';
    }
    if (!correctionRule.correction_source_type) {
      newErrors.correction_source_type = 'Correction source type is required';
    }

    if (correctionRule.correction_source_type === 'MASTER_GENERIC_LOOKUP') {
      if (!correctionRule.lookup_table) {
        newErrors.lookup_table = 'Lookup table is required';
      }
      if (!correctionRule.lookup_column) {
        newErrors.lookup_column = 'Lookup column is required';
      }
    }

    if (correctionRule.correction_source_type === 'STATIC' && !correctionRule.default_value) {
      newErrors.default_value = 'Default value is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation
  const handleNext = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  // Save handlers
  const handleSave = async () => {
    // Validate current step
    const isValid = currentStep === 1 ? validateStep1() : validateStep2();
    if (!isValid) return;

    setSaving(true);
    try {
      let savedValidationRule: ValidationRule;

      // Save validation rule
      if (isEditMode && id) {
        savedValidationRule = await updateValidationRule(id, validationRule);
      } else {
        savedValidationRule = await createValidationRule(validationRule);
      }

      // Save correction rule if auto-correction is enabled
      if (validationRule.auto_correct_enabled && savedValidationRule.rule_id) {
        const correctionData = {
          ...correctionRule,
          validation_rule_id: savedValidationRule.rule_id,
        };

        if (correctionRule.rule_id) {
          await updateCorrectionRule(correctionRule.rule_id, correctionData);
        } else {
          await createCorrectionRule(correctionData);
        }
      }

      alert('Rule saved successfully!');
      navigate('/rules');
    } catch (error: any) {
      console.error('Error saving rule:', error);
      alert('Failed to save rule: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndEnableCorrection = async () => {
    if (!validateStep1() || !validateStep2()) return;

    // Ensure auto-correction is enabled
    if (!validationRule.auto_correct_enabled) {
      setValidationRule((prev) => ({ ...prev, auto_correct_enabled: true }));
    }

    await handleSave();
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading rule data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/rules')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Rules
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditMode ? 'Edit Validation Rule' : 'Add New Validation Rule'}
          </h1>
          <p className="text-gray-600 mt-2">
            {currentStep === 1
              ? 'Configure validation criteria and error handling'
              : 'Set up automatic correction behavior (optional)'}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Step 1 */}
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep === 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-green-500 text-white'
                  }`}
                >
                  {currentStep > 1 ? <CheckCircle className="w-6 h-6" /> : '1'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Validation Rule</p>
                  <p className="text-xs text-gray-500">Define validation criteria</p>
                </div>
              </div>

              {/* Divider */}
              <div className="flex-1 h-0.5 bg-gray-300" />

              {/* Step 2 */}
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep === 2
                      ? 'bg-blue-600 text-white'
                      : validationRule.auto_correct_enabled
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  2
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Auto-Correction</p>
                  <p className="text-xs text-gray-500">
                    {validationRule.auto_correct_enabled ? 'Enabled' : 'Optional'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {currentStep === 1 ? (
            <ValidationRuleForm
              formData={validationRule}
              onChange={handleValidationRuleChange}
              payers={payers}
              facilities={facilities}
              errors={errors}
            />
          ) : (
            <>
              {!validationRule.auto_correct_enabled ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Auto-Correction Not Enabled
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Enable auto-correction in Step 1 to configure correction rules
                  </p>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Go Back to Step 1
                  </button>
                </div>
              ) : (
                <CorrectionRuleForm
                  formData={correctionRule}
                  onChange={handleCorrectionRuleChange}
                  errors={errors}
                />
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-3">
              {currentStep === 2 && (
                <button
                  onClick={handleBack}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                className="px-6 py-2.5 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2 font-medium"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>

              {currentStep === 1 ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2 font-medium disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Rule
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                  >
                    Next: Auto-Correction
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleSaveAndEnableCorrection}
                  disabled={saving || !validationRule.auto_correct_enabled}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium disabled:opacity-50"
                >
                  {saving ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Save & Enable Auto-Correction
                </button>
              )}
            </div>
          </div>

          {/* Error Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-red-800">
                    Please fix the following errors:
                  </h4>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {Object.entries(errors).map(([field, message]) => (
                      <li key={field}>{message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <RulePreview
              validationRule={validationRule}
              correctionRule={validationRule.auto_correct_enabled ? correctionRule : undefined}
              onClose={() => setShowPreview(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AddEditRule;
