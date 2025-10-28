@echo off
echo Running llmsummary column migration...
cd /d "%~dp0"
node run_llmsummary_migration.js
pause
