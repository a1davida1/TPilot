import "dotenv/config";
import { Client } from "pg";

const sql = String.raw;

const FIX = sql`
DO $$
BEGIN
  -- Skip primary key changes - keep existing serial IDs
  RAISE NOTICE 'Keeping existing primary key types to avoid breaking changes';

  -- Skip user_id changes if they're FK constraints - too risky to change
  RAISE NOTICE 'Keeping existing user_id foreign key types intact';

  -- Common arrays to JSONB: captions.hashtags, feature_flags.tags etc. (extend as needed)
  IF to_regclass('public.captions') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='captions' AND column_name='hashtags') THEN
      IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='captions' AND column_name='hashtags') <> 'jsonb' THEN
        ALTER TABLE public.captions ADD COLUMN IF NOT EXISTS hashtags_json JSONB DEFAULT '[]'::jsonb;
        BEGIN
          -- text[] or varchar[] -> jsonb
          EXECUTE $conv$UPDATE public.captions SET hashtags_json = to_jsonb(hashtags)$conv$;
        EXCEPTION WHEN undefined_column THEN
          -- If it was JSON already with wrong type name, ignore
          RAISE NOTICE 'captions.hashtags conversion skipped';
        END;
        ALTER TABLE public.captions DROP COLUMN hashtags;
        ALTER TABLE public.captions RENAME COLUMN hashtags_json TO hashtags;
      END IF;
    END IF;
  END IF;

END $$;
`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(FIX);
  await client.end();
  console.error("DB type normalization executed.");
}

main().catch((e) => { console.error(e); process.exit(1); });