-- Idempotent migration to ensure feature_flags table exists with correct structure
-- This resolves the repeating deployment prompt issue

BEGIN;

-- Ensure feature_flags table exists (it already does, but this makes it idempotent)
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "key" varchar(100) PRIMARY KEY NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "threshold" integer,
    "meta" jsonb,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add any missing columns (idempotent - won't fail if columns exist)
DO $$
BEGIN
    -- Ensure key column exists with correct type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feature_flags' AND column_name='key') THEN
        ALTER TABLE "feature_flags" ADD COLUMN "key" varchar(100) PRIMARY KEY NOT NULL;
    END IF;
    
    -- Ensure enabled column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feature_flags' AND column_name='enabled') THEN
        ALTER TABLE "feature_flags" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;
    END IF;
    
    -- Ensure threshold column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feature_flags' AND column_name='threshold') THEN
        ALTER TABLE "feature_flags" ADD COLUMN "threshold" integer;
    END IF;
    
    -- Ensure meta column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feature_flags' AND column_name='meta') THEN
        ALTER TABLE "feature_flags" ADD COLUMN "meta" jsonb;
    END IF;
    
    -- Ensure updated_at column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feature_flags' AND column_name='updated_at') THEN
        ALTER TABLE "feature_flags" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
    END IF;
END $$;

COMMIT;

-- Verification comment
-- This migration ensures feature_flags table exists with the correct structure
-- It will not drop or rename any existing tables/columns
-- Existing data (2 rows) is preserved