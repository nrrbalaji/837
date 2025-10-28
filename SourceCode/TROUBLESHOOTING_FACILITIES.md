# Troubleshooting: "Failed to fetch facilities" Error

## Quick Diagnosis

Open your browser's **Developer Tools** (F12) and check the **Console** and **Network** tabs for detailed error messages.

---

## Common Issues & Solutions

### 1. **Database Migration Not Run** ⚠️

**Symptom:** Backend errors mentioning "UserFacilityMapping" table doesn't exist

**Solution:**
```bash
# Connect to PostgreSQL
psql -U your_username -d your_database_name

# Run the migration
\i 'D:\AI\from my laptop\837\Source Code\backend\database\migrations\add_user_facility_mapping.sql'

# Verify table was created
\dt UserFacilityMapping
```

Or using command line:
```bash
psql -U your_username -d your_database_name -f "D:\AI\from my laptop\837\Source Code\backend\database\migrations\add_user_facility_mapping.sql"
```

---

### 2. **Backend Server Not Running**

**Symptom:** Network error, ERR_CONNECTION_REFUSED, or timeout

**Solution:**
```bash
# Navigate to backend directory
cd "D:\AI\from my laptop\837\Source Code\backend"

# Start the server
npm start
```

Check that server is running on: `http://10.1.9.210:3000` (or your configured port)

---

### 3. **Facilities Table Empty**

**Symptom:** API returns empty array, no facilities to select

**Solution:**
```sql
-- Check if facilities exist
SELECT COUNT(*) FROM Facilities;

-- If empty, add a test facility
INSERT INTO Facilities (
    facility_code,
    facility_name,
    npi,
    tax_id,
    city,
    state,
    facility_type,
    is_active
) VALUES (
    'FAC001',
    'Test Facility',
    '1234567890',
    '12-3456789',
    'New York',
    'NY',
    'Hospital',
    TRUE
);
```

---

### 4. **CORS/Network Issues**

**Symptom:** CORS error in browser console

**Solution:**
Check `backend/server.js` CORS configuration:
```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
  optionsSuccessStatus: 200,
};
```

Make sure frontend URL matches CORS origin.

---

### 5. **Authentication Token Invalid**

**Symptom:** 401 Unauthorized errors

**Solution:**
1. Logout and login again
2. Check browser localStorage has valid token:
   ```javascript
   // In browser console
   localStorage.getItem('token')
   ```
3. Clear token and re-login:
   ```javascript
   localStorage.removeItem('token')
   ```

---

## Step-by-Step Verification

### Backend Health Check

1. **Test API directly:**
   ```bash
   # Get your auth token first (login via UI or API)
   curl -X GET "http://10.1.9.210:3000/api/v1/facilities" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

2. **Check database connection:**
   ```sql
   -- In psql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('Facilities', 'Users', 'UserFacilityMapping');
   ```

### Frontend Check

1. **Open browser DevTools (F12)**
2. **Go to Network tab**
3. **Try to open User Form (Add User)**
4. **Look for the `/api/v1/facilities` request**
5. **Check:**
   - Status code (should be 200)
   - Response data (should contain facilities array)
   - Headers (should have Authorization header)

---

## Expected API Response

When working correctly, `/api/v1/facilities` should return:

```json
[
  {
    "facility_id": "uuid-here",
    "facility_code": "FAC001",
    "facility_name": "Test Facility",
    "npi": "1234567890",
    "tax_id": "12-3456789",
    "city": "New York",
    "state": "NY",
    "facility_type": "Hospital",
    "is_active": true
  }
]
```

---

## Still Having Issues?

### Enable Debug Logging

**Backend** (`backend/routes/facilities.js`):
```javascript
router.get('/', authenticateToken, masterPermissions.read, async (req, res, next) => {
  console.log('=== Facilities GET Request ===');
  console.log('User:', req.user?.username);
  console.log('User ID:', req.user?.user_id);
  console.log('User Roles:', req.user?.roles);
  // ... rest of code
});
```

**Frontend** (already added in UserForm.tsx):
- Check browser console for "Facilities loaded successfully" or error details

---

## Quick Fix: Bypass Facility Assignment Temporarily

If you need to create users urgently while troubleshooting, the facility assignment is optional. The UserForm will work without it - users just won't have facility-level restrictions.

---

## Contact Points

- **Backend API:** `http://10.1.9.210:3000/api/v1`
- **Frontend:** `http://localhost:5173` (or your Vite dev server)
- **Database:** Check your PostgreSQL connection in `backend/config/database.js`

---

## Verification Commands

```bash
# 1. Check backend is running
curl http://10.1.9.210:3000/health

# 2. Check database tables exist
psql -U your_user -d your_db -c "\dt"

# 3. Check if migration ran
psql -U your_user -d your_db -c "SELECT COUNT(*) FROM UserFacilityMapping"

# 4. Check facilities exist
psql -U your_user -d your_db -c "SELECT COUNT(*) FROM Facilities"
```

---

**Most Common Fix:** Run the database migration! 90% of issues come from the UserFacilityMapping table not existing.
