# Running the Database Migration

The Provider table needs a `facility_id` column to link providers to facilities.

## Steps to Run the Migration:

### Option 1: Via API Endpoint (Easiest)

1. **Restart your backend server** if it's already running
   ```bash
   # Stop the current server (Ctrl+C) and restart
   cd backend
   npm start
   ```

2. **Run the migration** using curl or Postman:

   **Using curl:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/migrations/add-facility-to-provider \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     -H "Content-Type: application/json"
   ```

   **Using Postman or Browser:**
   - Method: POST
   - URL: `http://localhost:3000/api/v1/migrations/add-facility-to-provider`
   - Headers:
     - `Authorization: Bearer YOUR_AUTH_TOKEN`
     - `Content-Type: application/json`

3. **Check migration status:**
   ```bash
   curl http://localhost:3000/api/v1/migrations/status \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN"
   ```

### Option 2: Direct SQL (If you have database access)

If you have direct access to the PostgreSQL database at `10.1.9.161:5434`, run:

```sql
-- Add facility_id column
ALTER TABLE Provider
ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES Facilities(facility_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_provider_facility_id ON Provider(facility_id);

-- Add comment
COMMENT ON COLUMN Provider.facility_id IS 'Links provider to a specific facility';
```

## What This Migration Does:

1. ✅ Adds `facility_id` column to the `Provider` table
2. ✅ Creates a foreign key relationship to the `Facilities` table
3. ✅ Creates an index on `facility_id` for better query performance
4. ✅ Allows NULL values (providers don't have to be linked to a facility)

## After Migration:

Once the migration is complete:
- The Facility dropdown in the Provider form will be functional
- You can assign providers to facilities
- The provider list will show which facility each provider belongs to
