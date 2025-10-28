# FHIR 837 Endpoint Implementation

## Overview

A new REST API endpoint has been added to accept FHIR Claim resources (Bundle or individual Claim) and process them through the existing 837 claim validation pipeline.

## Implementation Summary

### New Files Created

1. **`backend/services/parsingFHIR.js`**
   - Parses FHIR Claim/Bundle resources into the application's internal X12 837-compatible format
   - Maps FHIR elements to X12 segments (Patient, Provider, Payer, Service Lines, Diagnoses)
   - Generates ISA/GS/ST headers for compatibility with 837 file generation
   - Stores claims in database using existing schema

### Modified Files

1. **`backend/routes/upload.js`**
   - Added `POST /api/v1/upload/fhir` endpoint
   - Validates FHIR resource type (Bundle or Claim)
   - Generates unique file ID and stores FHIR data as JSON file
   - Creates record in `UploadFileDetail` table with `file_type='FHIR_837'`
   - Triggers asynchronous parsing and validation

2. **`backend/server.js`**
   - Updated startup console output to display new FHIR endpoint

## API Endpoint

### POST /api/v1/upload/fhir

**Authentication:** Required (Bearer Token)

**Content-Type:** `application/json`

**Request Body:** FHIR Bundle or Claim resource (JSON)

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/v1/upload/fhir \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d @fhir_claim.json
```

**Example FHIR Claim:**

```json
{
  "resourceType": "Claim",
  "id": "claim-12345",
  "status": "active",
  "type": {
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/claim-type",
      "code": "professional"
    }]
  },
  "patient": {
    "reference": "Patient/patient-123",
    "display": "John Doe"
  },
  "created": "2025-01-15T10:00:00Z",
  "provider": {
    "reference": "Organization/org-456",
    "display": "ABC Medical Center",
    "identifier": {
      "value": "1234567890"
    }
  },
  "insurer": {
    "reference": "Organization/payer-789",
    "display": "Blue Cross Blue Shield"
  },
  "insurance": [{
    "sequence": 1,
    "focal": true,
    "coverage": {
      "reference": "Coverage/coverage-001"
    }
  }],
  "billablePeriod": {
    "start": "2025-01-10",
    "end": "2025-01-10"
  },
  "diagnosis": [{
    "sequence": 1,
    "diagnosisCodeableConcept": {
      "coding": [{
        "system": "http://hl7.org/fhir/sid/icd-10",
        "code": "J44.0",
        "display": "COPD with acute lower respiratory infection"
      }]
    }
  }],
  "item": [{
    "sequence": 1,
    "productOrService": {
      "coding": [{
        "system": "http://www.ama-assn.org/go/cpt",
        "code": "99213",
        "display": "Office visit"
      }]
    },
    "servicedDate": "2025-01-10",
    "quantity": {
      "value": 1
    },
    "net": {
      "value": 150.00,
      "currency": "USD"
    }
  }],
  "total": {
    "value": 150.00,
    "currency": "USD"
  }
}
```

**Success Response:**

```json
{
  "message": "FHIR data uploaded successfully",
  "file": {
    "file_id": "a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
    "file_name": "FHIR_Claim_1737024000000.json",
    "upload_status": "PARSING",
    "uploaded_at": "2025-01-15T10:00:00.000Z"
  }
}
```

**Error Responses:**

- `400 Bad Request` - Invalid FHIR data or unsupported resource type
- `401 Unauthorized` - Missing or invalid authentication token
- `500 Internal Server Error` - Server processing error

## Data Flow

```
FHIR JSON (via POST /api/v1/upload/fhir)
  ↓
Validate FHIR resource type (Bundle or Claim)
  ↓
Generate unique file ID
  ↓
Store FHIR JSON to file (uploads/{fileId}.json)
  ↓
Insert record in UploadFileDetail
  - file_type: 'FHIR_837'
  - upload_method: 'REST_API'
  - upload_status: 'PARSING'
  ↓
Parse FHIR → Internal JSON format (async)
  ↓
Extract and store claims in database
  - ClaimHeader
  - ClaimLine
  - ClaimDiagnosis
  ↓
Run validations
  - File import validation
  - Business rule validation
  - LLM validation
  ↓
Auto-correction (if enabled)
  ↓
Generate 837 X12 file (output)
```

## FHIR to X12 Mapping

The parser maps FHIR elements to X12 837 segments:

| FHIR Element | X12 Segment | Notes |
|--------------|-------------|-------|
| `Claim.patient` | NM1 (QC) | Patient demographics |
| `Claim.provider` | NM1 (85) | Billing provider |
| `Claim.insurer` | NM1 (40) | Receiver/Payer |
| `Claim.insurance[0].coverage.subscriber` | NM1 (IL) | Subscriber |
| `Claim.careTeam` | NM1 (82) | Rendering provider |
| `Claim.facility` | NM1 (77) | Service facility |
| `Claim.diagnosis` | HI | Diagnosis codes |
| `Claim.item` | SV1/LX | Service lines |
| `Claim.billablePeriod` | DTP | Service dates |
| `Claim.total` | CLM02 | Total claim charge |

## Features

✅ **Accepts FHIR Input**: Supports both Bundle and individual Claim resources

✅ **Automatic Conversion**: Converts FHIR to internal X12-compatible format

✅ **Reuses Validation Pipeline**: All existing validations apply (file, business rules, LLM)

✅ **Auto-Correction**: Applies auto-correction rules like X12 files

✅ **Generates 837 Output**: Produces standard X12 837 file from FHIR input

✅ **Audit Trail**: Stores original FHIR data and tracks all changes

✅ **Database Storage**: Uses same schema as X12 claims

✅ **Async Processing**: Non-blocking parsing and validation

## Testing

### 1. Start the Server

```bash
cd backend
npm install
npm start
```

### 2. Authenticate

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'
```

Save the returned token.

### 3. Upload FHIR Claim

Create a file `test_claim.json` with the example FHIR Claim above, then:

```bash
curl -X POST http://localhost:3000/api/v1/upload/fhir \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d @test_claim.json
```

### 4. Check Processing Status

```bash
curl -X GET "http://localhost:3000/api/v1/upload/{file_id}" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 5. Retrieve Generated 837 File

```bash
curl -X GET "http://localhost:3000/api/v1/upload/get837?fileId={file_id}" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -o output.txt
```

### 6. View Validation Logs

```bash
curl -X GET "http://localhost:3000/api/v1/upload/getLogs?fileId={file_id}&format=json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Database Schema

No database schema changes required. FHIR files use the existing schema:

- **UploadFileDetail**: Stores file metadata (`file_type='FHIR_837'`)
- **BatchDetail**: Stores batch information
- **ClaimHeader**: Stores claim headers
- **ClaimLine**: Stores service lines
- **ClaimDiagnosis**: Stores diagnoses
- **FileValidationLog**: Stores validation results
- **BusinessValidationLog**: Stores business rule validation
- **ParsedJsonHistoryLog**: Tracks changes to parsed_json

## Error Handling

The endpoint handles various error scenarios:

1. **Missing FHIR Data**: Returns 400 error if request body is empty
2. **Invalid Resource Type**: Returns 400 if resourceType is not Bundle or Claim
3. **Duplicate File**: Detects duplicate checksums and prevents reprocessing
4. **Parsing Errors**: Logs errors and updates file status to 'FAILED'
5. **Validation Failures**: Stores validation errors in log tables

## Limitations and Notes

1. **FHIR Version**: Designed for FHIR R4. Other versions may require adjustments.

2. **Partial Mapping**: Not all FHIR elements are mapped. Additional mappings can be added as needed.

3. **Provider Lookup**: Provider/Facility/Payer lookup requires existing records in master tables. Missing references will be stored as NULL.

4. **Service Line Type**: Defaults to SV1 (professional). Institutional claims (SV2) would need additional logic.

5. **Patient Matching**: Matches patients by name and facility. May create duplicate patient records if matching fails.

6. **EDI Validation Skipped**: X12 EDI structural validation is not applicable to FHIR input (only business rules apply).

## Future Enhancements

- Support for FHIR R5 resources
- Enhanced patient matching logic (DOB, MRN, etc.)
- Support for institutional claims (837I)
- FHIR validation against profiles/schemas
- Batch processing of multiple claims
- Support for ExplanationOfBenefit resources
- Mapping additional FHIR extensions

## Troubleshooting

### Issue: "No FHIR data provided in request body"
- **Cause**: Request body is empty or not JSON
- **Solution**: Ensure Content-Type is `application/json` and body contains valid JSON

### Issue: "Unsupported FHIR resource type"
- **Cause**: Resource type is not Bundle or Claim
- **Solution**: Use FHIR Claim or Bundle resource

### Issue: File status stuck at "PARSING"
- **Cause**: Parsing error occurred
- **Solution**: Check server logs for detailed error messages

### Issue: Claims not showing up in database
- **Cause**: Required fields missing in FHIR data
- **Solution**: Ensure patient, provider, and item data are present

## Support

For issues or questions:
1. Check server logs in `logs/` directory
2. Review validation logs via `/api/v1/upload/getLogs` endpoint
3. Check database `UploadFileDetail.parsing_errors` field for error details

## Change Log

### Version 1.0 (2025-01-15)
- Initial implementation
- FHIR Claim and Bundle support
- Integration with existing validation pipeline
- Auto-correction support
- 837 file generation from FHIR input
