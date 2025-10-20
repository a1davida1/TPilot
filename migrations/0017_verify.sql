-- Verification queries for migration 0017_add_promotion_urls

-- Check if columns exist in user_preferences table
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'user_preferences' 
    AND column_name IN ('only_fans_url', 'fansly_url')
ORDER BY 
    column_name;

-- Check column comments
SELECT 
    c.column_name,
    pgd.description
FROM 
    pg_catalog.pg_statio_all_tables AS st
    INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
    INNER JOIN information_schema.columns c ON (
        pgd.objsubid = c.ordinal_position 
        AND c.table_schema = st.schemaname 
        AND c.table_name = st.relname
    )
WHERE 
    st.relname = 'user_preferences'
    AND c.column_name IN ('only_fans_url', 'fansly_url')
ORDER BY 
    c.column_name;

-- Show sample of user_preferences table structure
\d user_preferences
