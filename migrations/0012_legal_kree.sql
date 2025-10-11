CREATE TABLE "onboarding_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_minimized" boolean DEFAULT false NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_states_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "post_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subreddit" varchar(100) NOT NULL,
	"title" varchar(255),
	"score" double precision DEFAULT 0,
	"comments" integer DEFAULT 0,
	"content_type" varchar(100),
	"posted_at" timestamp NOT NULL,
	"nsfw_flagged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reddit_post_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subreddit" varchar(100) NOT NULL,
	"status" varchar(20) NOT NULL,
	"reason" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"platform" varchar(50),
	"tags" jsonb,
	"metadata" jsonb,
	"content_generation_id" integer,
	"social_media_post_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text,
	"image_url" text,
	"caption" text,
	"subreddit" varchar(100) NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC',
	"status" varchar(20) DEFAULT 'pending',
	"nsfw" boolean DEFAULT false,
	"spoiler" boolean DEFAULT false,
	"flair_id" varchar(100),
	"flair_text" varchar(100),
	"reddit_post_id" varchar(50),
	"reddit_post_url" text,
	"error_message" text,
	"executed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"media_urls" text[],
	"send_replies" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trending_topics" (
	"subreddit" varchar(100) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"mentions" integer DEFAULT 0 NOT NULL,
	"trend_score" double precision DEFAULT 0 NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "trending_topics_subreddit_topic_pk" PRIMARY KEY("subreddit","topic")
);
--> statement-breakpoint
CREATE TABLE "user_storage_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"url" text NOT NULL,
	"delete_hash" varchar(255),
	"source_filename" varchar(500),
	"width" integer,
	"height" integer,
	"file_size" integer,
	"mime_type" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reddit_post_outcomes" ADD CONSTRAINT "reddit_post_outcomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_content" ADD CONSTRAINT "saved_content_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_content" ADD CONSTRAINT "saved_content_content_generation_id_content_generations_id_fk" FOREIGN KEY ("content_generation_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_content" ADD CONSTRAINT "saved_content_social_media_post_id_social_media_posts_id_fk" FOREIGN KEY ("social_media_post_id") REFERENCES "public"."social_media_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_storage_assets" ADD CONSTRAINT "user_storage_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_metrics_subreddit_idx" ON "post_metrics" USING btree ("subreddit");--> statement-breakpoint
CREATE INDEX "post_metrics_posted_at_idx" ON "post_metrics" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "reddit_post_outcomes_user_idx" ON "reddit_post_outcomes" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "reddit_post_outcomes_status_idx" ON "reddit_post_outcomes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reddit_post_outcomes_subreddit_idx" ON "reddit_post_outcomes" USING btree ("subreddit");--> statement-breakpoint
CREATE INDEX "saved_content_user_id_idx" ON "saved_content" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_content_content_generation_id_idx" ON "saved_content" USING btree ("content_generation_id");--> statement-breakpoint
CREATE INDEX "saved_content_social_media_post_id_idx" ON "saved_content" USING btree ("social_media_post_id");--> statement-breakpoint
CREATE INDEX "scheduled_posts_user_id_idx" ON "scheduled_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scheduled_posts_status_idx" ON "scheduled_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scheduled_posts_scheduled_for_idx" ON "scheduled_posts" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "scheduled_posts_subreddit_idx" ON "scheduled_posts" USING btree ("subreddit");--> statement-breakpoint
CREATE INDEX "trending_topics_detected_at_idx" ON "trending_topics" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "user_storage_assets_user_id_idx" ON "user_storage_assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_storage_assets_provider_idx" ON "user_storage_assets" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "user_storage_assets_created_at_idx" ON "user_storage_assets" USING btree ("created_at");