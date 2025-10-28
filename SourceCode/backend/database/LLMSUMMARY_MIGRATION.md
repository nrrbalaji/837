# LLM Summary Column Migration

## Overview
This migration adds a new nullable `llmsummary` column to the `FileValidationLog` table to store LLM-generated summaries of validation errors and warnings.

## Changes Made

### 1. Database Schema
**File:** `backend/database/schema.sql`
- Added `llmsummary TEXT` column to `FileValidationLog` table (line 299)
- Column is nullable and can store text of any length

### 2. Migration Script
**File:** `backend/database/add_llmsummary_column.sql`
- SQL script to add the column with `ALTER TABLE`
- Includes column comment for documentation
- Uses `IF NOT EXISTS` to make it idempotent

### 3. Migration Runner
**File:** `backend/database/run_llmsummary_migration.js`
- Node.js script to execute the migration
- Uses transaction (BEGIN/COMMIT/ROLLBACK) for safety
- Connects to database using existing pool configuration

**File:** `backend/database/run_llmsummary_migration.bat`
- Windows batch file for easy execution

### 4. API Updates
**File:** `backend/routes/validationLogs.js`
- Updated GET `/api/v1/validation-logs/file/:fileId` to include `llmsummary` field (line 30)
- Updated combined query in GET `/api/v1/validation-logs/all/:fileId` to include `llmsummary` (lines 232, 251, 270)
- Added NULL placeholder for EDI and Business validation logs in UNION queries

## Running the Migration

### Option 1: Using Node.js
```bash
cd backend/database
node run_llmsummary_migration.js
```

### Option 2: Using Batch File (Windows)
```cmd
cd backend\database
run_llmsummary_migration.bat
```

### Option 3: Direct SQL
```bash
psql -U postgres -d rcm_platform -f add_llmsummary_column.sql
```

## Usage

### Inserting Data with LLM Summary
```javascript
await pool.query(`
  INSERT INTO FileValidationLog (
    file_id, validation_type, validation_rule,
    severity, error_code, error_message,
    error_location, llmsummary
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, [fileId, validationType, rule, severity, errorCode, message, location, llmSummary]);
```

### Updating Existing Records
```javascript
await pool.query(`
  UPDATE FileValidationLog
  SET llmsummary = $1
  WHERE validation_id = $2
`, [llmSummary, validationId]);
```

### Querying Data
```javascript
const result = await pool.query(`
  SELECT
    validation_id,
    error_message,
    llmsummary,
    validated_at
  FROM FileValidationLog
  WHERE file_id = $1 AND llmsummary IS NOT NULL
`, [fileId]);
```

## Rollback

If you need to remove the column:

```sql
ALTER TABLE FileValidationLog DROP COLUMN IF EXISTS llmsummary;
```

## Notes

- The column is nullable, so existing records will have `NULL` values
- No data migration is needed for existing records
- The column can store summaries of any length (TEXT type)
- API responses will now include the `llmsummary` field (will be `null` for records without summaries)
