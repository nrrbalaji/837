# Field Path Configuration Guide

This guide explains how to configure field paths for validation rules in the 837 EDI parsing system.

## Understanding the Data Structure

When an 837 file is parsed, it goes through the following transformation:

```
Raw X12 EDI File
    ↓ (parsing837.js - parseX12Content)
Parsed X12 Structure (intermediate)
    ↓ (parsing837.js - extractClaims)
Extracted Claim Objects (final structure used for validation)
```

## Important: Use the Extracted Claim Structure

**The field paths in validation rules should reference the EXTRACTED claim structure, NOT the intermediate parsing structure.**

### ❌ WRONG - Intermediate Parsing Structure:
```
claims[*].claims[*].serviceLines[*].procedureModifier1
```

### ✅ CORRECT - Extracted Claim Structure:
```
serviceLines[*].procedureModifier1
```

## Field Path Syntax

### Basic Paths
Use dot notation to access nested properties:
```
patient.firstName
billing.identificationCode
subscriber.dateOfBirth
```

### Array Paths
Use `[*]` to indicate array iteration:
```
serviceLines[*].procedureCode          // Validates all service lines
serviceLines[*].procedureModifier1     // Validates modifier 1 on all lines
diagnoses[*].code                      // Validates all diagnosis codes
```

### Why Use [*]?
The `[*]` syntax tells the validation engine to:
1. Iterate through ALL items in the array
2. Apply the validation rule to EACH item
3. Report errors for ANY item that fails

## Common Field Paths by Use Case

### Validating Provider Information
```javascript
// Billing provider NPI (10 digits required)
field_path: "billing.identificationCode"
validation_logic: { "pattern": "^[0-9]{10}$" }

// Rendering provider name required
field_path: "renderingProvider.lastName"
validation_logic: { "required": true }

// Provider taxonomy code format
field_path: "renderingProvider.providerInfo.providerTaxonomyCode"
validation_logic: { "pattern": "^[0-9]{10}X$" }
```

### Validating Patient Information
```javascript
// Patient DOB required and valid date
field_path: "patient.dateOfBirth"
validation_logic: {
  "required": true,
  "format": "date",
  "maxDate": "today"
}

// Patient gender must be M, F, or U
field_path: "patient.gender"
validation_logic: {
  "enum": ["M", "F", "U"]
}

// Patient ZIP code format (5 or 9 digits)
field_path: "patient.zipCode"
validation_logic: {
  "pattern": "^[0-9]{5}(-[0-9]{4})?$"
}
```

### Validating Service Lines
```javascript
// All procedure codes must be valid CPT/HCPCS
field_path: "serviceLines[*].procedureCode"
validation_logic: {
  "required": true,
  "pattern": "^[0-9A-Z]{5}$"
}

// Validate modifier 1 exists and is 2 characters
field_path: "serviceLines[*].procedureModifier1"
validation_logic: {
  "minLength": 2,
  "maxLength": 2,
  "pattern": "^[A-Z0-9]{2}$"
}

// Validate charge amount is positive
field_path: "serviceLines[*].lineItemCharge"
validation_logic: {
  "required": true,
  "min": 0.01,
  "type": "number"
}

// Place of service must be valid code
field_path: "serviceLines[*].placeOfService"
validation_logic: {
  "enum": ["11", "21", "22", "23", "24", ...]
}

// Revenue code required for institutional claims
field_path: "serviceLines[*].revenueCode"
applies_to_claim_type: "INSTITUTIONAL"
validation_logic: {
  "required": true,
  "pattern": "^[0-9]{4}$"
}
```

### Validating Diagnosis Codes
```javascript
// All diagnosis codes must be valid ICD-10
field_path: "diagnoses[*].code"
validation_logic: {
  "required": true,
  "pattern": "^[A-Z][0-9]{2}(\\.[0-9A-Z]{1,4})?$"
}

// Code qualifier must be ABK (ICD-10)
field_path: "diagnoses[*].codeListQualifier"
validation_logic: {
  "equals": "ABK"
}
```

### Validating Claim Header
```javascript
// Claim number required and unique
field_path: "claimNumber"
validation_logic: {
  "required": true,
  "unique": true
}

// Total charge must match sum of line charges
field_path: "totalCharge"
validation_logic: {
  "equals": "sum(serviceLines[*].lineItemCharge)"
}

// Service dates must be valid range
field_path: "serviceDateFrom"
validation_logic: {
  "required": true,
  "format": "date",
  "maxDate": "today"
}
```

### Validating Payer/Insurance
```javascript
// Subscriber relationship code
field_path: "subscriberInfo.individualRelationshipCode"
validation_logic: {
  "enum": ["01", "18", "19", "20", ...]
}

// Group number required for group insurance
field_path: "subscriberInfo.groupNumber"
validation_logic: {
  "required": true,
  "minLength": 1
}

// Payer ID must be in master table
field_path: "receiver.identificationCode"
validation_logic: {
  "lookup": {
    "table": "Payer",
    "column": "electronic_payer_id"
  }
}
```

## Complete Field Path Reference

### Claim Header
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `claimNumber` | Unique claim identifier | string |
| `totalCharge` | Total billed amount | number |
| `placeOfService` | 2-digit POS code | string |
| `claimFrequencyCode` | Claim frequency (1=Original) | string |
| `claimType` | Professional/Institutional | string |

### Billing Provider (NM1*85)
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `billing.identificationCode` | Provider NPI | string (10 digits) |
| `billing.lastName` | Organization name | string |
| `billing.firstName` | Provider first name | string |
| `billing.taxId` | Federal Tax ID (EIN) | string |
| `billing.addressLine1` | Street address | string |
| `billing.city` | City | string |
| `billing.state` | 2-letter state code | string |
| `billing.zipCode` | ZIP code | string |

### Patient (NM1*QC)
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `patient.firstName` | Patient first name | string |
| `patient.lastName` | Patient last name | string |
| `patient.middleName` | Patient middle name | string |
| `patient.dateOfBirth` | DOB (YYYY-MM-DD) | date |
| `patient.gender` | M, F, or U | string |
| `patient.addressLine1` | Patient address | string |
| `patient.city` | City | string |
| `patient.state` | State code | string |
| `patient.zipCode` | ZIP code | string |

### Subscriber (NM1*IL)
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `subscriber.firstName` | Subscriber first name | string |
| `subscriber.lastName` | Subscriber last name | string |
| `subscriber.dateOfBirth` | Subscriber DOB | date |
| `subscriber.identificationCode` | Member ID | string |
| `subscriberInfo.individualRelationshipCode` | Relationship to patient | string |
| `subscriberInfo.groupNumber` | Insurance group number | string |

### Service Lines (SV1/SV2)
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `serviceLines[*].procedureCode` | CPT/HCPCS code | string |
| `serviceLines[*].procedureModifier1` | Modifier 1 | string (2 chars) |
| `serviceLines[*].procedureModifier2` | Modifier 2 | string (2 chars) |
| `serviceLines[*].procedureModifier3` | Modifier 3 | string (2 chars) |
| `serviceLines[*].procedureModifier4` | Modifier 4 | string (2 chars) |
| `serviceLines[*].revenueCode` | Revenue code (837I only) | string (4 digits) |
| `serviceLines[*].lineItemCharge` | Line charge amount | number |
| `serviceLines[*].serviceUnitCount` | Number of units | number |
| `serviceLines[*].placeOfService` | Line-level POS | string |
| `serviceLines[*].serviceDateFrom` | Service start date | date |
| `serviceLines[*].serviceDateTo` | Service end date | date |
| `serviceLines[*].diagnosisCodePointer` | Link to diagnosis | string |

### Diagnoses (HI)
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `diagnoses[*].code` | ICD-10 diagnosis code | string |
| `diagnoses[*].codeListQualifier` | Code type (ABK=ICD-10) | string |

### Dates
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `serviceDateFrom` | Claim service start | date |
| `serviceDateTo` | Claim service end | date |
| `statementDateFrom` | Statement period start | date |
| `statementDateTo` | Statement period end | date |
| `admissionDate` | Hospital admission | date |
| `dischargeDate` | Hospital discharge | date |

### Rendering Provider (NM1*82)
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `renderingProvider.identificationCode` | Rendering provider NPI | string |
| `renderingProvider.lastName` | Last name | string |
| `renderingProvider.firstName` | First name | string |
| `renderingProvider.providerInfo.providerTaxonomyCode` | Specialty taxonomy | string |

### Payer/Receiver (NM1*40)
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `receiver.lastName` | Payer name | string |
| `receiver.identificationCode` | Electronic payer ID | string |

### References
| Field Path | Description | Data Type |
|------------|-------------|-----------|
| `priorAuthNumber` | Prior authorization number | string |

## Examples from Your Use Case

### Example 1: Validate Procedure Modifier 1 Format
```javascript
{
  "rule_code": "VAL_SV1_MODIFIER1_FORMAT",
  "rule_name": "Validate Procedure Modifier 1 Format",
  "rule_category": "BUSINESS",
  "rule_type": "FORMAT",
  "field_path": "serviceLines[*].procedureModifier1",
  "validation_logic": {
    "pattern": "^[A-Z0-9]{2}$",
    "message": "Modifier 1 must be exactly 2 alphanumeric characters"
  },
  "error_message_template": "Invalid modifier 1 '{value}' on line {lineNumber}. Must be 2 characters.",
  "severity": "ERROR"
}
```

### Example 2: Validate Modifier 1 Against Payer Rules
```javascript
{
  "rule_code": "VAL_MODIFIER1_PAYER_SPECIFIC",
  "rule_name": "Medicare - Modifier 25 Required for E&M with Procedure",
  "rule_category": "PAYER_SPECIFIC",
  "rule_type": "CONDITIONAL_REQUIRED",
  "field_path": "serviceLines[*].procedureModifier1",
  "applies_to_payer": "medicare_payer_id",
  "validation_logic": {
    "condition": "procedureCode IN ('99201'-'99215') AND otherProcedureExists",
    "required": true,
    "mustEqual": "25"
  },
  "error_message_template": "Medicare requires modifier 25 on E&M code when billed with procedure",
  "severity": "ERROR"
}
```

### Example 3: Cross-Field Validation
```javascript
{
  "rule_code": "VAL_MODIFIER1_NO_DUPLICATE",
  "rule_name": "Modifier 1 Cannot Match Modifier 2",
  "rule_category": "BUSINESS",
  "rule_type": "CROSS_FIELD_VALIDATION",
  "field_path": "serviceLines[*].procedureModifier1",
  "validation_logic": {
    "notEquals": "serviceLines[*].procedureModifier2",
    "message": "Modifier 1 cannot be the same as Modifier 2"
  },
  "error_message_template": "Duplicate modifier '{value}' found on line {lineNumber}",
  "severity": "ERROR"
}
```

## Best Practices

1. **Always test field paths** - Use the "Browse Fields" helper in the UI to ensure correct paths
2. **Use array notation [*] for repeating segments** - Service lines and diagnoses
3. **Be specific with error messages** - Include context like line numbers
4. **Set appropriate severity** - ERROR blocks processing, WARNING allows with notice
5. **Test with sample data** - Verify validation works as expected before activating

## Troubleshooting

### Issue: Validation not triggering
- **Check**: Is the field path correct? Use Browse Fields helper
- **Check**: Does the field exist in your test data? Review parsed JSON
- **Check**: Is the rule active? Check `is_active` flag

### Issue: Getting "field not found" errors
- **Solution**: The field may not exist in all claims. Use conditional logic or check for existence first

### Issue: Array validation not working
- **Check**: Did you use `[*]` notation?
- **Wrong**: `serviceLines.procedureModifier1`
- **Right**: `serviceLines[*].procedureModifier1`

## Need Help?

If you're unsure about a field path:
1. Click "Browse Fields" in the Field Path input
2. Search for the field you need
3. Click to auto-populate the correct path
4. Review the example values to ensure it matches your use case
