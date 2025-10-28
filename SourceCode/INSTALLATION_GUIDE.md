# Multi-Mode Ingestion Enhancement - Installation Guide

## Prerequisites

- Node.js 18.x or higher
- PostgreSQL 14+
- Existing 837 Claim Processing Platform

---

## Step 1: Install Required NPM Packages

Run the following command in the `backend` directory:

```bash
cd backend
npm install ssh2-sftp-client chokidar
```

### Package Details:

| Package | Version | Purpose |
|---------|---------|---------|
| `ssh2-sftp-client` | ^9.1.0 | SFTP client for remote file operations |
| `chokidar` | ^3.5.3 | Efficient file system watcher |

---

## Step 2: Generate Encryption Key

Generate a secure encryption key for SFTP password storage:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (64-character hex string) and add it to your `.env` file:

```bash
ENCRYPTION_KEY=your_generated_64_character_hex_key_here
```

---

## Step 3: Update Environment Variables

Add the following to your `.env` file (already added to `.env.example`):

```bash
# Multi-Mode Ingestion Configuration
ENCRYPTION_KEY=your_64_character_hex_encryption_key_here
SFTP_MAX_RETRIES=3
SFTP_BASE_RETRY_DELAY_MS=5000
SFTP_CONNECTION_TIMEOUT_SECONDS=30
SFTP_DEFAULT_POLL_INTERVAL_SECONDS=300
LOCAL_MAX_RETRIES=3
LOCAL_BASE_RETRY_DELAY_MS=5000
LOCAL_DEBOUNCE_MS=2000
TEMP_DIR=./temp
STAGING_DIR=./temp/staging
OUTPUT_DIR=./output
```

---

## Step 4: Run Database Migrations

Execute the migration script to add new tables and columns:

```bash
# Using psql
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f backend/database/migrations/add_multi_mode_ingestion.sql

# Or using node migration runner
cd backend
node database/run_migration_node.js migrations/add_multi_mode_ingestion.sql
```

Verify migration success:

```sql
-- Check Facilities table columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'facilities' AND column_name IN ('ingestion_mode', 'ingestion_config');

-- Check IngestionLog table exists
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ingestionlog');
```

---

## Step 5: Create Required Directories

The server will auto-create these on startup, but you can create them manually:

```bash
mkdir -p temp/sftp temp/staging output logs quarantine
```

---

## Step 6: Restart the Server

```bash
cd backend
npm start
```

You should see:

```
===========================================
  Initializing Ingestion Manager
===========================================

[1/2] Initializing SFTP Ingestion Service...
No facilities configured for SFTP ingestion. Service idle.

[2/2] Initializing File Watcher Service...
No facilities configured for local folder ingestion. Service idle.

===========================================
  ✓ Ingestion Manager Ready
===========================================
```

---

## Step 7: Verify Installation

### Test Health Check:

```bash
curl http://localhost:3000/health/ingestion
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-14T15:30:00Z",
  "services": {
    "sftp": {
      "status": "running",
      "active_facilities": 0,
      "active_pollers": 0
    },
    "local_folder": {
      "status": "running",
      "active_facilities": 0,
      "active_watchers": 0
    }
  }
}
```

### Test Encryption:

Create a test script `backend/test-encryption.js`:

```javascript
import { testEncryption, generateEncryptionKey } from './utils/encryption.js';

console.log('Testing encryption...');
const result = testEncryption();

if (result) {
  console.log('✓ Encryption is working correctly');
} else {
  console.log('✗ Encryption test failed');
}

console.log('\nGenerate new key:');
console.log(generateEncryptionKey());
```

Run:

```bash
node backend/test-encryption.js
```

---

## Step 8: Configure a Test Facility

### Option A: SFTP Mode

Use the API to configure a facility:

```bash
curl -X PUT http://localhost:3000/api/v1/ingestion/facility/<FACILITY_ID>/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "ingestion_mode": "SFTP",
    "ingestion_config": {
      "mode": "SFTP",
      "sftp": {
        "enabled": true,
        "host": "ftp.example.com",
        "port": 22,
        "username": "testuser",
        "password": "testpassword",
        "input_folder": "/inbound",
        "output_folder": "/outbound",
        "archive_folder": "/archive",
        "poll_interval_seconds": 300
      }
    }
  }'
```

### Option B: Local Folder Mode

```bash
curl -X PUT http://localhost:3000/api/v1/ingestion/facility/<FACILITY_ID>/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "ingestion_mode": "LOCAL_FOLDER",
    "ingestion_config": {
      "mode": "LOCAL_FOLDER",
      "local": {
        "enabled": true,
        "input_folder": "/data/837/input",
        "output_folder": "/data/837/output",
        "archive_folder": "/data/837/archive",
        "watch_recursive": false
      }
    }
  }'
```

---

## Step 9: Test Connection

Test SFTP or local folder access:

```bash
curl -X POST http://localhost:3000/api/v1/ingestion/facility/<FACILITY_ID>/test-connection \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{
    "ingestion_mode": "SFTP",
    "ingestion_config": {
      "sftp": {
        "host": "ftp.example.com",
        "port": 22,
        "username": "testuser",
        "password": "testpassword",
        "input_folder": "/inbound"
      }
    }
  }'
```

---

## Step 10: Monitor Ingestion

### View Statistics:

```bash
curl http://localhost:3000/api/v1/ingestion/statistics?days=7 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### View Logs:

```bash
curl http://localhost:3000/api/v1/ingestion/logs?facilityId=<FACILITY_ID>&page=1&limit=50 \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### View Facility Status:

```bash
curl http://localhost:3000/api/v1/ingestion/facility/<FACILITY_ID>/status \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

---

## Troubleshooting

### Issue: "ENCRYPTION_KEY not found"

**Solution:** Ensure `ENCRYPTION_KEY` is set in `.env` file. Generate one using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Issue: "ssh2-sftp-client module not found"

**Solution:** Install dependencies:

```bash
cd backend
npm install
```

---

### Issue: "Permission denied" for local folders

**Solution:** Ensure the Node.js process has read/write permissions:

```bash
chmod 755 /data/837/input
chmod 755 /data/837/output
```

---

### Issue: SFTP connection fails

**Solution:**
1. Verify hostname/IP is correct
2. Check firewall allows port 22 (or custom port)
3. Test connection manually:

```bash
sftp -P 22 username@hostname
```

4. For SSH key auth, ensure key file has correct permissions:

```bash
chmod 600 /path/to/private_key.pem
```

---

### Issue: Files not being picked up

**SFTP:**
- Check poll interval (default: 5 minutes)
- Verify file extensions (`.837`, `.edi`, `.txt`, `.x12`, `.dat`)
- Check file is stable (not being written to)

**Local Folder:**
- Verify watcher is active (check health endpoint)
- Check file is in correct folder
- Ensure file has valid extension

---

## Rollback Instructions

If you need to rollback the changes:

```bash
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f backend/database/migrations/rollback_multi_mode_ingestion.sql
```

This will:
- Drop `IngestionLog` table
- Remove new columns from `Facilities` and `UploadFileDetail` tables
- Remove indexes and views

---

## Production Deployment Checklist

- [ ] Generate secure `ENCRYPTION_KEY` (64 characters)
- [ ] Store encryption key in secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
- [ ] Run database migrations on production
- [ ] Test SFTP connections from production server
- [ ] Verify network connectivity to SFTP servers
- [ ] Set up monitoring alerts for ingestion failures
- [ ] Configure log aggregation (CloudWatch, ELK, etc.)
- [ ] Test graceful shutdown (SIGTERM handling)
- [ ] Set up health check monitoring
- [ ] Document facility configurations

---

## API Endpoints

### Ingestion Management:

- `GET /health/ingestion` - Get ingestion services health
- `GET /api/v1/ingestion/health` - Detailed health status
- `GET /api/v1/ingestion/facility/:facilityId/status` - Facility status
- `GET /api/v1/ingestion/facility/:facilityId/config` - Get configuration
- `PUT /api/v1/ingestion/facility/:facilityId/config` - Update configuration
- `POST /api/v1/ingestion/facility/:facilityId/test-connection` - Test connection
- `POST /api/v1/ingestion/facility/:facilityId/restart` - Restart ingestion
- `POST /api/v1/ingestion/facility/:facilityId/stop` - Stop ingestion
- `GET /api/v1/ingestion/statistics` - Get statistics
- `GET /api/v1/ingestion/logs` - Get ingestion logs

---

## Support

For issues or questions, refer to the comprehensive FRD document:
- `FRD_Multi_Mode_Ingestion_Enhancement.md`

---

**Installation Complete!** 🎉

Your 837 Claim Processing Platform now supports multi-mode ingestion (REST API, SFTP, Local Folder).
