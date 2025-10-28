# Auto-Correction Service - Complete Guide

## Overview

The Auto-Correction Service automatically applies rule-based corrections to parsed 837 claim files based on configured validation and correction rules. This system allows for:

- **Automated claim correction** based on validation failures
- **Multiple correction source types** (master data lookup, static values, format transformations, field references)
- **Test mode** for previewing corrections before applying
- **Comprehensive logging** of all corrections applied
- **Support for nested JSON paths** and segment-based field access

---

## Table of Contents

1. [Architecture](#architecture)
2. [API Endpoints](#api-endpoints)
3. [Service Method](#service-method)
4. [Correction Source Types](#correction-source-types)
5. [Usage Examples](#usage-examples)
6. [Database Schema](#database-schema)
7. [Response Format](#response-format)

---

## Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Fetch File Record & parsed_json from UploadFileDetail        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Load Active ValidationRules (ordered by priority ASC)        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. For Each Validation Rule:                                    │
│    - Evaluate condition on parsed_json                          │
│    - If FAILS and auto_correct_enabled = true → Next Step       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Find Matching CorrectionRule (by validation_rule_id)         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Apply Correction Based on correction_source_type:            │
│    ├─ MASTER_* → Query master table                             │
│    ├─ STATIC → Use default_value                                │
│    ├─ FORMAT_RULE → Transform value                             │
│    └─ FIELD_REFERENCE → Copy from another field                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Update parsed_json with corrected value                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Build correction log entry                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. If NOT test_mode → Update database + Insert CorrectionLog    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Return Response (status, logs, preview)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Apply Auto-Correction

**Endpoint:** `POST /api/v1/upload/:fileId/auto-correct`

**Description:** Applies auto-correction rules to a parsed claim file

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "isTestMode": false  // Optional, default: false
}
```

**Response:**
```json
{
  "message": "Auto-correction completed successfully",
  "status": "SUCCESS",
  "fileId": "uuid",
  "fileName": "claim_file.txt",
  "totalValidationRulesChecked": 25,
  "totalCorrectionsAttempted": 8,
  "totalCorrectionsApplied": 7,
  "totalCorrectionsFailed": 1,
  "correctionLog": [...],
  "updatedJsonPreview": null,
  "isTestMode": false,
  "timestamp": "2025-10-13T12:00:00.000Z"
}
```

### 2. Get Correction Log

**Endpoint:** `GET /api/v1/upload/:fileId/correction-log`

**Description:** Retrieves correction history for a file

**Authentication:** Required

**Response:**
```json
{
  "fileId": "uuid",
  "totalCorrections": 15,
  "corrections": [
    {
      "correction_id": "uuid",
      "field_name": "Provider NPI",
      "old_value": "1234567890",
      "new_value": "9876543210",
      "correction_type": "AUTO",
      "corrected_at": "2025-10-13T12:00:00.000Z",
      "corrected_by_username": "admin"
    }
  ]
}
```

---

## Service Method

### Function Signature

```javascript
async function autoCorrectClaim(fileId, options = {})
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `fileId` | string (UUID) | Yes | - | File ID from UploadFileDetail |
| `options.isTestMode` | boolean | No | false | If true, preview only (no DB updates) |
| `options.userId` | string (UUID) | No | null | User ID for audit logging |

### Return Type

```typescript
interface AutoCorrectionResponse {
  status: 'SUCCESS' | 'ERROR';
  fileId: string;
  fileName: string;
  totalValidationRulesChecked: number;
  totalCorrectionsAttempted: number;
  totalCorrectionsApplied: number;
  totalCorrectionsFailed: number;
  correctionLog: CorrectionLogEntry[];
  updatedJsonPreview: object | null;
  isTestMode: boolean;
  timestamp: string;
}

interface CorrectionLogEntry {
  rule_code: string;
  rule_name: string;
  correction_rule_code: string;
  target_path: string;
  before_value: any;
  corrected_value: any;
  correction_applied: boolean;
  correction_source: string;
  correction_reason: string;
  error?: string;
  timestamp: string;
}
```

---

## Correction Source Types

### 1. MASTER_PROVIDER / MASTER_FACILITY / MASTER_PAYER / MASTER_TRADING_PARTNER

**Description:** Looks up corrected value from master tables

**Configuration:**
```json
{
  "lookup_table": "Provider",
  "lookup_column": "npi",
  "correction_logic": {
    "matchColumn": "provider_id",
    "matchValue": "current_value"
  }
}
```

**Example:**
- **Validation Rule:** Provider NPI is invalid
- **Correction Rule:** Look up correct NPI from `Provider` table
- **Result:** Updates claim with valid NPI from master data

---

### 2. STATIC

**Description:** Applies a static default value

**Configuration:**
```json
{
  "correction_source_type": "STATIC",
  "default_value": "99213"
}
```

**Example:**
- **Validation Rule:** Procedure code is missing
- **Correction Rule:** Set to default code "99213"
- **Result:** Updates field with static value

---

### 3. FORMAT_RULE

**Description:** Applies format transformations to values

**Configuration:**
```json
{
  "correction_source_type": "FORMAT_RULE",
  "correction_logic": {
    "transformType": "UPPERCASE",
    "decimals": 2,
    "format": "YYYYMMDD"
  }
}
```

**Supported Transform Types:**

| Transform Type | Description | Example |
|---------------|-------------|---------|
| `TRIM` | Remove leading/trailing spaces | `" ABC "` → `"ABC"` |
| `UPPERCASE` | Convert to uppercase | `"abc"` → `"ABC"` |
| `LOWERCASE` | Convert to lowercase | `"ABC"` → `"abc"` |
| `REMOVE_SPECIAL_CHARS` | Remove non-alphanumeric | `"A-B_C"` → `"ABC"` |
| `REMOVE_SPACES` | Remove all spaces | `"A B C"` → `"ABC"` |
| `FORMAT_PHONE` | Format phone number | `"1234567890"` → `"(123) 456-7890"` |
| `FORMAT_DATE` | Format date | `"2025-10-13"` → `"20251013"` |
| `FORMAT_ZIP` | Format ZIP code | `"123456789"` → `"12345-6789"` |
| `DECIMAL_PLACES` | Round to decimals | `123.456` → `"123.46"` |
| `PAD_LEFT` | Left pad with character | `"123"` → `"000123"` |
| `PAD_RIGHT` | Right pad with character | `"ABC"` → `"ABC   "` |
| `SUBSTRING` | Extract substring | `"ABCDEF"` → `"BCD"` |
| `REPLACE` | Replace pattern | `"A-B-C"` → `"A_B_C"` |

**Examples:**

```javascript
// Format phone number
{
  "transformType": "FORMAT_PHONE"
}

// Format date to YYYYMMDD
{
  "transformType": "FORMAT_DATE",
  "format": "YYYYMMDD"
}

// Round to 2 decimal places
{
  "transformType": "DECIMAL_PLACES",
  "decimals": 2
}

// Pad left with zeros
{
  "transformType": "PAD_LEFT",
  "length": 10,
  "padChar": "0"
}

// Replace pattern
{
  "transformType": "REPLACE",
  "pattern": "-",
  "replacement": "_",
  "flags": "g"
}
```

---

### 4. FIELD_REFERENCE

**Description:** Copies value from another field in the same JSON

**Configuration:**
```json
{
  "correction_source_type": "FIELD_REFERENCE",
  "correction_logic": {
    "sourceField": "billing.provider.npi"
  }
}
```

**Example:**
- **Validation Rule:** Rendering provider NPI is missing
- **Correction Rule:** Copy from billing provider NPI
- **Result:** Copies value from nested field path

---

## Usage Examples

### Example 1: Test Mode (Preview Only)

```bash
curl -X POST http://localhost:3001/api/v1/upload/abc-123-def-456/auto-correct \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isTestMode": true}'
```

**Response:**
```json
{
  "message": "Auto-correction preview completed (no changes saved)",
  "status": "SUCCESS",
  "fileId": "abc-123-def-456",
  "fileName": "sample_claim.txt",
  "totalValidationRulesChecked": 10,
  "totalCorrectionsAttempted": 3,
  "totalCorrectionsApplied": 3,
  "totalCorrectionsFailed": 0,
  "correctionLog": [
    {
      "rule_code": "VAL_001",
      "rule_name": "Provider NPI Required",
      "correction_rule_code": "CORR_001",
      "target_path": "provider.npi",
      "before_value": null,
      "corrected_value": "1234567890",
      "correction_applied": true,
      "correction_source": "MASTER_PROVIDER",
      "correction_reason": "Looked up from Provider table",
      "timestamp": "2025-10-13T12:00:00.000Z"
    }
  ],
  "updatedJsonPreview": {
    "provider": {
      "npi": "1234567890",
      "name": "Dr. John Smith"
    }
  },
  "isTestMode": true,
  "timestamp": "2025-10-13T12:00:00.000Z"
}
```

---

### Example 2: Apply Corrections (Production)

```bash
curl -X POST http://localhost:3001/api/v1/upload/abc-123-def-456/auto-correct \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isTestMode": false}'
```

**Response:**
```json
{
  "message": "Auto-correction completed successfully",
  "status": "SUCCESS",
  "totalCorrectionsApplied": 7,
  "correctionLog": [...]
}
```

---

### Example 3: Node.js Usage

```javascript
import { autoCorrectClaim } from './services/autoCorrection.js';

// Test mode
const previewResult = await autoCorrectClaim('file-uuid', {
  isTestMode: true,
  userId: 'user-uuid'
});

console.log(`Preview: ${previewResult.totalCorrectionsApplied} corrections would be applied`);

// Apply corrections
const result = await autoCorrectClaim('file-uuid', {
  isTestMode: false,
  userId: 'user-uuid'
});

console.log(`Applied ${result.totalCorrectionsApplied} corrections`);
```

---

## Database Schema

### ValidationRules Table (Relevant Columns)

| Column | Type | Description |
|--------|------|-------------|
| `rule_id` | UUID | Primary key |
| `rule_code` | VARCHAR(50) | Unique code |
| `rule_name` | VARCHAR(255) | Rule name |
| `field_path` | TEXT | JSON path (e.g., "patient.firstName") |
| `segment_code` | VARCHAR(10) | X12 segment code (e.g., "NM1") |
| `element_position` | INT | Element position in segment |
| `validation_logic` | JSONB | Validation conditions |
| `auto_correct_enabled` | BOOLEAN | Enable auto-correction |
| `is_active` | BOOLEAN | Rule is active |
| `priority` | INT | Execution order (ASC) |

### CorrectionRules Table (Relevant Columns)

| Column | Type | Description |
|--------|------|-------------|
| `rule_id` | UUID | Primary key |
| `rule_code` | VARCHAR(50) | Unique code |
| `validation_rule_id` | UUID | FK to ValidationRules |
| `correction_source_type` | VARCHAR(50) | Source type (MASTER_*, STATIC, etc.) |
| `correction_logic` | JSONB | Correction logic |
| `lookup_table` | VARCHAR(100) | Master table name |
| `lookup_column` | VARCHAR(100) | Column to return |
| `default_value` | TEXT | Static default value |
| `fallback_strategy` | VARCHAR(50) | Fallback if correction fails |
| `is_test_mode` | BOOLEAN | Test mode flag |
| `is_active` | BOOLEAN | Rule is active |
| `priority` | INT | Execution order |

### CorrectionLog Table

| Column | Type | Description |
|--------|------|-------------|
| `correction_id` | UUID | Primary key |
| `claim_id` | UUID | FK to ClaimHeader |
| `correction_type` | VARCHAR(20) | AUTO or MANUAL |
| `field_name` | VARCHAR(100) | Field name |
| `field_path` | TEXT | JSON path |
| `old_value` | TEXT | Original value |
| `new_value` | TEXT | Corrected value |
| `correction_reason` | TEXT | Reason |
| `correction_rule` | VARCHAR(100) | Rule code |
| `corrected_by` | UUID | User ID |
| `corrected_at` | TIMESTAMP | Timestamp |
| `is_approved` | BOOLEAN | Approval status |

---

## Response Format

### Success Response

```json
{
  "status": "SUCCESS",
  "fileId": "abc-123-def-456",
  "fileName": "claim_837.txt",
  "totalValidationRulesChecked": 25,
  "totalCorrectionsAttempted": 8,
  "totalCorrectionsApplied": 7,
  "totalCorrectionsFailed": 1,
  "correctionLog": [
    {
      "rule_code": "VAL_NPI_REQ",
      "rule_name": "Provider NPI Required",
      "correction_rule_code": "CORR_NPI_LOOKUP",
      "target_path": "loops.2000A.segments.NM1/9",
      "before_value": null,
      "corrected_value": "1234567890",
      "correction_applied": true,
      "correction_source": "MASTER_PROVIDER",
      "correction_reason": "Looked up from Provider table",
      "timestamp": "2025-10-13T12:00:00.000Z"
    },
    {
      "rule_code": "VAL_DATE_FMT",
      "rule_name": "Service Date Format",
      "correction_rule_code": "CORR_DATE_FMT",
      "target_path": "service_date",
      "before_value": "2025-10-13",
      "corrected_value": "20251013",
      "correction_applied": true,
      "correction_source": "FORMAT_RULE",
      "correction_reason": "Applied format transformation: FORMAT_DATE",
      "timestamp": "2025-10-13T12:00:00.000Z"
    }
  ],
  "updatedJsonPreview": null,
  "isTestMode": false,
  "timestamp": "2025-10-13T12:00:00.000Z"
}
```

### Error Response

```json
{
  "error": "File not found"
}
```

---

## Best Practices

1. **Always test first**: Use `isTestMode: true` to preview corrections before applying
2. **Order matters**: Set `priority` on validation rules to control execution order
3. **Use fallback strategies**: Configure `fallback_strategy` to handle lookup failures
4. **Monitor logs**: Review `CorrectionLog` table regularly for audit trail
5. **Start with low-risk corrections**: Begin with format transformations and static defaults
6. **Validate master data**: Ensure master tables are up-to-date before applying lookups
7. **Handle edge cases**: Use fallback strategies for null/missing values

---

## Troubleshooting

### Issue: No corrections applied

**Check:**
- ValidationRules have `auto_correct_enabled = true`
- ValidationRules have `is_active = true`
- CorrectionRules exist for failed validation rules
- CorrectionRules have `is_active = true`

### Issue: Correction failed

**Check:**
- Master tables contain required data
- `lookup_table` and `lookup_column` are correct
- `correction_logic` JSON is valid
- `fallback_strategy` is configured

### Issue: Wrong field updated

**Check:**
- `field_path` uses correct dot notation
- `segment_code` and `element_position` match 837 structure
- JSON structure matches expected format

---

## Support

For issues or questions, contact the development team or open a GitHub issue.

---

**Version:** 1.0
**Last Updated:** 2025-10-13
