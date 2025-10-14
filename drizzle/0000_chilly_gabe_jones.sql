CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50),
	"target_id" integer,
	"description" text NOT NULL,
	"ip_address" varchar(45),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(20) NOT NULL,
	"model" varchar(50) NOT NULL,
	"input_hash" varchar(64) NOT NULL,
	"input_json" jsonb NOT NULL,
	"output_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "billing_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"amount" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_id" integer NOT NULL,
	"reported_by_id" integer,
	"reason" varchar(100) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" integer,
	"reviewed_at" timestamp,
	"actions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"platform" varchar(50) NOT NULL,
	"style" varchar(50) NOT NULL,
	"theme" varchar(50) NOT NULL,
	"titles" jsonb NOT NULL,
	"content" text NOT NULL,
	"photo_instructions" jsonb NOT NULL,
	"prompt" text,
	"subreddit" varchar(100),
	"allows_promotion" boolean DEFAULT false,
	"generation_type" varchar(50) DEFAULT 'ai' NOT NULL,
	"created_at" timestamp DEFAULT now()
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
CREATE TABLE "creator_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" varchar(50) NOT NULL,
	"handle" varchar(100) NOT NULL,
	"platform_username" varchar(255),
	"oauth_token" text NOT NULL,
	"oauth_refresh" text NOT NULL,
	"status" varchar(20) DEFAULT 'ok' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_accounts_user_platform_idx" UNIQUE("user_id","platform")
);
--> statement-breakpoint
CREATE TABLE "deleted_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_user_id" integer NOT NULL,
	"email" varchar(255),
	"username" varchar(50),
	"deletion_reason" text,
	"deleted_at" timestamp DEFAULT now() NOT NULL,
	"data_retention_expiry" timestamp
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
CREATE TABLE "event_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(100) NOT NULL,
	"meta" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"legal_explanation" text NOT NULL,
	"deduction_percentage" integer DEFAULT 100 NOT NULL,
	"its_deduction_code" varchar(50),
	"examples" jsonb NOT NULL,
	"icon" varchar(50) NOT NULL,
	"color" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"default_business_purpose" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"vendor" varchar(255),
	"expense_date" timestamp NOT NULL,
	"receipt_url" varchar(500),
	"receipt_file_name" varchar(255),
	"business_purpose" text,
	"deduction_percentage" integer DEFAULT 100 NOT NULL,
	"tags" jsonb,
	"is_recurring" boolean DEFAULT false,
	"recurring_period" varchar(20),
	"tax_year" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"threshold" integer,
	"meta" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"page_url" varchar(500),
	"user_agent" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium',
	"admin_notes" text,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"processor" varchar(20) NOT NULL,
	"processor_ref" varchar(255),
	"referral_code_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar(25) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"platform_tags" jsonb NOT NULL,
	"pain_point" text,
	"utm_source" varchar(255),
	"utm_medium" varchar(255),
	"utm_campaign" varchar(255),
	"utm_content" varchar(255),
	"utm_term" varchar(255),
	"referrer" varchar(500),
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "leads_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"key" varchar(255) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"bytes" integer NOT NULL,
	"mime" varchar(100) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"visibility" varchar(30) DEFAULT 'private' NOT NULL,
	"last_used_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_key_unique" UNIQUE("key"),
	CONSTRAINT "media_sha256_idx" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "media_usages" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_id" integer NOT NULL,
	"used_in_type" varchar(50) NOT NULL,
	"used_in_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "post_duplicates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"subreddit" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subreddit" varchar(100) NOT NULL,
	"title_final" text NOT NULL,
	"body_final" text NOT NULL,
	"media_key" varchar(255),
	"scheduled_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"result_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "post_previews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subreddit" varchar(100) NOT NULL,
	"title_preview" text NOT NULL,
	"body_preview" text NOT NULL,
	"policy_state" varchar(10) NOT NULL,
	"warnings" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subreddit" varchar(100) NOT NULL,
	"last_post_at" timestamp NOT NULL,
	"post_count_24h" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_rate_limits_user_subreddit_idx" UNIQUE("user_id","subreddit")
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
CREATE TABLE "post_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"title_tpl" text NOT NULL,
	"body_tpl" text NOT NULL,
	"variables" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue_name" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"delay_until" timestamp,
	"processed_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reddit_communities" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"members" integer NOT NULL,
	"engagement_rate" integer NOT NULL,
	"category" varchar(50) NOT NULL,
	"verification_required" boolean DEFAULT false NOT NULL,
	"promotion_allowed" varchar(20) DEFAULT 'no' NOT NULL,
	"posting_limits" jsonb,
	"rules" jsonb,
	"best_posting_times" jsonb,
	"average_upvotes" integer,
	"success_probability" integer,
	"growth_trend" varchar(20),
	"mod_activity" varchar(20),
	"description" text,
	"tags" jsonb,
	"competition_level" varchar(20),
	"over18" boolean DEFAULT false NOT NULL,
	"subscribers" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reddit_post_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subreddit" varchar(100) NOT NULL,
	"status" varchar(20) NOT NULL,
	"reason" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"title" text,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"owner_id" integer,
	"share_pct" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" integer NOT NULL,
	"referred_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" integer NOT NULL,
	"month" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"subscription_id" varchar(255),
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_id" integer NOT NULL,
	"referrer_id" integer NOT NULL,
	"receiver_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "subreddit_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"subreddit" varchar(100) NOT NULL,
	"rules_json" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subreddit_rules_subreddit_unique" UNIQUE("subreddit")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"plan" varchar(20) NOT NULL,
	"price_cents" integer NOT NULL,
	"processor" varchar(20) NOT NULL,
	"processor_sub_id" varchar(255),
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" varchar(20) NOT NULL,
	"service" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"user_id" integer,
	"ip_address" varchar(45),
	"resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_deduction_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"legal_basis" text NOT NULL,
	"requirements" jsonb NOT NULL,
	"limitations" text,
	"examples" jsonb NOT NULL,
	"its_reference" varchar(100),
	"applicable_for" jsonb NOT NULL,
	"risk_level" varchar(20) DEFAULT 'low' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "user_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"admin_id" integer NOT NULL,
	"action" varchar(50) NOT NULL,
	"reason" text NOT NULL,
	"duration_hours" integer,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"url" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"is_protected" boolean DEFAULT false,
	"protection_level" varchar(50) DEFAULT 'none',
	"tags" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"writing_style" jsonb,
	"content_preferences" jsonb,
	"prohibited_words" jsonb,
	"photo_style" jsonb,
	"platform_settings" jsonb,
	"fine_tuning_enabled" boolean DEFAULT false,
	"email_notifications" boolean DEFAULT true,
	"push_notifications" boolean DEFAULT false,
	"marketing_emails" boolean DEFAULT false,
	"show_nsfw_content" boolean DEFAULT true,
	"auto_schedule_posts" boolean DEFAULT false,
	"default_subreddit" varchar(100),
	"theme" varchar(20) DEFAULT 'auto',
	"compact_mode" boolean DEFAULT false,
	"show_onboarding" boolean DEFAULT true,
	"caption_style" varchar(50) DEFAULT 'casual',
	"watermark_position" varchar(20) DEFAULT 'bottom-right',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_samples" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"platform" varchar(50) NOT NULL,
	"style" varchar(50),
	"performance_score" integer,
	"tags" jsonb,
	"image_urls" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_sessions_session_id_unique" UNIQUE("session_id")
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
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" varchar(255) DEFAULT '' NOT NULL,
	"email" varchar(255),
	"role" varchar(50) DEFAULT 'user',
	"is_admin" boolean DEFAULT false,
	"email_verified" boolean DEFAULT false NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"tier" varchar(50) DEFAULT 'free' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"subscription_status" varchar(50) DEFAULT 'inactive' NOT NULL,
	"trial_ends_at" timestamp,
	"provider" varchar(50),
	"provider_id" varchar(255),
	"avatar" text,
	"bio" text,
	"referral_code_id" integer,
	"referred_by" integer,
	"reddit_username" varchar(255),
	"reddit_access_token" text,
	"reddit_refresh_token" text,
	"reddit_id" varchar(255),
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"banned_at" timestamp,
	"suspended_until" timestamp,
	"ban_reason" text,
	"suspension_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"last_login" timestamp,
	"password_reset_at" timestamp,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"avatar_url" text,
	"website" varchar(255),
	"timezone" varchar(50),
	"language" varchar(10) DEFAULT 'en',
	"two_factor_enabled" boolean DEFAULT false,
	"last_login_at" timestamp,
	"password_hash" varchar(255) DEFAULT '' NOT NULL,
	"last_password_change" timestamp,
	"posts_count" integer DEFAULT 0,
	"captions_generated" integer DEFAULT 0,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_metrics" ADD CONSTRAINT "analytics_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_content_id_content_generations_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generations" ADD CONSTRAINT "content_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_content_id_content_generations_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_session_id_user_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_views" ADD CONSTRAINT "content_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_accounts" ADD CONSTRAINT "creator_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_session_id_user_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_referral_code_id_referral_codes_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_session_id_user_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_engagement" ADD CONSTRAINT "platform_engagement_account_id_social_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_duplicates" ADD CONSTRAINT "post_duplicates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_jobs" ADD CONSTRAINT "post_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_previews" ADD CONSTRAINT "post_previews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_rate_limits" ADD CONSTRAINT "post_rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_schedule" ADD CONSTRAINT "post_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_schedule" ADD CONSTRAINT "post_schedule_content_generation_id_content_generations_id_fk" FOREIGN KEY ("content_generation_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_templates" ADD CONSTRAINT "post_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reddit_post_outcomes" ADD CONSTRAINT "reddit_post_outcomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referred_id_users_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_code_id_referral_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_content" ADD CONSTRAINT "saved_content_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_content" ADD CONSTRAINT "saved_content_content_generation_id_content_generations_id_fk" FOREIGN KEY ("content_generation_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_content" ADD CONSTRAINT "saved_content_social_media_post_id_social_media_posts_id_fk" FOREIGN KEY ("social_media_post_id") REFERENCES "public"."social_media_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_accounts" ADD CONSTRAINT "social_media_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_account_id_social_media_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_content_generation_id_content_generations_id_fk" FOREIGN KEY ("content_generation_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_metrics" ADD CONSTRAINT "social_metrics_content_id_content_generations_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_actions" ADD CONSTRAINT "user_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_images" ADD CONSTRAINT "user_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_samples" ADD CONSTRAINT "user_samples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_storage_assets" ADD CONSTRAINT "user_storage_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_generations_input_hash_idx" ON "ai_generations" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_type_idx" ON "feedback" USING btree ("type");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "post_metrics_subreddit_idx" ON "post_metrics" USING btree ("subreddit");--> statement-breakpoint
CREATE INDEX "post_metrics_posted_at_idx" ON "post_metrics" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "reddit_post_outcomes_user_idx" ON "reddit_post_outcomes" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "reddit_post_outcomes_status_idx" ON "reddit_post_outcomes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reddit_post_outcomes_subreddit_idx" ON "reddit_post_outcomes" USING btree ("subreddit");--> statement-breakpoint
CREATE INDEX "referral_rewards_referrer_idx" ON "referral_rewards" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "referral_rewards_referred_idx" ON "referral_rewards" USING btree ("referred_id");--> statement-breakpoint
CREATE INDEX "referral_rewards_status_idx" ON "referral_rewards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "referral_rewards_subscription_idx" ON "referral_rewards" USING btree ("subscription_id");--> statement-breakpoint
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