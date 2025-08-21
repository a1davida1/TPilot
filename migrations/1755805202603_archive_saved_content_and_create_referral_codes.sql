
BEGIN;

-- A) Archive legacy table so deploy tools stop proposing renames
DO $$
BEGIN
  IF to_regclass('public.saved_content') IS NOT NULL THEN
    -- Only archive if not already archived
    IF to_regclass('public.saved_content_legacy') IS NULL THEN
      ALTER TABLE public.saved_content RENAME TO saved_content_legacy;
      RAISE NOTICE 'Renamed saved_content -> saved_content_legacy';
    END IF;
  END IF;
END $$;

-- B) Ensure referral_codes exists (idempotent minimal schema)
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id           BIGSERIAL PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_by  TEXT,
  redeemed_at  TIMESTAMPTZ,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Ensure columns exist if table pre-existed
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS code        TEXT,
  ADD COLUMN IF NOT EXISTS created_by  TEXT,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS redeemed_by TEXT,
  ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata    JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
