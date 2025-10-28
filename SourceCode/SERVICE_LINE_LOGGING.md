# Service Line Logging Guide

## Overview
Comprehensive logging has been added to track procedure codes, modifiers, and all service line details during 837 parsing.

## Implementation

### 1. SV1/SV2 Segment Parsing (Lines 819-857)

When an SV1 or SV2 segment is parsed, detailed logging shows:

#### Console Output:
```
=== SV1/SV2 Parsed ===
Raw Procedure Info (SV101): HC:99213:25
Parsed Procedure Code: 99213
Parsed Modifiers: 25
Line Item Charge (SV102): $150
Unit Count (SV104): 1
Place of Service (SV105): 11
Diagnosis Pointer (SV107): 1
Total Service Lines: 1
======================
```

#### Logged Information:
- **Raw Procedure Info (SV101)**: The complete composite field from the 837 file
- **Parsed Procedure Code**: The CPT/HCPCS code (position 2 of SV101)
- **Parsed Modifiers**: All modifiers (positions 3-6 of SV101)
- **Line Item Charge**: Total charge for this service line
- **Unit Count**: Number of units/services
- **Place of Service**: Where the service was performed
- **Diagnosis Pointer**: Links to HI segment diagnosis
- **Total Service Lines**: Running count of lines

### 2. Service Line Summary (Lines 1198-1216)

Before inserting service lines into the database, a comprehensive summary is displayed:

#### Console Output:
```
=== Service Lines ===
Total Service Lines: 2

Service Line #1:
  - Procedure Code: 99213
  - Modifier 1: 25
  - Modifier 2: N/A
  - Modifier 3: N/A
  - Modifier 4: N/A
  - Charge: $150
  - Units: 1
  - Unit Charge: $150.00
  - Place of Service: 11
  - Diagnosis Pointer: 1
  - Service Date From: 2024-09-01
  - Service Date To: 2024-09-01

Service Line #2:
  - Procedure Code: 36415
  - Modifier 1: N/A
  - Modifier 2: N/A
  - Modifier 3: N/A
  - Modifier 4: N/A
  - Charge: $25
  - Units: 1
  - Unit Charge: $25.00
  - Place of Service: 11
  - Diagnosis Pointer: 1
  - Service Date From: 2024-09-01
  - Service Date To: 2024-09-01
=====================
```

### 3. Database Insert Logging (Lines 1218-1222)

Each service line insert operation is logged:

#### Console Output:
```
Inserting Service Line #1 - Code: 99213, Modifiers: 25
Inserting Service Line #2 - Code: 36415, Modifiers: None
```

## SV1 Segment Structure

### Format:
```
SV1*HC:99213:25:GT*150*UN*1*11**1~
    |   |    |  |   |   |  | |  |
    |   |    |  |   |   |  | |  +-- SV107: Diagnosis Pointer
    |   |    |  |   |   |  | +----- SV106: Reserved
    |   |    |  |   |   |  +------- SV105: Place of Service
    |   |    |  |   |   +---------- SV104: Unit Count
    |   |    |  |   +-------------- SV103: Unit Basis
    |   |    |  +------------------ SV102: Line Charge
    |   |    +--------------------- Modifier 2
    |   +-------------------------- Modifier 1
    +------------------------------- Procedure Code
```

### SV101 Composite Field Breakdown:
- **Position 1**: Qualifier (HC = HCPCS/CPT)
- **Position 2**: Procedure Code (e.g., 99213)
- **Position 3**: Modifier 1 (e.g., 25)
- **Position 4**: Modifier 2 (optional)
- **Position 5**: Modifier 3 (optional)
- **Position 6**: Modifier 4 (optional)

## Common Procedure Code Examples

### Office Visits (99xxx)
```
SV1*HC:99213*150*UN*1*11**1~
```
- **99213**: Office visit, established patient, level 3
- **No modifiers**
- **Charge**: $150
- **Units**: 1

### Office Visit with Modifier
```
SV1*HC:99213:25*150*UN*1*11**1~
```
- **99213**: Office visit
- **Modifier 25**: Significant, separately identifiable E/M service
- **Charge**: $150

### Lab Procedure
```
SV1*HC:36415*25*UN*1*11**1~
```
- **36415**: Routine venipuncture (blood draw)
- **Charge**: $25

### Multiple Modifiers
```
SV1*HC:99213:25:GT*150*UN*1*11**1~
```
- **99213**: Office visit
- **Modifier 25**: Separate E/M service
- **Modifier GT**: Via telehealth
- **Charge**: $150

## Modifier Reference

### Common Modifiers:
| Modifier | Description |
|----------|-------------|
| 25 | Significant, separately identifiable E/M service |
| 26 | Professional component |
| 59 | Distinct procedural service |
| 76 | Repeat procedure by same physician |
| 77 | Repeat procedure by another physician |
| 91 | Repeat clinical diagnostic lab test |
| GT | Via interactive audio and video telehealth |
| LT | Left side |
| RT | Right side |
| 50 | Bilateral procedure |
| 51 | Multiple procedures |
| 52 | Reduced services |
| 53 | Discontinued procedure |

## Verification Steps

### 1. Check Parsing Logs
Look for the "SV1/SV2 Parsed" section in console output to verify:
- ✅ Procedure code extracted correctly
- ✅ All modifiers captured (up to 4)
- ✅ Charges and units parsed
- ✅ Place of service recorded

### 2. Review Service Line Summary
Before database insert, verify:
- ✅ All service lines present
- ✅ Procedure codes correct
- ✅ Modifiers in proper order
- ✅ Charges and calculations accurate
- ✅ Service dates populated (if DTP after SV1)

### 3. Confirm Database Insert
Check logs for:
- ✅ "Inserting Service Line #X" messages
- ✅ No database errors
- ✅ All lines inserted successfully

### 4. Query Database
```sql
SELECT
  claim_number,
  line_number,
  procedure_code,
  procedure_modifier1,
  procedure_modifier2,
  procedure_modifier3,
  procedure_modifier4,
  total_charge,
  quantity,
  service_date_from,
  service_date_to
FROM ClaimLine cl
JOIN ClaimHeader ch ON cl.claim_id = ch.claim_id
ORDER BY ch.created_at DESC, cl.line_number;
```

## Troubleshooting

### Issue: Procedure Code Missing
**Symptom**: `Parsed Procedure Code: N/A`

**Check**:
1. Raw Procedure Info field - Is SV101 populated?
2. Composite field format - Should be `HC:CODE:MOD1:MOD2`
3. SUBELEMENT_DELIMITER - Default is `:` (colon)

**Example Problem**:
```
SV1*HC99213*150*...    ← Missing colon after HC
```

**Solution**: Ensure proper format `HC:99213`

### Issue: Modifiers Not Captured
**Symptom**: `Parsed Modifiers: None` when modifiers exist

**Check**:
1. Raw Procedure Info - Verify modifiers present after procedure code
2. Position in composite - Modifiers are positions 3, 4, 5, 6
3. Delimiter - Should use `:` between elements

**Example Problem**:
```
SV1*HC:99213-25*...    ← Using dash instead of colon
```

**Solution**: Use `HC:99213:25` format

### Issue: Multiple Modifiers Wrong Order
**Symptom**: Modifier 1 = 'GT', should be Modifier 2

**Check**:
1. SV101 composite order
2. Parsing positions in code

**Correct Format**:
```
SV1*HC:99213:25:GT*150*...
           ^   ^-- Modifier 2
           +------ Modifier 1
```

### Issue: Charges Incorrect
**Symptom**: Unit charge calculation wrong

**Check**:
1. Line Item Charge (SV102)
2. Service Unit Count (SV104)
3. Division calculation: `charge / units`

**Example**:
```
SV102 = 150
SV104 = 3
Unit Charge = 150 / 3 = $50.00
```

## Best Practices

### 1. Always Review Parsing Logs
- Check console output during file upload
- Look for "SV1/SV2 Parsed" sections
- Verify all expected service lines appear

### 2. Validate Modifier Order
- Modifiers should be in significance order
- Most significant modifier first (position 3)
- Up to 4 modifiers supported

### 3. Check Service Line Dates
- If DTP comes after SV1, dates populate to service line
- If DTP before SV1, dates populate to claim header
- Verify "Service Line Context" vs "Claim Header Context" in logs

### 4. Verify Diagnosis Pointers
- SV107 should reference HI segment
- Pointer "1" = first diagnosis code
- Multiple pointers possible (e.g., "1:2:3")

## Example Log Flow

### Complete Service Line Parse Sequence:
```
=== LX Parsed ===
Line Number: 1
=================

=== SV1/SV2 Parsed ===
Raw Procedure Info (SV101): HC:99213:25
Parsed Procedure Code: 99213
Parsed Modifiers: 25
Line Item Charge (SV102): $150
Unit Count (SV104): 1
Total Service Lines: 1
======================

=== DTP Parsed (Service Line Context) ===
Date Qualifier: 472
Format Qualifier: D8
Raw Date Value: 20240901
Parsed Date: 2024-09-01
Service Line Dates:
  serviceDateFrom: 2024-09-01
  serviceDateTo: 2024-09-01
==================

[... repeat for line 2 ...]

=== Service Lines ===
Total Service Lines: 2

Service Line #1:
  - Procedure Code: 99213
  - Modifier 1: 25
  [... details ...]

Service Line #2:
  - Procedure Code: 36415
  [... details ...]
=====================

Inserting Service Line #1 - Code: 99213, Modifiers: 25
Inserting Service Line #2 - Code: 36415, Modifiers: None
```

---

**Implementation Date**: 2025-01-07
**Purpose**: Verify procedure codes and modifiers during 837 parsing
**Related Segments**: SV1, SV2, LX, DTP*472
