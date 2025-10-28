// Step 2: Correction Rule Configuration Form

import React, { useEffect, useState } from 'react';
import { CorrectionRule, MasterTableOption } from '../types/rules';
import { AlertTriangle, CheckCircle, Wrench, Info } from 'lucide-react';
import { getMasterTables, getMasterTableColumns } from '../services/ruleService';

interface CorrectionRuleFormProps {
  formData: CorrectionRule;
  onChange: (field: keyof CorrectionRule, value: any) => void;
  errors?: Record<string, string>;
}

const CorrectionRuleForm: React.FC<CorrectionRuleFormProps> = ({
  formData,
  onChange,
  errors = {},
}) => {
  const [masterTables, setMasterTables] = useState<MasterTableOption[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  useEffect(() => {
    loadMasterTables();
  }, []);

  useEffect(() => {
    if (formData.lookup_table) {
      loadTableColumns(formData.lookup_table);
    }
  }, [formData.lookup_table]);

  const loadMasterTables = async () => {
    try {
      const tables = await getMasterTables();
      setMasterTables(tables);
    } catch (error) {
      console.error('Error loading master tables:', error);
    }
  };

  const loadTableColumns = async (tableName: string) => {
    try {
      const columns = await getMasterTableColumns(tableName);
      setAvailableColumns(columns);
    } catch (error) {
      console.error('Error loading columns:', error);
      setAvailableColumns([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Test Mode Warning Banner */}
      {formData.is_test_mode && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-800">
                Preview Mode Only
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                This correction rule is in test mode and won't modify actual claim data.
                Corrections will be logged for review only.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Basic Correction Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-green-500" />
          Correction Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correction Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.correction_type}
              onChange={(e) => onChange('correction_type', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.correction_type ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Type</option>
              <option value="MASTER_LOOKUP">Master Lookup</option>
              <option value="STATIC_VALUE">Static Value</option>
              <option value="FORMAT_CORRECTION">Format Correction</option>
              <option value="FIELD_COPY">Field Copy</option>
              <option value="MAPPING_TABLE">Mapping Table</option>
              <option value="CALCULATION">Calculation</option>
              <option value="PREPEND_APPEND">Prepend/Append</option>
              <option value="AI_ASSISTED_SUGGESTION">AI Assisted Suggestion</option>
              <option value="REMOVE_INVALID_SEGMENT">Remove Invalid Segment</option>
              <option value="CLEAN_UP">Clean Up</option>
            </select>
            {errors.correction_type && (
              <p className="mt-1 text-sm text-red-600">{errors.correction_type}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correction Source Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.correction_source_type || ''}
              onChange={(e) => onChange('correction_source_type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select Source</option>
              <option value="MASTER_PROVIDER">Master Provider</option>
              <option value="MASTER_FACILITY">Master Facility</option>
              <option value="MASTER_PAYER">Master Payer</option>
              <option value="MASTER_TRADING_PARTNER">Master Trading Partner</option>
              <option value="MASTER_GENERIC_LOOKUP">Master Generic Lookup</option>
              <option value="STATIC">Static</option>
              <option value="FORMAT_RULE">Format Rule</option>
              <option value="SQL_MAPPING_LOOKUP">SQL Mapping Lookup</option>
              <option value="FIELD_REFERENCE">Field Reference</option>
              <option value="AI_SUGGESTION">AI Suggestion</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => onChange('priority', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              min="1"
              max="1000"
            />
          </div>
        </div>
      </div>

      {/* Master Lookup Configuration */}
      {(formData.correction_source_type === 'MASTER_PROVIDER' ||
        formData.correction_source_type === 'MASTER_FACILITY' ||
        formData.correction_source_type === 'MASTER_PAYER' ||
        formData.correction_source_type === 'MASTER_TRADING_PARTNER' ||
        formData.correction_source_type === 'MASTER_GENERIC_LOOKUP') && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-green-600" />
            Master Data Lookup Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lookup Table <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.lookup_table || ''}
                onChange={(e) => onChange('lookup_table', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              >
                <option value="">Select Table</option>
                {masterTables.map((table) => (
                  <option key={table.value} value={table.value}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lookup Column <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.lookup_column || ''}
                onChange={(e) => onChange('lookup_column', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                disabled={!formData.lookup_table}
              >
                <option value="">Select Column</option>
                {availableColumns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">
              <strong>How it works:</strong> When validation fails, the system will look up
              the correct value from the selected master table and column. For example, if
              validating a provider NPI, it can automatically fetch the correct NPI from the
              Provider master table.
            </p>
          </div>
        </div>
      )}

      {/* Static Value Configuration */}
      {formData.correction_source_type === 'STATIC' && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Static Default Value
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Value <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.default_value || ''}
              onChange={(e) => onChange('default_value', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
              placeholder="Enter the default value to use"
            />
            <p className="mt-2 text-sm text-gray-600">
              This static value will be used whenever the validation fails.
            </p>
          </div>
        </div>
      )}

      {/* Format Rule Configuration */}
      {formData.correction_source_type === 'FORMAT_RULE' && (
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Format Transformation Rule
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format Pattern/Rule <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.default_value || ''}
              onChange={(e) => onChange('default_value', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white font-mono text-sm"
              placeholder={`Examples:
- uppercase
- lowercase
- trim
- toFixed(2)
- replace(/[^0-9]/g, '')
- padStart(10, '0')`}
            />
            <p className="mt-2 text-sm text-gray-600">
              Define JavaScript transformation functions to apply to the value.
            </p>
          </div>
        </div>
      )}

      {/* Correction Logic (JSON Editor) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Advanced Correction Logic (JSON)
        </h3>

        <div className="space-y-4">
          <textarea
            value={JSON.stringify(formData.correction_logic || {}, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange('correction_logic', parsed);
              } catch {
                // Allow invalid JSON while typing
              }
            }}
            rows={8}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
            placeholder={`{
  "strategy": "lookup",
  "match_field": "npi",
  "return_field": "provider_id",
  "fallback": "default_value"
}`}
          />
          <p className="text-xs text-gray-500">
            Define advanced correction logic using JSON. Supports conditional rules, multi-step
            corrections, and custom fallback strategies.
          </p>
        </div>
      </div>

      {/* Fallback Strategy */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Fallback & Error Handling
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fallback Strategy
          </label>
          <select
            value={formData.fallback_strategy || 'SKIP'}
            onChange={(e) => onChange('fallback_strategy', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="SKIP">Skip Correction (Keep Original)</option>
            <option value="DEFAULT">Use Default Value</option>
            <option value="NULL">Set to NULL</option>
            <option value="ERROR">Mark as Error</option>
            <option value="MANUAL_REVIEW">Send to Manual Review</option>
          </select>
          <p className="mt-2 text-sm text-gray-600">
            What should happen if the correction cannot be applied?
          </p>
        </div>
      </div>

      {/* Approval & Testing Flags */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Approval & Testing Settings
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_test_mode}
              onChange={(e) => onChange('is_test_mode', e.target.checked)}
              className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Test Mode (Preview Only)</span>
              <p className="text-xs text-gray-500">
                Enable to test this rule without actually modifying claim data
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requires_approval}
              onChange={(e) => onChange('requires_approval', e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Requires Approval</span>
              <p className="text-xs text-gray-500">
                Corrections must be reviewed and approved before being applied
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => onChange('is_active', e.target.checked)}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Active</span>
              <p className="text-xs text-gray-500">Enable this correction rule</p>
            </div>
          </label>
        </div>
      </div>

      {/* Success Indicator */}
      {formData.correction_source_type && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-green-800">
                Correction Rule Configured
              </h4>
              <p className="text-sm text-green-700 mt-1">
                This rule will automatically correct validation failures using{' '}
                <strong>{formData.correction_source_type}</strong> as the source.
                {formData.is_test_mode && ' (Test Mode - No actual changes)'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrectionRuleForm;
