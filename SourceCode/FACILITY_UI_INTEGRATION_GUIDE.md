# Facility Master Screen - Ingestion Configuration Integration Guide

## Overview

This guide explains how to integrate the ingestion configuration UI into your existing Facility Master screen.

---

## Files Created

1. **`FACILITY_CONFIGURATION_UI_SPEC.md`** - Complete UI/UX specification
2. **`frontend/FacilityIngestionConfig.tsx`** - React component implementation

---

## Integration Steps

### Step 1: Install Required Dependencies

```bash
cd frontend
npm install formik yup @mui/material @mui/icons-material axios
```

### Step 2: Add Component to Facility Form

#### Option A: Existing Facility Edit Form

```tsx
// FacilityEditForm.tsx or FacilityForm.tsx

import React, { useState } from 'react';
import FacilityIngestionConfig from './FacilityIngestionConfig';

const FacilityEditForm = ({ facilityId }) => {
  return (
    <Box>
      {/* Existing Basic Information Section */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6">Basic Information</Typography>
          {/* Your existing facility fields */}
          <TextField label="Facility Code" />
          <TextField label="Facility Name" />
          {/* ... other fields ... */}
        </CardContent>
      </Card>

      {/* NEW: Ingestion Configuration Section */}
      <FacilityIngestionConfig
        facilityId={facilityId}
        onSave={(mode, config) => {
          console.log('Configuration saved:', mode, config);
          // Handle save success
        }}
      />

      {/* Save buttons */}
      <Box sx={{ mt: 2 }}>
        <Button variant="contained">Save All Changes</Button>
      </Box>
    </Box>
  );
};
```

#### Option B: Tabbed Interface

```tsx
import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import FacilityIngestionConfig from './FacilityIngestionConfig';

const FacilityEditForm = ({ facilityId }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box>
      <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)}>
        <Tab label="Basic Information" />
        <Tab label="Contact Details" />
        <Tab label="Ingestion Configuration" />
      </Tabs>

      {/* Tab 0: Basic Information */}
      {activeTab === 0 && (
        <Box sx={{ p: 2 }}>
          {/* Your existing facility fields */}
        </Box>
      )}

      {/* Tab 1: Contact Details */}
      {activeTab === 1 && (
        <Box sx={{ p: 2 }}>
          {/* Contact fields */}
        </Box>
      )}

      {/* Tab 2: Ingestion Configuration */}
      {activeTab === 2 && (
        <Box sx={{ p: 2 }}>
          <FacilityIngestionConfig facilityId={facilityId} />
        </Box>
      )}
    </Box>
  );
};
```

---

### Step 3: Update Facility Service API

Ensure your facility update API handles the new fields:

```typescript
// facilityService.ts

export const updateFacility = async (facilityId: string, data: any) => {
  try {
    const response = await axios.put(`/api/v1/facilities/${facilityId}`, {
      // Basic facility fields
      facility_code: data.facility_code,
      facility_name: data.facility_name,
      npi: data.npi,
      // ... other fields ...

      // NEW: Ingestion configuration
      ingestion_mode: data.ingestion_mode,
      ingestion_config: data.ingestion_config,
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};
```

---

### Step 4: Update Facility List View (Optional)

Add an indicator showing the ingestion mode for each facility:

```tsx
// FacilityList.tsx

import { Chip } from '@mui/material';
import { CloudUpload, FolderOpen, Api } from '@mui/icons-material';

const getIngestionModeChip = (mode: string) => {
  switch (mode) {
    case 'SFTP':
      return <Chip label="SFTP" color="primary" size="small" icon={<CloudUpload />} />;
    case 'LOCAL_FOLDER':
      return <Chip label="Local" color="secondary" size="small" icon={<FolderOpen />} />;
    default:
      return <Chip label="API" color="default" size="small" icon={<Api />} />;
  }
};

const FacilityList = () => {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Facility Code</TableCell>
            <TableCell>Facility Name</TableCell>
            <TableCell>Ingestion Mode</TableCell> {/* NEW */}
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {facilities.map((facility) => (
            <TableRow key={facility.facility_id}>
              <TableCell>{facility.facility_code}</TableCell>
              <TableCell>{facility.facility_name}</TableCell>
              <TableCell>{getIngestionModeChip(facility.ingestion_mode)}</TableCell>
              <TableCell>
                <IconButton onClick={() => handleEdit(facility.facility_id)}>
                  <Edit />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
```

---

### Step 5: Add Ingestion Status Dashboard Widget (Optional)

```tsx
// IngestionStatusWidget.tsx

import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress } from '@mui/material';
import { CheckCircle, Error, Warning } from '@mui/icons-material';
import axios from 'axios';

interface IngestionStatus {
  facility_code: string;
  ingestion_mode: string;
  last_successful_ingestion: string;
  total_files_processed: number;
  total_files_failed: number;
}

const IngestionStatusWidget: React.FC<{ facilityId: string }> = ({ facilityId }) => {
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, [facilityId]);

  const loadStatus = async () => {
    try {
      const response = await axios.get(`/api/v1/ingestion/facility/${facilityId}/status`);
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to load ingestion status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (!status || status.ingestion_mode === 'REST_API') {
    return null; // Don't show widget for REST API mode
  }

  const successRate =
    status.total_files_processed > 0
      ? ((status.total_files_processed - status.total_files_failed) /
          status.total_files_processed) *
        100
      : 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Ingestion Status
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {successRate >= 95 ? (
            <CheckCircle color="success" sx={{ mr: 1 }} />
          ) : successRate >= 80 ? (
            <Warning color="warning" sx={{ mr: 1 }} />
          ) : (
            <Error color="error" sx={{ mr: 1 }} />
          )}
          <Typography>
            {status.ingestion_mode} - {successRate.toFixed(1)}% Success Rate
          </Typography>
        </Box>

        <Typography variant="body2" color="textSecondary">
          Last Success: {new Date(status.last_successful_ingestion).toLocaleString()}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Box>
            <Typography variant="body2" color="textSecondary">
              Processed
            </Typography>
            <Typography variant="h6">{status.total_files_processed}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="textSecondary">
              Failed
            </Typography>
            <Typography variant="h6" color="error">
              {status.total_files_failed}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default IngestionStatusWidget;
```

---

## Backend Integration Checklist

Ensure the backend is ready:

- [ ] Database migrations run (`add_multi_mode_ingestion.sql`)
- [ ] Encryption key generated and added to `.env`
- [ ] NPM packages installed (`ssh2-sftp-client`, `chokidar`)
- [ ] Server restarted with ingestion services
- [ ] API endpoints accessible:
  - `GET /api/v1/facilities/:id` (returns `ingestion_mode` and `ingestion_config`)
  - `PUT /api/v1/facilities/:id` (accepts `ingestion_mode` and `ingestion_config`)
  - `POST /api/v1/ingestion/facility/:id/test-connection`
  - `GET /api/v1/ingestion/facility/:id/status`

---

## Testing Steps

### 1. Test Component Rendering

```bash
# Run frontend dev server
cd frontend
npm start

# Navigate to facility edit page
# Verify ingestion configuration section renders
```

### 2. Test SFTP Configuration

1. Select "SFTP Server" mode
2. Fill in all required fields:
   - Host: `ftp.example.com`
   - Port: `22`
   - Username: `test_user`
   - Password: `test_password`
   - Input Folder: `/inbound`
   - Output Folder: `/outbound`
3. Click "Test Connection"
4. Verify success/error message displays

### 3. Test Local Folder Configuration

1. Select "Local File System" mode
2. Fill in required fields:
   - Input Folder: `/data/837/input`
   - Output Folder: `/data/837/output`
3. Click "Test Connection"
4. Verify folder access check works

### 4. Test Save Functionality

1. Configure SFTP or Local Folder mode
2. Click "Save Configuration"
3. Verify toast notification appears
4. Reload page and verify configuration persists
5. Check backend logs for ingestion service restart

### 5. Test Validation

1. Try to save with missing required fields
2. Verify inline error messages appear
3. Try invalid values (e.g., port > 65535)
4. Verify validation prevents save

---

## Customization Options

### Theme Customization

```tsx
// Customize colors to match your theme

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Blue for SFTP
    },
    secondary: {
      main: '#9c27b0', // Purple for Local Folder
    },
    success: {
      main: '#2e7d32', // Green for success states
    },
    error: {
      main: '#d32f2f', // Red for errors
    },
  },
});

<ThemeProvider theme={theme}>
  <FacilityIngestionConfig />
</ThemeProvider>
```

### Custom Field Layout

```tsx
// Adjust Grid spacing for different layouts

<Grid container spacing={3}> {/* Increase spacing */}
  <Grid item xs={12} md={6}> {/* 2-column on desktop */}
    <TextField ... />
  </Grid>
</Grid>
```

### Custom Validation Messages

```tsx
// Modify validation schema

const customSftpSchema = Yup.object({
  host: Yup.string()
    .required('Please enter the SFTP hostname')
    .matches(/^[\w.-]+$/, 'Invalid hostname format'),
  // ... other fields
});
```

---

## Troubleshooting

### Issue: Component not rendering

**Solution:**
- Check import path is correct
- Verify Material-UI is installed
- Check console for errors

### Issue: Test Connection fails with CORS error

**Solution:**
```javascript
// Add CORS headers in backend server.js
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

### Issue: Form validation not working

**Solution:**
- Ensure Formik and Yup are installed
- Check validation schema is correct
- Verify `touched` state is set on blur

### Issue: Password field shows asterisks instead of empty

**Solution:**
```tsx
// Clear password on load
useEffect(() => {
  if (initialConfig?.sftp?.password_encrypted) {
    sftpForm.setFieldValue('password', '');
  }
}, [initialConfig]);
```

---

## Security Best Practices

### 1. Never Log Passwords

```tsx
// BAD
console.log('Form values:', sftpForm.values); // Logs password

// GOOD
console.log('Form values:', {
  ...sftpForm.values,
  password: '[REDACTED]'
});
```

### 2. Clear Password on Unmount

```tsx
useEffect(() => {
  return () => {
    sftpForm.setFieldValue('password', '');
  };
}, []);
```

### 3. Use HTTPS

Ensure your frontend is served over HTTPS in production to encrypt password transmission.

---

## Accessibility Enhancements

### Keyboard Navigation

Already implemented:
- Tab order follows visual flow
- Radio buttons navigable with arrow keys
- Enter key submits form

### Screen Reader Support

Add ARIA labels:

```tsx
<TextField
  label="SFTP Host"
  inputProps={{
    'aria-required': 'true',
    'aria-describedby': 'sftp-host-help'
  }}
/>
<FormHelperText id="sftp-host-help">
  Enter the SFTP server hostname or IP address
</FormHelperText>
```

---

## Performance Optimization

### 1. Lazy Load Component

```tsx
import React, { lazy, Suspense } from 'react';

const FacilityIngestionConfig = lazy(() => import('./FacilityIngestionConfig'));

const FacilityForm = () => (
  <Suspense fallback={<CircularProgress />}>
    <FacilityIngestionConfig facilityId={facilityId} />
  </Suspense>
);
```

### 2. Debounce Test Connection

```tsx
import { debounce } from 'lodash';

const debouncedTestConnection = debounce(handleTestConnection, 1000);
```

---

## Next Steps

1. ✅ Review UI specification
2. ✅ Install dependencies
3. ✅ Integrate component into facility form
4. ✅ Test all ingestion modes
5. ✅ Deploy to staging
6. ✅ Train users
7. ✅ Monitor ingestion statistics

---

## Support

For questions or issues:
- **UI Spec:** `FACILITY_CONFIGURATION_UI_SPEC.md`
- **Component Code:** `frontend/FacilityIngestionConfig.tsx`
- **Backend API:** `backend/routes/ingestion.js`
- **Full FRD:** `FRD_Multi_Mode_Ingestion_Enhancement.md`

---

**Document Version:** 1.0
**Status:** Ready for Integration
