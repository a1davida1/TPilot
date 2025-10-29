-- Migration: Create analytics_ai_usage_daily table
-- Purpose: Track daily AI usage metrics per user for analytics aggregation
-- Date: 2025-10-29

CREATE TABLE IF NOT EXISTS analytics_ai_usage_daily (
  user_id INTEGER NOT NULL,
  day DATE NOT NULL,
  generation_count INTEGER NOT NULL DEFAULT 0,
  model_breakdown JSONB NOT NULL,
  PRIMARY KEY (user_id, day)
);

-- Add index for efficient querying by user and date range
CREATE INDEX IF NOT EXISTS idx_analytics_ai_usage_daily_user_day
  ON analytics_ai_usage_daily(user_id, day DESC);

-- Add comment for documentation
COMMENT ON TABLE analytics_ai_usage_daily IS 'Daily aggregated AI usage statistics per user';
COMMENT ON COLUMN analytics_ai_usage_daily.model_breakdown IS 'JSON array of {model: string, count: number} objects';
