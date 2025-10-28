# Quick Start - Master Screens Implementation

## ✅ Step 1: Install Dependencies (DONE)
```
✅ json2csv package installed
✅ Server running on port 3000
```

## 📋 Step 2: Run Database Migration

### Option A: Using Windows Batch File (Recommended)
```cmd
run_migration.bat
```

### Option B: Using psql directly
Open **Command Prompt** or **PowerShell** and run:
```cmd
psql -U postgres -d Claim837 -f "backend\database\add_master_tables.sql"
```

### Option C: Using pgAdmin (GUI)
1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Right-click on `Claim837` database → Query Tool
4. Open file: `backend\database\add_master_tables.sql`
5. Click Execute (F5)

**Expected Output:**
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
...
CREATE TRIGGER
INSERT 0 3
```

## 📋 Step 3: Seed Sample Data

### Option A: Using Windows Batch File (Recommended)
```cmd
seed_data.bat
```

### Option B: Using Node directly
```cmd
node backend\database\seed_master_data.js
```

**Expected Output:**
```
🌱 Starting master data seed...

📊 Seeding Trading Partners...
✅ Seeded 2 trading partners

📊 Seeding Payers...
✅ Seeded 2 payers

📊 Seeding Facilities...
✅ Seeded 2 facilities

📊 Seeding Providers...
✅ Seeded 2 providers

📊 Seeding Provider-Payer Mappings...
✅ Seeded 2 provider-payer mappings

✅ Master data seed completed successfully!
```

## 🧪 Step 4: Verify Installation

### Test 1: Check Health Endpoint
```cmd
curl http://localhost:3000/health
```

**Expected:** `{"status":"healthy",...}`

### Test 2: Login to Get Token
```cmd
curl http://localhost:3000/api/v1/auth/login -X POST -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"your_password\"}"
```

### Test 3: Test Trading Partners Endpoint
```cmd
curl http://localhost:3000/api/v1/trading-partners -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected:** List of 2 trading partners (TP0001, TP0002)

## 📊 Verify Database Tables

Open psql or pgAdmin and run:
```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('tradingpartnermaster', 'masterdataauditlog', 'providerpayermapping', 'facilitypayermapping');

-- Check data
SELECT * FROM TradingPartnerMaster;
SELECT * FROM UserRole;
SELECT * FROM ProviderPayerMapping;
```

## 🎯 What's Next?

After completing the migration and seeding:

### Immediate Next Steps:
1. **Add CSV import/export to existing routes** (2-3 hours)
   - See: `CSV_INTEGRATION_GUIDE.md`
   - Files to edit: `backend/routes/providers.js`, `payers.js`, `facilities.js`

2. **Test the implementation** (1 hour)
   - Test Trading Partner CRUD operations
   - Test CSV import/export
   - Test RBAC permissions
   - Test audit logging

### Frontend Development:
3. **Create Trading Partner Master UI** (4 hours)
   - File: `frontend/src/pages/TradingPartnerMaster.tsx`
   - Pattern: Copy from `ProviderProfileMaster.tsx`

4. **Add CSV Import/Export UI** (3 hours)
   - Create: `frontend/src/components/CSVImportModal.tsx`
   - Update all master screens with Import/Export buttons

5. **Add Audit Trail Viewer** (2 hours)
   - Create: `frontend/src/components/AuditTrailModal.tsx`

## 📚 Documentation

- **[README_MASTER_SCREENS.md](./README_MASTER_SCREENS.md)** - Main documentation
- **[SETUP_GUIDE.md](../SETUP_GUIDE.md)** - Detailed setup guide
- **[IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)** - Complete implementation details
- **[CSV_INTEGRATION_GUIDE.md](../CSV_INTEGRATION_GUIDE.md)** - How to add CSV to existing routes

## 🔧 Troubleshooting

### Issue: "psql: command not found"
**Solution:** Use pgAdmin GUI or update the `PSQL_PATH` in `run_migration.bat`

### Issue: "relation already exists"
**Solution:** Tables already created. Skip migration or drop and recreate:
```sql
DROP TABLE IF EXISTS TradingPartnerMaster CASCADE;
DROP TABLE IF EXISTS MasterDataAuditLog CASCADE;
DROP TABLE IF EXISTS ProviderPayerMapping CASCADE;
DROP TABLE IF EXISTS FacilityPayerMapping CASCADE;
```

### Issue: "duplicate key value violates unique constraint"
**Solution:** Data already seeded. This is safe to ignore.

### Issue: Server won't start
**Solution:**
1. Check if port 3000 is available
2. Verify PostgreSQL is running
3. Check database connection in `.env` file

### Issue: "Cannot connect to database"
**Solution:** Verify `.env` settings:
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=Claim837
DB_PASSWORD=hlnotes
DB_PORT=5434
```

## ✅ Success Checklist

After completing all steps, verify:

- [x] Server running on port 3000
- [ ] Database tables created (4 new tables)
- [ ] Sample data seeded (8 total records)
- [ ] Health endpoint responding
- [ ] Trading partners endpoint working
- [ ] Audit logging enabled
- [ ] RBAC roles configured

## 🎉 You're Ready!

Once all checkboxes are complete, you have:
- ✅ Working Trading Partner Master backend
- ✅ Complete audit logging system
- ✅ RBAC with 3 roles
- ✅ CSV import/export infrastructure
- ✅ Master data validation hooks
- ✅ Sample data for testing

**Next:** Follow `CSV_INTEGRATION_GUIDE.md` to add CSV capabilities to existing Provider, Payer, and Facility routes!

---

**Current Status:**
- ✅ Dependencies installed
- ✅ Server running
- ⏳ **Next: Run migration & seed data**
