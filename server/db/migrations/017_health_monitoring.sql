-- Health Monitoring System
-- Migration 017: Account and community health tracking

-- ============================================================================
-- TABLE: health_checks
-- Stores results of various health checks
-- ============================================================================
CREATE TABLE IF NOT EXISTS health_checks (
  id SERIAL PRIMARY KEY,
  check_type VARCHAR(50) NOT NULL CHECK (check_type IN (
    'account_shadowban',
    'account_karma',
    'account_removal_rate',
    'subreddit_health',
    'subreddit_rules',
    'content_similarity',
    'engagement_drop'
  )),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('user', 'subreddit', 'post')),
  target_id VARCHAR(200) NOT NULL, -- user_id, subreddit name, or post_id
  status VARCHAR(20) NOT NULL CHECK (status IN ('pass', 'warn', 'fail', 'unknown')),
  score INTEGER CHECK (score >= 0 AND score <= 100), -- Health score 0-100
  details JSONB, -- Additional check-specific data
  checked_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_health_checks_type ON health_checks(check_type);
CREATE INDEX idx_health_checks_target ON health_checks(target_type, target_id);
CREATE INDEX idx_health_checks_status ON health_checks(status);
CREATE INDEX idx_health_checks_time ON health_checks(checked_at DESC);

-- ============================================================================
-- TABLE: health_alerts
-- Active alerts that need user attention
-- ============================================================================
CREATE TABLE IF NOT EXISTS health_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  action_required TEXT, -- What user should do
  related_target VARCHAR(200), -- Affected subreddit/post
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON health_alerts(user_id);
CREATE INDEX idx_alerts_severity ON health_alerts(severity);
CREATE INDEX idx_alerts_resolved ON health_alerts(is_resolved, created_at DESC);
CREATE INDEX idx_alerts_user_unresolved ON health_alerts(user_id, is_resolved) WHERE is_resolved = false;

-- ============================================================================
-- TABLE: subreddit_health_history
-- Time-series data for subreddit health tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS subreddit_health_history (
  id SERIAL PRIMARY KEY,
  subreddit VARCHAR(100) NOT NULL,
  subscribers INTEGER,
  active_users INTEGER,
  posts_per_day DECIMAL(10, 2),
  avg_upvotes_per_post DECIMAL(10, 2),
  removal_rate DECIMAL(5, 2), -- % of posts removed
  mod_activity_score INTEGER CHECK (mod_activity_score >= 0 AND mod_activity_score <= 100),
  community_sentiment VARCHAR(20) CHECK (community_sentiment IN ('positive', 'neutral', 'negative', 'unknown')),
  is_healthy BOOLEAN DEFAULT true,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(subreddit, snapshot_date)
);

CREATE INDEX idx_subreddit_history_sub ON subreddit_health_history(subreddit);
CREATE INDEX idx_subreddit_history_date ON subreddit_health_history(snapshot_date DESC);
CREATE INDEX idx_subreddit_history_health ON subreddit_health_history(is_healthy);

-- ============================================================================
-- TABLE: account_health_metrics
-- User account health snapshot over time
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_health_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  karma_score INTEGER DEFAULT 0,
  post_removal_rate DECIMAL(5, 2) DEFAULT 0,
  comment_removal_rate DECIMAL(5, 2) DEFAULT 0,
  shadowban_status VARCHAR(20) CHECK (shadowban_status IN ('none', 'suspected', 'confirmed', 'unknown')),
  engagement_trend VARCHAR(20) CHECK (engagement_trend IN ('up', 'stable', 'down', 'unknown')),
  posts_last_7_days INTEGER DEFAULT 0,
  avg_upvotes_last_7_days DECIMAL(10, 2) DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0, -- How many times hit rate limits
  overall_health_score INTEGER CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX idx_account_metrics_user ON account_health_metrics(user_id);
CREATE INDEX idx_account_metrics_date ON account_health_metrics(snapshot_date DESC);
CREATE INDEX idx_account_metrics_score ON account_health_metrics(overall_health_score);

-- ============================================================================
-- TABLE: content_similarity_checks
-- Detects repetitive content patterns
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_similarity_checks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  total_posts_checked INTEGER DEFAULT 0,
  similar_pairs_found INTEGER DEFAULT 0,
  similarity_score DECIMAL(5, 2), -- 0-100, higher = more repetitive
  title_diversity_score DECIMAL(5, 2), -- 0-100, higher = more diverse
  is_concerning BOOLEAN DEFAULT false,
  recommendations TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, check_date)
);

CREATE INDEX idx_similarity_user ON content_similarity_checks(user_id);
CREATE INDEX idx_similarity_concerning ON content_similarity_checks(is_concerning);

-- ============================================================================
-- VIEW: user_health_dashboard
-- Comprehensive user health overview
-- ============================================================================
CREATE OR REPLACE VIEW user_health_dashboard AS
SELECT
  u.id as user_id,
  u.username,
  u.tier,
  -- Recent account metrics
  ahm.overall_health_score,
  ahm.karma_score,
  ahm.post_removal_rate,
  ahm.shadowban_status,
  ahm.engagement_trend,
  ahm.posts_last_7_days,
  ahm.avg_upvotes_last_7_days,
  -- Active alerts count
  (SELECT COUNT(*) FROM health_alerts WHERE user_id = u.id AND is_resolved = false) as active_alerts,
  (SELECT COUNT(*) FROM health_alerts WHERE user_id = u.id AND is_resolved = false AND severity = 'critical') as critical_alerts,
  -- Recent checks
  (SELECT checked_at FROM health_checks WHERE target_type = 'user' AND target_id = u.id::TEXT ORDER BY checked_at DESC LIMIT 1) as last_check_at,
  -- Content similarity
  csc.similarity_score,
  csc.title_diversity_score,
  csc.is_concerning as has_content_concerns,
  ahm.snapshot_date as metrics_date
FROM users u
LEFT JOIN LATERAL (
  SELECT * FROM account_health_metrics
  WHERE user_id = u.id
  ORDER BY snapshot_date DESC
  LIMIT 1
) ahm ON true
LEFT JOIN LATERAL (
  SELECT * FROM content_similarity_checks
  WHERE user_id = u.id
  ORDER BY check_date DESC
  LIMIT 1
) csc ON true;

-- ============================================================================
-- VIEW: subreddit_health_dashboard
-- Subreddit health overview
-- ============================================================================
CREATE OR REPLACE VIEW subreddit_health_dashboard AS
SELECT
  subreddit,
  subscribers,
  active_users,
  posts_per_day,
  avg_upvotes_per_post,
  removal_rate,
  mod_activity_score,
  community_sentiment,
  is_healthy,
  snapshot_date,
  -- Trend indicators
  LAG(avg_upvotes_per_post) OVER (PARTITION BY subreddit ORDER BY snapshot_date) as prev_avg_upvotes,
  LAG(removal_rate) OVER (PARTITION BY subreddit ORDER BY snapshot_date) as prev_removal_rate,
  -- Health change
  CASE
    WHEN is_healthy = true AND LAG(is_healthy) OVER (PARTITION BY subreddit ORDER BY snapshot_date) = false THEN 'improving'
    WHEN is_healthy = false AND LAG(is_healthy) OVER (PARTITION BY subreddit ORDER BY snapshot_date) = true THEN 'declining'
    ELSE 'stable'
  END as health_trend
FROM subreddit_health_history
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days';

-- ============================================================================
-- FUNCTION: calculate_account_health_score
-- Computes overall account health (0-100)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_account_health_score(
  p_karma INTEGER,
  p_removal_rate DECIMAL,
  p_shadowban_status VARCHAR,
  p_engagement_trend VARCHAR,
  p_rate_limit_hits INTEGER
) RETURNS INTEGER AS $$
DECLARE
  karma_score INTEGER;
  removal_score INTEGER;
  shadowban_score INTEGER;
  engagement_score INTEGER;
  rate_limit_score INTEGER;
BEGIN
  -- Karma component (0-20 points)
  karma_score := CASE
    WHEN p_karma >= 1000 THEN 20
    WHEN p_karma >= 500 THEN 15
    WHEN p_karma >= 100 THEN 10
    WHEN p_karma >= 10 THEN 5
    ELSE 0
  END;
  
  -- Removal rate component (0-30 points, inverted)
  removal_score := CASE
    WHEN p_removal_rate <= 5 THEN 30
    WHEN p_removal_rate <= 10 THEN 25
    WHEN p_removal_rate <= 15 THEN 20
    WHEN p_removal_rate <= 25 THEN 10
    ELSE 0
  END;
  
  -- Shadowban component (0-25 points)
  shadowban_score := CASE
    WHEN p_shadowban_status = 'none' THEN 25
    WHEN p_shadowban_status = 'unknown' THEN 20
    WHEN p_shadowban_status = 'suspected' THEN 10
    ELSE 0
  END;
  
  -- Engagement trend component (0-15 points)
  engagement_score := CASE
    WHEN p_engagement_trend = 'up' THEN 15
    WHEN p_engagement_trend = 'stable' THEN 10
    WHEN p_engagement_trend = 'unknown' THEN 8
    ELSE 0
  END;
  
  -- Rate limit component (0-10 points, inverted)
  rate_limit_score := CASE
    WHEN p_rate_limit_hits = 0 THEN 10
    WHEN p_rate_limit_hits <= 2 THEN 7
    WHEN p_rate_limit_hits <= 5 THEN 4
    ELSE 0
  END;
  
  RETURN karma_score + removal_score + shadowban_score + engagement_score + rate_limit_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCTION: create_health_alert
-- Helper function to create alerts with auto-deduplication
-- ============================================================================
CREATE OR REPLACE FUNCTION create_health_alert(
  p_user_id INTEGER,
  p_alert_type VARCHAR,
  p_severity VARCHAR,
  p_title VARCHAR,
  p_message TEXT,
  p_action_required TEXT DEFAULT NULL,
  p_related_target VARCHAR DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  existing_alert INTEGER;
  new_alert_id INTEGER;
BEGIN
  -- Check for existing unresolved alert of same type
  SELECT id INTO existing_alert
  FROM health_alerts
  WHERE user_id = p_user_id
    AND alert_type = p_alert_type
    AND is_resolved = false
    AND created_at >= NOW() - INTERVAL '24 hours'
  LIMIT 1;
  
  IF existing_alert IS NOT NULL THEN
    -- Update existing alert
    UPDATE health_alerts
    SET message = p_message,
        action_required = p_action_required,
        updated_at = NOW()
    WHERE id = existing_alert;
    RETURN existing_alert;
  ELSE
    -- Create new alert
    INSERT INTO health_alerts (
      user_id, alert_type, severity, title, message, action_required, related_target
    ) VALUES (
      p_user_id, p_alert_type, p_severity, p_title, p_message, p_action_required, p_related_target
    ) RETURNING id INTO new_alert_id;
    RETURN new_alert_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE health_checks IS 'Historical record of all health checks performed';
COMMENT ON TABLE health_alerts IS 'Active alerts requiring user attention';
COMMENT ON TABLE subreddit_health_history IS 'Time-series subreddit health data';
COMMENT ON TABLE account_health_metrics IS 'User account health snapshots';
COMMENT ON TABLE content_similarity_checks IS 'Content repetitiveness detection';
COMMENT ON VIEW user_health_dashboard IS 'Comprehensive user health overview';
COMMENT ON VIEW subreddit_health_dashboard IS 'Subreddit health trends';
COMMENT ON FUNCTION calculate_account_health_score IS 'Computes 0-100 health score';
COMMENT ON FUNCTION create_health_alert IS 'Creates/updates health alerts with deduplication';
