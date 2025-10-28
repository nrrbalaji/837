-- Verification Script for Parsed JSON History Log Migration
-- Run this to check if migration was successful

\echo '======================================'
\echo 'Verifying Parsed JSON History Migration'
\echo '======================================'
\echo ''

-- Check if table exists
\echo 'Checking if ParsedJsonHistoryLog table exists...'
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'parsedjsonhistorylog'
        ) THEN '✓ Table exists'
        ELSE '✗ Table NOT found - Migration may have failed'
    END as table_status;

\echo ''

-- Check if helper functions exist
\echo 'Checking helper functions...'
SELECT
    proname as function_name,
    '✓ Function exists' as status
FROM pg_proc
WHERE proname IN (
    'log_parsed_json_change',
    'get_current_parsed_json_version',
    'get_next_parsed_json_version',
    'rollback_to_parsed_json_version'
)
ORDER BY proname;

\echo ''

-- Check if views exist
\echo 'Checking views...'
SELECT
    viewname as view_name,
    '✓ View exists' as status
FROM pg_views
WHERE viewname IN (
    'parsedjsonhistorylogview',
    'parsedjsonhistorysummary'
)
ORDER BY viewname;

\echo ''

-- Check table structure
\echo 'Table structure:'
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'parsedjsonhistorylog'
ORDER BY ordinal_position;

\echo ''

-- Check indexes
\echo 'Indexes:'
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'parsedjsonhistorylog'
ORDER BY indexname;

\echo ''
\echo '======================================'
\echo 'Verification Complete'
\echo '======================================'
