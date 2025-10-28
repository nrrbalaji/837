@echo off
echo ====================================================
echo 837 Claim Processing Platform - Quick Start
echo ====================================================
echo.

echo Step 1: Installing Backend Dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b %errorlevel%
)
echo Backend dependencies installed successfully!
echo.

echo Step 2: Installing Frontend Dependencies...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b %errorlevel%
)
cd ..
echo Frontend dependencies installed successfully!
echo.

echo Step 3: Creating Environment File...
if not exist .env (
    copy .env.example .env
    echo .env file created. Please edit it with your configuration.
    echo.
    echo IMPORTANT: Update the following in .env:
    echo   - AZURE_OPENAI_API_KEY
    echo   - JWT_SECRET
    echo   - Database credentials if different
    echo.
    pause
)
echo.

echo Step 4: Running Database Migrations...
call npm run db:migrate
if %errorlevel% neq 0 (
    echo ERROR: Database migration failed
    echo Please ensure PostgreSQL is running and credentials are correct
    pause
    exit /b %errorlevel%
)
echo Database schema created successfully!
echo.

echo Step 5: Seeding Initial Data...
call npm run db:seed
if %errorlevel% neq 0 (
    echo ERROR: Database seeding failed
    pause
    exit /b %errorlevel%
)
echo Initial data loaded successfully!
echo.

echo ====================================================
echo Setup Complete!
echo ====================================================
echo.
echo Default Login Credentials:
echo   Username: admin
echo   Password: Admin@123
echo.
echo To start the application, run:
echo   npm run dev
echo.
echo The application will be available at:
echo   Frontend: http://localhost:5173
echo   Backend API: http://localhost:3000
echo.
echo For detailed instructions, see SETUP_GUIDE.md
echo ====================================================
pause
