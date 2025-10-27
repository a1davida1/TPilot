-- Add Reddit user data fields for enhanced validation
-- These fields enable karma/age requirement checking for subreddit validation

ALTER TABLE "users" ADD COLUMN "reddit_karma" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reddit_account_created" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reddit_is_verified" boolean DEFAULT false;--> statement-breakpoint

-- Add comments for documentation
COMMENT ON COLUMN users.reddit_karma IS 'Total Reddit karma (combined post + comment karma) fetched from Reddit API';--> statement-breakpoint
COMMENT ON COLUMN users.reddit_account_created IS 'Reddit account creation timestamp (UTC) fetched from Reddit API';--> statement-breakpoint
COMMENT ON COLUMN users.reddit_is_verified IS 'Whether user has manually confirmed verification status in subreddits';
