-- Multi-subreddit caption variants table
-- Stores generated caption variants for different subreddits with persona and tone hints

CREATE TABLE IF NOT EXISTS "caption_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"image_id" integer,
	"subreddit" varchar(100) NOT NULL,
	"persona" varchar(120),
	"tone_hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"final_caption" text NOT NULL,
	"final_alt" text,
	"final_cta" text,
	"hashtags" text[],
	"ranked_metadata" jsonb,
	"variants" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "caption_variants" ADD CONSTRAINT "caption_variants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "caption_variants" ADD CONSTRAINT "caption_variants_image_id_user_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "user_images"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "caption_variants_user_idx" ON "caption_variants" ("user_id");
CREATE INDEX IF NOT EXISTS "caption_variants_subreddit_idx" ON "caption_variants" ("subreddit");
CREATE INDEX IF NOT EXISTS "caption_variants_image_idx" ON "caption_variants" ("image_id");
