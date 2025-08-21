const { Client } = require('pg');

const sql = String.raw;

const DROP_USER_SAMPLES_IF_EMPTY = sql`
DO $$
BEGIN
  IF to_regclass('public.user_samples') IS NOT NULL THEN
    IF (SELECT count(*) FROM public.user_samples) = 0 THEN
      EXECUTE 'DROP TABLE public.user_samples';
      RAISE NOTICE 'Dropped table user_samples (was empty)';
    ELSE
      RAISE NOTICE 'user_samples not empty; left intact';
    END IF;
  ELSE
    RAISE NOTICE 'user_samples does not exist';
  END IF;
END $$;`;

// Deterministic resolution for feature_flags vs saved_content.
// If only saved_content exists => rename. If both exist and feature_flags empty => copy from saved_content.
// If feature_flags has rows => keep it and leave saved_content (or rename to *_old).
const RESOLVE_FEATURE_FLAGS = sql`
DO $$
DECLARE
  has_saved boolean := (to_regclass('public.saved_content') IS NOT NULL);
  has_flags boolean := (to_regclass('public.feature_flags') IS NOT NULL);
  flags_rows bigint := 0;
BEGIN
  IF has_flags THEN
    SELECT count(*) INTO flags_rows FROM public.feature_flags;
  END IF;

  IF (NOT has_flags) AND has_saved THEN
    -- rename saved_content -> feature_flags
    EXECUTE 'ALTER TABLE public.saved_content RENAME TO feature_flags';
    RAISE NOTICE 'Renamed saved_content -> feature_flags';
  ELSIF has_flags AND has_saved AND flags_rows = 0 THEN
    -- backfill from saved_content into empty feature_flags
    EXECUTE $ins$INSERT INTO public.feature_flags (key, enabled, created_at)
            SELECT sc.key, COALESCE(sc.enabled, false), COALESCE(sc.created_at, now())
            FROM public.saved_content sc
            ON CONFLICT (key) DO NOTHING$ins$;
    RAISE NOTICE 'Backfilled feature_flags from saved_content';
  ELSE
    RAISE NOTICE 'feature_flags kept as-is (or both absent)';
  END IF;

  -- Ensure required columns on feature_flags (idempotent)
  IF to_regclass('public.feature_flags') IS NOT NULL THEN
    -- add columns if missing
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='feature_flags' AND column_name='id';
    IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.feature_flags ADD COLUMN id BIGSERIAL PRIMARY KEY'; END IF;

    PERFORM 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='feature_flags' AND column_name='key';
    IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.feature_flags ADD COLUMN key TEXT UNIQUE'; END IF;

    PERFORM 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='feature_flags' AND column_name='enabled';
    IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.feature_flags ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT FALSE'; END IF;

    PERFORM 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='feature_flags' AND column_name='created_at';
    IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.feature_flags ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now()'; END IF;
  END IF;
END $$;`;

// Optional: rename old saved_content after successful resolution (no drop to avoid risk)
const OPTIONAL_RETIRE_SAVED = sql`
DO $$
BEGIN
  IF to_regclass('public.saved_content') IS NOT NULL
     AND to_regclass('public.feature_flags') IS NOT NULL THEN
    -- Keep a safety rename only if you want, else skip:
    -- EXECUTE 'ALTER TABLE public.saved_content RENAME TO saved_content_old';
    RAISE NOTICE 'saved_content still present (left intact)';
  END IF;
END $$;`;

const VERIFY = sql`
SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN
  ('user_samples','feature_flags','saved_content','saved_content_old')
ORDER BY tablename;`;

const VERIFY_COUNTS = sql`
SELECT
  'user_samples' AS table, COALESCE((SELECT count(*) FROM public.user_samples), 0) AS rows
WHERE to_regclass('public.user_samples') IS NOT NULL
UNION ALL
SELECT 'feature_flags', COALESCE((SELECT count(*) FROM public.feature_flags), 0)
WHERE to_regclass('public.feature_flags') IS NOT NULL
UNION ALL
SELECT 'saved_content', COALESCE((SELECT count(*) FROM public.saved_content), 0)
WHERE to_regclass('public.saved_content') IS NOT NULL
UNION ALL
SELECT 'saved_content_old', COALESCE((SELECT count(*) FROM public.saved_content_old), 0)
WHERE to_regclass('public.saved_content_old') IS NOT NULL;`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('🔧 Starting database fixes...\n');

  // Drop empty user_samples
  console.log('Step 1: Checking user_samples table...');
  await client.query(DROP_USER_SAMPLES_IF_EMPTY);

  // Resolve feature_flags vs saved_content
  console.log('\nStep 2: Resolving feature_flags vs saved_content...');
  await client.query(RESOLVE_FEATURE_FLAGS);

  // Optionally retire old table (no-op by default)
  // await client.query(OPTIONAL_RETIRE_SAVED);

  // Print verification
  console.log('\n--- TABLES PRESENT ---');
  const r1 = await client.query(VERIFY);
  console.table(r1.rows);

  console.log('\n--- TABLE ROW COUNTS ---');
  const r2 = await client.query(VERIFY_COUNTS);
  console.table(r2.rows);

  await client.end();
  console.log('\n✅ Database fixes completed!');
}

main().catch((e) => { console.error(e); process.exit(1); });