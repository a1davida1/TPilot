-- Advanced Reddit Analytics Tables
-- Migration: 0002_analytics_tables
-- Created: 2025-01-29

-- ============================================================================
-- 1. Reddit Sync Status Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS reddit_sync_status (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMP,
  last_sync_type VARCHAR(20), -- 'quick', 'deep', 'full'
  posts_synced INTEGER DEFAULT 0,
  subreddits_found INTEGER DEFAULT 0,
  sync_status VARCHAR(20) DEFAULT 'never_synced', -- 'never_synced', 'syncing', 'completed', 'failed'
  sync_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_reddit_sync_status_user ON reddit_sync_status(user_id);
CREATE INDEX idx_reddit_sync_status_last_sync ON reddit_sync_status(last_sync_at);

-- ============================================================================
-- 2. Subreddit Metrics History Table (for trending detection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subreddit_metrics_history (
  id SERIAL PRIMARY KEY,
  subreddit VARCHAR(100) NOT NULL,
  members INTEGER NOT NULL,
  active_users INTEGER,
  posts_per_day FLOAT,
  avg_upvotes FLOAT,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subreddit_metrics_subreddit_time ON subreddit_metrics_history(subreddit, recorded_at);
CREATE INDEX idx_subreddit_metrics_recorded_at ON subreddit_metrics_history(recorded_at);

-- ============================================================================
-- 3. Anonymous Creator Profiles Table (GDPR-compliant benchmarking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS anonymous_creator_profiles (
  id SERIAL PRIMARY KEY,
  anonymous_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  tier VARCHAR(20) NOT NULL, -- 'free', 'starter', 'pro', 'premium'
  account_age_days INTEGER,
  total_posts INTEGER DEFAULT 0,
  total_upvotes INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  avg_upvotes_per_post FLOAT,
  success_rate FLOAT, -- Percentage of posts with >50 upvotes
  top_subreddits JSONB, -- Array of top 5 subreddits
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_anonymous_profiles_tier ON anonymous_creator_profiles(tier);
CREATE INDEX idx_anonymous_profiles_success_rate ON anonymous_creator_profiles(success_rate);

-- ============================================================================
-- 4. Subreddit Relationships Table (for crosspost recommendations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subreddit_relationships (
  id SERIAL PRIMARY KEY,
  subreddit_a VARCHAR(100) NOT NULL,
  subreddit_b VARCHAR(100) NOT NULL,
  relationship_type VARCHAR(50) NOT NULL, -- 'similar', 'complementary', 'crosspost_target'
  similarity_score FLOAT, -- 0-1 score
  shared_users_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(subreddit_a, subreddit_b, relationship_type)
);

CREATE INDEX idx_subreddit_relationships_a ON subreddit_relationships(subreddit_a);
CREATE INDEX idx_subreddit_relationships_b ON subreddit_relationships(subreddit_b);
CREATE INDEX idx_subreddit_relationships_score ON subreddit_relationships(similarity_score);

-- ============================================================================
-- 5. User Subreddit Preferences Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_subreddit_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subreddit VARCHAR(100) NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  custom_notes TEXT,
  last_posted_at TIMESTAMP,
  post_count INTEGER DEFAULT 0,
  avg_upvotes FLOAT,
  success_rate FLOAT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, subreddit)
);

CREATE INDEX idx_user_subreddit_prefs_user ON user_subreddit_preferences(user_id);
CREATE INDEX idx_user_subreddit_prefs_subreddit ON user_subreddit_preferences(subreddit);
CREATE INDEX idx_user_subreddit_prefs_favorite ON user_subreddit_preferences(user_id, is_favorite) WHERE is_favorite = TRUE;

-- ============================================================================
-- 6. Subreddit Mod Activity Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS subreddit_mod_activity (
  id SERIAL PRIMARY KEY,
  subreddit VARCHAR(100) NOT NULL,
  mod_username VARCHAR(100),
  activity_type VARCHAR(50), -- 'comment', 'removal', 'sticky', 'lock'
  activity_count INTEGER DEFAULT 1,
  last_activity_at TIMESTAMP DEFAULT NOW(),
  activity_level VARCHAR(20), -- 'low', 'medium', 'high'
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mod_activity_subreddit ON subreddit_mod_activity(subreddit);
CREATE INDEX idx_mod_activity_last_activity ON subreddit_mod_activity(last_activity_at);

-- ============================================================================
-- 7. User Rule Violations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_rule_violations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subreddit VARCHAR(100) NOT NULL,
  rule_category VARCHAR(100), -- 'title_length', 'promotional_link', 'karma_requirement', etc.
  violation_count INTEGER DEFAULT 1,
  last_violation_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_rule_violations_user ON user_rule_violations(user_id);
CREATE INDEX idx_user_rule_violations_subreddit ON user_rule_violations(user_id, subreddit);

-- ============================================================================
-- 8. Extend reddit_post_outcomes table
-- ============================================================================
ALTER TABLE reddit_post_outcomes 
  ADD COLUMN IF NOT EXISTS removal_reason TEXT,
  ADD COLUMN IF NOT EXISTS removal_type VARCHAR(50), -- 'mod', 'automod', 'spam_filter', 'user'
  ADD COLUMN IF NOT EXISTS reddit_post_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS detected_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS time_until_removal_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_comment_length FLOAT,
  ADD COLUMN IF NOT EXISTS user_replied BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS anonymous_profile_id INTEGER REFERENCES anonymous_creator_profiles(id),
  ADD COLUMN IF NOT EXISTS post_flair VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_post_reddit_id ON reddit_post_outcomes(reddit_post_id);
CREATE INDEX IF NOT EXISTS idx_post_removal ON reddit_post_outcomes(removal_type) WHERE removal_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_user_subreddit ON reddit_post_outcomes(user_id, subreddit, occurred_at);

-- ============================================================================
-- 9. Extend reddit_communities table
-- ============================================================================
ALTER TABLE reddit_communities
  ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(50), -- 'user_history', 'recommendation', 'trending', 'manual'
  ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS discovered_by_user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trend_score FLOAT,
  ADD COLUMN IF NOT EXISTS last_mod_activity_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS mod_activity_level VARCHAR(20); -- 'low', 'medium', 'high', 'unknown'

CREATE INDEX IF NOT EXISTS idx_communities_trending ON reddit_communities(is_trending) WHERE is_trending = TRUE;
CREATE INDEX IF NOT EXISTS idx_communities_discovery_source ON reddit_communities(discovery_source);
CREATE INDEX IF NOT EXISTS idx_communities_discovered_by ON reddit_communities(discovered_by_user_id);

-- ============================================================================
-- 10. Create materialized view for user subreddit performance
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS user_subreddit_performance AS
SELECT 
  user_id,
  subreddit,
  COUNT(*) as total_posts,
  AVG(upvotes) as avg_upvotes,
  AVG(views) as avg_views,
  AVG(comment_count) as avg_comments,
  SUM(CASE WHEN success = TRUE THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate,
  SUM(CASE WHEN removal_type IS NOT NULL THEN 1 ELSE 0 END) as removal_count,
  MAX(occurred_at) as last_post_at,
  MIN(occurred_at) as first_post_at
FROM reddit_post_outcomes
WHERE occurred_at > NOW() - INTERVAL '90 days' -- Only last 90 days
GROUP BY user_id, subreddit;

CREATE UNIQUE INDEX idx_user_subreddit_perf_unique ON user_subreddit_performance(user_id, subreddit);
CREATE INDEX idx_user_subreddit_perf_user ON user_subreddit_performance(user_id);
CREATE INDEX idx_user_subreddit_perf_success_rate ON user_subreddit_performance(success_rate);

-- ============================================================================
-- 11. Create function to refresh materialized view
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_user_subreddit_performance()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_subreddit_performance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE reddit_sync_status IS 'Tracks Reddit sync status per user for analytics data collection';
COMMENT ON TABLE subreddit_metrics_history IS 'Historical metrics for trending subreddit detection';
COMMENT ON TABLE anonymous_creator_profiles IS 'GDPR-compliant anonymous profiles for benchmarking';
COMMENT ON TABLE subreddit_relationships IS 'Subreddit similarity and crosspost recommendations';
COMMENT ON TABLE user_subreddit_preferences IS 'User-specific subreddit preferences and performance';
COMMENT ON TABLE subreddit_mod_activity IS 'Tracks moderator activity levels for safe posting times';
COMMENT ON TABLE user_rule_violations IS 'Tracks user rule violations for enhanced validation';
COMMENT ON MATERIALIZED VIEW user_subreddit_performance IS 'Aggregated user performance per subreddit (refreshed hourly)';

