# Setup Guide: Parsed JSON History Tracking

## Prerequisites

- PostgreSQL 12 or higher
- Node.js application running
- Database user with CREATE TABLE permissions

## Step-by-Step Installation

### Step 1: Check Your Environment

First, verify your database connection details. Check your `.env` file or config:

```bash
# Example from your .env file
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

### Step 2: Run the Migration

#### Option A: Using the provided scripts (Recommended)

**For Windows:**

```cmd
# Edit run_history_migration.bat first to set your database details
run_history_migration.bat
```

**For Linux/Mac:**

```bash
# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=your_database_name
export DB_USER=your_username

# Make script executable
chmod +x run_history_migration.sh

# Run the migration
./run_history_migration.sh
```

#### Option B: Using psql directly

**Windows:**

```cmd
psql -h localhost -U your_username -d your_database_name -f "backend\database\migrations\add_parsed_json_history_log.sql"
```

**Linux/Mac:**

```bash
psql -h localhost -U your_username -d your_database_name -f backend/database/migrations/add_parsed_json_history_log.sql
```

#### Option C: Using Node.js script

```bash
# From the backend directory
node -e "const pool = require('./config/database.js').default; const fs = require('fs'); const sql = fs.readFileSync('./database/migrations/add_parsed_json_history_log.sql', 'utf8'); pool.query(sql).then(() => { console.log('Migration successful'); process.exit(0); }).catch(err => { console.error('Migration failed:', err); process.exit(1); });"
```

### Step 3: Verify Installation

Run the verification script:

```bash
psql -h localhost -U your_username -d your_database_name -f verify_history_migration.sql
```

You should see:

- ✓ Table exists
- ✓ 4 Functions exist
- ✓ 2 Views exist
- List of columns and indexes

### Step 4: Test the Installation

Run a quick test in psql or pgAdmin:

```sql
-- Test 1: Check if function exists
SELECT get_current_parsed_json_version('00000000-0000-0000-0000-000000000000');
-- Should return: 0 (no history for that file yet)

-- Test 2: Check if table is empty (should be)
SELECT COUNT(*) FROM ParsedJsonHistoryLog;
-- Should return: 0

-- Test 3: Check views work
SELECT * FROM ParsedJsonHistorySummary;
-- Should return: empty result (no data yet)
```

### Step 5: Restart Your Application

```bash
# Stop your backend
# Then restart it
npm run dev
# or
npm start
```

## Troubleshooting

### Error: "function get_current_parsed_json_version(unknown) does not exist"

**Cause:** The migration hasn't been run, or the function was not created successfully.

**Solution:**

1. Check if the migration file exists:

   ```bash
   ls backend/database/migrations/add_parsed_json_history_log.sql
   ```

2. Run the migration:

   ```bash
   psql -U your_user -d your_db -f backend/database/migrations/add_parsed_json_history_log.sql
   ```

3. Check for errors in the output. Common issues:

   - Insufficient permissions
   - PostgreSQL extension not enabled
   - Syntax errors (shouldn't happen with provided file)

4. Verify the function was created:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'get_current_parsed_json_version';
   ```

### Error: "relation 'parsedjsonhistorylog' does not exist"

**Cause:** The table was not created.

**Solution:**

1. Check if you're connected to the correct database:

   ```sql
   SELECT current_database();
   ```

2. Re-run the migration with verbose output:

   ```bash
   psql -U your_user -d your_db -f backend/database/migrations/add_parsed_json_history_log.sql -a
   ```

3. Check for permission errors:
   ```sql
   SELECT has_table_privilege('your_username', 'parsedjsonhistorylog', 'SELECT');
   ```

### Error: "permission denied for table parsedjsonhistorylog"

**Cause:** Database user doesn't have sufficient permissions.

**Solution:**

```sql
-- Run as superuser or database owner
GRANT ALL PRIVILEGES ON TABLE ParsedJsonHistoryLog TO your_username;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_username;
```

### Migration runs but nothing happens

**Cause:** You may have run it on the wrong database.

**Solution:**

1. Check which database you're connected to:

   ```sql
   SELECT current_database();
   ```

2. Connect to correct database:

   ```bash
   psql -U your_user -d correct_database_name
   ```

3. Re-run migration

### Error: "column 'parsed_json_version' does not exist"

**Cause:** You're seeing references to the old migration approach.

**Solution:**
This is actually expected with the new log-based approach! The new implementation **doesn't** add a version column. If you see this error:

1. Make sure you're using the correct migration file:

   - ✅ Use: `add_parsed_json_history_log.sql`
   - ❌ Don't use: `add_parsed_json_history.sql` (old approach, deleted)

2. Make sure your code references the correct table:
   - ✅ Table name: `ParsedJsonHistoryLog`
   - ✅ Function: `get_current_parsed_json_version(file_id)`

### Frontend shows "Error Loading History"

**Cause:** Backend API can't connect to database or migration not run.

**Solution:**

1. Check backend logs for detailed error
2. Verify migration was successful (use verification script)
3. Test API endpoint directly:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3000/api/v1/upload/YOUR_FILE_ID/parsed-json-history
   ```
4. Check network tab in browser for actual error response

## Testing the Feature

### 1. Upload a Test File

1. Go to Upload page
2. Upload an 837 file
3. Wait for it to parse

### 2. Check Initial History

1. Go to Upload History
2. Find your uploaded file
3. Click the purple GitBranch icon (📊)
4. You should see Version 1 with type "INITIAL_PARSE"

### 3. Run Auto-Correction

1. Ensure you have validation rules configured
2. Trigger auto-correction (if not automatic)
3. Go back to history page
4. You should now see Version 2 with type "AUTO_CORRECTION"

### 4. View Version Details

1. Click "View" button on any version
2. Modal should show full JSON data
3. Check metadata is correct (user, timestamp, change type)

## Database Queries for Verification

### Check if data is being logged

```sql
-- See all logged changes
SELECT
    file_id,
    version,
    change_type,
    change_description,
    changed_by_username,
    changed_at
FROM ParsedJsonHistoryLog
ORDER BY changed_at DESC
LIMIT 10;
```

### Check specific file's history

```sql
-- Replace with your actual file_id
SELECT
    version,
    change_type,
    change_description,
    changed_at
FROM ParsedJsonHistoryLog
WHERE file_id = 'your-file-id-here'
ORDER BY version;
```

### Check summary statistics

```sql
SELECT * FROM ParsedJsonHistorySummary;
```

### Get current versions for all files

```sql
SELECT
    ufd.file_id,
    ufd.file_name,
    get_current_parsed_json_version(ufd.file_id) as current_version
FROM UploadFileDetail ufd
WHERE is_deleted = false
ORDER BY ufd.uploaded_at DESC
LIMIT 10;
```

## Configuration Checklist

- [ ] PostgreSQL is running
- [ ] Database connection details are correct in `.env`
- [ ] Migration file exists at `backend/database/migrations/add_parsed_json_history_log.sql`
- [ ] Migration has been run successfully
- [ ] Table `ParsedJsonHistoryLog` exists
- [ ] Functions exist (verify with verification script)
- [ ] Views exist (verify with verification script)
- [ ] Backend application restarted after migration
- [ ] API endpoint returns data (test with curl/Postman)
- [ ] Frontend displays history page without errors

## Next Steps

Once installation is complete:

1. Review the [detailed documentation](PARSED_JSON_HISTORY_LOG_GUIDE.md)
2. Test uploading and parsing files
3. Check that history is being recorded
4. Familiarize yourself with the rollback feature
5. Set up monitoring/alerting for the log table size

## Support

If you encounter issues:

1. Check PostgreSQL logs for detailed errors
2. Run the verification script
3. Check backend application logs
4. Review the [troubleshooting section](#troubleshooting) above
5. Check browser console for frontend errors

## Clean Installation

If you need to start fresh:

```sql
-- WARNING: This deletes all history data!
DROP TABLE IF EXISTS ParsedJsonHistoryLog CASCADE;
DROP FUNCTION IF EXISTS log_parsed_json_change CASCADE;
DROP FUNCTION IF EXISTS get_current_parsed_json_version CASCADE;
DROP FUNCTION IF EXISTS get_next_parsed_json_version CASCADE;
DROP FUNCTION IF EXISTS rollback_to_parsed_json_version CASCADE;
DROP VIEW IF EXISTS ParsedJsonHistoryLogView CASCADE;
DROP VIEW IF EXISTS ParsedJsonHistorySummary CASCADE;

-- Then re-run the migration
\i backend/database/migrations/add_parsed_json_history_log.sql
```

## Files Reference

- **Migration**: `backend/database/migrations/add_parsed_json_history_log.sql`
- **Documentation**: `PARSED_JSON_HISTORY_LOG_GUIDE.md`
- **Verification**: `verify_history_migration.sql`
- **Windows Setup**: `run_history_migration.bat`
- **Linux/Mac Setup**: `run_history_migration.sh`

## Quick Start Commands

```bash
# 1. Run migration
psql -U your_user -d your_db -f backend/database/migrations/add_parsed_json_history_log.sql

# 2. Verify
psql -U your_user -d your_db -f verify_history_migration.sql

# 3. Restart app
npm restart

# 4. Test
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/v1/upload/FILE_ID/parsed-json-history
```

Done! 🎉
