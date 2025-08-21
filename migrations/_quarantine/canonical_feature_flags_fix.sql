
BEGIN;

-- A) If feature_flags missing and saved_content exists → RENAME
DO $$
BEGIN
  IF to_regclass('public.feature_flags') IS NULL
     AND to_regclass('public.saved_content') IS NOT NULL THEN
    ALTER TABLE public.saved_content RENAME TO feature_flags;
    RAISE NOTICE 'Renamed saved_content -> feature_flags';
  END IF;
END $$;

-- B) If neither exists → CREATE
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C) If both exist and feature_flags is empty → backfill from saved_content
DO $$
DECLARE ff_rows BIGINT := 0;
BEGIN
  IF to_regclass('public.saved_content') IS NOT NULL
     AND to_regclass('public.feature_flags') IS NOT NULL THEN
    SELECT count(*) INTO ff_rows FROM public.feature_flags;
    IF ff_rows = 0 THEN
      INSERT INTO public.feature_flags (key, enabled, created_at)
      SELECT sc.key, COALESCE(sc.enabled, false), COALESCE(sc.created_at, now())
      FROM public.saved_content sc
      ON CONFLICT (key) DO NOTHING;
      RAISE NOTICE 'Backfilled feature_flags from saved_content';
    END IF;
  END IF;
END $$;

-- D) Ensure required columns exist (idempotent)
DO $$
BEGIN
  -- Add columns only if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='key') THEN
    ALTER TABLE public.feature_flags ADD COLUMN key TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='enabled') THEN
    ALTER TABLE public.feature_flags ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='created_at') THEN
    ALTER TABLE public.feature_flags ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

COMMIT;
