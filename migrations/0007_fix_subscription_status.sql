-- Fix subscription_status values before adding constraints
-- This migration ensures all users have valid subscription_status values

-- First, update any invalid subscription_status values
UPDATE users 
SET subscription_status = 'inactive'
WHERE subscription_status IS NULL 
   OR subscription_status = ''
   OR subscription_status = 'expired'
   OR subscription_status = 'canceled'  -- Fix single 'l' to double 'll'
   OR subscription_status NOT IN ('active', 'inactive', 'cancelled', 'past_due');

-- Now it's safe to add the reddit_communities table
CREATE TABLE IF NOT EXISTS "reddit_communities" (
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
  "competition_level" varchar(20)
);