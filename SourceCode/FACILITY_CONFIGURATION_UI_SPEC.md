# Facility Master Screen - Ingestion Configuration UI Specification

## Overview

This document specifies the UI/UX requirements for adding ingestion configuration to the Facility Master screen.

---

## UI Layout

### Facility Form Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Edit Facility: Main Hospital (FAC001)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ 📋 Basic Information                                 │   │
│ │ ─────────────────────────────────────────────────── │   │
│ │ Facility Code*:  [FAC001                    ]       │   │
│ │ Facility Name*:  [Main Hospital             ]       │   │
│ │ NPI:             [1234567890               ]       │   │
│ │ Tax ID:          [12-3456789               ]       │   │
│ │ Address:         [123 Main St              ]       │   │
│ │ City, State:     [New York    ] [NY  ] [10001]    │   │
│ │ Phone:           [(555) 123-4567           ]       │   │
│ │ Email:           [admin@hospital.com       ]       │   │
│ │ Facility Type:   [Hospital ▼               ]       │   │
│ │ Status:          ☑ Active                          │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ 📥 File Ingestion Configuration                     │   │
│ │ ─────────────────────────────────────────────────── │   │
│ │                                                      │   │
│ │ Ingestion Mode*:                                    │   │
│ │   ○ REST API Upload (Default)                      │   │
│ │   ● SFTP Server                                     │   │
│ │   ○ Local File System                              │   │
│ │                                                      │   │
│ │ ┌──────────────────────────────────────────────┐   │   │
│ │ │ SFTP Configuration                           │   │   │
│ │ │ ──────────────────────────────────────────── │   │   │
│ │ │ SFTP Host*:        [ftp.clearinghouse.com ] │   │   │
│ │ │ Port*:             [22                    ] │   │   │
│ │ │ Username*:         [facility_001          ] │   │   │
│ │ │                                              │   │   │
│ │ │ Authentication:                              │   │   │
│ │ │   ● Password      ○ SSH Key                 │   │   │
│ │ │                                              │   │   │
│ │ │ Password:          [••••••••••            ] │   │   │
│ │ │                    [Show] [Test Connection] │   │   │
│ │ │                                              │   │   │
│ │ │ Input Folder*:     [/inbound/837          ] │   │   │
│ │ │ Output Folder*:    [/outbound/837         ] │   │   │
│ │ │ Archive Folder:    [/archive              ] │   │   │
│ │ │                    (Optional)               │   │   │
│ │ │                                              │   │   │
│ │ │ Poll Interval:     [5    ] minutes         │   │   │
│ │ │                    (Default: 5 minutes)     │   │   │
│ │ │                                              │   │   │
│ │ │ Connection Timeout:[30   ] seconds         │   │   │
│ │ │ Max Retries:       [3    ]                 │   │   │
│ │ └──────────────────────────────────────────────┘   │   │
│ │                                                      │   │
│ │ [Test Connection] [View Ingestion Status]          │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ [Cancel]                              [Save Changes]       │
└─────────────────────────────────────────────────────────────┘
```

---

## Field Specifications

### Ingestion Mode (Radio Group)

**Field:** `ingestion_mode`
**Type:** Radio buttons (single choice)
**Options:**
- `REST_API` - REST API Upload (Default)
- `SFTP` - SFTP Server
- `LOCAL_FOLDER` - Local File System

**Default:** `REST_API`

**Behavior:**
- When mode changes, show/hide corresponding configuration panel
- Changing mode should prompt user confirmation if unsaved changes exist

---

### SFTP Configuration Panel

**Visibility:** Shown only when `ingestion_mode = 'SFTP'`

#### SFTP Host
- **Field:** `sftp.host`
- **Type:** Text input
- **Required:** Yes (when SFTP mode selected)
- **Validation:** Valid hostname or IP address
- **Example:** `ftp.clearinghouse.com` or `192.168.1.100`

#### Port
- **Field:** `sftp.port`
- **Type:** Number input
- **Required:** Yes
- **Default:** `22`
- **Validation:** 1-65535
- **Example:** `22` (SFTP), `21` (FTP)

#### Username
- **Field:** `sftp.username`
- **Type:** Text input
- **Required:** Yes
- **Validation:** Non-empty, alphanumeric + underscore
- **Example:** `facility_001`

#### Authentication Method
- **Field:** `sftp.auth_method`
- **Type:** Radio buttons
- **Options:**
  - `password` - Password
  - `ssh_key` - SSH Key
- **Default:** `password`

#### Password (if auth_method = password)
- **Field:** `sftp.password`
- **Type:** Password input
- **Required:** Yes (if password auth)
- **Validation:** Minimum 8 characters
- **Features:**
  - Masked by default
  - "Show" button to reveal
  - Stored encrypted (AES-256)
- **Placeholder:** `Enter SFTP password`

#### SSH Key Path (if auth_method = ssh_key)
- **Field:** `sftp.private_key_path`
- **Type:** Text input or file browser
- **Required:** Yes (if SSH key auth)
- **Validation:** Valid absolute file path
- **Example:** `/keys/facility_001.pem`
- **Note:** File must be accessible by server

#### Input Folder
- **Field:** `sftp.input_folder`
- **Type:** Text input
- **Required:** Yes
- **Validation:** Valid absolute path (starts with `/`)
- **Example:** `/inbound/837`
- **Help Text:** "Remote folder to poll for input files"

#### Output Folder
- **Field:** `sftp.output_folder`
- **Type:** Text input
- **Required:** Yes
- **Validation:** Valid absolute path (starts with `/`)
- **Example:** `/outbound/837`
- **Help Text:** "Remote folder to upload processed files"

#### Archive Folder
- **Field:** `sftp.archive_folder`
- **Type:** Text input
- **Required:** No
- **Validation:** Valid absolute path (if provided)
- **Example:** `/archive`
- **Help Text:** "Optional folder to archive original files"

#### Poll Interval
- **Field:** `sftp.poll_interval_seconds`
- **Type:** Number input (minutes)
- **Required:** No
- **Default:** `5` minutes (300 seconds)
- **Validation:** Minimum 1 minute (60 seconds)
- **Display:** Convert seconds ↔ minutes
- **Example:** `5` minutes
- **Help Text:** "How often to check for new files"

#### Connection Timeout
- **Field:** `sftp.connection_timeout_seconds`
- **Type:** Number input
- **Required:** No
- **Default:** `30` seconds
- **Validation:** 5-300 seconds
- **Example:** `30`

#### Max Retries
- **Field:** `sftp.max_retries`
- **Type:** Number input
- **Required:** No
- **Default:** `3`
- **Validation:** 1-10
- **Example:** `3`

---

### Local Folder Configuration Panel

**Visibility:** Shown only when `ingestion_mode = 'LOCAL_FOLDER'`

#### Input Folder
- **Field:** `local.input_folder`
- **Type:** Text input with folder browser
- **Required:** Yes
- **Validation:** Valid absolute path, folder must exist
- **Example:** `/data/837/input`
- **Platform-specific:**
  - Windows: `D:\Data\837\Input`
  - Linux/Mac: `/data/837/input`

#### Output Folder
- **Field:** `local.output_folder`
- **Type:** Text input with folder browser
- **Required:** Yes
- **Validation:** Valid absolute path, folder must exist
- **Example:** `/data/837/output`

#### Archive Folder
- **Field:** `local.archive_folder`
- **Type:** Text input with folder browser
- **Required:** No
- **Validation:** Valid absolute path (if provided)
- **Example:** `/data/837/archive`

#### Watch Subdirectories
- **Field:** `local.watch_recursive`
- **Type:** Checkbox
- **Required:** No
- **Default:** `false`
- **Label:** "Monitor subdirectories"

#### Debounce (milliseconds)
- **Field:** `local.debounce_milliseconds`
- **Type:** Number input
- **Required:** No
- **Default:** `2000` ms
- **Validation:** 500-10000 ms
- **Example:** `2000`
- **Help Text:** "Wait time after last file write before processing"

---

## Action Buttons

### Test Connection Button

**Location:** Below configuration panel
**Visibility:** Enabled when mode is SFTP or LOCAL_FOLDER
**Behavior:**
1. Click button
2. Show loading spinner
3. Call `POST /api/v1/ingestion/facility/:id/test-connection`
4. Show toast notification:
   - Success: "✓ Connection successful"
   - Error: "✗ Connection failed: [error message]"

**Validation:**
- All required fields must be filled
- Does NOT save configuration
- Tests with current form values

---

### View Ingestion Status Button

**Location:** Below configuration panel
**Visibility:** Always visible (disabled if facility not saved)
**Behavior:**
1. Click button
2. Open modal/drawer showing:
   - Current ingestion mode
   - Last successful ingestion timestamp
   - Total files processed (7 days)
   - Failed files count
   - Quarantined files count
   - Service status (running/stopped)

**API Call:** `GET /api/v1/ingestion/facility/:id/status`

---

### Save Changes Button

**Location:** Bottom right
**Behavior:**
1. Validate all required fields
2. Show confirmation modal if changing ingestion mode
3. Call `PUT /api/v1/facilities/:id` with:
   - Basic facility data
   - `ingestion_mode`
   - `ingestion_config` (JSONB)
4. On success:
   - Show toast: "✓ Facility updated successfully"
   - If mode changed: "Ingestion service restarting..."
   - Redirect to facility list or stay on form
5. On error:
   - Show validation errors inline
   - Show toast: "✗ Failed to update: [error]"

---

## Validation Rules

### Client-Side Validation (Before Submit)

```javascript
// SFTP Mode
if (ingestion_mode === 'SFTP') {
  required: ['host', 'port', 'username', 'input_folder', 'output_folder']

  if (auth_method === 'password') {
    required: ['password']
    rules: password.length >= 8
  }

  if (auth_method === 'ssh_key') {
    required: ['private_key_path']
    rules: private_key_path startsWith '/'
  }

  rules: {
    port: 1 <= port <= 65535
    poll_interval_seconds: >= 60
    input_folder: startsWith '/'
    output_folder: startsWith '/'
    archive_folder: startsWith '/' (if provided)
  }
}

// Local Folder Mode
if (ingestion_mode === 'LOCAL_FOLDER') {
  required: ['input_folder', 'output_folder']

  rules: {
    input_folder: isAbsolutePath && exists
    output_folder: isAbsolutePath && exists
    archive_folder: isAbsolutePath (if provided)
    debounce_milliseconds: 500 <= value <= 10000
  }
}
```

### Server-Side Validation

Backend API validates:
- All required fields present
- Data types correct
- Path formats valid
- For SFTP: Test connection ability (optional)
- For Local: Check folder permissions (optional)

---

## UI States

### Loading States

1. **Initial Load**
   - Show skeleton loader for form
   - Fetch facility data: `GET /api/v1/facilities/:id`

2. **Test Connection**
   - Disable "Test Connection" button
   - Show spinner on button
   - Display progress text: "Testing..."

3. **Saving**
   - Disable all inputs
   - Show spinner on "Save Changes" button
   - Display progress text: "Saving..."

4. **View Status**
   - Show modal with loading spinner
   - Fetch status data

---

### Error States

1. **Field Validation Errors**
   ```
   SFTP Host *
   [                    ]
   ⚠️ Valid hostname or IP required
   ```

2. **Connection Test Failed**
   ```
   Toast Notification (Top Right):
   ┌─────────────────────────────────┐
   │ ✗ Connection Failed             │
   │ Unable to connect to SFTP       │
   │ server. Check credentials.      │
   └─────────────────────────────────┘
   ```

3. **Save Failed**
   ```
   Toast Notification:
   ┌─────────────────────────────────┐
   │ ✗ Failed to Save                │
   │ [Error message from API]        │
   └─────────────────────────────────┘
   ```

---

### Success States

1. **Connection Test Success**
   ```
   Toast Notification:
   ┌─────────────────────────────────┐
   │ ✓ Connection Successful         │
   │ SFTP server is reachable        │
   └─────────────────────────────────┘
   ```

2. **Save Success**
   ```
   Toast Notification:
   ┌─────────────────────────────────┐
   │ ✓ Facility Updated              │
   │ Ingestion service restarting... │
   └─────────────────────────────────┘
   ```

---

## Ingestion Status Modal

### Layout

```
┌──────────────────────────────────────────────────────┐
│ Ingestion Status: Main Hospital (FAC001)      [X]   │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Current Mode: SFTP                                   │
│ Status: ● Running                                    │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ Last 7 Days                                    │  │
│ │ ────────────────────────────────────────────── │  │
│ │ Total Files:          156                      │  │
│ │ Successful:           150  (96.2%)             │  │
│ │ Failed:               3    (1.9%)              │  │
│ │ Duplicates:           2    (1.3%)              │  │
│ │ Quarantined:          1    (0.6%)              │  │
│ │                                                 │  │
│ │ Avg Processing Time:  18.5 seconds             │  │
│ │ Total Bytes:          157 MB                   │  │
│ │                                                 │  │
│ │ Last Success:         2025-10-14 15:25:00      │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ [View Detailed Logs] [Restart Service] [Close]      │
└──────────────────────────────────────────────────────┘
```

---

## Responsive Design

### Desktop (>1200px)
- Two-column layout: Basic Info | Ingestion Config side-by-side
- Full configuration panels expanded

### Tablet (768px - 1200px)
- Single column layout
- Configuration panels collapsed by default (accordion)

### Mobile (<768px)
- Stack all sections vertically
- Accordion-style collapsible sections
- Larger touch targets for buttons
- Simplified folder browser (text input only)

---

## Accessibility

### ARIA Labels
```html
<label for="ingestion_mode">Ingestion Mode</label>
<fieldset aria-labelledby="sftp-config-legend">
  <legend id="sftp-config-legend">SFTP Configuration</legend>
  ...
</fieldset>

<button
  aria-label="Test SFTP connection"
  aria-busy="true"  <!-- when loading -->
  aria-disabled="false"
>
  Test Connection
</button>
```

### Keyboard Navigation
- Tab order: Top to bottom, left to right
- Radio buttons: Arrow keys to navigate
- Form submission: Enter key (when focused on input)
- Modal close: Escape key

### Screen Reader Support
- Announce validation errors
- Announce loading states
- Announce success/error toasts

---

## Color Scheme

### Status Indicators
- **Active/Running:** Green (#10B981)
- **Inactive/Stopped:** Gray (#6B7280)
- **Error/Failed:** Red (#EF4444)
- **Warning:** Yellow (#F59E0B)
- **Info:** Blue (#3B82F6)

### Form Elements
- **Required field asterisk:** Red (#EF4444)
- **Input border (default):** Gray (#D1D5DB)
- **Input border (focus):** Blue (#3B82F6)
- **Input border (error):** Red (#EF4444)
- **Disabled input bg:** Light gray (#F3F4F6)

---

## Security Considerations

### Password Handling
1. **Display:**
   - Masked by default (`type="password"`)
   - "Show" button toggles visibility temporarily
   - Never pre-populate password from server (show "********" placeholder)

2. **Transmission:**
   - Always use HTTPS
   - Send plain text to server (server encrypts)

3. **Storage:**
   - Server stores encrypted (AES-256)
   - Client never caches password

### SSH Key Path
- Validate path exists on server side
- Never expose key contents in API responses
- Check file permissions (should be 600)

---

## API Integration Summary

### Get Facility with Config
```
GET /api/v1/facilities/:id

Response:
{
  "facility_id": "...",
  "facility_code": "FAC001",
  "facility_name": "Main Hospital",
  "ingestion_mode": "SFTP",
  "ingestion_config": {
    "mode": "SFTP",
    "sftp": {
      "enabled": true,
      "host": "ftp.clearinghouse.com",
      "port": 22,
      "username": "facility_001",
      "password_encrypted": "********",  // Masked
      "auth_method": "password",
      "input_folder": "/inbound/837",
      "output_folder": "/outbound/837",
      "archive_folder": "/archive",
      "poll_interval_seconds": 300
    }
  },
  ...
}
```

### Update Facility with Config
```
PUT /api/v1/facilities/:id

Request:
{
  "facility_name": "Main Hospital",
  "ingestion_mode": "SFTP",
  "ingestion_config": {
    "mode": "SFTP",
    "sftp": {
      "enabled": true,
      "host": "ftp.clearinghouse.com",
      "port": 22,
      "username": "facility_001",
      "password": "plain_text_password",  // Server encrypts
      "auth_method": "password",
      "input_folder": "/inbound/837",
      "output_folder": "/outbound/837",
      "poll_interval_seconds": 300
    }
  },
  ...
}

Response:
{
  "message": "Facility updated successfully",
  "facility_id": "...",
  "ingestion_service_restarted": true
}
```

### Test Connection
```
POST /api/v1/ingestion/facility/:id/test-connection

Request:
{
  "ingestion_mode": "SFTP",
  "ingestion_config": {
    "sftp": {
      "host": "ftp.clearinghouse.com",
      "port": 22,
      "username": "facility_001",
      "password": "test_password",
      "input_folder": "/inbound/837"
    }
  }
}

Response (Success):
{
  "success": true,
  "message": "SFTP connection successful"
}

Response (Error):
{
  "success": false,
  "error": "SFTP connection failed",
  "message": "Authentication failed"
}
```

### Get Ingestion Status
```
GET /api/v1/ingestion/facility/:id/status

Response:
{
  "facility_id": "...",
  "facility_code": "FAC001",
  "ingestion_mode": "SFTP",
  "is_enabled": true,
  "last_successful_ingestion": "2025-10-14T15:25:00Z",
  "total_files_processed": 156,
  "total_files_failed": 3,
  "avg_processing_time_ms": 18500,
  "quarantined_files": 1,
  "service_status": {
    "polling_active": true,
    "is_processing": false
  }
}
```

---

## Implementation Notes

### React Component Structure
```
FacilityForm/
├── FacilityBasicInfo.tsx
├── IngestionConfiguration/
│   ├── index.tsx
│   ├── IngestionModeSelector.tsx
│   ├── SftpConfiguration.tsx
│   ├── LocalFolderConfiguration.tsx
│   ├── ConnectionTestButton.tsx
│   └── IngestionStatusModal.tsx
├── hooks/
│   ├── useFacilityForm.ts
│   ├── useIngestionConfig.ts
│   └── useConnectionTest.ts
└── validation/
    └── ingestionSchema.ts
```

### State Management
```typescript
interface FacilityFormState {
  basicInfo: FacilityBasicInfo;
  ingestion_mode: 'REST_API' | 'SFTP' | 'LOCAL_FOLDER';
  ingestion_config: {
    sftp?: SftpConfig;
    local?: LocalConfig;
  };
  isTestingConnection: boolean;
  isSaving: boolean;
  errors: Record<string, string>;
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Validation rules (all fields)
- [ ] Mode switching logic
- [ ] Password masking/revealing
- [ ] Form state management

### Integration Tests
- [ ] API: Get facility with config
- [ ] API: Update facility config
- [ ] API: Test connection (success/failure)
- [ ] API: Get ingestion status

### E2E Tests
- [ ] Create facility with SFTP config
- [ ] Edit facility - change mode
- [ ] Test connection - success flow
- [ ] Test connection - failure flow
- [ ] Save configuration - success
- [ ] View ingestion status modal
- [ ] Form validation errors display

---

**Document Version:** 1.0
**Last Updated:** 2025-10-14
**Status:** Ready for Implementation
