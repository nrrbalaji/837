// Step 1: Validation Rule Configuration Form

import React, { useState } from 'react';
import { ValidationRule } from '../types/rules';
import { AlertCircle, Info, Search, BookOpen } from 'lucide-react';
import { FIELD_PATHS, getFieldPathsByCategory, searchFieldPaths } from '../constants/fieldPaths';

interface ValidationRuleFormProps {
  formData: ValidationRule;
  onChange: (field: keyof ValidationRule, value: any) => void;
  payers: Array<{ payer_id: string; payer_name: string }>;
  facilities: Array<{ facility_id: string; facility_name: string }>;
  errors?: Record<string, string>;
}

const ValidationRuleForm: React.FC<ValidationRuleFormProps> = ({
  formData,
  onChange,
  payers,
  facilities,
  errors = {},
}) => {
  const [showFieldPathHelper, setShowFieldPathHelper] = useState(false);
  const [fieldPathSearch, setFieldPathSearch] = useState('');

  const fieldPathsByCategory = getFieldPathsByCategory();
  const filteredPaths = fieldPathSearch
    ? searchFieldPaths(fieldPathSearch)
    : FIELD_PATHS;

  const handleFieldPathSelect = (path: string) => {
    onChange('field_path', path);
    setShowFieldPathHelper(false);
    setFieldPathSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-500" />
          Basic Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rule Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.rule_code}
              onChange={(e) => onChange('rule_code', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.rule_code ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., VAL_NM1_01"
            />
            {errors.rule_code && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.rule_code}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rule Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.rule_name}
              onChange={(e) => onChange('rule_name', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.rule_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Validate Provider NPI Format"
            />
            {errors.rule_name && (
              <p className="mt-1 text-sm text-red-600">{errors.rule_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rule Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.rule_category}
              onChange={(e) => onChange('rule_category', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Category</option>
              <option value="FILE">File Level</option>
              <option value="STRUCTURAL">EDI Structural</option>
              <option value="BUSINESS">Business Logic</option>
              <option value="PAYER_SPECIFIC">Payer Specific</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rule Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.rule_type}
              onChange={(e) => onChange('rule_type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Type</option>
              <option value="REQUIRED_FIELD">Required Field</option>
              <option value="FORMAT">Format</option>
              <option value="VALUE_RANGE">Value Range</option>
              <option value="LOOKUP_VALIDATION">Lookup Validation</option>
              <option value="CROSS_FIELD_VALIDATION">Cross Field Validation</option>
              <option value="CONDITIONAL_REQUIRED">Conditional Required</option>
              <option value="ENUM_MATCH">Enum Match</option>
              <option value="LENGTH_CHECK">Length Check</option>
              <option value="DATE_VALIDATION">Date Validation</option>
              <option value="STRUCTURAL_ORDER">Structural Order</option>
              <option value="LOOP_REQUIRED">Loop Required</option>
              <option value="PAYER_SPECIFIC_RULE">Payer Specific Rule</option>
              <option value="DUPLICATE_CHECK">Duplicate Check</option>
              <option value="RELATIONAL_CHECK">Relational Check</option>
              <option value="CUSTOM_SCRIPT_LOGIC">Custom Script Logic</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Severity <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.severity}
              onChange={(e) => onChange('severity', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ERROR">Error</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="1000"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Describe what this rule validates..."
          />
        </div>
      </div>

      {/* X12 EDI Specific Fields */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          X12 EDI Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Segment Code
            </label>
            <input
              type="text"
              value={formData.segment_code || ''}
              onChange={(e) => onChange('segment_code', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., NM1, REF, DTP"
              maxLength={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Element Position
            </label>
            <input
              type="number"
              value={formData.element_position || ''}
              onChange={(e) => onChange('element_position', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 1, 2, 3"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loop Level
            </label>
            <input
              type="text"
              value={formData.loop_level || ''}
              onChange={(e) => onChange('loop_level', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 2000A, 2010AA, 2300"
              maxLength={50}
            />
          </div>
        </div>
      </div>

      {/* Field Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Field Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Field Name
            </label>
            <input
              type="text"
              value={formData.field_name || ''}
              onChange={(e) => onChange('field_name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., provider_npi, patient_dob"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Field Path (JSON)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.field_path || ''}
                onChange={(e) => onChange('field_path', e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., billing.identificationCode, serviceLines[*].procedureModifier1"
              />
              <button
                type="button"
                onClick={() => setShowFieldPathHelper(!showFieldPathHelper)}
                className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-2"
                title="Field Path Helper"
              >
                <BookOpen className="w-4 h-4" />
                Browse Fields
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Use [*] for arrays, e.g., serviceLines[*].procedureModifier1 to validate all service lines
            </p>

            {/* Field Path Helper Modal */}
            {showFieldPathHelper && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
                {/* Search Bar */}
                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={fieldPathSearch}
                      onChange={(e) => setFieldPathSearch(e.target.value)}
                      placeholder="Search fields..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Field List */}
                <div className="overflow-y-auto flex-1">
                  {fieldPathSearch ? (
                    // Search results
                    <div className="p-2">
                      {filteredPaths.length > 0 ? (
                        filteredPaths.map((field, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleFieldPathSelect(field.value)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg group"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900 group-hover:text-blue-600">
                                  {field.label}
                                </div>
                                <div className="text-xs font-mono text-blue-600 mt-0.5">
                                  {field.value}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {field.description}
                                </div>
                              </div>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded ml-2">
                                {field.category}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          No fields found matching "{fieldPathSearch}"
                        </div>
                      )}
                    </div>
                  ) : (
                    // Grouped by category
                    Object.entries(fieldPathsByCategory).map(([category, fields]) => (
                      <div key={category} className="border-b border-gray-200 last:border-b-0">
                        <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wider sticky top-0">
                          {category}
                        </div>
                        <div className="p-2">
                          {fields.map((field, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleFieldPathSelect(field.value)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg group"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-gray-900 group-hover:text-blue-600">
                                    {field.label}
                                  </div>
                                  <div className="text-xs font-mono text-blue-600 mt-0.5">
                                    {field.value}
                                  </div>
                                  {field.example && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      Example: {field.example}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                  💡 Tip: Use [*] for arrays (e.g., serviceLines[*].procedureCode validates all lines)
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applies to Claim Type
            </label>
            <select
              value={formData.applies_to_claim_type || 'ALL'}
              onChange={(e) => onChange('applies_to_claim_type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="PROFESSIONAL">Professional (837P)</option>
              <option value="INSTITUTIONAL">Institutional (837I)</option>
              <option value="DENTAL">Dental (837D)</option>
              <option value="BOTH_PROFESSIONAL_AND_INSTITUTIONAL">Professional & Institutional</option>
              <option value="ALL">All Claim Types</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Error Message Template
          </label>
          <textarea
            value={formData.error_message_template || ''}
            onChange={(e) => onChange('error_message_template', e.target.value)}
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Error message shown when validation fails. Use {field_name} for dynamic values."
          />
        </div>
      </div>

      {/* Validation Logic (JSON Editor) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Validation Logic (JSON)
        </h3>

        <div className="space-y-4">
          <textarea
            value={typeof formData.validation_logic === 'string'
              ? formData.validation_logic
              : JSON.stringify(formData.validation_logic || {}, null, 2)}
            onChange={(e) => {
              const value = e.target.value;
              try {
                const parsed = JSON.parse(value);
                onChange('validation_logic', parsed);
              } catch {
                // Store as string while typing invalid JSON
                onChange('validation_logic', value);
              }
            }}
            rows={8}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder={`{
  "operator": "equals",
  "expected_value": "1234567890",
  "pattern": "^[0-9]{10}$"
}`}
          />
          <p className="text-xs text-gray-500">
            Define validation conditions using JSON format. Supports operators: equals, contains, regex, range, etc.
          </p>
        </div>
      </div>

      {/* Scope Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Scope & Filters (Optional)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Apply to Specific Payer
            </label>
            <select
              value={formData.applies_to_payer || ''}
              onChange={(e) => onChange('applies_to_payer', e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Payers</option>
              {payers.map((payer) => (
                <option key={payer.payer_id} value={payer.payer_id}>
                  {payer.payer_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Apply to Specific Facility
            </label>
            <select
              value={formData.applies_to_facility || ''}
              onChange={(e) => onChange('applies_to_facility', e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Facilities</option>
              {facilities.map((facility) => (
                <option key={facility.facility_id} value={facility.facility_id}>
                  {facility.facility_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status Toggles */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Rule Status
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => onChange('is_active', e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Active</span>
              <p className="text-xs text-gray-500">Enable this validation rule</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.auto_correct_enabled || false}
              onChange={(e) => onChange('auto_correct_enabled', e.target.checked)}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Enable Auto-Correction</span>
              <p className="text-xs text-gray-500">
                Automatically attempt to correct validation failures
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ValidationRuleForm;
