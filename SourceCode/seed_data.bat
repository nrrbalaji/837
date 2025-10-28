@echo off
echo ========================================
echo Seeding Master Data
echo ========================================
echo.

node backend\database\seed_master_data.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ Data seeding completed successfully!
    echo ========================================
    echo.
    echo You can now test the API at:
    echo   http://localhost:3000/api/v1/trading-partners
) else (
    echo.
    echo ========================================
    echo ❌ Data seeding failed!
    echo ========================================
    echo Please check the error messages above
)

echo.
pause
