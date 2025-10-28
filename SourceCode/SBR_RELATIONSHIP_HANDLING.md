# SBR Segment - Individual Relationship Code Handling

## Overview
The SBR (Subscriber Information) segment contains the Individual Relationship Code (SBR02) which indicates the patient's relationship to the subscriber/insured person.

## Implementation

### Location
- **File**: `backend/services/parsing837.js`
- **Function**: `parseSBR()` - Lines 535-598

### Key Logic

#### 1. Relationship Code Mapping
The parser maintains a complete mapping of all HIPAA-approved relationship codes:

| Code | Relationship Description |
|------|-------------------------|
| 01 | Spouse |
| 04 | Grandfather or Grandmother |
| 05 | Grandson or Granddaughter |
| 07 | Nephew or Niece |
| 10 | Foster Child |
| 15 | Ward |
| 17 | Stepson or Stepdaughter |
| **18** | **Self** (Subscriber is Patient) |
| 19 | Child |
| 20 | Employee |
| 21 | Unknown |
| 22 | Handicapped Dependent |
| 23 | Sponsored Dependent |
| 24 | Dependent of a Minor Dependent |
| 29 | Significant Other |
| 32 | Mother |
| 33 | Father |
| 34 | Other Adult |
| 36 | Emancipated Minor |
| 39 | Organ Donor |
| 40 | Cadaver Donor |
| 41 | Injured Plaintiff |
| 43 | Child Where Insured Has No Financial Responsibility |
| 53 | Life Partner |
| G8 | Other Relationship |

#### 2. Self Relationship Handling (Code "18")

When `SBR02 = "18"`, it means the **subscriber IS the patient** (same person).

**Automatic Data Copy:**
```javascript
if (relationshipCode === '18') {
  // Copy all subscriber data to patient object
  if (!currentClaim.patient || !currentClaim.patient.lastName) {
    currentClaim.patient = { ...currentClaim.subscriber };
  }
}
```

**What gets copied:**
- First Name, Last Name, Middle Name
- Date of Birth (from DMG segment)
- Gender (from DMG segment)
- Address (from N3 segment)
- City, State, ZIP (from N4 segment)
- Member ID (from NM109)
- All other subscriber demographics

#### 3. Dependent Relationship Handling (Other Codes)

When `SBR02 ≠ "18"`, the patient is a **dependent** of the subscriber.

Examples:
- `SBR02 = "01"` → Patient is the spouse of the subscriber
- `SBR02 = "19"` → Patient is a child of the subscriber
- `SBR02 = "32"` → Patient is the mother of the subscriber

In these cases:
- Subscriber data stays in `subscriber` object
- Patient data comes from separate NM1*QC segment
- Patient demographics come from separate DMG segment
- Patient and Subscriber are two different people

## Data Flow Examples

### Example 1: Self (Code 18)
```
837 File:
  NM1*IL*1*DOE*JANE~~~MI*W123456789~     ← Subscriber
  DMG*D8*19850515*F~                      ← DOB & Gender
  N3*456 ELM STREET~                      ← Address
  N4*CITY*ST*54321~                       ← City/State/ZIP
  SBR*P*18*...~                           ← Code 18 = SELF

Result:
  subscriber: {
    firstName: "JANE",
    lastName: "DOE",
    dateOfBirth: "1985-05-15",
    gender: "F",
    addressLine1: "456 ELM STREET",
    city: "CITY",
    state: "ST",
    zipCode: "54321"
  }

  patient: {
    // Automatically copied from subscriber
    firstName: "JANE",
    lastName: "DOE",
    dateOfBirth: "1985-05-15",
    gender: "F",
    addressLine1: "456 ELM STREET",
    city: "CITY",
    state: "ST",
    zipCode: "54321"
  }

  subscriberInfo: {
    individualRelationshipCode: "18",
    relationshipDescription: "Self"
  }
```

### Example 2: Child (Code 19)
```
837 File:
  NM1*IL*1*DOE*JANE~~~MI*W123456789~     ← Subscriber
  DMG*D8*19850515*F~                      ← Subscriber DOB & Gender
  SBR*P*19*...~                           ← Code 19 = CHILD
  NM1*QC*1*DOE*TOMMY~~~                  ← Patient (different person)
  DMG*D8*20150320*M~                      ← Patient DOB & Gender
  N3*456 ELM STREET~                      ← Patient Address
  N4*CITY*ST*54321~

Result:
  subscriber: {
    firstName: "JANE",
    lastName: "DOE",
    dateOfBirth: "1985-05-15",
    gender: "F"
  }

  patient: {
    firstName: "TOMMY",
    lastName: "DOE",
    dateOfBirth: "2015-03-20",
    gender: "M",
    addressLine1: "456 ELM STREET",
    city: "CITY",
    state: "ST",
    zipCode: "54321"
  }

  subscriberInfo: {
    individualRelationshipCode: "19",
    relationshipDescription: "Child"
  }
```

## Stored Data

### ClaimHeader Table
The relationship information is stored in the `raw_claim_data` JSONB column:

```json
{
  "subscriberInfo": {
    "payerResponsibilitySequence": "P",
    "individualRelationshipCode": "18",
    "relationshipDescription": "Self",
    "groupNumber": "GRP123",
    "claimFilingIndicatorCode": "CI"
  }
}
```

### Patient Table
Patient demographics are stored regardless of relationship:
- `first_name`, `last_name`, `middle_name`
- `date_of_birth`
- `gender`
- `address_line1`, `address_line2`
- `city`, `state`, `zip_code`

## Console Logging

The parser provides detailed logging for relationship handling:

### When SBR is parsed:
```
=== SBR: Subscriber is Self (Patient) ===
Copied subscriber data to patient (Self relationship)
```
or
```
=== SBR: Patient is Child of Subscriber ===
```

### When claim is stored:
```
=== Inserting Claim Header ===
Claim Number: 54321
Patient ID: <uuid>
...

Subscriber Information:
  - Payer Responsibility: P
  - Relationship Code: 18
  - Relationship: Self
  - Group Number: GRP123
  - Filing Indicator: CI
```

## Benefits

### ✅ Automatic Data Population
- When subscriber = patient (Code 18), no need for duplicate NM1*QC segment
- Demographics automatically copied from subscriber to patient
- Reduces data entry errors

### ✅ Proper Dependent Handling
- Correctly identifies when patient is different from subscriber
- Maintains separate demographic records
- Essential for COB (Coordination of Benefits) processing

### ✅ RCM Integration
- **Eligibility Verification**: Knows whether to check subscriber or dependent
- **Claim Adjudication**: Proper relationship for claim processing
- **COB Processing**: Primary/Secondary payer determination
- **Benefit Coordination**: Correct benefit application based on relationship

### ✅ Compliance
- **HIPAA 5010**: Complete relationship code mapping
- **Payer Requirements**: Meets all payer-specific relationship tracking
- **Audit Trail**: Relationship stored in raw claim data

## Use Cases

### 1. Primary Subscriber Claims (Code 18)
- Adult seeing doctor for themselves
- Single person with individual insurance
- Employee with employer-sponsored insurance (self coverage)

### 2. Dependent Claims (Other Codes)
- Child on parent's insurance (Code 19)
- Spouse on partner's insurance (Code 01)
- Parent on adult child's insurance (Code 32/33)
- Domestic partner claims (Code 53)

### 3. Coordination of Benefits (COB)
```
Claim 1: Primary Insurance
  SBR*P*18*...    ← Patient is subscriber (Primary)

Claim 2: Secondary Insurance
  SBR*S*19*...    ← Patient is child (Secondary)
```

## Testing

### Test Scenarios

1. **Test Code 18 (Self)**:
   - Verify patient data copied from subscriber
   - Check DOB, Gender, Address populated
   - Confirm only one person in claim

2. **Test Code 19 (Child)**:
   - Verify separate patient and subscriber records
   - Check patient has own demographics
   - Confirm relationship description = "Child"

3. **Test Code 01 (Spouse)**:
   - Verify spouse demographics separate from subscriber
   - Check relationship description = "Spouse"
   - Validate different DOB for patient vs subscriber

### SQL Query to Check Relationship
```sql
SELECT
  claim_number,
  raw_claim_data->'subscriberInfo'->>'individualRelationshipCode' as relationship_code,
  raw_claim_data->'subscriberInfo'->>'relationshipDescription' as relationship,
  raw_claim_data->'subscriberInfo'->>'payerResponsibilitySequence' as payer_sequence
FROM ClaimHeader
WHERE raw_claim_data->'subscriberInfo' IS NOT NULL
ORDER BY created_at DESC;
```

## Future Enhancements

### Potential Additions:
1. **Validation Rules**:
   - Validate age based on relationship (e.g., Child must be < 26)
   - Check subscriber vs patient age for parent relationships

2. **Database Table**:
   - Create separate `Subscriber` table
   - Link Patient → Subscriber with relationship
   - Store group numbers and policy info

3. **Business Rules**:
   - Auto-deny claims with invalid relationships
   - Flag suspicious relationship combinations
   - COB rules based on relationship type

---

**Implementation Date**: 2025-01-07
**HIPAA Reference**: HIPAA 5010 837P - SBR Segment
**Specification**: 837_Segment_Matrix.csv - Lines 135-146
