# Functional and Technical Requirements Document
## Multi-Mode 837 File Ingestion Enhancement

---

**Document Information:**
- **Project:** 837 Claim Processing Platform - Multi-Mode Ingestion
- **Version:** 1.0
- **Date:** 2025-10-14
- **Prepared For:** Healthcare EDI System Enhancement
- **Document Type:** FRD (Functional Requirements Document) & TSD (Technical Specification Document)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Limitations](#2-current-system-limitations)
3. [Enhancement Objectives](#3-enhancement-objectives)
4. [Functional Requirements](#4-functional-requirements)
5. [Technical Architecture](#5-technical-architecture)
6. [Database Schema Changes](#6-database-schema-changes)
7. [Module Specifications](#7-module-specifications)
8. [Processing Flow](#8-processing-flow)
9. [Configuration Management](#9-configuration-management)
10. [Error Handling & Retry Logic](#10-error-handling--retry-logic)
11. [Logging & Audit Requirements](#11-logging--audit-requirements)
12. [Security Considerations](#12-security-considerations)
13. [Developer Task Breakdown](#13-developer-task-breakdown)
14. [Testing Strategy](#14-testing-strategy)
15. [Deployment Plan](#15-deployment-plan)
16. [Appendices](#16-appendices)

---

## 1. Executive Summary

### 1.1 Purpose
This document defines the functional and technical requirements for enhancing the 837 Claim Processing Platform to support multiple file ingestion modes beyond the current REST API upload functionality.

### 1.2 Scope
The enhancement will enable:
- **SFTP/FTP-based ingestion** with automated polling
- **Local file system monitoring** with directory watching
- **Existing REST API** (maintained for backward compatibility)

### 1.3 Business Value
- **Automation**: Eliminate manual file uploads for batch processing
- **Integration**: Support legacy systems using FTP/SFTP
- **Flexibility**: Allow on-premise deployments with local folder monitoring
- **Efficiency**: Reduce operational overhead and processing time

---

## 2. Current System Limitations

### 2.1 Existing Architecture
```
┌─────────────────┐
│   User (Web)    │
└────────┬────────┘
         │ Manual Upload
         ▼
┌─────────────────────────────────┐
│  REST API Endpoint              │
│  POST /api/v1/upload            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  File Storage (./uploads)       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Parsing & Validation Pipeline  │
│  - parse837File()               │
│  - validateFileImport()         │
│  - validateX12Structure()       │
│  - validateClaim()              │
│  - autoCorrectClaim()           │
│  - generate837File()            │
└─────────────────────────────────┘
```

### 2.2 Limitations
- **FR-LIMIT-001**: Only supports manual file upload via REST API
- **FR-LIMIT-002**: No support for automated batch processing
- **FR-LIMIT-003**: Cannot integrate with legacy FTP-based clearinghouse systems
- **FR-LIMIT-004**: No support for on-premise file system integration
- **FR-LIMIT-005**: Requires user intervention for each file submission

---

## 3. Enhancement Objectives

### 3.1 Primary Objectives
1. **Enable Multi-Mode Ingestion**: Support REST API, SFTP, and Local File System
2. **Facility-Level Configuration**: Allow per-facility ingestion mode selection
3. **Automated Processing**: Implement polling and watching mechanisms
4. **Maintain Compatibility**: Preserve existing REST API functionality
5. **Unified Pipeline**: Ensure all modes use the same validation & correction logic

### 3.2 Success Criteria
- ✅ Facilities can configure ingestion mode via settings
- ✅ SFTP polling operates on configurable intervals (default: 5 minutes)
- ✅ File system watcher triggers on file creation events
- ✅ All ingestion modes produce identical output files
- ✅ Comprehensive logging and error tracking per mode
- ✅ Zero disruption to existing REST API users

---

## 4. Functional Requirements

### 4.1 Facility Configuration (FR-CONFIG)

#### FR-CONFIG-001: Ingestion Mode Selection
**Priority:** P0 (Critical)
**Description:** Facility administrators must be able to select an ingestion mode from the following options:
- `REST_API` (default, existing behavior)
- `SFTP` (FTP/SFTP polling)
- `LOCAL_FOLDER` (File system monitoring)

**Acceptance Criteria:**
- Configuration stored in `Facilities` table
- UI provides dropdown selection
- Mode change triggers service restart for that facility

---

#### FR-CONFIG-002: SFTP Configuration Fields
**Priority:** P0 (Critical)
**Description:** For facilities using SFTP mode, the following fields must be configurable:

| Field Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| `sftp_enabled` | Boolean | Yes | Enable SFTP ingestion | `true` |
| `sftp_host` | String | Yes | FTP/SFTP server hostname | `ftp.clearinghouse.com` |
| `sftp_port` | Integer | Yes | Port number | `22` (SFTP) or `21` (FTP) |
| `sftp_username` | String | Yes | Authentication username | `facility_001` |
| `sftp_password` | String (Encrypted) | Conditional* | Password (if not using key auth) | `[encrypted]` |
| `sftp_private_key_path` | String | Conditional* | Path to SSH private key | `/keys/facility_001.pem` |
| `sftp_input_folder` | String | Yes | Remote folder to poll for input files | `/inbound/837` |
| `sftp_output_folder` | String | Yes | Remote folder to upload processed files | `/outbound/837` |
| `sftp_archive_folder` | String | No | Remote folder for processed originals | `/archive` |
| `sftp_poll_interval_seconds` | Integer | No | Polling frequency (default: 300s = 5min) | `300` |

\* Either `sftp_password` OR `sftp_private_key_path` must be provided.

**Acceptance Criteria:**
- Password fields are encrypted using AES-256
- Private key paths are validated at configuration time
- Configuration validation prevents saving invalid settings

---

#### FR-CONFIG-003: Local File System Configuration
**Priority:** P0 (Critical)
**Description:** For facilities using `LOCAL_FOLDER` mode, the following fields must be configurable:

| Field Name | Type | Required | Description | Example |
|------------|------|----------|-------------|---------|
| `local_enabled` | Boolean | Yes | Enable local folder monitoring | `true` |
| `local_input_folder` | String | Yes | Absolute path to input directory | `/data/837/input` |
| `local_output_folder` | String | Yes | Absolute path to output directory | `/data/837/output` |
| `local_archive_folder` | String | No | Absolute path to archive directory | `/data/837/archive` |
| `local_watch_recursive` | Boolean | No | Watch subdirectories (default: false) | `false` |

**Acceptance Criteria:**
- Paths are validated for existence and write permissions at configuration time
- Relative paths are rejected (must be absolute)
- Archive folder auto-creates if it doesn't exist

---

### 4.2 SFTP Ingestion (FR-SFTP)

#### FR-SFTP-001: Connection Management
**Priority:** P0
**Description:** System must establish and maintain SFTP connections for enabled facilities.

**Acceptance Criteria:**
- Support both password and SSH key authentication
- Connection pooling for multiple facilities
- Automatic reconnection on connection loss (max 3 retries with exponential backoff)
- Connection timeout: 30 seconds
- Idle connection reuse for efficiency

---

#### FR-SFTP-002: File Polling
**Priority:** P0
**Description:** System must poll SFTP `input_folder` at configured intervals.

**Processing Logic:**
```
1. Connect to SFTP server
2. List files in input_folder matching pattern (*.837, *.edi, *.txt, *.x12)
3. For each file:
   a. Check if file is stable (no size change for 10 seconds)
   b. Download to temporary staging area
   c. Calculate checksum (SHA-256)
   d. Check for duplicate (based on checksum)
   e. If unique → trigger processing pipeline
   f. If duplicate → log and skip
4. Move processed file to archive_folder (if configured)
5. Close connection
```

**Acceptance Criteria:**
- Only processes files with extensions: `.837`, `.edi`, `.txt`, `.x12`, `.dat`
- Files locked by other processes are skipped with retry on next poll
- Polling runs in background thread per facility
- Graceful shutdown on service stop

---

#### FR-SFTP-003: File Upload
**Priority:** P0
**Description:** After processing (parse → validate → correct → regenerate), system must upload corrected 837 file to SFTP `output_folder`.

**Output File Naming:**
```
{original_filename}_CORRECTED_{timestamp}.837
Example: claim_batch_001.837 → claim_batch_001_CORRECTED_20251014_153045.837
```

**Acceptance Criteria:**
- Corrected file uploaded to configured `output_folder`
- Original file moved to `archive_folder` (if configured)
- Upload failures are retried (max 3 attempts, 5-second delay)
- Transaction logged with upload status

---

### 4.3 Local File System Ingestion (FR-LOCAL)

#### FR-LOCAL-001: Directory Monitoring
**Priority:** P0
**Description:** System must monitor configured `input_folder` using file system events (e.g., `fs.watch` or `chokidar`).

**Trigger Events:**
- File creation (`add` event)
- File rename/move into folder

**Acceptance Criteria:**
- Watcher starts on service boot for enabled facilities
- Only triggers on file extensions: `.837`, `.edi`, `.txt`, `.x12`, `.dat`
- Debounce: Wait 2 seconds after last write event before processing
- Handles file system permission errors gracefully

---

#### FR-LOCAL-002: File Processing
**Priority:** P0
**Description:** When a new file is detected, trigger the standard processing pipeline.

**Processing Flow:**
```
1. Detect new file in input_folder
2. Wait for file to stabilize (no writes for 2 seconds)
3. Move file to staging area (prevent re-processing)
4. Calculate checksum
5. Check for duplicate
6. If unique → trigger processing pipeline
7. Write corrected file to output_folder
8. Move original to archive_folder (if configured)
9. Delete staging file
```

**Acceptance Criteria:**
- Files are moved (not copied) to prevent duplicates
- Staging area is cleaned up even on errors
- Output files use naming convention: `{original}_CORRECTED_{timestamp}.837`

---

### 4.4 Unified Processing Pipeline (FR-PIPELINE)

#### FR-PIPELINE-001: Mode-Agnostic Processing
**Priority:** P0
**Description:** All ingestion modes must use the **exact same** validation and correction pipeline.

**Pipeline Stages:**
```
┌─────────────────────────────────────────────────────────────┐
│  Ingestion Layer (Mode-Specific)                            │
│  - REST API: /api/v1/upload                                 │
│  - SFTP: ftpIngestionService.js                             │
│  - Local: fileWatcherService.js                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Core Processing Pipeline (Mode-Agnostic)                   │
│  1. validateFileImport() - Basic file checks                │
│  2. parse837File() - X12 parsing                            │
│  3. validateX12Structure() - EDI validation                 │
│  4. validateWithLLM() - Semantic validation                 │
│  5. validateClaim() - Business rules                        │
│  6. autoCorrectClaim() - Apply corrections                  │
│  7. generate837File() - Regenerate EDI                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Output Layer (Mode-Specific)                               │
│  - REST API: Return file via download                       │
│  - SFTP: Upload to output_folder                            │
│  - Local: Write to output_folder                            │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- No mode-specific logic in core pipeline modules
- All modes produce byte-identical output for same input
- Processing metadata includes ingestion mode for audit trails

---

#### FR-PIPELINE-002: File Metadata Tracking
**Priority:** P1
**Description:** `UploadFileDetail` table must track ingestion mode and source location.

**New Columns Required:**
```sql
ingestion_mode VARCHAR(20), -- 'REST_API', 'SFTP', 'LOCAL_FOLDER'
source_host VARCHAR(255),   -- SFTP hostname or 'localhost' for local
source_path TEXT,           -- Original remote/local path
```

**Acceptance Criteria:**
- `upload_method` column distinguishes between `WEB_UI`, `SFTP`, `LOCAL_FOLDER`
- `source_path` stored for traceability
- Query reports groupable by ingestion mode

---

### 4.5 Error Handling (FR-ERROR)

#### FR-ERROR-001: Connection Failures
**Priority:** P0
**Description:** System must handle SFTP connection failures gracefully.

**Error Scenarios:**
| Error Type | Handling Strategy | Retry Logic |
|------------|-------------------|-------------|
| Authentication failure | Alert admin, disable polling | No retry |
| Network timeout | Retry with exponential backoff | Max 3 retries, 5s/10s/20s delays |
| Host unreachable | Log error, continue next poll | Retry on next scheduled poll |
| Permission denied | Alert admin, skip folder | No retry for that folder |

**Acceptance Criteria:**
- Errors logged to `FileValidationLog` with severity `ERROR`
- Admin notifications sent for critical failures (auth, permission)
- Polling continues for other facilities even if one fails

---

#### FR-ERROR-002: File Processing Failures
**Priority:** P0
**Description:** If a file fails validation/parsing, it must be quarantined.

**Quarantine Logic:**
```
1. Create quarantine folder: {input_folder}/quarantine/
2. Move failed file to quarantine with timestamp
3. Create .error file with failure details
4. Send notification to facility administrator
5. Log to UploadFileDetail with status 'FAILED'
```

**Error File Format (JSON):**
```json
{
  "original_file": "claim_001.837",
  "failed_at": "2025-10-14T15:30:45Z",
  "ingestion_mode": "SFTP",
  "facility_id": "550e8400-e29b-41d4-a716-446655440000",
  "error_phase": "VALIDATION",
  "error_message": "ISA13 and IEA02 mismatch",
  "stack_trace": "..."
}
```

**Acceptance Criteria:**
- Quarantined files are never re-processed automatically
- Manual review required for quarantined files
- Dashboard displays quarantine count per facility

---

## 5. Technical Architecture

### 5.1 System Components

```
┌──────────────────────────────────────────────────────────────┐
│                     Application Layer                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────┐  ┌──────────────────┐               │
│  │ REST API Service   │  │ Admin Dashboard  │               │
│  │ (Express.js)       │  │ (React/Vue)      │               │
│  └─────────┬──────────┘  └────────┬─────────┘               │
│            │                       │                          │
│            ▼                       ▼                          │
│  ┌──────────────────────────────────────────────┐            │
│  │         Ingestion Manager Service            │            │
│  │  - Mode Router                               │            │
│  │  - Connection Pool Manager                   │            │
│  │  - Scheduler (node-cron)                     │            │
│  └──────────┬───────────────────────────────────┘            │
│             │                                                 │
│    ┌────────┴─────────┬──────────────┐                       │
│    │                  │              │                       │
│    ▼                  ▼              ▼                       │
│ ┌─────────┐  ┌──────────────┐  ┌─────────────┐             │
│ │  REST   │  │     SFTP     │  │Local Folder │             │
│ │ Handler │  │   Polling    │  │  Watcher    │             │
│ │         │  │   Service    │  │  Service    │             │
│ └─────────┘  └──────────────┘  └─────────────┘             │
│      │              │                  │                     │
│      └──────────────┴──────────────────┘                     │
│                     │                                         │
│                     ▼                                         │
│  ┌──────────────────────────────────────────────┐            │
│  │      Core Processing Pipeline                │            │
│  │  - Validation (file, EDI, business, LLM)    │            │
│  │  - Auto-Correction                           │            │
│  │  - 837 Generation                            │            │
│  └──────────┬───────────────────────────────────┘            │
│             │                                                 │
│             ▼                                                 │
│  ┌──────────────────────────────────────────────┐            │
│  │         Database Layer (PostgreSQL)          │            │
│  │  - Facilities (config)                       │            │
│  │  - UploadFileDetail (metadata)               │            │
│  │  - ValidationLogs (errors/warnings)          │            │
│  │  - CorrectionLog (audit trail)               │            │
│  └──────────────────────────────────────────────┘            │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   External Systems                            │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐      │
│  │ SFTP Servers │  │ Local File   │  │ Clearinghouse │      │
│  │ (Trading     │  │ System       │  │ APIs          │      │
│  │  Partners)   │  │              │  │               │      │
│  └──────────────┘  └──────────────┘  └───────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | 18.x+ | Server-side JavaScript |
| Framework | Express.js | 4.x | REST API routing |
| SFTP Client | `ssh2-sftp-client` | 9.x | SFTP operations |
| File Watcher | `chokidar` | 3.x | File system monitoring |
| Scheduler | `node-cron` | 3.x | Polling intervals |
| Encryption | `bcryptjs` | 2.x | Password hashing |
| Database | PostgreSQL | 14+ | Data persistence |
| ORM/Client | `pg` (node-postgres) | 8.x | Database queries |

---

## 6. Database Schema Changes

### 6.1 Facilities Table Enhancement

```sql
-- Add new columns to Facilities table
ALTER TABLE Facilities
ADD COLUMN IF NOT EXISTS ingestion_mode VARCHAR(20) DEFAULT 'REST_API'
    CHECK (ingestion_mode IN ('REST_API', 'SFTP', 'LOCAL_FOLDER'));

ALTER TABLE Facilities
ADD COLUMN IF NOT EXISTS ingestion_config JSONB DEFAULT '{}';

-- Index for filtering by mode
CREATE INDEX idx_facilities_ingestion_mode ON Facilities(ingestion_mode)
WHERE is_active = TRUE;

-- Comment
COMMENT ON COLUMN Facilities.ingestion_mode IS
'Ingestion method: REST_API (default), SFTP, LOCAL_FOLDER';

COMMENT ON COLUMN Facilities.ingestion_config IS
'Mode-specific configuration (SFTP/Local settings)';
```

### 6.2 Ingestion Configuration Schema (JSONB)

#### SFTP Configuration:
```json
{
  "mode": "SFTP",
  "sftp": {
    "enabled": true,
    "host": "ftp.clearinghouse.com",
    "port": 22,
    "username": "facility_001",
    "password_encrypted": "[AES256-encrypted-password]",
    "private_key_path": "/keys/facility_001.pem",
    "input_folder": "/inbound/837",
    "output_folder": "/outbound/837",
    "archive_folder": "/archive",
    "poll_interval_seconds": 300,
    "connection_timeout_seconds": 30,
    "max_retries": 3
  }
}
```

#### Local Folder Configuration:
```json
{
  "mode": "LOCAL_FOLDER",
  "local": {
    "enabled": true,
    "input_folder": "/data/837/input",
    "output_folder": "/data/837/output",
    "archive_folder": "/data/837/archive",
    "watch_recursive": false,
    "debounce_milliseconds": 2000
  }
}
```

### 6.3 UploadFileDetail Table Enhancement

```sql
-- Add source tracking columns
ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS ingestion_mode VARCHAR(20) DEFAULT 'REST_API';

ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS source_host VARCHAR(255);

ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS source_path TEXT;

ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP;

ALTER TABLE UploadFileDetail
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP;

-- Index for reporting
CREATE INDEX idx_upload_file_ingestion_mode ON UploadFileDetail(ingestion_mode);

-- Comments
COMMENT ON COLUMN UploadFileDetail.ingestion_mode IS
'Source ingestion method for this file';

COMMENT ON COLUMN UploadFileDetail.source_host IS
'SFTP hostname or "localhost" for local files';

COMMENT ON COLUMN UploadFileDetail.source_path IS
'Original file path (remote or local)';
```

### 6.4 Ingestion Log Table (NEW)

```sql
-- Track ingestion attempts and errors
CREATE TABLE IF NOT EXISTS IngestionLog (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID REFERENCES Facilities(facility_id) ON DELETE CASCADE,
    ingestion_mode VARCHAR(20) NOT NULL,
    file_name VARCHAR(255),
    source_path TEXT,
    file_size_bytes BIGINT,
    checksum VARCHAR(64),
    status VARCHAR(20), -- 'SUCCESS', 'FAILED', 'DUPLICATE', 'QUARANTINED'
    error_message TEXT,
    error_type VARCHAR(50), -- 'CONNECTION_ERROR', 'VALIDATION_ERROR', etc.
    retry_count INTEGER DEFAULT 0,
    processing_duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_id UUID REFERENCES UploadFileDetail(file_id) -- Link to processed file
);

-- Indexes
CREATE INDEX idx_ingestion_log_facility ON IngestionLog(facility_id, created_at DESC);
CREATE INDEX idx_ingestion_log_status ON IngestionLog(status);
CREATE INDEX idx_ingestion_log_mode ON IngestionLog(ingestion_mode);

-- Comments
COMMENT ON TABLE IngestionLog IS
'Audit trail for all file ingestion attempts across all modes';
```

---

## 7. Module Specifications

### 7.1 ftpIngestionService.js

**Purpose:** SFTP polling and file download/upload operations.

**Module Structure:**
```javascript
// backend/services/ftpIngestionService.js

import Client from 'ssh2-sftp-client';
import pool from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { parse837File } from './parsing837.js';
import { autoCorrectClaim } from './autoCorrection.js';
import { generate837File } from './generate837.js';

/**
 * SFTP Ingestion Service
 * Handles SFTP polling, download, processing, and upload
 */

class FTPIngestionService {
  constructor() {
    this.connections = new Map(); // Facility ID → SFTP Client
    this.pollIntervals = new Map(); // Facility ID → Interval
    this.isShuttingDown = false;
  }

  /**
   * Initialize SFTP polling for all enabled facilities
   */
  async init() {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT facility_id, facility_code, facility_name, ingestion_config
        FROM Facilities
        WHERE ingestion_mode = 'SFTP'
          AND is_active = TRUE
          AND ingestion_config->>'mode' = 'SFTP'
          AND (ingestion_config->'sftp'->>'enabled')::boolean = TRUE
      `);

      for (const facility of result.rows) {
        await this.startPolling(facility);
      }

      console.log(`✓ SFTP polling started for ${result.rows.length} facilities`);
    } finally {
      client.release();
    }
  }

  /**
   * Start polling for a specific facility
   * @param {Object} facility - Facility record with config
   */
  async startPolling(facility) {
    const { facility_id, facility_code, ingestion_config } = facility;
    const sftpConfig = ingestion_config.sftp;

    // Validate configuration
    if (!sftpConfig.host || !sftpConfig.input_folder) {
      console.error(`Invalid SFTP config for facility ${facility_code}`);
      return;
    }

    // Schedule polling
    const intervalSeconds = sftpConfig.poll_interval_seconds || 300;
    const intervalMs = intervalSeconds * 1000;

    const interval = setInterval(async () => {
      if (this.isShuttingDown) return;
      await this.pollFacility(facility);
    }, intervalMs);

    this.pollIntervals.set(facility_id, interval);

    // Immediate first poll
    await this.pollFacility(facility);

    console.log(`✓ Polling started for facility ${facility_code} (interval: ${intervalSeconds}s)`);
  }

  /**
   * Poll SFTP server for new files
   * @param {Object} facility - Facility record
   */
  async pollFacility(facility) {
    const { facility_id, facility_code, ingestion_config } = facility;
    const sftpConfig = ingestion_config.sftp;

    let sftp = null;
    const startTime = Date.now();

    try {
      // Connect to SFTP
      sftp = await this.connect(sftpConfig);

      // List files in input folder
      const files = await sftp.list(sftpConfig.input_folder);
      const validExtensions = ['.837', '.edi', '.txt', '.x12', '.dat'];

      const targetFiles = files.filter(file =>
        file.type === '-' && // Regular file
        validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
      );

      console.log(`Found ${targetFiles.length} files for facility ${facility_code}`);

      // Process each file
      for (const file of targetFiles) {
        await this.processFile(sftp, facility, file, sftpConfig);
      }

    } catch (error) {
      console.error(`SFTP poll error for facility ${facility_code}:`, error.message);
      await this.logIngestionError(facility_id, 'SFTP', null, 'CONNECTION_ERROR', error.message);
    } finally {
      if (sftp) {
        await sftp.end();
      }
      const duration = Date.now() - startTime;
      console.log(`Poll completed for ${facility_code} in ${duration}ms`);
    }
  }

  /**
   * Establish SFTP connection
   * @param {Object} config - SFTP configuration
   * @returns {Promise<Client>} Connected SFTP client
   */
  async connect(config) {
    const sftp = new Client();

    const connectionConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: (config.connection_timeout_seconds || 30) * 1000,
    };

    // Authentication: password or private key
    if (config.private_key_path) {
      connectionConfig.privateKey = await fs.readFile(config.private_key_path, 'utf8');
    } else if (config.password_encrypted) {
      connectionConfig.password = this.decryptPassword(config.password_encrypted);
    } else {
      throw new Error('No authentication method configured');
    }

    await sftp.connect(connectionConfig);
    return sftp;
  }

  /**
   * Process a single file from SFTP
   * @param {Client} sftp - Connected SFTP client
   * @param {Object} facility - Facility record
   * @param {Object} file - File metadata from SFTP
   * @param {Object} config - SFTP configuration
   */
  async processFile(sftp, facility, file, config) {
    const { facility_id, facility_code } = facility;
    const remotePath = `${config.input_folder}/${file.name}`;
    const stagingDir = path.join(process.cwd(), 'temp', 'sftp', facility_id);
    const localPath = path.join(stagingDir, file.name);

    let fileId = null;

    try {
      // Ensure staging directory exists
      await fs.mkdir(stagingDir, { recursive: true });

      // Check file stability (avoid downloading incomplete files)
      await this.waitForFileStability(sftp, remotePath, 10000); // 10s timeout

      // Download file
      console.log(`Downloading ${file.name} from ${facility_code}...`);
      await sftp.get(remotePath, localPath);

      // Calculate checksum
      const fileBuffer = await fs.readFile(localPath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Check for duplicate
      const isDuplicate = await this.checkDuplicate(checksum);
      if (isDuplicate) {
        console.log(`Duplicate file detected: ${file.name} (skipping)`);
        await this.logIngestionError(facility_id, 'SFTP', file.name, 'DUPLICATE', 'File already processed');
        await fs.unlink(localPath); // Cleanup
        return;
      }

      // Insert file record
      fileId = await this.createFileRecord(facility_id, file.name, remotePath, file.size, checksum);

      // Trigger processing pipeline
      await parse837File(fileId, localPath);
      await autoCorrectClaim(fileId, { isTestMode: false, userId: null });

      // Generate corrected 837 file
      const outputFileName = `${path.parse(file.name).name}_CORRECTED_${Date.now()}.837`;
      const outputPath = path.join(stagingDir, outputFileName);

      const client = await pool.connect();
      const { parsed_json } = (await client.query(
        'SELECT parsed_json FROM UploadFileDetail WHERE file_id = $1',
        [fileId]
      )).rows[0];
      client.release();

      await generate837File(parsed_json, outputPath);

      // Upload corrected file to output folder
      const remoteOutputPath = `${config.output_folder}/${outputFileName}`;
      await sftp.put(outputPath, remoteOutputPath);
      console.log(`✓ Uploaded corrected file: ${outputFileName}`);

      // Archive original file (if configured)
      if (config.archive_folder) {
        const archivePath = `${config.archive_folder}/${file.name}`;
        await sftp.rename(remotePath, archivePath);
        console.log(`✓ Archived original file: ${file.name}`);
      } else {
        await sftp.delete(remotePath); // Delete original
      }

      // Cleanup local files
      await fs.unlink(localPath);
      await fs.unlink(outputPath);

      // Log success
      await this.logIngestionSuccess(facility_id, 'SFTP', file.name, remotePath, file.size, checksum, fileId);

    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      await this.quarantineFile(sftp, remotePath, facility_id, file.name, error.message, config);
      await this.logIngestionError(facility_id, 'SFTP', file.name, 'PROCESSING_ERROR', error.message, fileId);
    }
  }

  /**
   * Wait for file to stabilize (no size change)
   * @param {Client} sftp - SFTP client
   * @param {string} remotePath - Remote file path
   * @param {number} timeout - Max wait time in ms
   */
  async waitForFileStability(sftp, remotePath, timeout = 10000) {
    const startTime = Date.now();
    let previousSize = -1;

    while (Date.now() - startTime < timeout) {
      const stat = await sftp.stat(remotePath);
      const currentSize = stat.size;

      if (currentSize === previousSize && currentSize > 0) {
        return true; // Stable
      }

      previousSize = currentSize;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    }

    throw new Error(`File ${remotePath} did not stabilize within ${timeout}ms`);
  }

  /**
   * Check if file checksum exists in database
   * @param {string} checksum - SHA-256 checksum
   * @returns {Promise<boolean>} True if duplicate
   */
  async checkDuplicate(checksum) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT 1 FROM UploadFileDetail WHERE checksum = $1 AND is_deleted = FALSE LIMIT 1',
        [checksum]
      );
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Create file record in UploadFileDetail
   */
  async createFileRecord(facilityId, fileName, sourcePath, fileSize, checksum) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO UploadFileDetail (
          file_name, file_path, file_size_bytes, file_type, upload_method,
          upload_status, ingestion_mode, source_path, checksum, processing_started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING file_id
      `, [
        fileName,
        sourcePath, // Remote path as file_path
        fileSize,
        'X12_837',
        'SFTP',
        'PARSING',
        'SFTP',
        sourcePath,
        checksum
      ]);
      return result.rows[0].file_id;
    } finally {
      client.release();
    }
  }

  /**
   * Quarantine failed file
   */
  async quarantineFile(sftp, remotePath, facilityId, fileName, errorMessage, config) {
    try {
      const quarantineFolder = `${config.input_folder}/quarantine`;
      await sftp.mkdir(quarantineFolder, true); // Create if not exists

      const quarantinePath = `${quarantineFolder}/${fileName}_${Date.now()}.quarantine`;
      await sftp.rename(remotePath, quarantinePath);

      // Create error file
      const errorData = JSON.stringify({
        original_file: fileName,
        failed_at: new Date().toISOString(),
        facility_id: facilityId,
        error_message: errorMessage
      }, null, 2);

      const errorFilePath = `${quarantinePath}.error`;
      await sftp.put(Buffer.from(errorData), errorFilePath);

      console.log(`✓ Quarantined file: ${fileName}`);
    } catch (qError) {
      console.error(`Failed to quarantine file ${fileName}:`, qError);
    }
  }

  /**
   * Log ingestion success
   */
  async logIngestionSuccess(facilityId, mode, fileName, sourcePath, fileSize, checksum, fileId) {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO IngestionLog (
          facility_id, ingestion_mode, file_name, source_path, file_size_bytes,
          checksum, status, file_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS', $7, CURRENT_TIMESTAMP)
      `, [facilityId, mode, fileName, sourcePath, fileSize, checksum, fileId]);
    } finally {
      client.release();
    }
  }

  /**
   * Log ingestion error
   */
  async logIngestionError(facilityId, mode, fileName, errorType, errorMessage, fileId = null) {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO IngestionLog (
          facility_id, ingestion_mode, file_name, status, error_type, error_message, file_id, created_at
        ) VALUES ($1, $2, $3, 'FAILED', $4, $5, $6, CURRENT_TIMESTAMP)
      `, [facilityId, mode, fileName, errorType, errorMessage, fileId]);
    } finally {
      client.release();
    }
  }

  /**
   * Decrypt stored password (AES-256)
   */
  decryptPassword(encryptedPassword) {
    // Implementation depends on encryption strategy
    // Example using crypto module
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(encryptedPassword.slice(0, 32), 'hex');
    const encrypted = encryptedPassword.slice(32);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.isShuttingDown = true;

    // Clear all polling intervals
    for (const [facilityId, interval] of this.pollIntervals) {
      clearInterval(interval);
      console.log(`Stopped polling for facility ${facilityId}`);
    }

    // Close all SFTP connections
    for (const [facilityId, connection] of this.connections) {
      await connection.end();
      console.log(`Closed SFTP connection for facility ${facilityId}`);
    }

    console.log('SFTP Ingestion Service shut down');
  }
}

export default new FTPIngestionService();
```

---

### 7.2 fileWatcherService.js

**Purpose:** Monitor local file system directories for new 837 files.

**Module Structure:**
```javascript
// backend/services/fileWatcherService.js

import chokidar from 'chokidar';
import pool from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { parse837File } from './parsing837.js';
import { autoCorrectClaim } from './autoCorrection.js';
import { generate837File } from './generate837.js';

/**
 * Local File System Watcher Service
 * Monitors local folders for new 837 files
 */

class FileWatcherService {
  constructor() {
    this.watchers = new Map(); // Facility ID → Chokidar watcher
    this.processingFiles = new Set(); // Track files being processed
  }

  /**
   * Initialize file watchers for all enabled facilities
   */
  async init() {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT facility_id, facility_code, facility_name, ingestion_config
        FROM Facilities
        WHERE ingestion_mode = 'LOCAL_FOLDER'
          AND is_active = TRUE
          AND ingestion_config->>'mode' = 'LOCAL_FOLDER'
          AND (ingestion_config->'local'->>'enabled')::boolean = TRUE
      `);

      for (const facility of result.rows) {
        await this.startWatching(facility);
      }

      console.log(`✓ File watching started for ${result.rows.length} facilities`);
    } finally {
      client.release();
    }
  }

  /**
   * Start watching a folder for a specific facility
   * @param {Object} facility - Facility record with config
   */
  async startWatching(facility) {
    const { facility_id, facility_code, ingestion_config } = facility;
    const localConfig = ingestion_config.local;

    // Validate configuration
    if (!localConfig.input_folder || !localConfig.output_folder) {
      console.error(`Invalid local folder config for facility ${facility_code}`);
      return;
    }

    // Ensure folders exist
    await fs.mkdir(localConfig.input_folder, { recursive: true });
    await fs.mkdir(localConfig.output_folder, { recursive: true });
    if (localConfig.archive_folder) {
      await fs.mkdir(localConfig.archive_folder, { recursive: true });
    }

    // Create watcher
    const watcher = chokidar.watch(localConfig.input_folder, {
      ignored: /(^|[\/\\])\../, // Ignore hidden files
      persistent: true,
      ignoreInitial: false, // Process existing files on startup
      awaitWriteFinish: {
        stabilityThreshold: localConfig.debounce_milliseconds || 2000,
        pollInterval: 500
      },
      depth: localConfig.watch_recursive ? undefined : 0 // 0 = no subdirectories
    });

    // Event: File added
    watcher.on('add', async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const validExtensions = ['.837', '.edi', '.txt', '.x12', '.dat'];

      if (!validExtensions.includes(ext)) {
        return; // Skip non-EDI files
      }

      // Prevent duplicate processing
      if (this.processingFiles.has(filePath)) {
        return;
      }

      this.processingFiles.add(filePath);
      await this.processFile(facility, filePath, localConfig);
      this.processingFiles.delete(filePath);
    });

    // Error handling
    watcher.on('error', error => {
      console.error(`Watcher error for facility ${facility_code}:`, error);
    });

    this.watchers.set(facility_id, watcher);
    console.log(`✓ Watching folder for facility ${facility_code}: ${localConfig.input_folder}`);
  }

  /**
   * Process a newly detected file
   * @param {Object} facility - Facility record
   * @param {string} filePath - Absolute path to file
   * @param {Object} config - Local folder configuration
   */
  async processFile(facility, filePath, config) {
    const { facility_id, facility_code } = facility;
    const fileName = path.basename(filePath);
    const stagingPath = path.join(config.input_folder, '.processing', fileName);

    let fileId = null;

    try {
      console.log(`Processing file ${fileName} for facility ${facility_code}...`);

      // Move to staging area (prevents re-triggering watcher)
      await fs.mkdir(path.dirname(stagingPath), { recursive: true });
      await fs.rename(filePath, stagingPath);

      // Calculate checksum
      const fileBuffer = await fs.readFile(stagingPath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const fileSize = fileBuffer.length;

      // Check for duplicate
      const isDuplicate = await this.checkDuplicate(checksum);
      if (isDuplicate) {
        console.log(`Duplicate file detected: ${fileName} (skipping)`);
        await this.logIngestionError(facility_id, 'LOCAL_FOLDER', fileName, 'DUPLICATE', 'File already processed');
        await fs.unlink(stagingPath); // Cleanup
        return;
      }

      // Create file record
      fileId = await this.createFileRecord(facility_id, fileName, filePath, fileSize, checksum);

      // Trigger processing pipeline
      await parse837File(fileId, stagingPath);
      await autoCorrectClaim(fileId, { isTestMode: false, userId: null });

      // Generate corrected 837 file
      const outputFileName = `${path.parse(fileName).name}_CORRECTED_${Date.now()}.837`;
      const outputPath = path.join(config.output_folder, outputFileName);

      const client = await pool.connect();
      const { parsed_json } = (await client.query(
        'SELECT parsed_json FROM UploadFileDetail WHERE file_id = $1',
        [fileId]
      )).rows[0];
      client.release();

      await generate837File(parsed_json, outputPath);
      console.log(`✓ Generated corrected file: ${outputPath}`);

      // Archive original (if configured)
      if (config.archive_folder) {
        const archivePath = path.join(config.archive_folder, fileName);
        await fs.rename(stagingPath, archivePath);
        console.log(`✓ Archived original file: ${archivePath}`);
      } else {
        await fs.unlink(stagingPath); // Delete original
      }

      // Log success
      await this.logIngestionSuccess(facility_id, 'LOCAL_FOLDER', fileName, filePath, fileSize, checksum, fileId);

    } catch (error) {
      console.error(`Error processing file ${fileName}:`, error);
      await this.quarantineFile(stagingPath, facility_id, fileName, error.message, config);
      await this.logIngestionError(facility_id, 'LOCAL_FOLDER', fileName, 'PROCESSING_ERROR', error.message, fileId);
    }
  }

  /**
   * Check if file checksum exists in database
   */
  async checkDuplicate(checksum) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT 1 FROM UploadFileDetail WHERE checksum = $1 AND is_deleted = FALSE LIMIT 1',
        [checksum]
      );
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Create file record in UploadFileDetail
   */
  async createFileRecord(facilityId, fileName, sourcePath, fileSize, checksum) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO UploadFileDetail (
          file_name, file_path, file_size_bytes, file_type, upload_method,
          upload_status, ingestion_mode, source_host, source_path, checksum, processing_started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        RETURNING file_id
      `, [
        fileName,
        sourcePath,
        fileSize,
        'X12_837',
        'LOCAL_FOLDER',
        'PARSING',
        'LOCAL_FOLDER',
        'localhost',
        sourcePath,
        checksum
      ]);
      return result.rows[0].file_id;
    } finally {
      client.release();
    }
  }

  /**
   * Quarantine failed file
   */
  async quarantineFile(stagingPath, facilityId, fileName, errorMessage, config) {
    try {
      const quarantineFolder = path.join(config.input_folder, 'quarantine');
      await fs.mkdir(quarantineFolder, { recursive: true });

      const quarantinePath = path.join(quarantineFolder, `${fileName}_${Date.now()}.quarantine`);
      await fs.rename(stagingPath, quarantinePath);

      // Create error file
      const errorData = JSON.stringify({
        original_file: fileName,
        failed_at: new Date().toISOString(),
        facility_id: facilityId,
        error_message: errorMessage
      }, null, 2);

      const errorFilePath = `${quarantinePath}.error`;
      await fs.writeFile(errorFilePath, errorData, 'utf8');

      console.log(`✓ Quarantined file: ${fileName}`);
    } catch (qError) {
      console.error(`Failed to quarantine file ${fileName}:`, qError);
    }
  }

  /**
   * Log ingestion success
   */
  async logIngestionSuccess(facilityId, mode, fileName, sourcePath, fileSize, checksum, fileId) {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO IngestionLog (
          facility_id, ingestion_mode, file_name, source_path, file_size_bytes,
          checksum, status, file_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS', $7, CURRENT_TIMESTAMP)
      `, [facilityId, mode, fileName, sourcePath, fileSize, checksum, fileId]);
    } finally {
      client.release();
    }
  }

  /**
   * Log ingestion error
   */
  async logIngestionError(facilityId, mode, fileName, errorType, errorMessage, fileId = null) {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO IngestionLog (
          facility_id, ingestion_mode, file_name, status, error_type, error_message, file_id, created_at
        ) VALUES ($1, $2, $3, 'FAILED', $4, $5, $6, CURRENT_TIMESTAMP)
      `, [facilityId, mode, fileName, errorType, errorMessage, fileId]);
    } finally {
      client.release();
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    for (const [facilityId, watcher] of this.watchers) {
      await watcher.close();
      console.log(`Stopped watching for facility ${facilityId}`);
    }
    console.log('File Watcher Service shut down');
  }
}

export default new FileWatcherService();
```

---

## 8. Processing Flow

### 8.1 SFTP Ingestion Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                   SFTP Ingestion Flow                          │
└────────────────────────────────────────────────────────────────┘

[START] → Scheduled Poll (Every 5 min)
   │
   ├─→ [Connect to SFTP Server]
   │   ├─ Auth: Password or SSH Key
   │   ├─ Timeout: 30s
   │   └─ Retry: 3 attempts (5s, 10s, 20s backoff)
   │
   ├─→ [List Files in Input Folder]
   │   ├─ Filter: *.837, *.edi, *.txt, *.x12, *.dat
   │   └─ Sort: By modification time (oldest first)
   │
   ├─→ FOR EACH FILE:
   │   │
   │   ├─→ [Check File Stability]
   │   │   ├─ Wait 10s for size stabilization
   │   │   └─ Skip if still being written
   │   │
   │   ├─→ [Download to Staging]
   │   │   └─ Path: ./temp/sftp/{facility_id}/{filename}
   │   │
   │   ├─→ [Calculate Checksum (SHA-256)]
   │   │
   │   ├─→ [Duplicate Check]
   │   │   ├─ YES → Log & Skip
   │   │   └─ NO → Continue
   │   │
   │   ├─→ [Insert UploadFileDetail Record]
   │   │   ├─ upload_method: 'SFTP'
   │   │   ├─ ingestion_mode: 'SFTP'
   │   │   ├─ source_path: Remote path
   │   │   └─ status: 'PARSING'
   │   │
   │   ├─→ [Trigger Processing Pipeline]
   │   │   ├─ parse837File(fileId, localPath)
   │   │   ├─ validateFileImport()
   │   │   ├─ validateX12Structure()
   │   │   ├─ validateWithLLM()
   │   │   ├─ validateClaim()
   │   │   ├─ autoCorrectClaim()
   │   │   └─ generate837File()
   │   │
   │   ├─→ [Upload Corrected File]
   │   │   ├─ Filename: {original}_CORRECTED_{timestamp}.837
   │   │   ├─ Path: {output_folder}/{filename}
   │   │   └─ Retry: 3 attempts (5s delay)
   │   │
   │   ├─→ [Archive Original]
   │   │   ├─ IF archive_folder configured:
   │   │   │   └─ Move to archive_folder
   │   │   └─ ELSE:
   │   │       └─ Delete from input_folder
   │   │
   │   ├─→ [Cleanup Local Files]
   │   │   ├─ Delete staging file
   │   │   └─ Delete generated output
   │   │
   │   └─→ [Log Success]
   │       └─ IngestionLog: status='SUCCESS'
   │
   ├─→ [Handle Errors]
   │   ├─ Connection Error → Retry on next poll
   │   ├─ Validation Error → Quarantine file
   │   └─ Processing Error → Quarantine file
   │
   └─→ [Close SFTP Connection]
       └─ Wait for next scheduled poll

[END]
```

### 8.2 Local Folder Ingestion Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│               Local Folder Ingestion Flow                      │
└────────────────────────────────────────────────────────────────┘

[START] → File System Event (chokidar)
   │
   ├─→ [Detect New File]
   │   ├─ Event: 'add'
   │   ├─ Filter: *.837, *.edi, *.txt, *.x12, *.dat
   │   └─ Debounce: 2s (wait for write completion)
   │
   ├─→ [Move to Staging Area]
   │   ├─ From: {input_folder}/{filename}
   │   └─ To: {input_folder}/.processing/{filename}
   │
   ├─→ [Calculate Checksum (SHA-256)]
   │
   ├─→ [Duplicate Check]
   │   ├─ YES → Log & Delete
   │   └─ NO → Continue
   │
   ├─→ [Insert UploadFileDetail Record]
   │   ├─ upload_method: 'LOCAL_FOLDER'
   │   ├─ ingestion_mode: 'LOCAL_FOLDER'
   │   ├─ source_host: 'localhost'
   │   ├─ source_path: Original path
   │   └─ status: 'PARSING'
   │
   ├─→ [Trigger Processing Pipeline]
   │   ├─ parse837File(fileId, stagingPath)
   │   ├─ validateFileImport()
   │   ├─ validateX12Structure()
   │   ├─ validateWithLLM()
   │   ├─ validateClaim()
   │   ├─ autoCorrectClaim()
   │   └─ generate837File()
   │
   ├─→ [Write Corrected File]
   │   ├─ Filename: {original}_CORRECTED_{timestamp}.837
   │   └─ Path: {output_folder}/{filename}
   │
   ├─→ [Archive Original]
   │   ├─ IF archive_folder configured:
   │   │   └─ Move to archive_folder
   │   └─ ELSE:
   │       └─ Delete from staging
   │
   ├─→ [Log Success]
   │   └─ IngestionLog: status='SUCCESS'
   │
   ├─→ [Handle Errors]
   │   ├─ Validation Error → Quarantine
   │   └─ Processing Error → Quarantine
   │
   └─→ [Continue Watching]
       └─ Wait for next file event

[END]
```

---

## 9. Configuration Management

### 9.1 Facility Configuration UI Requirements

**Screen:** Facility Settings → Ingestion Configuration

**Fields:**

1. **Ingestion Mode** (Dropdown)
   - Options: REST API, SFTP, Local Folder
   - Default: REST API

2. **SFTP Configuration** (Visible when mode = SFTP)
   - Host* (Text Input)
   - Port* (Number, default: 22)
   - Username* (Text Input)
   - Authentication Method (Radio):
     - Password (requires Password field)
     - SSH Key (requires Private Key Path field)
   - Password (Password Input, encrypted on save)
   - Private Key Path (File Upload or Text Input)
   - Input Folder* (Text Input, e.g., `/inbound/837`)
   - Output Folder* (Text Input, e.g., `/outbound/837`)
   - Archive Folder (Text Input, optional)
   - Poll Interval (Number, seconds, default: 300)

3. **Local Folder Configuration** (Visible when mode = Local Folder)
   - Input Folder* (Text Input, absolute path)
   - Output Folder* (Text Input, absolute path)
   - Archive Folder (Text Input, absolute path, optional)
   - Watch Subdirectories (Checkbox, default: false)

**Validation Rules:**
- All required fields must be filled before saving
- Paths must be absolute (start with `/` or drive letter on Windows)
- SFTP host must be valid hostname or IP
- Port must be 1-65535
- Poll interval must be ≥ 60 seconds
- Test Connection button (pings SFTP or checks local folder access)

### 9.2 Configuration Storage (JSONB Example)

```json
{
  "mode": "SFTP",
  "sftp": {
    "enabled": true,
    "host": "ftp.clearinghouse.com",
    "port": 22,
    "username": "facility_001",
    "auth_method": "ssh_key",
    "password_encrypted": null,
    "private_key_path": "/keys/facility_001.pem",
    "input_folder": "/inbound/837",
    "output_folder": "/outbound/837",
    "archive_folder": "/archive",
    "poll_interval_seconds": 300,
    "connection_timeout_seconds": 30,
    "max_retries": 3
  },
  "local": null
}
```

---

## 10. Error Handling & Retry Logic

### 10.1 SFTP Error Scenarios

| Error Type | HTTP Code (if API) | Handling | Retry | Notification |
|------------|-------------------|----------|-------|--------------|
| Auth Failure (Invalid Credentials) | N/A | Stop polling, alert admin | No | Email + Dashboard Alert |
| Connection Timeout | N/A | Retry with backoff | 3 attempts (5s, 10s, 20s) | Log warning |
| Host Unreachable | N/A | Skip this poll | Retry on next scheduled poll | Log warning |
| Permission Denied (Folder) | N/A | Skip folder, alert admin | No | Email + Dashboard Alert |
| File Download Failed | N/A | Retry | 3 attempts (5s delay) | Log error |
| File Upload Failed | N/A | Retry | 3 attempts (5s delay) | Log error, keep local copy |
| Disk Space Full (Local) | N/A | Pause ingestion, alert admin | No | Email + Dashboard Alert |

### 10.2 Local Folder Error Scenarios

| Error Type | Handling | Retry | Notification |
|------------|----------|-------|--------------|
| Folder Not Found | Alert admin, disable watcher | No | Email + Dashboard Alert |
| Permission Denied (Read) | Alert admin, disable watcher | No | Email + Dashboard Alert |
| Permission Denied (Write) | Alert admin, disable watcher | No | Email + Dashboard Alert |
| File Locked by Another Process | Skip file | Retry on next event | Log warning |
| Disk Space Full | Pause ingestion, alert admin | No | Email + Dashboard Alert |

### 10.3 Retry Strategy Configuration

**Exponential Backoff Formula:**
```javascript
retryDelay = baseDelay * (2 ** attemptNumber)

Example:
Attempt 1: 5s
Attempt 2: 10s
Attempt 3: 20s
```

**Configuration in `.env`:**
```bash
SFTP_MAX_RETRIES=3
SFTP_BASE_RETRY_DELAY_MS=5000
LOCAL_MAX_RETRIES=3
LOCAL_BASE_RETRY_DELAY_MS=5000
```

---

## 11. Logging & Audit Requirements

### 11.1 Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| **INFO** | Normal operations | "File processed successfully" |
| **WARN** | Recoverable issues | "Connection timeout, retrying..." |
| **ERROR** | Failed operations | "Validation failed, file quarantined" |
| **DEBUG** | Development diagnostics | "SFTP command: LIST /inbound" |

### 11.2 Required Log Entries

#### Ingestion Start
```json
{
  "timestamp": "2025-10-14T15:30:45.123Z",
  "level": "INFO",
  "service": "ftpIngestionService",
  "event": "ingestion_start",
  "facility_id": "550e8400-e29b-41d4-a716-446655440000",
  "facility_code": "FAC001",
  "ingestion_mode": "SFTP",
  "message": "Starting SFTP poll for facility FAC001"
}
```

#### File Processed
```json
{
  "timestamp": "2025-10-14T15:31:12.456Z",
  "level": "INFO",
  "service": "ftpIngestionService",
  "event": "file_processed",
  "facility_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_id": "a8b9c0d1-e2f3-4g5h-6i7j-8k9l0m1n2o3p",
  "file_name": "claim_batch_001.837",
  "file_size_bytes": 524288,
  "checksum": "abc123def456...",
  "processing_duration_ms": 27000,
  "status": "SUCCESS",
  "message": "File processed and uploaded to output folder"
}
```

#### Error Occurred
```json
{
  "timestamp": "2025-10-14T15:32:05.789Z",
  "level": "ERROR",
  "service": "ftpIngestionService",
  "event": "processing_error",
  "facility_id": "550e8400-e29b-41d4-a716-446655440000",
  "file_name": "invalid_claim.837",
  "error_type": "VALIDATION_ERROR",
  "error_message": "ISA13 and IEA02 mismatch",
  "stack_trace": "...",
  "action_taken": "QUARANTINED",
  "message": "File validation failed, quarantined for review"
}
```

### 11.3 Audit Trail Requirements

**IngestionLog Table:**
- Every file ingestion attempt must be logged
- Status: SUCCESS, FAILED, DUPLICATE, QUARANTINED
- Searchable by facility, date range, status
- Retention: 2 years

**AuditLog Table:**
- Configuration changes (ingestion mode, SFTP settings, etc.)
- Manual interventions (quarantine review, re-processing)
- Admin actions (disable/enable ingestion)

---

## 12. Security Considerations

### 12.1 Credential Management

**FR-SEC-001: Password Encryption**
- All SFTP passwords must be encrypted using AES-256-CBC
- Encryption key stored in environment variable `ENCRYPTION_KEY` (64-byte hex)
- Passwords never logged in plain text
- UI masks password fields

**FR-SEC-002: SSH Key Storage**
- Private keys stored in secure directory with 600 permissions
- Path validation prevents directory traversal attacks
- Keys never transmitted over network
- Rotation policy: Every 90 days (recommended)

**FR-SEC-003: Secrets Management**
- Use environment variables for sensitive config
- `.env` file excluded from version control
- Production secrets managed via AWS Secrets Manager / Azure Key Vault

### 12.2 Access Control

**FR-SEC-004: File System Permissions**
- Service account runs with minimal privileges
- Input/output folders: 755 (read/execute for service)
- Archive folders: 750 (no public access)
- Quarantine folders: 700 (service account only)

**FR-SEC-005: SFTP User Permissions**
- Dedicated SFTP user per facility (not shared)
- Read-only access to input folder
- Write-only access to output folder
- No shell access (SFTP subsystem only)

### 12.3 Data Protection

**FR-SEC-006: File Integrity**
- Checksum verification (SHA-256) on all transfers
- Detect tampering or corruption
- Log checksum mismatches as critical errors

**FR-SEC-007: PHI Compliance (HIPAA)**
- Ensure all local storage is encrypted at rest
- SFTP connections use TLS/SSL (FTPS) or SSH (SFTP)
- Audit trail for all file access (who, what, when)
- Data retention policy enforced (e.g., 7 years for claims)

**FR-SEC-008: Network Security**
- Whitelist SFTP server IPs in firewall rules
- VPN/VPC for on-premise to cloud connections
- Rate limiting on REST API uploads (prevent DoS)

---

## 13. Developer Task Breakdown

### 13.1 Phase 1: Database Schema & Infrastructure (Week 1)

**Task 1.1: Database Migrations**
- **FR IDs:** FR-CONFIG-001, FR-CONFIG-002, FR-CONFIG-003, FR-PIPELINE-002
- **Owner:** Backend Developer
- **Effort:** 8 hours
- **Deliverables:**
  - Migration script: `add_ingestion_mode_to_facilities.sql`
  - Migration script: `add_ingestion_tracking_to_upload_file_detail.sql`
  - Migration script: `create_ingestion_log_table.sql`
  - Rollback scripts for all migrations
- **Acceptance Criteria:**
  - Migrations run successfully on dev/staging/production
  - Existing data preserved
  - Indexes created for performance

**Task 1.2: Environment Configuration**
- **FR IDs:** FR-SEC-001, FR-SEC-002, FR-SEC-003
- **Owner:** DevOps Engineer
- **Effort:** 4 hours
- **Deliverables:**
  - `.env.example` updated with new variables
  - AWS Secrets Manager integration (for production)
  - Encryption key generation script
- **Acceptance Criteria:**
  - All sensitive configs stored securely
  - Development environment uses `.env`
  - Production uses Secrets Manager

---

### 13.2 Phase 2: SFTP Ingestion Module (Week 2-3)

**Task 2.1: SFTP Connection Manager**
- **FR IDs:** FR-SFTP-001
- **Owner:** Backend Developer
- **Effort:** 16 hours
- **Deliverables:**
  - `ftpIngestionService.js` (connection logic)
  - Unit tests for connection/auth
  - Connection pooling implementation
- **Acceptance Criteria:**
  - Supports password and SSH key auth
  - Connection timeout enforced
  - Retry logic with exponential backoff

**Task 2.2: SFTP Polling Logic**
- **FR IDs:** FR-SFTP-002, FR-ERROR-001
- **Owner:** Backend Developer
- **Effort:** 24 hours
- **Deliverables:**
  - Polling scheduler (node-cron)
  - File listing and filtering
  - File stability checks
  - Duplicate detection
- **Acceptance Criteria:**
  - Polls at configured intervals
  - Only processes stable files
  - Duplicates logged and skipped

**Task 2.3: SFTP File Upload & Archiving**
- **FR IDs:** FR-SFTP-003
- **Owner:** Backend Developer
- **Effort:** 16 hours
- **Deliverables:**
  - Upload corrected file to output folder
  - Archive original file
  - Cleanup local staging area
- **Acceptance Criteria:**
  - Output files use correct naming convention
  - Archiving works with/without configured folder
  - Local files cleaned up on success/failure

**Task 2.4: SFTP Error Handling & Quarantine**
- **FR IDs:** FR-ERROR-001, FR-ERROR-002
- **Owner:** Backend Developer
- **Effort:** 12 hours
- **Deliverables:**
  - Quarantine logic
  - Error logging to IngestionLog
  - Admin notification system (email/Slack)
- **Acceptance Criteria:**
  - Failed files moved to quarantine
  - Error JSON files created
  - Admins notified of critical failures

**Task 2.5: SFTP Integration Testing**
- **FR IDs:** All FR-SFTP-*
- **Owner:** QA Engineer + Backend Developer
- **Effort:** 16 hours
- **Deliverables:**
  - Test SFTP server setup (Docker container)
  - End-to-end test cases
  - Performance test (100 files)
- **Acceptance Criteria:**
  - All happy paths work
  - Error scenarios handled gracefully
  - No memory leaks during long-running tests

---

### 13.3 Phase 3: Local Folder Monitoring Module (Week 3-4)

**Task 3.1: File System Watcher Setup**
- **FR IDs:** FR-LOCAL-001
- **Owner:** Backend Developer
- **Effort:** 12 hours
- **Deliverables:**
  - `fileWatcherService.js` (chokidar integration)
  - Watcher initialization on service boot
  - Event handlers (add, change, unlink)
- **Acceptance Criteria:**
  - Watchers start for all enabled facilities
  - Only triggers on valid file extensions
  - Debounce logic prevents premature processing

**Task 3.2: Local File Processing**
- **FR IDs:** FR-LOCAL-002, FR-ERROR-002
- **Owner:** Backend Developer
- **Effort:** 16 hours
- **Deliverables:**
  - Staging area logic
  - Duplicate detection
  - Quarantine logic
- **Acceptance Criteria:**
  - Files moved to staging (not copied)
  - Duplicates detected and skipped
  - Failed files quarantined

**Task 3.3: Local Folder Integration Testing**
- **FR IDs:** All FR-LOCAL-*
- **Owner:** QA Engineer + Backend Developer
- **Effort:** 12 hours
- **Deliverables:**
  - Automated test scripts (simulate file drops)
  - Edge case testing (locked files, permissions)
  - Performance test (200 files dropped simultaneously)
- **Acceptance Criteria:**
  - All files processed correctly
  - No race conditions
  - Graceful handling of OS-level errors

---

### 13.4 Phase 4: Unified Pipeline Integration (Week 4-5)

**Task 4.1: Refactor Existing Upload Route**
- **FR IDs:** FR-PIPELINE-001, FR-PIPELINE-002
- **Owner:** Backend Developer
- **Effort:** 8 hours
- **Deliverables:**
  - Update `routes/upload.js` to use unified pipeline
  - Add `ingestion_mode` tracking
  - Backward compatibility tests
- **Acceptance Criteria:**
  - Existing API users unaffected
  - REST uploads tracked as `REST_API` mode
  - All tests pass

**Task 4.2: Service Initialization & Lifecycle**
- **FR IDs:** All
- **Owner:** Backend Developer
- **Effort:** 12 hours
- **Deliverables:**
  - Service manager (`ingestionManager.js`)
  - Graceful shutdown handlers
  - Health check endpoints
- **Acceptance Criteria:**
  - All services start on boot
  - Graceful shutdown on SIGTERM/SIGINT
  - Health endpoint reports service status

**Task 4.3: Configuration UI (Frontend)**
- **FR IDs:** FR-CONFIG-001, FR-CONFIG-002, FR-CONFIG-003
- **Owner:** Frontend Developer
- **Effort:** 24 hours
- **Deliverables:**
  - Facility Settings page (React/Vue)
  - Form validation
  - Test Connection button
- **Acceptance Criteria:**
  - UI matches mockups
  - Real-time validation
  - Test Connection pings SFTP/local folder

---

### 13.5 Phase 5: Logging, Monitoring & Documentation (Week 5-6)

**Task 5.1: Logging Infrastructure**
- **FR IDs:** All FR-ERROR-*, All logging requirements
- **Owner:** Backend Developer
- **Effort:** 16 hours
- **Deliverables:**
  - Centralized logging (Winston/Pino)
  - Log rotation policy
  - Log aggregation (ELK/Cloudwatch)
- **Acceptance Criteria:**
  - All logs structured (JSON)
  - Logs rotated daily
  - Searchable in log aggregation system

**Task 5.2: Monitoring & Alerting**
- **FR IDs:** FR-ERROR-001, FR-ERROR-002
- **Owner:** DevOps Engineer
- **Effort:** 12 hours
- **Deliverables:**
  - Metrics dashboard (Grafana)
  - Alerts for critical errors (PagerDuty/Slack)
  - SLA monitoring (uptime, processing time)
- **Acceptance Criteria:**
  - Dashboard shows real-time metrics
  - Alerts trigger within 5 minutes of error
  - Historical data retained for 90 days

**Task 5.3: Developer Documentation**
- **FR IDs:** All
- **Owner:** Technical Writer + Lead Developer
- **Effort:** 16 hours
- **Deliverables:**
  - API documentation (Swagger/OpenAPI)
  - Configuration guide
  - Troubleshooting guide
- **Acceptance Criteria:**
  - Documentation covers all features
  - Code examples provided
  - Troubleshooting section includes common issues

**Task 5.4: User Documentation**
- **FR IDs:** All
- **Owner:** Technical Writer
- **Effort:** 12 hours
- **Deliverables:**
  - Admin guide (configuration)
  - Operations guide (monitoring)
  - FAQ section
- **Acceptance Criteria:**
  - Step-by-step screenshots
  - Common workflows documented
  - Reviewed by product owner

---

## 14. Testing Strategy

### 14.1 Unit Tests

**Coverage Target:** 80% code coverage

**Test Cases:**
- SFTP connection (password auth, key auth, timeout, retry)
- File polling (list files, filter, stability check)
- Checksum calculation & duplicate detection
- Quarantine logic
- File system watcher (add event, debounce, cleanup)
- Pipeline integration (all modes)

**Tools:**
- Jest (test framework)
- Sinon (mocking)
- Coverage: Istanbul/NYC

---

### 14.2 Integration Tests

**Test Scenarios:**

1. **SFTP End-to-End**
   - Start SFTP test server (Docker)
   - Upload test 837 file to input folder
   - Verify file downloaded, processed, corrected, uploaded
   - Verify original archived
   - Verify logs created

2. **Local Folder End-to-End**
   - Create test folders
   - Drop test 837 file into input folder
   - Verify watcher triggers
   - Verify processing completes
   - Verify output file created

3. **REST API Compatibility**
   - Upload file via REST API
   - Verify `ingestion_mode = 'REST_API'`
   - Verify pipeline executes identically

4. **Error Scenarios**
   - Invalid file format
   - Duplicate file
   - SFTP connection failure
   - Disk space full
   - Permission denied

**Tools:**
- Supertest (API testing)
- Docker Compose (test infrastructure)
- Test fixtures (sample 837 files)

---

### 14.3 Performance Tests

**Test Cases:**

1. **SFTP Throughput**
   - Scenario: 100 files (each 500KB) in input folder
   - Expected: All processed within 30 minutes
   - Metrics: Avg processing time per file, memory usage

2. **Local Folder Throughput**
   - Scenario: 200 files dropped simultaneously
   - Expected: All processed within 20 minutes
   - Metrics: Watcher responsiveness, CPU usage

3. **Concurrent Facilities**
   - Scenario: 10 facilities with SFTP/Local enabled
   - Expected: No interference between facilities
   - Metrics: Processing time per facility, error rate

**Tools:**
- Apache JMeter (load testing)
- k6 (performance testing)
- Monitoring: Grafana + Prometheus

---

## 15. Deployment Plan

### 15.1 Pre-Deployment Checklist

- [ ] All database migrations tested on staging
- [ ] Environment variables configured (production secrets)
- [ ] SFTP credentials validated
- [ ] Local folders created with correct permissions
- [ ] Encryption keys generated and stored securely
- [ ] Health check endpoints verified
- [ ] Monitoring dashboards configured
- [ ] Alerting rules set up
- [ ] Rollback plan documented
- [ ] Stakeholders notified of deployment window

---

### 15.2 Deployment Steps

**Phase 1: Database Migration (1 hour)**
```bash
# Staging
npm run migrate:staging

# Production (after verification)
npm run migrate:production
```

**Phase 2: Deploy Backend Services (2 hours)**
```bash
# Build application
npm run build

# Deploy to production (zero-downtime rolling update)
kubectl apply -f k8s/deployment.yaml

# Verify health
curl https://api.example.com/health
```

**Phase 3: Initialize Ingestion Services (30 minutes)**
```bash
# Start SFTP polling (auto-starts on boot)
# Start file watchers (auto-starts on boot)

# Verify services running
curl https://api.example.com/health/ingestion
```

**Phase 4: Smoke Testing (1 hour)**
- Upload test file via REST API → Verify success
- Drop test file in local folder → Verify processing
- Upload test file to SFTP → Verify download & processing

**Phase 5: Monitor & Validate (24 hours)**
- Monitor logs for errors
- Check ingestion metrics dashboard
- Verify alerts trigger correctly

---

### 15.3 Rollback Plan

**Trigger Conditions:**
- Critical errors in production (> 10% failure rate)
- Data corruption detected
- Performance degradation (> 50% slower)

**Rollback Steps:**
1. Stop new ingestion services (kill processes)
2. Revert database migrations (run rollback scripts)
3. Redeploy previous application version
4. Verify REST API still functional
5. Notify stakeholders

**Recovery Time Objective (RTO):** 30 minutes

---

## 16. Appendices

### 16.1 Glossary

| Term | Definition |
|------|------------|
| **837 File** | X12 EDI transaction set for healthcare claim submissions |
| **SFTP** | Secure File Transfer Protocol (SSH-based) |
| **Polling** | Periodically checking a source for new data |
| **Quarantine** | Isolating failed files for manual review |
| **Checksum** | Hash value (SHA-256) used to verify file integrity |
| **Debounce** | Delaying action until a period of inactivity |
| **Ingestion** | Process of importing external data into the system |

---

### 16.2 Configuration Examples

#### SFTP Configuration (Production)
```json
{
  "mode": "SFTP",
  "sftp": {
    "enabled": true,
    "host": "secure.clearinghouse.com",
    "port": 22,
    "username": "production_user",
    "auth_method": "ssh_key",
    "private_key_path": "/secure/keys/prod_key.pem",
    "input_folder": "/prod/inbound/837",
    "output_folder": "/prod/outbound/837",
    "archive_folder": "/prod/archive/837",
    "poll_interval_seconds": 300,
    "connection_timeout_seconds": 30,
    "max_retries": 3
  }
}
```

#### Local Folder Configuration (On-Premise)
```json
{
  "mode": "LOCAL_FOLDER",
  "local": {
    "enabled": true,
    "input_folder": "/mnt/edi/inbound",
    "output_folder": "/mnt/edi/outbound",
    "archive_folder": "/mnt/edi/archive",
    "watch_recursive": false,
    "debounce_milliseconds": 2000
  }
}
```

---

### 16.3 SQL Query Examples

#### Get Ingestion Statistics (Last 7 Days)
```sql
SELECT
  f.facility_code,
  f.facility_name,
  f.ingestion_mode,
  COUNT(*) FILTER (WHERE il.status = 'SUCCESS') as successful_files,
  COUNT(*) FILTER (WHERE il.status = 'FAILED') as failed_files,
  COUNT(*) FILTER (WHERE il.status = 'DUPLICATE') as duplicate_files,
  COUNT(*) FILTER (WHERE il.status = 'QUARANTINED') as quarantined_files,
  AVG(il.processing_duration_ms) as avg_processing_ms
FROM Facilities f
LEFT JOIN IngestionLog il ON f.facility_id = il.facility_id
WHERE il.created_at >= NOW() - INTERVAL '7 days'
GROUP BY f.facility_id, f.facility_code, f.facility_name, f.ingestion_mode
ORDER BY successful_files DESC;
```

#### Find Files Stuck in Processing
```sql
SELECT
  file_id,
  file_name,
  ingestion_mode,
  upload_status,
  processing_started_at,
  EXTRACT(EPOCH FROM (NOW() - processing_started_at)) / 60 as minutes_stuck
FROM UploadFileDetail
WHERE upload_status = 'PARSING'
  AND processing_started_at < NOW() - INTERVAL '1 hour'
ORDER BY processing_started_at;
```

---

### 16.4 Environment Variables

```bash
# Encryption
ENCRYPTION_KEY=64_byte_hex_key_here

# SFTP Defaults
SFTP_MAX_RETRIES=3
SFTP_BASE_RETRY_DELAY_MS=5000
SFTP_CONNECTION_TIMEOUT_SECONDS=30
SFTP_DEFAULT_POLL_INTERVAL_SECONDS=300

# Local Folder Defaults
LOCAL_MAX_RETRIES=3
LOCAL_BASE_RETRY_DELAY_MS=5000
LOCAL_DEBOUNCE_MS=2000

# Paths
TEMP_DIR=./temp
STAGING_DIR=./temp/staging
OUTPUT_DIR=./output

# Logging
LOG_LEVEL=info  # debug, info, warn, error
LOG_ROTATION_MAX_SIZE=100M
LOG_RETENTION_DAYS=90

# Monitoring
HEALTH_CHECK_PORT=8080
METRICS_PORT=9090
```

---

### 16.5 API Endpoints

#### GET /health/ingestion
**Description:** Health check for ingestion services

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "sftp": {
      "status": "running",
      "active_facilities": 5,
      "last_poll": "2025-10-14T15:45:00Z"
    },
    "local_folder": {
      "status": "running",
      "active_watchers": 3,
      "last_event": "2025-10-14T15:44:30Z"
    }
  },
  "timestamp": "2025-10-14T15:45:10Z"
}
```

#### GET /api/v1/facilities/{facilityId}/ingestion/status
**Description:** Get ingestion status for a facility

**Response:**
```json
{
  "facility_id": "550e8400-e29b-41d4-a716-446655440000",
  "ingestion_mode": "SFTP",
  "is_enabled": true,
  "last_successful_ingestion": "2025-10-14T15:30:00Z",
  "total_files_processed": 1523,
  "total_files_failed": 12,
  "avg_processing_time_ms": 18500,
  "quarantined_files": 3
}
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-14 | AI Assistant | Initial draft - Full FRD/TSD |

---

**END OF DOCUMENT**
