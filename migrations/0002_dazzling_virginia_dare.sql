CREATE TABLE "analytics_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"metric_type" varchar(100) NOT NULL,
	"date" timestamp NOT NULL,
	"total_views" integer DEFAULT 0,
	"total_engagement" integer DEFAULT 0,
	"content_generated" integer DEFAULT 0,
	"platform_views" jsonb,
	"top_content" jsonb,
	"engagement_rate" integer DEFAULT 0,
	"growth" jsonb,
	"revenue" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "analytics_metrics_user_date_idx" UNIQUE("user_id","date","metric_type")
);
--> statement-breakpoint
CREATE TABLE "content_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_id" integer NOT NULL,
	"session_id" varchar(255),
	"user_id" integer,
	"platform" varchar(50) NOT NULL,
	"subreddit" varchar(100),
	"view_type" varchar(50) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"referrer" varchar(500),
	"time_spent" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "engagement_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(255),
	"user_id" integer,
	"event_type" varchar(100) NOT NULL,
	"element" varchar(255),
	"page" varchar(500) NOT NULL,
	"metadata" jsonb,
	"value" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"user_id" integer,
	"path" varchar(500) NOT NULL,
	"title" varchar(500),
	"referrer" varchar(500),
	"time_on_page" integer,
	"scroll_depth" integer,
	"exit_page" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_engagement" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"platform" varchar(50) NOT NULL,
	"date" timestamp NOT NULL,
	"followers" integer DEFAULT 0,
	"following" integer DEFAULT 0,
	"total_likes" integer DEFAULT 0,
	"total_comments" integer DEFAULT 0,
	"total_shares" integer DEFAULT 0,
	"total_views" integer DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"reach" integer DEFAULT 0,
	"engagement_rate" integer DEFAULT 0,
	"profile_views" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content_generation_id" integer,
	"platforms" jsonb NOT NULL,
	"scheduled_time" timestamp NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC',
	"recurrence" varchar(50),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"last_executed" timestamp,
	"next_execution" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_media_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" varchar(50) NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"profile_picture" varchar(500),
	"access_token" varchar(1000),
	"refresh_token" varchar(1000),
	"token_expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_media_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"content_generation_id" integer,
	"platform" varchar(50) NOT NULL,
	"platform_post_id" varchar(255),
	"content" text NOT NULL,
	"media_urls" jsonb,
	"hashtags" jsonb,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp,
	"published_at" timestamp,
	"error_message" text,
	"engagement" jsonb,
	"last_engagement_sync" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_id" integer NOT NULL,
	"platform" varchar(50) NOT NULL,
	"platform_post_id" varchar(255),
	"views" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"saves" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"engagement_rate" integer DEFAULT 0,
	"reach" integer DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"user_id" integer,
	"ip_address" varchar(45),
	"user_agent" text,
	"referrer" varchar(500),
	"utm_source" varchar(255),
	"utm_medium" varchar(255),
	"utm_campaign" varchar(255),
	"device_type" varchar(50),
	"browser" varchar(100),
	"os" varchar(100),
	"country" varchar(100),
	"city" varchar(100),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration" integer,
	"page_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "analytics_metrics" ADD CONSTRAINT "analytics_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_content_id_content_generations_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_session_id_user_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_session_id_user_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_session_id_user_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_engagement" ADD CONSTRAINT "platform_engagement_account_id_social_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_schedule" ADD CONSTRAINT "post_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_schedule" ADD CONSTRAINT "post_schedule_content_generation_id_content_generations_id_fk" FOREIGN KEY ("content_generation_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_accounts" ADD CONSTRAINT "social_media_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_account_id_social_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_content_generation_id_content_generations_id_fk" FOREIGN KEY ("content_generation_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_metrics" ADD CONSTRAINT "social_metrics_content_id_content_generations_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");