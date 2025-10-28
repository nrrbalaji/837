# Two-Level Validation Approach - File & Claim Level

## Overview

The validation system now supports **TWO distinct levels of validation**:

1. **File-Level Validation** - For ISA, GS, ST segments (one validation per file)
2. **Claim-Level Validation** - For claim and service line data (many validations per file)

## Why Two Levels?

### Data Structure Hierarchy

```
837 File
├── ISA (Interchange Control Header)          ← FILE LEVEL
├── GS (Functional Group Header)               ← FILE LEVEL
├── ST (Transaction Set Header)                ← FILE LEVEL
└── Claims [Transaction Array]
    ├── Submitter (NM1*41)                    ← TRANSACTION LEVEL (copied to each claim)
    ├── Receiver (NM1*40)                     ← TRANSACTION LEVEL (copied to each claim)
    └── Claims [Claim Array]
        ├── Claim 1
        │   ├── Billing Provider (NM1*85)     ← CLAIM LEVEL
        │   ├── Patient (NM1*QC)              ← CLAIM LEVEL
        │   ├── Service Lines []              ← CLAIM LEVEL
        │   └── Diagnoses []                  ← CLAIM LEVEL
        └── Claim 2
            ├── ...
```

### The Problem Without Two Levels

If we only use extracted claims:
- ❌ **ISA segments lost** - Not included in extracted claims
- ❌ **GS segments lost** - Not included in extracted claims
- ❌ **ST segments lost** - Not included in extracted claims
- ❌ **Can't validate file integrity** - Control numbers, version, etc.

## Implementation

### File: `autoCorrection.js`

```javascript
// Step 1: Extract claims from nested structure
const extractedClaims = extractClaims(parsedJson);

// Step 2: Separate rules by level
const fileLevelRules = allRules.filter(rule =>
  rule.rule_category === 'FILE' ||
  rule.field_path?.startsWith('isa.') ||
  rule.field_path?.startsWith('gs.') ||
  rule.field_path?.startsWith('st.') ||
  rule.segment_code === 'ISA' ||
  rule.segment_code === 'GS' ||
  rule.segment_code === 'ST'
);

const claimLevelRules = allRules.filter(rule =>
  rule.rule_category !== 'FILE' &&
  !fileLevelRules.includes(rule)
);

// Step 3a: Validate file-level (ISA, GS, ST)
for (const rule of fileLevelRules) {
  await evaluateValidationRule(
    parsedJson,  // ← Use original parsed structure
    rule,
    client
  );
}

// Step 3b: Validate each claim
for (const claim of extractedClaims) {
  for (const rule of claimLevelRules) {
    await evaluateValidationRule(
      claim,  // ← Use extracted claim structure
      rule,
      client
    );
  }
}
```

## Field Paths by Level

### File-Level Field Paths

These validate the **original `parsedJson`** structure:

```javascript
// ISA Segment
"isa.interchangeControlVersionNumber"     // Version (00501)
"isa.interchangeSenderId"                  // Sender ID
"isa.interchangeReceiverId"                // Receiver ID
"isa.interchangeControlNumber"             // Control number

// GS Segment
"gs.functionalIdentifierCode"              // HC for healthcare
"gs.applicationSendersCode"                // Sender code
"gs.applicationReceiversCode"              // Receiver code
"gs.groupControlNumber"                    // Group control number

// ST Segment
"st.transactionSetIdentifierCode"          // 837
"st.transactionSetControlNumber"           // Transaction control number
"st.implementationConventionReference"     // Implementation guide
```

### Claim-Level Field Paths

These validate **extracted claim** objects:

```javascript
// Claim header
"claimNumber"
"totalCharge"
"placeOfService"

// Provider info (from transaction level, copied to each claim)
"submitter.lastName"                       // From NM1*41
"receiver.lastName"                        // From NM1*40
"billing.identificationCode"               // From NM1*85

// Patient/subscriber (claim level)
"patient.firstName"
"subscriber.identificationCode"

// Arrays (use [*])
"serviceLines[*].procedureModifier1"       // ✅ Works now!
"serviceLines[*].procedureCode"
"diagnoses[*].code"
```

## Rule Configuration

### File-Level Rule Example

```javascript
{
  "rule_code": "VAL_ISA_VERSION",
  "rule_name": "Validate ISA Version Number",
  "rule_category": "FILE",                // ← Important!
  "rule_type": "FORMAT",
  "field_path": "isa.interchangeControlVersionNumber",
  "validation_logic": {
    "enum": ["00501", "00401"]
  },
  "error_message_template": "Invalid ISA version. Must be 00501 or 00401.",
  "severity": "ERROR"
}
```

### Claim-Level Rule Example

```javascript
{
  "rule_code": "VAL_MODIFIER1_FORMAT",
  "rule_name": "Validate Procedure Modifier 1",
  "rule_category": "BUSINESS",            // ← Not FILE
  "rule_type": "FORMAT",
  "field_path": "serviceLines[*].procedureModifier1",
  "validation_logic": {
    "pattern": "^[A-Z0-9]{2}$"
  },
  "error_message_template": "Invalid modifier 1 format",
  "severity": "ERROR"
}
```

## How Rules Are Categorized

The system automatically determines the level based on:

1. **`rule_category === 'FILE'`** → File-level
2. **`field_path` starts with `isa.`, `gs.`, or `st.`** → File-level
3. **`segment_code` is `ISA`, `GS`, or `ST`** → File-level
4. **Everything else** → Claim-level

## Data Structure Comparison

### Original `parsedJson` (File-Level)

```json
{
  "isa": {
    "interchangeControlVersionNumber": "00501",
    "interchangeSenderId": "1234567890",
    "interchangeReceiverId": "9876543210"
  },
  "gs": {
    "functionalIdentifierCode": "HC",
    "applicationSendersCode": "SENDER"
  },
  "st": {
    "transactionSetIdentifierCode": "837",
    "transactionSetControlNumber": "0001"
  },
  "claims": [
    {
      "submitter": { "lastName": "ABC Company" },
      "receiver": { "lastName": "XYZ Insurance" },
      "claims": [
        {
          "claimNumber": "CLM001",
          "serviceLines": [...]
        }
      ]
    }
  ]
}
```

### Extracted Claims (Claim-Level)

```json
[
  {
    "claimNumber": "CLM001",
    "submitter": { "lastName": "ABC Company" },    // Copied from transaction
    "receiver": { "lastName": "XYZ Insurance" },   // Copied from transaction
    "billing": { "identificationCode": "..." },
    "patient": { "firstName": "Jane" },
    "serviceLines": [                             // Direct access!
      {
        "procedureCode": "99213",
        "procedureModifier1": "25"                 // ← Can validate with serviceLines[*].procedureModifier1
      }
    ]
  }
]
```

## Benefits

### 1. Complete Validation Coverage
- ✅ **File integrity** - ISA, GS, ST segments validated
- ✅ **Claim data** - All claim and service line data validated
- ✅ **Nothing missed** - Both levels covered

### 2. Clear Separation
- ✅ **File-level rules** run once per file
- ✅ **Claim-level rules** run per claim (can be 100s per file)
- ✅ **Performance** - File rules don't repeat unnecessarily

### 3. Simpler Field Paths
- ✅ **File-level**: `isa.senderId` (simple)
- ✅ **Claim-level**: `serviceLines[*].procedureModifier1` (simple)
- ❌ **Old way**: `claims[*].claims[*].serviceLines[*].procedureModifier1` (complex!)

### 4. Better Error Reporting
- File-level errors show at **file level**
- Claim-level errors show **which claim** and **which line**

## Validation Flow

```
1. Upload 837 File
   ↓
2. Parse to intermediate structure (parsedJson)
   ↓
3. Load validation rules
   ↓
4. Split rules:
   ├─ File-level rules → Validate parsedJson (ISA, GS, ST)
   └─ Claim-level rules → Extract claims → Validate each claim
   ↓
5. Apply corrections (if enabled)
   ↓
6. Store corrected data
   ↓
7. Generate corrected 837 file
```

## Examples

### Example 1: Validate ISA Sender ID Format

```javascript
{
  "rule_category": "FILE",
  "field_path": "isa.interchangeSenderId",
  "validation_logic": {
    "pattern": "^[0-9]{10}$"  // Must be 10 digits
  }
}
```

**Validates against**: `parsedJson.isa.interchangeSenderId`

### Example 2: Validate All Procedure Modifiers

```javascript
{
  "rule_category": "BUSINESS",
  "field_path": "serviceLines[*].procedureModifier1",
  "validation_logic": {
    "pattern": "^[A-Z0-9]{2}$"
  }
}
```

**Validates against**: Each `extractedClaim.serviceLines[i].procedureModifier1`

### Example 3: Validate Transaction Set ID

```javascript
{
  "rule_category": "FILE",
  "field_path": "st.transactionSetIdentifierCode",
  "validation_logic": {
    "enum": ["837"]  // Must be 837
  }
}
```

**Validates against**: `parsedJson.st.transactionSetIdentifierCode`

## Migration Guide

### Update Existing Rules

If you have rules targeting file-level segments, update the `rule_category`:

**Before:**
```javascript
{
  "rule_code": "VAL_VERSION",
  "rule_category": "STRUCTURAL",  // ❌ Wrong
  "field_path": "isa.interchangeControlVersionNumber"
}
```

**After:**
```javascript
{
  "rule_code": "VAL_VERSION",
  "rule_category": "FILE",  // ✅ Correct
  "field_path": "isa.interchangeControlVersionNumber"
}
```

### For Claim-Level Rules

No changes needed! They already work with extracted claims:

```javascript
{
  "rule_category": "BUSINESS",  // ✅ Already correct
  "field_path": "serviceLines[*].procedureModifier1"
}
```

## Summary

**Two-level validation ensures:**
1. ✅ **ISA, GS, ST segments are validated** (file level)
2. ✅ **Claims and service lines are validated** (claim level)
3. ✅ **Simple, intuitive field paths** for both levels
4. ✅ **Proper data structure access** at each level
5. ✅ **Complete validation coverage** of the entire 837 file

**Your validation rules can now target:**
- **File-level**: `isa.*`, `gs.*`, `st.*`
- **Claim-level**: `serviceLines[*].*`, `diagnoses[*].*`, `patient.*`, `billing.*`, etc.

Both work perfectly! 🎉
