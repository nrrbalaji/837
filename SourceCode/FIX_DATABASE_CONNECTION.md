# Fix: Database Connection Error (ECONNREFUSED ::1:5432)

## Problem

Your application is trying to connect to `::1:5432` (IPv6 localhost) instead of the correct database server at `10.1.9.161:5434` specified in your `.env` file.

## Root Cause

The `.env` file is not being loaded properly, so the application uses default values from `database.js`:
- Default host: `localhost` → resolves to `::1` (IPv6)
- Default port: `5434` from code → but error shows `5432` (PostgreSQL default)

## Quick Diagnosis

Run this to check if `.env` is being loaded:

```bash
cd backend
node -e "require('dotenv').config({path:'../.env'}); console.log('DB_HOST:', process.env.DB_HOST); console.log('DB_PORT:', process.env.DB_PORT);"
```

Expected output:
```
DB_HOST: 10.1.9.161
DB_PORT: 5434
```

If you see `undefined`, the `.env` file isn't being found.

## Solutions

### Solution 1: Fix .env Path in database.js (Recommended)

The issue is that `database.js` loads dotenv, but by that time it may be looking in the wrong directory.

**Edit `backend/config/database.js`:**

```javascript
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'Claim837',
  password: process.env.DB_PASSWORD || 'hlnotes',
  port: parseInt(process.env.DB_PORT) || 5434,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
  console.log(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`   Database: ${process.env.DB_NAME}`);
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

export default pool;
```

### Solution 2: Force IPv4 Instead of IPv6

If the `.env` is loaded but still connecting to IPv6, force IPv4:

**Edit `backend/config/database.js`:**

Change:
```javascript
host: process.env.DB_HOST || 'localhost',
```

To:
```javascript
host: process.env.DB_HOST || '127.0.0.1',  // Force IPv4
```

### Solution 3: Check Database is Running and Accessible

Test if PostgreSQL is running and accessible:

**From your local machine:**
```bash
# Test connection to the remote database
psql -h 10.1.9.161 -p 5434 -U postgres -d Claim837
```

**Common issues:**
1. **Database not running** - Start PostgreSQL on the remote server
2. **Firewall blocking** - Allow port 5434 through firewall
3. **PostgreSQL not listening on remote connections** - Edit `postgresql.conf`:
   ```
   listen_addresses = '*'
   ```
4. **pg_hba.conf not allowing connections** - Add this line:
   ```
   host    all             all             0.0.0.0/0               md5
   ```

### Solution 4: Debug Logging

Add debug logging to see what's being loaded:

**Edit `backend/config/database.js`:**

Add this right after dotenv.config():

```javascript
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Debug: Log environment variables
console.log('═══════════════════════════════════════');
console.log('Database Configuration Debug:');
console.log('═══════════════════════════════════════');
console.log('DB_HOST:', process.env.DB_HOST || '(not set - will use default)');
console.log('DB_PORT:', process.env.DB_PORT || '(not set - will use default)');
console.log('DB_NAME:', process.env.DB_NAME || '(not set - will use default)');
console.log('DB_USER:', process.env.DB_USER || '(not set - will use default)');
console.log('═══════════════════════════════════════');
```

This will show you exactly what values are being used.

## Step-by-Step Fix

### Step 1: Update database.js

Replace your `backend/config/database.js` with the fixed version (Solution 1 above).

### Step 2: Restart Your Application

```bash
# Stop the server (Ctrl+C)
# Then start again
cd backend
npm run dev
# or
npm start
```

### Step 3: Check the Console Output

You should see:
```
✅ Database connected successfully
   Host: 10.1.9.161:5434
   Database: Claim837
```

If you see errors, the debug output will show what values are being used.

### Step 4: Verify Database Connection

Once connected, test an API endpoint:

```bash
curl http://localhost:3000/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-15T...",
  "uptime": 123.456,
  "environment": "development"
}
```

## Common Issues and Solutions

### Issue 1: .env file not found

**Symptoms:** Debug shows all values as "(not set)"

**Solution:** Make sure `.env` is in the project root:
```
d:\AI\from my laptop\837\Source Code\.env
```

Not in:
```
d:\AI\from my laptop\837\Source Code\backend\.env  ❌
```

### Issue 2: Database credentials wrong

**Symptoms:** Error "authentication failed"

**Solution:** Verify credentials:
```bash
psql -h 10.1.9.161 -p 5434 -U postgres -d Claim837
# Enter password: hlnotes
```

### Issue 3: Network not reachable

**Symptoms:** Error "network unreachable" or timeout

**Solution:**
1. Check if you can ping the server:
   ```bash
   ping 10.1.9.161
   ```
2. Check if port is open:
   ```bash
   telnet 10.1.9.161 5434
   ```
3. Check firewall rules on both client and server

### Issue 4: Database not accepting remote connections

**Symptoms:** Connection refused even though database is running

**Solution:**

On the database server, edit PostgreSQL config:

**1. Edit postgresql.conf:**
```bash
# Find the file
# Linux: /etc/postgresql/14/main/postgresql.conf
# Windows: C:\Program Files\PostgreSQL\14\data\postgresql.conf

# Change this line:
listen_addresses = '*'  # Allow all addresses
# or
listen_addresses = '10.1.9.161'  # Specific IP only
```

**2. Edit pg_hba.conf:**
```bash
# Add this line to allow connections from your app server
host    Claim837        postgres        0.0.0.0/0               md5
```

**3. Restart PostgreSQL:**
```bash
# Linux
sudo systemctl restart postgresql

# Windows
net stop postgresql-x64-14
net start postgresql-x64-14
```

## Testing the Fix

### Test 1: Environment Variables

```bash
cd backend
node -e "require('dotenv').config({path:'../.env'}); console.log('Host:', process.env.DB_HOST, 'Port:', process.env.DB_PORT);"
```

Should show:
```
Host: 10.1.9.161 Port: 5434
```

### Test 2: Direct Connection

```bash
psql -h 10.1.9.161 -p 5434 -U postgres -d Claim837 -c "SELECT version();"
```

Should connect and show PostgreSQL version.

### Test 3: Application Connection

```bash
npm run dev
```

Should show:
```
✅ Database connected successfully
   Host: 10.1.9.161:5434
   Database: Claim837
```

### Test 4: Run Migration (After Connection Works)

Once database is connected, run the history migration:

```bash
psql -h 10.1.9.161 -p 5434 -U postgres -d Claim837 -f backend/database/migrations/add_parsed_json_history_log.sql
```

## After Fixing

Once the database connection is working:

1. ✅ Start your backend: `npm run dev`
2. ✅ Run the migration: `./run_history_migration.sh` or `.bat`
3. ✅ Verify: `psql ... -f verify_history_migration.sql`
4. ✅ Test the history feature in the UI

## Need More Help?

If none of these solutions work:

1. **Check the full error stack** - Share the complete error message
2. **Check backend logs** - Look in `logs/` directory for more details
3. **Check database server logs** - PostgreSQL logs may show why connections are rejected
4. **Network diagnostics** - Use `tracert 10.1.9.161` to check network path

## Quick Reference

```bash
# Check if database is running
psql -h 10.1.9.161 -p 5434 -U postgres -d Claim837

# Test .env loading
node -e "require('dotenv').config({path:'.env'}); console.log(process.env.DB_HOST);"

# Restart application
npm run dev

# Run migration (after connection works)
psql -h 10.1.9.161 -p 5434 -U postgres -d Claim837 -f backend/database/migrations/add_parsed_json_history_log.sql

# Verify migration
psql -h 10.1.9.161 -p 5434 -U postgres -d Claim837 -f verify_history_migration.sql
```
