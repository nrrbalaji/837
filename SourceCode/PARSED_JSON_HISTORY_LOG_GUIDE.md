# Parsed JSON History - Log Table Approach

## Overview

This implementation uses a **dedicated log table** (`ParsedJsonHistoryLog`) to track all changes to `parsed_json` in the `UploadFileDetail` table, without modifying the original table structure.

### Key Benefits
✅ **No schema changes** to `UploadFileDetail` table
✅ **Clean separation** of concerns - logs are separate from main data
✅ **Flexible** - easily add new fields to log table without affecting main table
✅ **Automatic version numbering** computed from log entries
✅ **Built-in rollback function** to restore previous versions

## Quick Start

### 1. Run the Migration

```bash
psql -U your_user -d your_db -f backend/database/migrations/add_parsed_json_history_log.sql
```

This creates:
- `ParsedJsonHistoryLog` table
- Helper functions (`log_parsed_json_change`, `get_current_parsed_json_version`, etc.)
- Views for easy querying
- Rollback function

### 2. Logging Changes (Application Code)

Every time you update `parsed_json`, explicitly call the log function:

```javascript
const client = await pool.connect();

try {
  await client.query('BEGIN');

  // Get current parsed_json before update
  const currentResult = await client.query(
    'SELECT parsed_json FROM UploadFileDetail WHERE file_id = $1',
    [fileId]
  );
  const previousJson = currentResult.rows[0]?.parsed_json;

  // Prepare new JSON
  const newJsonValue = { /* your updated data */ };

  // Update the file
  await client.query(
    'UPDATE UploadFileDetail SET parsed_json = $1 WHERE file_id = $2',
    [JSON.stringify(newJsonValue), fileId]
  );

  // Log the change
  await client.query(
    `SELECT log_parsed_json_change(
      $1::UUID,        -- file_id
      $2::JSONB,       -- previous_value
      $3::JSONB,       -- new_value
      $4::VARCHAR,     -- change_type
      $5::TEXT,        -- change_description
      $6::UUID,        -- changed_by (user_id)
      $7::VARCHAR,     -- changed_by_username
      $8::VARCHAR,     -- changed_via
      $9::JSONB        -- changes_summary (optional)
    )`,
    [
      fileId,
      previousJson,
      newJsonValue,
      'AUTO_CORRECTION',
      'Applied 5 corrections to 10 claims',
      userId,
      username,
      'AUTO_CORRECTION',
      { correctionsApplied: 5, claimsModified: 10 }
    ]
  );

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Database Schema

### ParsedJsonHistoryLog Table

```sql
CREATE TABLE ParsedJsonHistoryLog (
    log_id UUID PRIMARY KEY,
    file_id UUID REFERENCES UploadFileDetail(file_id),
    version INTEGER NOT NULL,
    previous_value JSONB,
    new_value JSONB NOT NULL,
    change_type VARCHAR(50),
    change_description TEXT,
    changes_summary JSONB,
    changed_by UUID REFERENCES Users(user_id),
    changed_by_username VARCHAR(100),
    changed_via VARCHAR(50),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    correction_log_ids UUID[],
    related_validation_ids UUID[],
    ip_address VARCHAR(45),
    user_agent TEXT
);
```

## Change Types

- `INITIAL_PARSE` - First parse of 837 file
- `AUTO_CORRECTION` - Auto-correction rules applied
- `MANUAL_EDIT` - User manually edited the JSON
- `REGENERATION` - File regenerated from data
- `ROLLBACK` - Rolled back to previous version
- `VALIDATION_UPDATE` - Updated based on validation results

## Helper Functions

### Get Current Version
```sql
SELECT get_current_parsed_json_version('file-id-here');
-- Returns: 3 (if there are 3 log entries)
```

### Get Next Version
```sql
SELECT get_next_parsed_json_version('file-id-here');
-- Returns: 4 (next version to use)
```

### Log a Change
```sql
SELECT log_parsed_json_change(
    'file-id'::UUID,
    '{"old": "data"}'::JSONB,
    '{"new": "data"}'::JSONB,
    'MANUAL_EDIT',
    'Updated claim #123',
    'user-id'::UUID,
    'john.doe',
    'WEB_UI',
    '{"fieldsChanged": ["claimNumber"]}'::JSONB
);
-- Returns: log_id of the new entry
```

### Rollback to Version
```sql
SELECT rollback_to_parsed_json_version(
    'file-id'::UUID,
    2,  -- target version
    'user-id'::UUID,
    'admin',
    'Reverting incorrect changes'
);
-- Returns: log_id of the rollback entry
-- Also updates UploadFileDetail.parsed_json
```

## API Endpoints

### Get History
```http
GET /api/v1/upload/:fileId/parsed-json-history
```

Query Parameters:
- `includeJson=true` - Include full JSON values (default: false, only sizes)

Response:
```json
{
  "fileId": "uuid",
  "fileName": "file.txt",
  "currentVersion": 3,
  "totalChanges": 3,
  "history": [
    {
      "history_id": "log-uuid",
      "version": 3,
      "change_type": "AUTO_CORRECTION",
      "change_description": "Applied 5 corrections",
      "changed_by_username": "system",
      "changed_via": "AUTO_CORRECTION",
      "changed_at": "2025-10-15T10:30:00Z",
      "previous_value_size": 45678,
      "new_value_size": 45890
    }
  ]
}
```

### Get Specific Version
```http
GET /api/v1/upload/:fileId/parsed-json-history/:version
```

Returns full JSON for that version.

## Views

### ParsedJsonHistoryLogView
Convenience view with computed fields:
```sql
SELECT * FROM ParsedJsonHistoryLogView WHERE file_id = 'your-file-id';
```

Returns:
- Size comparisons
- Time since last change
- Whether it's the current version
- File name (joined from UploadFileDetail)

### ParsedJsonHistorySummary
Summary statistics per file:
```sql
SELECT * FROM ParsedJsonHistorySummary WHERE file_id = 'your-file-id';
```

Returns:
- Total versions
- First/last change timestamps
- Unique changers count
- All change types used

## Frontend Integration

The frontend components ([ParsedJsonHistory.tsx](frontend/src/pages/ParsedJsonHistory.tsx) and [UploadHistory.tsx](frontend/src/pages/UploadHistory.tsx)) remain unchanged - they work with the new log table structure seamlessly.

### Viewing History in UI
1. Go to Upload History page
2. Click the purple GitBranch icon (📊) for any file
3. View timeline of all changes
4. Click "View" to see full JSON details

## Examples

### Example 1: Initial Parse
```javascript
// In parsing837.js
await client.query(
  `SELECT log_parsed_json_change(
    $1::UUID, NULL, $2::JSONB, 'INITIAL_PARSE',
    $3::TEXT, NULL, 'system', 'PARSING_SERVICE', $4::JSONB
  )`,
  [
    fileId,
    parsedData,
    `Initial parse: ${claims.length} claims extracted`,
    { totalClaims: claims.length, totalAmount: totalAmount }
  ]
);
```

### Example 2: Auto-Correction
```javascript
// In autoCorrection.js
const previousJson = await getFile Current ParsedJson(fileId);
const newJson = applyCorrections(previousJson);

await client.query(
  `SELECT log_parsed_json_change(
    $1::UUID, $2::JSONB, $3::JSONB, 'AUTO_CORRECTION',
    $4::TEXT, $5::UUID, $6::VARCHAR, 'AUTO_CORRECTION', $7::JSONB, $8::UUID[]
  )`,
  [
    fileId,
    previousJson,
    newJson,
    `Applied ${count} corrections to ${claimsCount} claims`,
    userId,
    username,
    { correctionsApplied: count, claimsModified: claimsCount },
    correctionLogIds
  ]
);
```

### Example 3: Manual Edit
```javascript
// In your edit endpoint
await client.query(
  `SELECT log_parsed_json_change(
    $1::UUID, $2::JSONB, $3::JSONB, 'MANUAL_EDIT',
    $4::TEXT, $5::UUID, $6::VARCHAR, 'WEB_UI', NULL,
    NULL, NULL, $7::VARCHAR, $8::TEXT
  )`,
  [
    fileId,
    oldJson,
    newJson,
    'User manually edited claim #123',
    userId,
    username,
    req.ip,
    req.headers['user-agent']
  ]
);
```

## Querying History

### Get all changes for a file
```sql
SELECT
  version,
  change_type,
  change_description,
  changed_by_username,
  changed_at
FROM ParsedJsonHistoryLog
WHERE file_id = 'your-file-id'
ORDER BY version DESC;
```

### Get changes in last 24 hours
```sql
SELECT * FROM ParsedJsonHistoryLog
WHERE changed_at > NOW() - INTERVAL '24 hours'
ORDER BY changed_at DESC;
```

### Get changes by user
```sql
SELECT
  file_id,
  version,
  change_type,
  change_description,
  changed_at
FROM ParsedJsonHistoryLog
WHERE changed_by_username = 'john.doe'
ORDER BY changed_at DESC;
```

### Get changes by type
```sql
SELECT
  file_id,
  version,
  change_description,
  changed_at
FROM ParsedJsonHistoryLog
WHERE change_type = 'AUTO_CORRECTION'
ORDER BY changed_at DESC
LIMIT 50;
```

## Rollback Feature

The migration includes a built-in rollback function:

### From SQL
```sql
SELECT rollback_to_parsed_json_version(
    'file-id'::UUID,
    2,  -- rollback to version 2
    'user-id'::UUID,
    'admin',
    'Reverting due to incorrect auto-correction'
);
```

### From Application Code
```javascript
async function rollbackFile(fileId, targetVersion, userId, username, reason) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT rollback_to_parsed_json_version($1, $2, $3, $4, $5)`,
      [fileId, targetVersion, userId, username, reason]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

The rollback function:
1. Fetches the target version's JSON
2. Updates `UploadFileDetail.parsed_json`
3. Creates a new log entry with type `ROLLBACK`
4. Returns the new log entry ID

## Maintenance

### Archive Old Logs
```sql
-- Keep only last 10 versions per file
DELETE FROM ParsedJsonHistoryLog
WHERE log_id IN (
  SELECT log_id FROM (
    SELECT log_id,
           ROW_NUMBER() OVER (PARTITION BY file_id ORDER BY version DESC) as rn
    FROM ParsedJsonHistoryLog
  ) sub
  WHERE rn > 10
);
```

### Check Table Size
```sql
SELECT
  pg_size_pretty(pg_total_relation_size('ParsedJsonHistoryLog')) as table_size,
  COUNT(*) as total_logs,
  COUNT(DISTINCT file_id) as unique_files
FROM ParsedJsonHistoryLog;
```

### Cleanup by Age
```sql
-- Delete logs older than 2 years (keep version 1 and latest)
DELETE FROM ParsedJsonHistoryLog
WHERE changed_at < NOW() - INTERVAL '2 years'
AND version NOT IN (
  1,  -- Keep initial parse
  (SELECT MAX(version) FROM ParsedJsonHistoryLog pjhl2 WHERE pjhl2.file_id = ParsedJsonHistoryLog.file_id)
);
```

## Advantages Over Trigger Approach

| Feature | Log Table | Trigger Approach |
|---------|-----------|------------------|
| Schema Changes | None to main table | Adds version column |
| Control | Explicit logging in code | Automatic via trigger |
| Flexibility | Easy to add fields | Requires migration |
| Context | Rich metadata | Limited to session vars |
| Debugging | Clear log calls | Hidden in trigger |
| Rollback | Built-in function | Must implement |
| Performance | Slightly slower | Automatic |

## Troubleshooting

### History not being recorded
1. Check if function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'log_parsed_json_change';
   ```

2. Check if table exists:
   ```sql
   SELECT tablename FROM pg_tables WHERE tablename = 'parsedjsonhistorylog';
   ```

3. Verify function is being called in code

### Version numbers skipped
This is normal if transactions are rolled back. The sequence continues.

### Large table size
Consider:
- Archiving old logs
- Compressing JSON for old versions
- Keeping only N most recent versions

## Related Files

- Migration: [add_parsed_json_history_log.sql](backend/database/migrations/add_parsed_json_history_log.sql)
- Backend API: [upload.js](backend/routes/upload.js) (lines 909-1052)
- Auto-correction: [autoCorrection.js](backend/services/autoCorrection.js) (lines 240-310)
- Parsing service: [parsing837.js](backend/services/parsing837.js) (lines 144-212)
- Frontend: [ParsedJsonHistory.tsx](frontend/src/pages/ParsedJsonHistory.tsx)
