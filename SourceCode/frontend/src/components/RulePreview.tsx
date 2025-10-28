// Rule Preview/Summary Component

import React from 'react';
import { ValidationRule, CorrectionRule } from '../types/rules';
import { Eye, CheckCircle, AlertCircle, Wrench, Info } from 'lucide-react';

interface RulePreviewProps {
  validationRule: ValidationRule;
  correctionRule?: CorrectionRule;
  onClose?: () => void;
}

const RulePreview: React.FC<RulePreviewProps> = ({
  validationRule,
  correctionRule,
  onClose,
}) => {
  const generateValidationSummary = (): string => {
    const parts = [
      `Validates ${validationRule.field_name || 'field'}`,
      validationRule.segment_code && `in segment ${validationRule.segment_code}`,
      validationRule.loop_level && `(loop ${validationRule.loop_level})`,
    ].filter(Boolean);

    return parts.join(' ');
  };

  const generateCorrectionSummary = (): string | null => {
    if (!correctionRule) return null;

    const sourceMap: Record<string, string> = {
      MASTER_LOOKUP: `master table ${correctionRule.lookup_table}`,
      STATIC: `static value "${correctionRule.default_value}"`,
      FORMAT: 'format transformation',
      API: 'external API',
    };

    return `Auto-correct using ${sourceMap[correctionRule.correction_source_type || ''] || 'configured source'}`;
  };

  const getImpactedFields = (): string[] => {
    const fields: string[] = [];

    if (validationRule.field_name) fields.push(validationRule.field_name);
    if (validationRule.field_path) fields.push(validationRule.field_path);
    if (validationRule.segment_code) {
      fields.push(`${validationRule.segment_code}${validationRule.element_position ? `-${validationRule.element_position}` : ''}`);
    }

    return fields.length > 0 ? fields : ['No specific fields'];
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      ERROR: 'text-red-600 bg-red-50 border-red-200',
      WARNING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      INFO: 'text-blue-600 bg-blue-50 border-blue-200',
    };
    return colors[severity] || colors.INFO;
  };

  return (
    <div className="bg-white rounded-lg border-2 border-blue-300 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white">
        <div className="flex items-center gap-3">
          <Eye className="w-6 h-6" />
          <div>
            <h3 className="text-xl font-bold">Rule Summary Preview</h3>
            <p className="text-sm text-blue-100 mt-1">
              Review the configuration before saving
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Validation Rule Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <span>Validation Rule</span>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Rule Code</p>
                <p className="text-sm font-mono font-semibold text-gray-900">
                  {validationRule.rule_code}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Severity</p>
                <span
                  className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(validationRule.severity)}`}
                >
                  {validationRule.severity}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Rule Name</p>
              <p className="text-sm text-gray-900">{validationRule.rule_name}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">What It Does</p>
              <p className="text-sm text-gray-700 bg-white rounded border border-gray-200 px-3 py-2">
                {generateValidationSummary()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Category</p>
                <p className="text-sm text-gray-900">
                  {validationRule.rule_category?.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Type</p>
                <p className="text-sm text-gray-900">
                  {validationRule.rule_type?.replace('_', ' ')}
                </p>
              </div>
            </div>

            {validationRule.applies_to_claim_type && validationRule.applies_to_claim_type !== 'BOTH' && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Applies To</p>
                <p className="text-sm text-gray-900">{validationRule.applies_to_claim_type} Claims Only</p>
              </div>
            )}
          </div>
        </div>

        {/* Correction Rule Section */}
        {validationRule.auto_correct_enabled && correctionRule && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Wrench className="w-5 h-5 text-green-600" />
              <span>Auto-Correction Rule</span>
              {correctionRule.is_test_mode && (
                <span className="text-xs font-semibold px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                  TEST MODE
                </span>
              )}
            </div>

            <div className="bg-green-50 rounded-lg p-4 space-y-3 border border-green-200">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Correction Strategy</p>
                <p className="text-sm text-gray-900 font-semibold">
                  {correctionRule.correction_source_type} - {correctionRule.correction_type}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">How It Works</p>
                <p className="text-sm text-gray-700 bg-white rounded border border-green-200 px-3 py-2">
                  {generateCorrectionSummary()}
                </p>
              </div>

              {correctionRule.correction_source_type === 'MASTER_LOOKUP' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Lookup Table</p>
                    <p className="text-sm text-gray-900 font-mono">{correctionRule.lookup_table}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Lookup Column</p>
                    <p className="text-sm text-gray-900 font-mono">{correctionRule.lookup_column}</p>
                  </div>
                </div>
              )}

              {correctionRule.correction_source_type === 'STATIC' && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Default Value</p>
                  <p className="text-sm text-gray-900 font-mono bg-white rounded border border-green-200 px-3 py-2">
                    {correctionRule.default_value}
                  </p>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                {correctionRule.requires_approval && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                    <Info className="w-4 h-4" />
                    Requires Approval
                  </span>
                )}
                {correctionRule.fallback_strategy && (
                  <span className="text-xs text-gray-600">
                    Fallback: {correctionRule.fallback_strategy}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Impacted Fields */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Impacted Fields:</p>
          <div className="flex flex-wrap gap-2">
            {getImpactedFields().map((field, index) => (
              <span
                key={index}
                className="px-3 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded-full border border-gray-300"
              >
                {field}
              </span>
            ))}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex gap-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${validationRule.is_active ? 'bg-green-500' : 'bg-gray-400'}`}
            />
            <span className="text-sm text-gray-700">
              {validationRule.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {validationRule.auto_correct_enabled && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-gray-700">Auto-Correction Enabled</span>
            </div>
          )}
          {correctionRule?.is_test_mode && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm text-gray-700">Test Mode</span>
            </div>
          )}
        </div>

        {/* Summary Statement */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Summary:</strong> This rule will validate{' '}
            <span className="font-semibold">{validationRule.field_name || 'the specified field'}</span>
            {validationRule.auto_correct_enabled && correctionRule
              ? ` and automatically attempt correction using ${correctionRule.correction_source_type?.toLowerCase()}`
              : ' without automatic correction'}
            .
            {correctionRule?.is_test_mode &&
              ' Corrections will be previewed only (test mode).'}
          </p>
        </div>
      </div>

      {/* Footer with Close Button */}
      {onClose && (
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close Preview
          </button>
        </div>
      )}
    </div>
  );
};

export default RulePreview;
