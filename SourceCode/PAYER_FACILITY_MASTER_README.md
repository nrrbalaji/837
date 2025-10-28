# Payer & Facility Master Screens

## Overview

Two comprehensive admin screens for managing healthcare payers and facilities in the 837 Claim Processing Platform.

### ✨ Features

**Payer Master:**
- Complete CRUD operations for insurance payers
- Multi-tab form (General, Contact/Address, Transmission/Integration, Metadata)
- SFTP/API connection testing
- Advanced filtering and search
- Pagination and sorting
- Bulk operations support
- Audit trail tracking

**Facility Master:**
- Complete CRUD operations for healthcare facilities
- Multi-tab form (General, Address/Contact, Operational, Audit)
- Payer linking and management
- NPI and Tax ID validation
- Advanced filtering and search
- Pagination and sorting
- Background relink job notifications

---

## 🎨 Design Highlights

### Color Theme
- **Payer Master**: Teal/Cyan gradient (`from-teal-600 to-cyan-700`)
- **Facility Master**: Blue/Indigo gradient (`from-blue-600 to-indigo-700`)
- Professional healthcare-focused palette
- Consistent with existing Provider Master design

### UI Components
- Rounded cards with shadows
- Gradient headers and buttons
- Toast notifications for user feedback
- Empty states with helpful prompts
- Responsive grid layouts
- Accessible form controls

---

## 📁 File Structure

```
frontend/src/pages/
├── PayerMaster.tsx          # Payer management UI
├── FacilityMaster.tsx       # Facility management UI
└── ProviderProfileMaster.tsx # Existing provider UI

backend/
├── services/
│   ├── payerService.js      # Payer business logic
│   └── facilityService.js   # Facility business logic (updated)
├── routes/
│   ├── payers.js            # Payer API endpoints
│   └── facilities.js        # Facility API endpoints (updated)
└── server.js                # Updated with payer routes
```

---

## 🔌 API Endpoints

### Payers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/payers` | Get all payers with filters/pagination |
| GET | `/api/v1/payers/:id` | Get payer by ID |
| POST | `/api/v1/payers` | Create new payer |
| PUT | `/api/v1/payers/:id` | Update payer |
| DELETE | `/api/v1/payers/:id` | Soft delete payer |
| POST | `/api/v1/payers/test-connection` | Test transmission connection |

**Query Parameters (GET):**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `sortField` - Field to sort by
- `sortOrder` - asc or desc
- `search` - Search in name/code/electronic ID
- `payerType` - Filter by payer type
- `transmissionMethod` - Filter by transmission method
- `state` - Filter by state
- `isActive` - Filter by active status
- `dateFrom` / `dateTo` - Date range filter

### Facilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/facilities` | Get all facilities with filters/pagination |
| GET | `/api/v1/facilities/:id` | Get facility by ID |
| POST | `/api/v1/facilities` | Create new facility |
| PUT | `/api/v1/facilities/:id` | Update facility |
| DELETE | `/api/v1/facilities/:id` | Soft delete facility |

**Query Parameters (GET):**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `sortField` - Field to sort by
- `sortOrder` - asc or desc
- `search` - Search in name/code/NPI/Tax ID
- `facilityType` - Filter by facility type
- `state` - Filter by state
- `isActive` - Filter by active status

---

## 📊 Database Schema Mapping

### Payer Table Fields

```typescript
interface Payer {
  payer_id: UUID;              // Primary key
  payer_code: string;          // Unique identifier
  payer_name: string;          // Display name
  payer_type: string;          // Medicare, Medicaid, Commercial, etc.
  trading_partner_id: string;  // Trading partner identifier
  electronic_payer_id: string; // Electronic payer ID
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;               // 2-char state code
  zip_code: string;
  phone: string;
  fax: string;
  email: string;
  transmission_method: string; // SFTP, API, HL7, FHIR, Manual
  endpoint_url: string;
  sftp_config: JSONB;          // SFTP configuration object
  is_active: boolean;
  created_at: timestamp;
  updated_at: timestamp;
  created_by: UUID;
  updated_by: UUID;
}
```

### Facility Table Fields

```typescript
interface Facility {
  facility_id: UUID;           // Primary key
  facility_code: string;       // Unique identifier
  facility_name: string;       // Display name
  npi: string;                 // 10-digit NPI (validated)
  tax_id: string;              // Required Tax ID
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;               // 2-char state code
  zip_code: string;
  phone: string;
  fax: string;
  email: string;
  facility_type: string;       // Hospital, Clinic, etc.
  is_active: boolean;
  created_at: timestamp;
  updated_at: timestamp;
  created_by: UUID;
  updated_by: UUID;
}
```

---

## ✅ Form Validations

### Payer Master

**Required Fields:**
- Payer Code
- Payer Name
- Payer Type
- Electronic Payer ID

**Format Validations:**
- Email: Standard email regex
- ZIP Code: `12345` or `12345-6789` format
- Endpoint URL: Must start with `http://` or `https://`

**Business Rules:**
- Unique payer_code check (409 conflict response)
- SFTP config required when transmission_method = 'SFTP'

### Facility Master

**Required Fields:**
- Facility Code
- Facility Name
- Facility Type
- NPI (10 digits)
- Tax ID

**Format Validations:**
- NPI: Must be exactly 10 numeric digits
- Email: Standard email regex
- ZIP Code: `12345` or `12345-6789` format

**Business Rules:**
- Unique facility_code check (409 conflict response)
- NPI format validation (10 digits only)

---

## 🎯 Key Features

### 1. Advanced Search & Filtering

Both screens include comprehensive search panels with:
- Text search across multiple fields
- Type/category dropdowns
- State selector
- Active/Inactive status filter
- Date range filtering (Payer Master)

### 2. Multi-Tab Modal Forms

**Payer Master Tabs:**
1. **General Info** - Basic payer details
2. **Contact & Address** - Location and contact information
3. **Transmission/Integration** - Connection settings with test button
4. **Metadata & Audit** - Notes and audit trail

**Facility Master Tabs:**
1. **General Info** - Basic facility details
2. **Address & Contact** - Location and contact person
3. **Operational** - Active status, billing location, payer linking
4. **Audit** - Change history and notes

### 3. Connection Testing (Payer Master)

The Transmission/Integration tab includes a "Test Connection" button that:
- Validates transmission settings
- Tests SFTP/API connectivity
- Shows real-time loading spinner
- Displays success/failure toast notifications

### 4. Payer Linking (Facility Master)

Facilities can be linked to multiple payers through:
- Checkbox list of all available payers
- Quick visual selection
- Background relink job triggered on save

### 5. Bulk Operations

Header action buttons support:
- Import CSV (placeholder)
- Export CSV (placeholder)
- Bulk Deactivate (Payer)
- Bulk Re-link (Facility)

### 6. Toast Notifications

Three types of notifications:
- ✅ **Success** - Green (operations completed)
- ❌ **Error** - Red (validation or operation failures)
- ℹ️ **Info** - Blue (background jobs, warnings)

Auto-dismiss after 5 seconds with manual close option.

### 7. Pagination & Sorting

- Navigate through large datasets
- Click column headers to sort
- Visual sort direction indicators (↑↓)
- Page info display
- Configurable page size (default: 20)

### 8. Empty States

Helpful prompts when no data exists:
- Icon illustration
- Descriptive message
- Quick "Add" button to get started

---

## 🚀 Usage Instructions

### 1. Run Database Migration

First, ensure the `facility_id` column exists in the Provider table:

```bash
# Using the HTML migration tool
1. Open run-migration.html in browser
2. Enter your auth token
3. Click "Run Migration"

# Or via API
curl -X POST http://localhost:3000/api/v1/migrations/add-facility-to-provider \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Start the Backend

```bash
cd backend
npm start
```

The server will now include payer routes at:
- `http://localhost:3000/api/v1/payers`
- `http://localhost:3000/api/v1/facilities` (updated)

### 3. Access the Screens

Navigate to:
- Payer Master: `/payers` (add route to your router)
- Facility Master: `/facilities` (add route to your router)

### 4. Add Routes to React Router

Update your frontend router configuration:

```typescript
import PayerMaster from './pages/PayerMaster';
import FacilityMaster from './pages/FacilityMaster';

// Add to your routes
<Route path="/payers" element={<PayerMaster />} />
<Route path="/facilities" element={<FacilityMaster />} />
```

---

## 🔒 Security Considerations

### Authentication
All API endpoints require JWT authentication via the `authenticateToken` middleware.

### SFTP Credentials
- Passwords are stored in JSONB format
- **TODO**: Implement encryption for sensitive fields
- Consider using environment variables or secrets manager

### Audit Trail
All create/update/delete operations track:
- User ID (`created_by`, `updated_by`)
- Timestamps (`created_at`, `updated_at`)
- Can be extended with detailed change logs

### Soft Deletes
Instead of hard deletes, records are marked `is_active = false`:
- Preserves data integrity
- Maintains referential relationships
- Enables audit trail
- Allows data recovery

---

## 📝 Example Payloads

### Create Payer

```json
{
  "payer_code": "BCBS001",
  "payer_name": "Blue Cross Blue Shield",
  "payer_type": "Commercial",
  "trading_partner_id": "87726",
  "electronic_payer_id": "00590",
  "address_line1": "1 Blue Cross Plaza",
  "city": "Chicago",
  "state": "IL",
  "zip_code": "60606",
  "phone": "(312) 440-6000",
  "email": "claims@bcbs.com",
  "transmission_method": "SFTP",
  "endpoint_url": "sftp://claims.bcbs.com",
  "sftp_config": {
    "host": "claims.bcbs.com",
    "port": 22,
    "username": "claims_user",
    "password": "encrypted_password",
    "remotePath": "/incoming"
  },
  "is_active": true
}
```

### Create Facility

```json
{
  "facility_code": "FAC001",
  "facility_name": "St. Mary's Hospital",
  "facility_type": "Hospital",
  "npi": "1234567890",
  "tax_id": "12-3456789",
  "address_line1": "123 Medical Center Dr",
  "city": "Boston",
  "state": "MA",
  "zip_code": "02115",
  "phone": "(617) 555-1234",
  "email": "billing@stmarys.org",
  "is_active": true,
  "contact_person": "John Smith",
  "default_billing_location": true,
  "linked_payers": ["payer-uuid-1", "payer-uuid-2"]
}
```

---

## 🧪 Testing

### Manual Testing Checklist

**Payer Master:**
- [ ] Create new payer with all required fields
- [ ] Update existing payer
- [ ] Test SFTP connection settings
- [ ] Test API connection settings
- [ ] Filter by payer type
- [ ] Search by name/code/electronic ID
- [ ] Sort by different columns
- [ ] Deactivate payer
- [ ] Verify duplicate code rejection (409)

**Facility Master:**
- [ ] Create new facility with valid NPI
- [ ] Update existing facility
- [ ] Link multiple payers
- [ ] Filter by facility type
- [ ] Search by name/code/NPI/Tax ID
- [ ] Sort by different columns
- [ ] Deactivate facility
- [ ] Verify NPI validation (10 digits)
- [ ] Verify duplicate code rejection (409)

---

## 🎨 UI States Implemented

### Table States
- ✅ Loading (spinner)
- ✅ Empty (no data prompt)
- ✅ Populated (data grid)
- ✅ Row hover effects
- ✅ Sorted columns (visual indicators)

### Modal States
- ✅ Add mode (empty form)
- ✅ Edit mode (pre-filled form)
- ✅ View mode (read-only)
- ✅ Validation errors (red borders + messages)
- ✅ Tab switching

### Special States
- ✅ Connection test loading (spinner)
- ✅ Connection test success (green toast)
- ✅ Connection test failure (red toast)
- ✅ Background job notification (blue toast)

---

## 🔮 Future Enhancements

### Planned Features
1. **CSV Import/Export** - Bulk data management
2. **Bulk Operations UI** - Select multiple rows for batch actions
3. **Advanced Audit Trail** - Detailed change history table
4. **Role-Based Access Control** - Admin/Ops/Analyst visibility
5. **Inline Quick Edit** - Edit key fields without opening modal
6. **Connection Health Monitoring** - Periodic connection tests
7. **Payer-Facility Mapping Table** - Dedicated relationship management
8. **Duplicate Detection** - Smart suggestions during creation
9. **Data Validation Preview** - Pre-import CSV validation
10. **Export Templates** - Downloadable CSV templates

### Technical Debt
- Implement actual SFTP connection testing (currently mocked)
- Add encryption for sensitive SFTP credentials
- Create dedicated audit log table
- Implement background job queue system
- Add unit and integration tests
- Create API documentation (Swagger/OpenAPI)

---

## 📚 Related Documentation

- [Provider Master](./frontend/src/pages/ProviderProfileMaster.tsx) - Similar UI pattern
- [Database Schema](./backend/database/schema.sql) - Full DB structure
- [Migration Guide](./RUN_MIGRATION.md) - Database migration instructions
- [API Documentation](./backend/routes/) - Endpoint details

---

## 🆘 Troubleshooting

### Issue: Payers not loading
**Solution**: Check that payer routes are registered in server.js and the Payer table exists in the database.

### Issue: Facility dropdown empty in Provider form
**Solution**: Run the migration to add `facility_id` column to Provider table.

### Issue: Connection test not working
**Solution**: This is currently a mock implementation. Actual SFTP/API testing requires additional dependencies.

### Issue: 409 Conflict on save
**Solution**: The payer_code or facility_code already exists. Use a unique code.

### Issue: NPI validation failing
**Solution**: Ensure NPI is exactly 10 numeric digits with no spaces or hyphens.

---

## 👥 Contributors

Built for the 837 Claim Processing Platform healthcare RCM application.

---

## 📄 License

Proprietary - Internal use only
