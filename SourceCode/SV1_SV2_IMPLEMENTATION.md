# SV1 vs SV2 Segment Implementation

## Overview
Complete implementation of both SV1 (Professional) and SV2 (Institutional) service line segments with proper differentiation and logging.

## Key Differences

| Feature | SV1 (837P - Professional) | SV2 (837I - Institutional) |
|---------|---------------------------|----------------------------|
| **Claim Type** | Professional (physician, outpatient clinic) | Institutional (hospital, facility billing) |
| **Primary Code** | CPT/HCPCS procedure code | Revenue Code + CPT/HCPCS (optional) |
| **Position 1** | SV101: Procedure code composite | SV201: Revenue Code (required) |
| **Position 2** | SV102: Line charge | SV202: Procedure code composite (optional) |
| **Position 3** | SV103: Unit basis | SV203: Line charge |
| **Modifiers** | Common (25, 59, 26, TC, etc.) | Rare, mostly revenue code driven |
| **Units** | Number of services | Service units (days, tests, accommodations) |
| **Used By** | Physicians, specialists, outpatient | Hospitals, inpatient/outpatient facilities |

## Implementation

### 1. SV1 - Professional Service Line Parser

**Location**: Lines 820-865

**Format**:
```
SV1*HC:99213:25*150*UN*1*11**1~
```

**Fields Parsed**:
- **SV101**: Procedure code composite
  - Position 0: Qualifier (HC = HCPCS/CPT)
  - Position 1: Procedure Code (99213)
  - Position 2-5: Modifiers (25, GT, etc.)
- **SV102**: Line charge ($150)
- **SV103**: Unit basis (UN = Units)
- **SV104**: Unit count (1)
- **SV105**: Place of Service (11 = Office)
- **SV107**: Diagnosis Pointer (1 = first diagnosis)

**Data Structure**:
```javascript
{
  serviceLineType: 'SV1',
  procedureCodeQualifier: 'HC',
  procedureCode: '99213',
  procedureModifier1: '25',
  procedureModifier2: null,
  procedureModifier3: null,
  procedureModifier4: null,
  lineItemCharge: 150,
  unitOrBasisMeasurement: 'UN',
  serviceUnitCount: 1,
  placeOfService: '11',
  diagnosisCodePointer: '1'
}
```

**Console Output**:
```
=== SV1 Parsed (Professional) ===
Segment Type: SV1 (837P - Professional Claim)
Raw SV101 Composite: HC:99213:25
  - Qualifier: HC
  - Procedure Code (CPT/HCPCS): 99213
  - Modifiers: 25
SV102 - Line Charge: $150
SV103 - Unit Basis: UN
SV104 - Unit Count: 1
SV105 - Place of Service: 11
SV107 - Diagnosis Pointer: 1
Total Service Lines: 1
==================================
```

### 2. SV2 - Institutional Service Line Parser

**Location**: Lines 871-923

**Format**:
```
SV2*0300*HC:80053*250*UN*1**1~
```

**Fields Parsed**:
- **SV201**: Revenue Code (0300 = Laboratory)
- **SV202**: Procedure code composite (optional)
  - Position 0: Qualifier (HC = HCPCS/CPT)
  - Position 1: Procedure Code (80053)
  - Position 2-5: Modifiers (rare)
- **SV203**: Line charge ($250)
- **SV204**: Unit basis (UN = Units, DA = Days)
- **SV205**: Unit count (1)
- **SV207**: Diagnosis Pointer (optional)

**Data Structure**:
```javascript
{
  serviceLineType: 'SV2',
  revenueCode: '0300',
  procedureCodeQualifier: 'HC',
  procedureCode: '80053',
  procedureModifier1: null,
  procedureModifier2: null,
  procedureModifier3: null,
  procedureModifier4: null,
  lineItemCharge: 250,
  unitOrBasisMeasurement: 'UN',
  serviceUnitCount: 1,
  diagnosisCodePointer: '1'
}
```

**Console Output**:
```
=== SV2 Parsed (Institutional) ===
Segment Type: SV2 (837I - Institutional Claim)
SV201 - Revenue Code: 0300
Raw SV202 Composite: HC:80053
  - Qualifier: HC
  - Procedure Code (CPT/HCPCS): 80053
  - Modifiers: None
SV203 - Line Charge: $250
SV204 - Unit Basis: UN
SV205 - Unit Count: 1
SV207 - Diagnosis Pointer: 1
Total Service Lines: 1
====================================
```

### 3. Revenue Code Support

**Database Schema**:
```sql
ALTER TABLE ClaimLine
ADD COLUMN revenue_code VARCHAR(4);
```

**Common Revenue Codes**:
| Code | Description |
|------|-------------|
| 0100 | All-Inclusive Room & Board |
| 0110 | Room & Board - Private (1 Bed) |
| 0120 | Room & Board - Semi-Private (2 Beds) |
| 0200 | Intensive Care |
| 0250 | Pharmacy |
| 0260 | IV Therapy |
| 0270 | Medical/Surgical Supplies |
| 0300 | Laboratory |
| 0301 | Chemistry |
| 0305 | Hematology |
| 0310 | Bacteriology |
| 0320 | Radiology - Diagnostic |
| 0450 | Emergency Room |
| 0510 | Clinic |
| 0636 | Drugs Requiring Specific Identification |
| 0730 | EKG/ECG |
| 0920 | Other Diagnostic Services |

## Complete Logging Flow

### Example 1: Professional Claim (SV1)

**837P File**:
```
LX*1~
SV1*HC:99213:25*150*UN*1*11**1~
DTP*472*D8*20240901~
```

**Console Output**:
```
=== LX Parsed ===
...

=== SV1 Parsed (Professional) ===
Segment Type: SV1 (837P - Professional Claim)
Raw SV101 Composite: HC:99213:25
  - Qualifier: HC
  - Procedure Code (CPT/HCPCS): 99213
  - Modifiers: 25
SV102 - Line Charge: $150
...
==================================

=== DTP Parsed (Service Line Context) ===
...

=== Service Lines ===
Total Service Lines: 1

Service Line #1 [SV1]:
  - Line Type: Professional (837P)
  - Procedure Code: 99213
  - Modifier 1: 25
  - Revenue Code: N/A
  - Charge: $150
...
=====================

Inserting Service Line #1 (Professional) - Code: 99213, Modifiers: 25
```

### Example 2: Institutional Claim (SV2)

**837I File**:
```
LX*1~
SV2*0300*HC:80053*250*UN*1**1~
DTP*472*D8*20240901~
```

**Console Output**:
```
=== LX Parsed ===
...

=== SV2 Parsed (Institutional) ===
Segment Type: SV2 (837I - Institutional Claim)
SV201 - Revenue Code: 0300
Raw SV202 Composite: HC:80053
  - Qualifier: HC
  - Procedure Code (CPT/HCPCS): 80053
  - Modifiers: None
SV203 - Line Charge: $250
...
====================================

=== DTP Parsed (Service Line Context) ===
...

=== Service Lines ===
Total Service Lines: 1

Service Line #1 [SV2]:
  - Line Type: Institutional (837I)
  - Revenue Code: 0300
  - Procedure Code: 80053
  - Modifier 1: N/A
  - Charge: $250
...
=====================

Inserting Service Line #1 (Institutional) - Revenue: 0300, Code: 80053, Modifiers: None
```

### Example 3: Institutional with Revenue Code Only

**837I File**:
```
SV2*0110**1500*DA*3~
```
_(Room & Board - Private, $1500, 3 days, no procedure code)_

**Console Output**:
```
=== SV2 Parsed (Institutional) ===
Segment Type: SV2 (837I - Institutional Claim)
SV201 - Revenue Code: 0110
Raw SV202 Composite: N/A
  - No procedure code (revenue code only)
SV203 - Line Charge: $1500
SV204 - Unit Basis: DA
SV205 - Unit Count: 3
====================================
```

## Database Storage

### ClaimLine Table Fields:
```sql
CREATE TABLE ClaimLine (
  ...
  revenue_code VARCHAR(4),        -- For SV2 only
  procedure_code VARCHAR(10),     -- For both SV1 and SV2
  procedure_modifier1 VARCHAR(2), -- Modifiers (all 4)
  procedure_modifier2 VARCHAR(2),
  procedure_modifier3 VARCHAR(2),
  procedure_modifier4 VARCHAR(2),
  ...
);
```

### Query Examples:

**Professional Claims Only**:
```sql
SELECT claim_number, line_number, procedure_code,
       procedure_modifier1, total_charge
FROM ClaimLine cl
JOIN ClaimHeader ch ON cl.claim_id = ch.claim_id
WHERE cl.revenue_code IS NULL
  AND cl.procedure_code IS NOT NULL;
```

**Institutional Claims Only**:
```sql
SELECT claim_number, line_number, revenue_code,
       procedure_code, total_charge
FROM ClaimLine cl
JOIN ClaimHeader ch ON cl.claim_id = ch.claim_id
WHERE cl.revenue_code IS NOT NULL;
```

**Revenue Code Summary**:
```sql
SELECT revenue_code, COUNT(*) as line_count,
       SUM(total_charge) as total_amount
FROM ClaimLine
WHERE revenue_code IS NOT NULL
GROUP BY revenue_code
ORDER BY total_amount DESC;
```

## Use Cases

### Professional Claims (SV1):
1. **Physician Office Visits**
   - CPT: 99213 (Established patient, level 3)
   - Modifier: 25 (Separate E/M service)

2. **Specialist Consultations**
   - CPT: 99243 (Consultation, level 3)
   - Modifier: None

3. **Procedures with Modifiers**
   - CPT: 99213 (Office visit)
   - Modifiers: 25, GT (Telehealth)

### Institutional Claims (SV2):
1. **Hospital Laboratory**
   - Revenue: 0300 (Lab)
   - CPT: 80053 (Comprehensive metabolic panel)

2. **Emergency Room**
   - Revenue: 0450 (ER)
   - CPT: 99284 (ER visit, level 4)

3. **Room & Board (No Procedure Code)**
   - Revenue: 0110 (Private room)
   - CPT: None
   - Units: Days (DA)

4. **Pharmacy**
   - Revenue: 0250 (Pharmacy)
   - HCPCS: J1234 (Drug code)

## Validation & Testing

### Test Scenarios:

1. **SV1 with Multiple Modifiers**:
   ```
   SV1*HC:99213:25:GT:AI*150*UN*1*11**1~
   ```
   Expected: All 3 modifiers captured (25, GT, AI)

2. **SV2 with Revenue Code Only**:
   ```
   SV2*0110**1500*DA*3~
   ```
   Expected: Revenue code stored, procedure code = NULL

3. **SV2 with Both Revenue and Procedure**:
   ```
   SV2*0300*HC:80053*250*UN*1~
   ```
   Expected: Both revenue code and procedure code stored

4. **Mixed SV1 and SV2 in Same File**:
   Should NOT happen - 837P has only SV1, 837I has only SV2
   Log warning if detected

### Verification Queries:

```sql
-- Check for orphaned revenue codes (should be NULL for professional)
SELECT claim_id, revenue_code, procedure_code
FROM ClaimLine
WHERE revenue_code IS NOT NULL
  AND claim_id IN (
    SELECT claim_id FROM ClaimHeader WHERE claim_type = 'Professional'
  );

-- Check institutional claims have revenue codes
SELECT claim_id, revenue_code, procedure_code
FROM ClaimLine
WHERE claim_id IN (
    SELECT claim_id FROM ClaimHeader WHERE claim_type = 'Institutional'
  );
```

## Benefits

### ✅ Proper Claim Type Handling
- SV1 for professional claims (837P)
- SV2 for institutional claims (837I)
- Correct field mapping for each type

### ✅ Revenue Code Support
- Essential for hospital billing
- Links to charge description master (CDM)
- Required for facility claims adjudication

### ✅ Complete Logging
- Shows segment type (SV1 vs SV2)
- Displays revenue code for institutional
- Identifies claim type in output

### ✅ Database Flexibility
- Supports both claim types in same table
- Revenue code nullable for professional claims
- Procedure code optional for some institutional lines

---

**Implementation Date**: 2025-01-07
**HIPAA References**:
- HIPAA 5010 837P - SV1 Segment
- HIPAA 5010 837I - SV2 Segment
**Related Files**:
- `backend/services/parsing837.js` - Parsers
- `backend/database/schema.sql` - Schema
- `backend/database/migrations/add_revenue_code_to_claimline.sql` - Migration
