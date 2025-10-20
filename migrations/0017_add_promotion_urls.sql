-- Add OnlyFans and Fansly URL fields to user_preferences
-- These URLs are used for explicit promotional CTAs in AI-generated captions

ALTER TABLE "user_preferences" ADD COLUMN "only_fans_url" varchar(255);--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "fansly_url" varchar(255);--> statement-breakpoint

-- Add comments for documentation
COMMENT ON COLUMN user_preferences.only_fans_url IS 'User OnlyFans URL for explicit promotional captions (format: onlyfans.com/username)';--> statement-breakpoint
COMMENT ON COLUMN user_preferences.fansly_url IS 'User Fansly URL for explicit promotional captions (format: fansly.com/username)';
