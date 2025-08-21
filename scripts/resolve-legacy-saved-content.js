import "dotenv/config";
import { Client } from "pg";
import fs from "node:fs/promises";

const sql = String.raw;

const MIGRATION_SQL = sql`
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
`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(MIGRATION_SQL);

  // Persist the same SQL as a canonical migration so future deploys don't re-ask
  const path = `migrations/${Date.now()}_archive_saved_content_and_create_referral_codes.sql`;
  await fs.writeFile(path, MIGRATION_SQL);
  console.log("Wrote migration:", path);

  // Verification
  const tables = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname='public'
      AND tablename IN ('saved_content','saved_content_legacy','feature_flags','referral_codes')
    ORDER BY tablename;
  `);
  console.table(tables.rows);

  const counts = await client.query(`
    SELECT 'referral_codes' AS table, count(*)::int AS rows FROM public.referral_codes
    UNION ALL
    SELECT 'feature_flags', count(*)::int FROM public.feature_flags
      WHERE to_regclass('public.feature_flags') IS NOT NULL
    UNION ALL
    SELECT 'saved_content_legacy', count(*)::int FROM public.saved_content_legacy
      WHERE to_regclass('public.saved_content_legacy') IS NOT NULL;
  `);
  console.table(counts.rows);

  await client.end();
}

main().catch((e)=>{ console.error(e); process.exit(1); });