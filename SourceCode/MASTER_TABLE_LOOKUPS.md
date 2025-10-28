# Master Table Lookup Enhancement

## Overview
Enhanced the claim storage process to automatically lookup and populate foreign key references from master tables (Facilities, Patient, Provider, Payer) when creating ClaimHeader records.

## What Was Added

### 1. Facility Lookup (`lookupFacility`)
**Location:** [parsing837.js:516-549](backend/services/parsing837.js:516)

**Lookup Strategy:**
1. **Primary:** Search by NPI from billing provider (NM1*85 segment)
2. **Fallback:** Search by facility name (partial match, case-insensitive)

**Code:**
```javascript
async function lookupFacility(client, billingData) {
  // Try NPI first
  if (billingData.identificationCode) {
    SELECT facility_id FROM Facilities
    WHERE npi = $1 AND is_active = true
  }

  // Try name match
  if (billingData.lastName) {
    SELECT facility_id FROM Facilities
    WHERE facility_name ILIKE '%name%' AND is_active = true
  }

  return null; // If not found
}
```

**Data Source:**
- From parsed `NM1*85` (Billing Provider) segment
- `identificationCode` = NPI
- `lastName` = Organization name

### 2. Provider Lookup (`lookupProvider`)
**Location:** [parsing837.js:551-564](backend/services/parsing837.js:551)

**Lookup Strategy:**
- Search by NPI from billing provider data

**Code:**
```javascript
async function lookupProvider(client, billingData) {
  if (billingData?.identificationCode) {
    SELECT provider_id FROM Provider
    WHERE npi = $1 AND is_active = true
  }

  return null; // If not found
}
```

**Data Source:**
- From parsed `NM1*85` (Billing Provider) segment
- `identificationCode` = Provider NPI

### 3. Payer Lookup (`lookupPayer`)
**Location:** [parsing837.js:566-600](backend/services/parsing837.js:566)

**Lookup Strategy:**
1. **Primary:** Search by electronic payer ID from receiver (NM1*40 segment)
2. **Fallback:** Search by payer name (partial match, case-insensitive)

**Code:**
```javascript
async function lookupPayer(client, receiverData, payerName) {
  // Try electronic payer ID
  if (receiverData?.identificationCode) {
    SELECT payer_id FROM Payer
    WHERE electronic_payer_id = $1 AND is_active = true
  }

  // Try payer name
  if (payerName || receiverData?.lastName) {
    SELECT payer_id FROM Payer
    WHERE payer_name ILIKE '%name%' AND is_active = true
  }

  return null; // If not found
}
```

**Data Source:**
- From parsed `NM1*40` (Receiver/Payer) segment
- `identificationCode` = Electronic Payer ID
- `lastName` = Payer organization name

### 4. Patient Lookup/Create (`lookupOrCreatePatient`)
**Location:** [parsing837.js:476-514](backend/services/parsing837.js:476)

**Special Behavior:**
- **Lookup first:** Try to find existing patient
- **Create if not found:** Auto-create patient record

**Lookup Strategy:**
- Match by first name, last name, and facility

**Code:**
```javascript
async function lookupOrCreatePatient(client, patientData, facilityId) {
  // Try to find existing
  SELECT patient_id FROM Patient
  WHERE last_name = $1
  AND first_name = $2
  AND facility_id = $3

  // If not found, create new
  if (not found) {
    INSERT INTO Patient (
      facility_id, first_name, last_name, middle_name,
      date_of_birth, gender, mrn, is_active
    ) VALUES (...)
    RETURNING patient_id
  }
}
```

**Auto-Generated Fields:**
- `mrn` = 'MRN-' + timestamp (temporary identifier)
- `is_active` = true
- `date_of_birth` = null (not yet parsed from 837)
- `gender` = null (not yet parsed from 837)

**Data Source:**
- From parsed `NM1*QC` (Patient) segment
- `firstName`, `lastName`, `middleName`

### 5. Enhanced ClaimHeader Insert
**Location:** [parsing837.js:605-648](backend/services/parsing837.js:605)

**Now Includes:**
```javascript
async function storeClaim(client, fileId, batchId, claim) {
  // Perform all lookups
  const facilityId = await lookupFacility(client, claim.billing);
  const providerId = await lookupProvider(client, claim.billing);
  const payerId = await lookupPayer(client, claim.receiver, claim.payer);
  const patientId = await lookupOrCreatePatient(client, claim.patient, facilityId);

  // Insert with foreign keys
  INSERT INTO ClaimHeader (
    file_id, batch_id, claim_number, claim_type,
    patient_id,    // ← Populated from lookup/create
    facility_id,   // ← Populated from lookup
    provider_id,   // ← Populated from lookup
    payer_id,      // ← Populated from lookup
    total_charge, place_of_service, claim_frequency_code,
    claim_status, validation_status, raw_claim_data
  ) VALUES (...)
}
```

## Lookup Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Parse 837 File                                         │
│  Extract NM1 Segments:                                  │
│  - NM1*85 (Billing Provider)                           │
│  - NM1*40 (Receiver/Payer)                             │
│  - NM1*QC (Patient)                                    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│  For Each Claim:                                        │
└─────────────────┬───────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌─────────┐  ┌──────────┐  ┌─────────┐
│Facility │  │ Provider │  │  Payer  │
│ Lookup  │  │  Lookup  │  │ Lookup  │
└────┬────┘  └─────┬────┘  └────┬────┘
     │             │             │
     │  ┌──────────┴─────────────┘
     │  │
     ▼  ▼
┌─────────────────┐
│  Patient        │
│  Lookup/Create  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Insert ClaimHeader with all foreign key IDs            │
└─────────────────────────────────────────────────────────┘
```

## Data Mapping

### From X12 837 Segments to Database

| X12 Segment | Field | Maps To | Lookup Field |
|-------------|-------|---------|--------------|
| NM1*85 | Identification Code | Provider.npi | provider_id |
| NM1*85 | Identification Code | Facilities.npi | facility_id |
| NM1*85 | Last Name | Facilities.facility_name | facility_id (fallback) |
| NM1*40 | Identification Code | Payer.electronic_payer_id | payer_id |
| NM1*40 | Last Name | Payer.payer_name | payer_id (fallback) |
| NM1*QC | First/Last Name | Patient.first_name, last_name | patient_id |

## Behavior Scenarios

### Scenario 1: All Master Data Exists
```
Input: 837 with NPI 1234567890
Database: Facility, Provider, Payer exist with matching NPIs

Result:
✅ facilityId = UUID (found)
✅ providerId = UUID (found)
✅ payerId = UUID (found)
✅ patientId = UUID (found or created)
✅ ClaimHeader inserted with all foreign keys
```

### Scenario 2: Master Data Partially Missing
```
Input: 837 with NPI 1234567890
Database: Provider exists, but Facility and Payer don't

Result:
⚠️ facilityId = null (not found)
✅ providerId = UUID (found)
⚠️ payerId = null (not found)
✅ patientId = UUID (created new)
✅ ClaimHeader inserted (some FKs null)
```

### Scenario 3: No Master Data Exists
```
Input: 837 with new NPIs
Database: No matching records

Result:
⚠️ facilityId = null
⚠️ providerId = null
⚠️ payerId = null
✅ patientId = UUID (created new)
✅ ClaimHeader inserted (FKs mostly null)
⚠️ Validation will flag missing references
```

### Scenario 4: Patient Auto-Creation
```
Input: 837 with patient "John Doe"
Database: Patient doesn't exist

Result:
✅ New Patient record created:
   - first_name: "John"
   - last_name: "Doe"
   - mrn: "MRN-1705345678901"
   - facility_id: (from facility lookup)
   - is_active: true
✅ patientId returned and used in ClaimHeader
```

## Validation Impact

With foreign keys now populated, validation rules can check:

### Missing Facility
```javascript
ValidationRule: "Facility Required"
SELECT facility_id FROM ClaimHeader WHERE claim_id = $1
If null → ERROR: "Facility not found in master table"
```

### Missing Provider
```javascript
ValidationRule: "Provider Required"
SELECT provider_id FROM ClaimHeader WHERE claim_id = $1
If null → ERROR: "Provider not found in master table"
```

### Missing Payer
```javascript
ValidationRule: "Payer Required"
SELECT payer_id FROM ClaimHeader WHERE claim_id = $1
If null → ERROR: "Payer not found in master table"
```

## Auto-Correction Opportunities

The correction engine can now:

1. **Lookup Missing Facility:** If facilityId is null, search by facility name
2. **Lookup Missing Provider:** If providerId is null, search by provider NPI
3. **Lookup Missing Payer:** If payerId is null, search by payer name
4. **Link Patient:** If patientId is null, try to match by demographics

## Database Query Examples

### Get Claims with Full Entity Details
```sql
SELECT
  ch.claim_number,
  ch.total_charge,
  f.facility_name,
  p.first_name || ' ' || p.last_name as provider_name,
  py.payer_name,
  pt.first_name || ' ' || pt.last_name as patient_name
FROM ClaimHeader ch
LEFT JOIN Facilities f ON ch.facility_id = f.facility_id
LEFT JOIN Provider p ON ch.provider_id = p.provider_id
LEFT JOIN Payer py ON ch.payer_id = py.payer_id
LEFT JOIN Patient pt ON ch.patient_id = pt.patient_id
WHERE ch.file_id = 'uuid';
```

### Find Claims with Missing Master Data
```sql
SELECT
  claim_id,
  claim_number,
  CASE WHEN facility_id IS NULL THEN 'Missing Facility' END,
  CASE WHEN provider_id IS NULL THEN 'Missing Provider' END,
  CASE WHEN payer_id IS NULL THEN 'Missing Payer' END,
  CASE WHEN patient_id IS NULL THEN 'Missing Patient' END
FROM ClaimHeader
WHERE facility_id IS NULL
   OR provider_id IS NULL
   OR payer_id IS NULL
   OR patient_id IS NULL;
```

### Patient Auto-Creation Report
```sql
SELECT
  patient_id,
  mrn,
  first_name,
  last_name,
  facility_id,
  created_at
FROM Patient
WHERE mrn LIKE 'MRN-%'
ORDER BY created_at DESC;
```

## Benefits

### 1. Data Integrity
✅ Enforces referential integrity through foreign keys
✅ Links claims to actual master entities
✅ Prevents orphaned claim records

### 2. Reporting
✅ Easy JOIN queries for comprehensive reports
✅ Facility-level analytics
✅ Provider performance metrics
✅ Payer-specific statistics

### 3. Validation
✅ Can validate against master data
✅ Flag claims with missing entities
✅ Ensure data completeness

### 4. Correction
✅ Auto-correction can lookup missing references
✅ Link existing patients to claims
✅ Update facility/provider/payer associations

### 5. Analytics
✅ Claims by facility
✅ Provider productivity
✅ Payer performance scorecards
✅ Patient claim history

## Testing

### Prerequisites
Ensure master tables have data:
```sql
-- Check master data
SELECT COUNT(*) FROM Facilities WHERE is_active = true;
SELECT COUNT(*) FROM Provider WHERE is_active = true;
SELECT COUNT(*) FROM Payer WHERE is_active = true;
```

### Test Upload
1. Upload 837 file with known NPIs
2. Check ClaimHeader foreign keys populated
3. Verify patient auto-creation
4. Query joined data

### Expected Results
```sql
SELECT
  ch.claim_id,
  ch.facility_id IS NOT NULL as has_facility,
  ch.provider_id IS NOT NULL as has_provider,
  ch.payer_id IS NOT NULL as has_payer,
  ch.patient_id IS NOT NULL as has_patient
FROM ClaimHeader ch
WHERE ch.file_id = 'uploaded-file-uuid';
```

## Future Enhancements

### Potential Improvements
1. **Fuzzy Matching:** Use Levenshtein distance for name matching
2. **Multi-Identifier Lookup:** Try multiple identifiers (Tax ID, License #)
3. **Auto-Create All:** Option to auto-create missing facilities/providers
4. **Confidence Scoring:** Rate match quality (exact vs partial)
5. **Lookup Cache:** Cache lookups for performance
6. **Batch Lookups:** Optimize with batch queries

## Configuration

### Enable/Disable Auto-Creation
```javascript
// In .env
AUTO_CREATE_PATIENTS=true
AUTO_CREATE_FACILITIES=false
AUTO_CREATE_PROVIDERS=false
AUTO_CREATE_PAYERS=false
```

## Monitoring

### Track Lookup Success Rate
```sql
SELECT
  COUNT(*) as total_claims,
  COUNT(facility_id) as with_facility,
  COUNT(provider_id) as with_provider,
  COUNT(payer_id) as with_payer,
  COUNT(patient_id) as with_patient,
  ROUND(COUNT(facility_id)::numeric / COUNT(*) * 100, 2) as facility_match_rate,
  ROUND(COUNT(provider_id)::numeric / COUNT(*) * 100, 2) as provider_match_rate,
  ROUND(COUNT(payer_id)::numeric / COUNT(*) * 100, 2) as payer_match_rate
FROM ClaimHeader
WHERE created_at >= NOW() - INTERVAL '7 days';
```

## Conclusion

The parsing engine now intelligently links claims to existing master data, providing:
✅ Automatic facility/provider/payer lookups
✅ Patient auto-creation with matching
✅ Populated foreign key references
✅ Better data integrity
✅ Enhanced reporting capabilities
✅ Foundation for validation and correction

This enhancement transforms raw 837 data into a fully normalized, relational database structure ready for advanced analytics and processing.
