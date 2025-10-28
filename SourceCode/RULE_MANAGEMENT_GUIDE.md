# Validation & Correction Rules Management Guide

## Overview

The **Add/Edit Rule** feature provides a comprehensive interface for managing validation rules and their associated auto-correction behaviors in the 837 Claim Processing Platform.

## Features

### ✅ Two-Step Form Design

1. **Step 1: Validation Rule Setup** - Define validation criteria
2. **Step 2: Auto-Correction Configuration** - Optional automatic correction setup

### ✅ Dynamic Field Visibility

- Fields appear/hide based on correction source type selection
- Intelligent form validation with real-time error feedback
- Test mode banner for preview-only corrections

### ✅ Master Data Integration

- Automatic lookup table suggestions (Facilities, Providers, Payers, Trading Partners)
- Dynamic column dropdowns based on selected table
- Support for static values, format transformations, and API-based corrections

---

## File Structure

```
frontend/src/
├── pages/
│   ├── Rules.tsx                    # List view with Add/Edit/Delete actions
│   └── AddEditRule.tsx              # Main form page
├── components/
│   ├── ValidationRuleForm.tsx       # Step 1 form component
│   ├── CorrectionRuleForm.tsx       # Step 2 form component
│   └── RulePreview.tsx              # Summary preview modal
├── services/
│   └── ruleService.ts               # API integration layer
└── types/
    └── rules.ts                     # TypeScript interfaces

backend/database/migrations/
└── add_validation_correction_columns.sql  # Database migration
```

---

## Database Schema Updates

### ValidationRules Table - New Columns

```sql
ALTER TABLE public.ValidationRules
ADD COLUMN segment_code VARCHAR(10) NULL,
ADD COLUMN element_position INT NULL,
ADD COLUMN loop_level VARCHAR(50) NULL,
ADD COLUMN applies_to_claim_type VARCHAR(30) NULL DEFAULT 'BOTH';
```

**Purpose:**
- `segment_code` - X12 segment identifier (e.g., NM1, REF, DTP)
- `element_position` - Position within segment
- `loop_level` - X12 loop identifier (e.g., 2000A, 2010AA)
- `applies_to_claim_type` - Filter: PROFESSIONAL, INSTITUTIONAL, or BOTH

### CorrectionRules Table - New Columns

```sql
ALTER TABLE public.CorrectionRules
ADD COLUMN correction_source_type VARCHAR(50) NULL,
ADD COLUMN is_test_mode BOOL NULL DEFAULT false,
ADD COLUMN approved_by UUID NULL,
ADD COLUMN approved_at TIMESTAMP NULL;
```

**Purpose:**
- `correction_source_type` - Source: MASTER_LOOKUP, STATIC, FORMAT, API
- `is_test_mode` - Preview mode flag (no actual data changes)
- `approved_by` / `approved_at` - Approval tracking

---

## Usage Guide

### Adding a New Validation Rule

1. **Navigate to Rules Page**
   - Go to `/rules` in the application
   - Click "Add New Rule" button

2. **Step 1: Configure Validation**
   - **Basic Information:**
     - Rule Code (unique identifier, e.g., `VAL_NM1_01`)
     - Rule Name (descriptive name)
     - Rule Category (FILE, STRUCTURAL, BUSINESS, PAYER_SPECIFIC)
     - Rule Type (REQUIRED_FIELD, FORMAT, RANGE, LOOKUP, CUSTOM)
     - Severity (ERROR, WARNING, INFO)
     - Priority (1-1000)

   - **X12 EDI Configuration:**
     - Segment Code (e.g., NM1, DTP, REF)
     - Element Position (1, 2, 3, etc.)
     - Loop Level (e.g., 2000A, 2010AA)

   - **Field Configuration:**
     - Field Name (e.g., `provider_npi`)
     - Field Path (JSON path: `provider.npi`)
     - Applies to Claim Type (BOTH, PROFESSIONAL, INSTITUTIONAL)
     - Error Message Template

   - **Validation Logic (JSON):**
     ```json
     {
       "operator": "regex",
       "pattern": "^[0-9]{10}$",
       "expected_length": 10
     }
     ```

   - **Scope Filters (Optional):**
     - Apply to Specific Payer
     - Apply to Specific Facility

   - **Status:**
     - ✅ Active (enable rule)
     - ✅ Enable Auto-Correction (show Step 2)

3. **Step 2: Configure Auto-Correction** (if enabled)
   - **Correction Type:** LOOKUP, DEFAULT_VALUE, FORMAT, CALCULATION, AI_ASSISTED
   - **Correction Source Type:** Choose one:

   #### A. MASTER_LOOKUP
   - Select Lookup Table (Facilities, Providers, Payers, etc.)
   - Select Lookup Column
   - System will fetch correct value from master data

   #### B. STATIC
   - Enter Default Value
   - This value will be used when validation fails

   #### C. FORMAT
   - Define transformation rule:
     ```
     uppercase
     lowercase
     trim
     toFixed(2)
     replace(/[^0-9]/g, '')
     ```

   #### D. API
   - Configure external API endpoint for correction

   - **Fallback Strategy:**
     - SKIP (keep original)
     - DEFAULT (use default value)
     - NULL (set to null)
     - ERROR (mark as error)
     - MANUAL_REVIEW (send for review)

   - **Testing & Approval:**
     - ✅ Test Mode (preview only, no actual changes)
     - ✅ Requires Approval
     - ✅ Active

4. **Preview & Save**
   - Click "Preview" to see summary
   - Click "Save Rule" to save without correction
   - Click "Save & Enable Auto-Correction" to save with correction

---

## API Endpoints

### Validation Rules

```typescript
GET    /api/v1/rules/validation           # List all validation rules
GET    /api/v1/rules/validation/:id       # Get specific rule
POST   /api/v1/rules/validation           # Create new rule
PUT    /api/v1/rules/validation/:id       # Update rule
DELETE /api/v1/rules/validation/:id       # Delete rule
```

### Correction Rules

```typescript
GET    /api/v1/rules/correction                      # List all correction rules
GET    /api/v1/rules/correction/:id                  # Get specific rule
GET    /api/v1/rules/correction/by-validation/:id    # Get by validation rule ID
POST   /api/v1/rules/correction                      # Create new rule
PUT    /api/v1/rules/correction/:id                  # Update rule
DELETE /api/v1/rules/correction/:id                  # Delete rule
```

### Preview & Testing

```typescript
POST   /api/v1/rules/preview                         # Preview rule impact
POST   /api/v1/rules/correction/:id/test             # Test correction with sample data
```

---

## Component Props Reference

### ValidationRuleForm

```typescript
interface ValidationRuleFormProps {
  formData: ValidationRule;
  onChange: (field: keyof ValidationRule, value: any) => void;
  payers: Array<{ payer_id: string; payer_name: string }>;
  facilities: Array<{ facility_id: string; facility_name: string }>;
  errors?: Record<string, string>;
}
```

### CorrectionRuleForm

```typescript
interface CorrectionRuleFormProps {
  formData: CorrectionRule;
  onChange: (field: keyof CorrectionRule, value: any) => void;
  errors?: Record<string, string>;
}
```

### RulePreview

```typescript
interface RulePreviewProps {
  validationRule: ValidationRule;
  correctionRule?: CorrectionRule;
  onClose?: () => void;
}
```

---

## State Management Flow

```
1. Load Initial Data
   ├── Fetch payers
   ├── Fetch facilities
   └── If editing: Load validation + correction rules

2. Step 1: Validation Rule
   ├── User fills form
   ├── Real-time validation
   ├── Toggle auto-correction checkbox
   └── Click "Next" → Step 2

3. Step 2: Correction Rule (if enabled)
   ├── User selects correction type
   ├── Dynamic fields appear based on source type
   ├── Configure correction logic
   └── Click "Save & Enable Auto-Correction"

4. Save Process
   ├── Validate all fields
   ├── POST/PUT validation rule
   ├── If auto-correction enabled:
   │   └── POST/PUT correction rule (linked by validation_rule_id)
   └── Navigate back to rules list
```

---

## Example Use Cases

### Use Case 1: Validate Provider NPI Format

**Validation Rule:**
- Rule Code: `VAL_PROVIDER_NPI`
- Field: `provider.npi`
- Validation Logic: `{"pattern": "^[0-9]{10}$"}`
- Auto-Correction: **Disabled**

### Use Case 2: Auto-Correct Facility Code from Master Data

**Validation Rule:**
- Rule Code: `VAL_FACILITY_CODE`
- Field: `facility.facility_code`
- Auto-Correction: **Enabled**

**Correction Rule:**
- Source Type: `MASTER_LOOKUP`
- Lookup Table: `facilities`
- Lookup Column: `facility_code`
- Test Mode: `false`

### Use Case 3: Format Phone Numbers

**Validation Rule:**
- Rule Code: `VAL_PHONE_FORMAT`
- Field: `patient.phone`
- Auto-Correction: **Enabled**

**Correction Rule:**
- Source Type: `FORMAT`
- Format Rule: `replace(/[^0-9]/g, '')`
- Test Mode: `true` (preview first)

---

## Testing Workflow

1. **Create Rule in Test Mode**
   - Set `is_test_mode = true`
   - Corrections are logged but not applied
   - Review correction logs

2. **Verify Corrections**
   - Check correction preview
   - Validate against sample data
   - Review fallback behavior

3. **Enable Production Mode**
   - Set `is_test_mode = false`
   - Set `requires_approval = true` (optional)
   - Monitor correction results

---

## Troubleshooting

### Issue: Correction not triggering
- **Check:** Is `auto_correct_enabled = true` on validation rule?
- **Check:** Is `is_active = true` on correction rule?
- **Check:** Is validation rule failing (correction only runs on failure)?

### Issue: Master lookup returns null
- **Check:** Is lookup table and column configured correctly?
- **Check:** Does the value exist in master table?
- **Check:** Is fallback strategy set appropriately?

### Issue: Test mode not working
- **Check:** Is `is_test_mode = true`?
- **Check:** Are corrections being logged in CorrectionLog table?

---

## Best Practices

1. **Always use test mode first** - Set `is_test_mode = true` for new correction rules
2. **Descriptive rule codes** - Use clear naming like `VAL_NPI_FORMAT` or `CORR_FACILITY_LOOKUP`
3. **Set appropriate severity** - ERROR for critical, WARNING for business logic
4. **Use fallback strategies** - Always define what happens when correction fails
5. **Require approval for critical fields** - Set `requires_approval = true` for sensitive data
6. **Document validation logic** - Use clear JSON structure in validation_logic field
7. **Test with sample data** - Use preview endpoint before enabling in production

---

## Migration Steps

1. **Run Database Migration:**
   ```bash
   psql -U your_user -d your_database -f backend/database/migrations/add_validation_correction_columns.sql
   ```

2. **Update Backend API** (if not already implemented):
   - Add routes for validation/correction CRUD
   - Implement preview and test endpoints

3. **Deploy Frontend:**
   - Build and deploy React components
   - Update routing to include `/rules/add` and `/rules/edit/:id`

4. **Verify:**
   - Test adding a new rule
   - Test editing existing rule
   - Test auto-correction flow
   - Check preview functionality

---

## Future Enhancements

- [ ] Bulk import/export of rules (CSV/JSON)
- [ ] Rule versioning and history
- [ ] AI-assisted rule creation
- [ ] Visual rule builder (drag-and-drop)
- [ ] Rule impact analysis dashboard
- [ ] Rule testing sandbox with sample claims
- [ ] Rule templates library
- [ ] Collaborative rule review workflow

---

## Support

For issues or questions:
1. Check logs in `FileValidationLog`, `BusinessValidationLog`, `CorrectionLog`
2. Review API responses for error details
3. Verify database column additions with `\d ValidationRules` and `\d CorrectionRules`
4. Contact development team for assistance

---

**Last Updated:** 2025-10-13
**Version:** 1.0.0
