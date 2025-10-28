#!/bin/bash

# Script to run the Parsed JSON History Log migration
# This creates the ParsedJsonHistoryLog table and helper functions

echo "======================================"
echo "Running Parsed JSON History Migration"
echo "======================================"
echo ""

# Set your database connection details here
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-your_database_name}"
DB_USER="${DB_USER:-your_username}"

echo "Connecting to database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "ERROR: psql command not found"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Run the migration
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "backend/database/migrations/add_parsed_json_history_log.sql"

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "Migration completed successfully!"
    echo "======================================"
    echo ""
    echo "The following have been created:"
    echo "- ParsedJsonHistoryLog table"
    echo "- Helper functions: log_parsed_json_change, get_current_parsed_json_version, etc."
    echo "- Views: ParsedJsonHistoryLogView, ParsedJsonHistorySummary"
    echo ""
else
    echo ""
    echo "======================================"
    echo "Migration failed!"
    echo "======================================"
    echo ""
    echo "Please check:"
    echo "1. PostgreSQL is running"
    echo "2. Database connection details are correct"
    echo "3. User has CREATE TABLE permissions"
    echo ""
    exit 1
fi
