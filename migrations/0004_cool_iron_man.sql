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
ALTER TABLE "referral_codes" DROP CONSTRAINT "referral_codes_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_referral_code_id_referral_codes_id_fk";
--> statement-breakpoint
ALTER TABLE "referral_codes" ALTER COLUMN "owner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "content_generations" ADD COLUMN "generation_type" varchar(50) DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "creator_accounts" ADD COLUMN "platform_username" varchar(255);--> statement-breakpoint
ALTER TABLE "creator_accounts" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "creator_accounts" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" varchar(50) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referred_by" integer;