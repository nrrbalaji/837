@echo off
echo ========================================
echo Running Master Tables Migration
echo ========================================
echo.

REM Update these paths if your PostgreSQL is installed elsewhere
set PSQL_PATH="C:\Program Files\PostgreSQL\14\bin\psql.exe"
set DB_USER=postgres
set DB_NAME=Claim837

REM Check if psql exists
if not exist %PSQL_PATH% (
    echo ERROR: PostgreSQL psql.exe not found at %PSQL_PATH%
    echo Please update the PSQL_PATH variable in this script
    echo.
    echo Common PostgreSQL installation paths:
    echo   C:\Program Files\PostgreSQL\14\bin\psql.exe
    echo   C:\Program Files\PostgreSQL\15\bin\psql.exe
    echo   C:\Program Files\PostgreSQL\16\bin\psql.exe
    pause
    exit /b 1
)

echo Running migration script...
%PSQL_PATH% -U %DB_USER% -d %DB_NAME% -f "backend\database\add_master_tables.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ Migration completed successfully!
    echo ========================================
    echo.
    echo Next step: Run seed_data.bat to populate sample data
) else (
    echo.
    echo ========================================
    echo ❌ Migration failed!
    echo ========================================
    echo Please check the error messages above
)

echo.
pause
