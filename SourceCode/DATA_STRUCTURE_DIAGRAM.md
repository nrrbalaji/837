# 837 Data Structure Diagram

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         X12 837 FILE                             │
│  ISA*00*...*GS*HC*...*ST*837*...*BHT*...*NM1*85*...*CLM*...~   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   parseX12Content() in parsing837.js
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              INTERMEDIATE PARSING STRUCTURE                      │
│              (parsedData - NOT used for validation)              │
├─────────────────────────────────────────────────────────────────┤
│  parsedData {                                                    │
│    isa: { ... },                                                │
│    gs: { ... },                                                 │
│    st: { ... },                                                 │
│    claims: [                    ← Array of transactions         │
│      {                                                          │
│        bht: { ... },                                            │
│        submitter: { ... },                                      │
│        billing: { ... },                                        │
│        patient: { ... },                                        │
│        claims: [               ← Nested array of actual claims  │
│          {                                                      │
│            claimNumber: "...",                                  │
│            totalCharge: 250.00,                                 │
│            serviceLines: [     ← Service lines here            │
│              {                                                  │
│                procedureCode: "99213",                          │
│                procedureModifier1: "25"  ← NESTED TOO DEEP!    │
│              }                                                  │
│            ]                                                    │
│          }                                                      │
│        ]                                                        │
│      }                                                          │
│    ]                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   extractClaims() in parsing837.js
                   (Flattens structure for validation)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              EXTRACTED CLAIM STRUCTURE                           │
│              (Used for validation and storage)                   │
├─────────────────────────────────────────────────────────────────┤
│  claim {                                                         │
│    claimNumber: "CLM001",                     ← Direct access   │
│    totalCharge: 250.00,                       ← Direct access   │
│    placeOfService: "11",                      ← Direct access   │
│    claimType: "Professional",                 ← Direct access   │
│                                                                  │
│    billing: {                                 ← Direct access   │
│      identificationCode: "1234567890",  // Provider NPI         │
│      lastName: "ABC Medical Center",                            │
│      taxId: "12-3456789"                                        │
│    },                                                           │
│                                                                  │
│    patient: {                                 ← Direct access   │
│      firstName: "Jane",                                         │
│      lastName: "Doe",                                           │
│      dateOfBirth: "1985-03-15",                                 │
│      gender: "F"                                                │
│    },                                                           │
│                                                                  │
│    subscriber: {                              ← Direct access   │
│      firstName: "John",                                         │
│      lastName: "Doe",                                           │
│      identificationCode: "ABC123456"                            │
│    },                                                           │
│                                                                  │
│    serviceLines: [                            ← Array - use [*] │
│      {                                                          │
│        procedureCode: "99213",         ← serviceLines[*].procedureCode     │
│        procedureModifier1: "25",       ← serviceLines[*].procedureModifier1│
│        procedureModifier2: "GT",       ← serviceLines[*].procedureModifier2│
│        lineItemCharge: 150.00,         ← serviceLines[*].lineItemCharge    │
│        serviceUnitCount: 1,            ← serviceLines[*].serviceUnitCount  │
│        placeOfService: "11"            ← serviceLines[*].placeOfService    │
│      },                                                         │
│      {                                                          │
│        procedureCode: "80053",                                  │
│        procedureModifier1: "QW",                                │
│        lineItemCharge: 100.00,                                  │
│        serviceUnitCount: 1                                      │
│      }                                                          │
│    ],                                                           │
│                                                                  │
│    diagnoses: [                               ← Array - use [*] │
│      {                                                          │
│        code: "E11.9",                  ← diagnoses[*].code      │
│        codeListQualifier: "ABK"        ← diagnoses[*].codeListQualifier│
│      },                                                         │
│      {                                                          │
│        code: "Z79.4",                                           │
│        codeListQualifier: "ABK"                                 │
│      }                                                          │
│    ],                                                           │
│                                                                  │
│    renderingProvider: {                       ← Direct access   │
│      identificationCode: "9876543210",                          │
│      lastName: "Smith",                                         │
│      firstName: "Sarah"                                         │
│    },                                                           │
│                                                                  │
│    serviceDateFrom: "2024-01-15",            ← Direct access   │
│    serviceDateTo: "2024-01-15",              ← Direct access   │
│    priorAuthNumber: "AUTH123456"             ← Direct access   │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   storeClaim() → Database
                              ↓
                   validateClaim() → Validation Engine
                              ↓
                   Uses field_path from ValidationRules
```

## Field Path Examples

### ✅ CORRECT - Using Extracted Structure

```javascript
// Single values (no array)
"claimNumber"                          // → "CLM001"
"totalCharge"                          // → 250.00
"billing.identificationCode"          // → "1234567890"
"patient.firstName"                    // → "Jane"
"patient.dateOfBirth"                  // → "1985-03-15"

// Array values (use [*])
"serviceLines[*].procedureCode"        // → ["99213", "80053"]
"serviceLines[*].procedureModifier1"   // → ["25", "QW"]
"serviceLines[*].lineItemCharge"       // → [150.00, 100.00]
"diagnoses[*].code"                    // → ["E11.9", "Z79.4"]
```

### ❌ INCORRECT - Using Intermediate Structure

```javascript
// These reference the parsing structure, not the extracted claim!
"claims[*].claims[*].serviceLines[*].procedureModifier1"  // TOO NESTED
"parsedData.claims[0].claims[0].serviceLines[0].procedureModifier1"  // WRONG
```

## Validation Rule Configuration

### Example: Validate Procedure Modifier 1

```javascript
┌────────────────────────────────────────────────────────────────┐
│                    VALIDATION RULE                              │
├────────────────────────────────────────────────────────────────┤
│  rule_code: "VAL_MODIFIER1_FORMAT"                             │
│  field_path: "serviceLines[*].procedureModifier1"              │
│              ─────────────┬─────────────                        │
│                          │                                      │
│                   Points to extracted                           │
│                   claim structure                               │
│                          │                                      │
│  validation_logic: {     ↓                                      │
│    "pattern": "^[A-Z0-9]{2}$"                                   │
│  }                                                              │
└────────────────────────────────────────────────────────────────┘
                              ↓
                   Validation Engine Applies Rule
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                    VALIDATION EXECUTION                         │
├────────────────────────────────────────────────────────────────┤
│  FOR EACH claim IN claims:                                      │
│    FOR EACH line IN claim.serviceLines:                         │
│      IF line.procedureModifier1 EXISTS:                         │
│        IF NOT MATCHES pattern "^[A-Z0-9]{2}$":                  │
│          CREATE ValidationError {                               │
│            rule_id: "VAL_MODIFIER1_FORMAT",                     │
│            field_name: "procedureModifier1",                    │
│            field_value: line.procedureModifier1,                │
│            error_message: "Invalid modifier format",            │
│            line_number: line.lineNumber                         │
│          }                                                      │
└────────────────────────────────────────────────────────────────┘
```

## Understanding Array Notation [*]

### Without [*] - Only First Item Validated
```
Field Path: "serviceLines.procedureModifier1"

serviceLines[0].procedureModifier1  ✅ Validated
serviceLines[1].procedureModifier1  ❌ SKIPPED
serviceLines[2].procedureModifier1  ❌ SKIPPED
```

### With [*] - All Items Validated
```
Field Path: "serviceLines[*].procedureModifier1"

serviceLines[0].procedureModifier1  ✅ Validated
serviceLines[1].procedureModifier1  ✅ Validated
serviceLines[2].procedureModifier1  ✅ Validated
```

## Common Validation Patterns

### Pattern 1: Required Field
```javascript
{
  "field_path": "billing.identificationCode",
  "validation_logic": {
    "required": true
  }
}
```

### Pattern 2: Format Validation
```javascript
{
  "field_path": "serviceLines[*].procedureModifier1",
  "validation_logic": {
    "pattern": "^[A-Z0-9]{2}$"
  }
}
```

### Pattern 3: Range Validation
```javascript
{
  "field_path": "serviceLines[*].lineItemCharge",
  "validation_logic": {
    "min": 0.01,
    "max": 999999.99
  }
}
```

### Pattern 4: Enum Validation
```javascript
{
  "field_path": "patient.gender",
  "validation_logic": {
    "enum": ["M", "F", "U"]
  }
}
```

### Pattern 5: Conditional Validation
```javascript
{
  "field_path": "serviceLines[*].procedureModifier1",
  "validation_logic": {
    "condition": "procedureCode BETWEEN '99201' AND '99215'",
    "required": true
  }
}
```

## Key Insights

1. **Two Structures Exist**
   - Intermediate: Used during parsing (complex nested structure)
   - Extracted: Used for validation (flat, clean structure)

2. **Always Use Extracted Structure**
   - Field paths reference the extracted claim object
   - This is what gets stored in the database
   - This is what the validation engine sees

3. **Array Fields Need [*]**
   - `serviceLines` is an array → use `serviceLines[*]`
   - `diagnoses` is an array → use `diagnoses[*]`
   - Other fields are direct properties → no `[*]` needed

4. **Browse Fields Helper**
   - Shows only extracted structure paths
   - Provides examples and descriptions
   - Ensures correct path syntax

## Quick Reference

| What You Want | Field Path | Example Value |
|---------------|------------|---------------|
| Claim number | `claimNumber` | "CLM001" |
| Provider NPI | `billing.identificationCode` | "1234567890" |
| Patient name | `patient.firstName` | "Jane" |
| Patient DOB | `patient.dateOfBirth` | "1985-03-15" |
| Procedure code | `serviceLines[*].procedureCode` | "99213" |
| **Modifier 1** | `serviceLines[*].procedureModifier1` | **"25"** |
| Modifier 2 | `serviceLines[*].procedureModifier2` | "GT" |
| Line charge | `serviceLines[*].lineItemCharge` | 150.00 |
| Diagnosis code | `diagnoses[*].code` | "E11.9" |
| Service date | `serviceDateFrom` | "2024-01-15" |
