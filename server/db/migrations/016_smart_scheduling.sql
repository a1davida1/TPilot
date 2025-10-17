-- Smart Scheduling & Optimal Timing System
-- Migration 016: Adds intelligent post timing recommendations

-- ============================================================================
-- TABLE: optimal_posting_times
-- Stores analyzed best times to post for each subreddit
-- ============================================================================
CREATE TABLE IF NOT EXISTS optimal_posting_times (
  id SERIAL PRIMARY KEY,
  subreddit VARCHAR(100) NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  avg_upvotes DECIMAL(10, 2) DEFAULT 0,
  median_upvotes INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5, 2) DEFAULT 0, -- % of posts that exceeded threshold
  score INTEGER DEFAULT 0, -- 0-100 composite score
  last_calculated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(subreddit, day_of_week, hour_of_day)
);

CREATE INDEX idx_optimal_times_subreddit ON optimal_posting_times(subreddit);
CREATE INDEX idx_optimal_times_score ON optimal_posting_times(score DESC);
CREATE INDEX idx_optimal_times_lookup ON optimal_posting_times(subreddit, day_of_week, hour_of_day);

-- ============================================================================
-- TABLE: user_posting_patterns
-- Tracks individual user's successful posting times
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_posting_patterns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subreddit VARCHAR(100),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  avg_upvotes DECIMAL(10, 2) DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  last_post_at TIMESTAMP,
  preference_score INTEGER DEFAULT 50, -- 0-100, higher = user prefers this time
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, subreddit, day_of_week, hour_of_day)
);

CREATE INDEX idx_user_patterns_user ON user_posting_patterns(user_id);
CREATE INDEX idx_user_patterns_subreddit ON user_posting_patterns(subreddit);
CREATE INDEX idx_user_patterns_score ON user_posting_patterns(preference_score DESC);

-- ============================================================================
-- TABLE: scheduling_experiments
-- Tracks performance of auto-scheduled vs manual posts
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduling_experiments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER REFERENCES reddit_posts(id) ON DELETE SET NULL,
  scheduled_post_id INTEGER REFERENCES scheduled_posts(id) ON DELETE SET NULL,
  
  scheduling_type VARCHAR(20) NOT NULL CHECK (scheduling_type IN ('auto', 'manual', 'recommended')),
  recommended_time TIMESTAMP,
  actual_time TIMESTAMP,
  time_diff_minutes INTEGER, -- Difference between recommended and actual
  
  subreddit VARCHAR(100),
  predicted_upvotes INTEGER,
  actual_upvotes INTEGER,
  prediction_error INTEGER, -- actual - predicted
  
  was_optimal_time BOOLEAN DEFAULT false,
  confidence_score INTEGER, -- 0-100
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_experiments_user ON scheduling_experiments(user_id);
CREATE INDEX idx_experiments_type ON scheduling_experiments(scheduling_type);
CREATE INDEX idx_experiments_post ON scheduling_experiments(post_id);

-- ============================================================================
-- TABLE: calendar_slots
-- Pre-calculated optimal time slots for quick lookups
-- ============================================================================
CREATE TABLE IF NOT EXISTS calendar_slots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  subreddit VARCHAR(100),
  slot_time TIMESTAMP NOT NULL,
  is_optimal BOOLEAN DEFAULT false,
  predicted_upvotes INTEGER,
  confidence_level VARCHAR(20) CHECK (confidence_level IN ('low', 'medium', 'high')),
  reason TEXT, -- Why this slot is optimal
  is_available BOOLEAN DEFAULT true, -- false if slot is taken
  reserved_by INTEGER REFERENCES scheduled_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, subreddit, slot_time)
);

CREATE INDEX idx_calendar_user ON calendar_slots(user_id);
CREATE INDEX idx_calendar_subreddit ON calendar_slots(subreddit);
CREATE INDEX idx_calendar_time ON calendar_slots(slot_time);
CREATE INDEX idx_calendar_optimal ON calendar_slots(is_optimal, is_available);

-- ============================================================================
-- VIEW: best_posting_times
-- Easy lookup for top 3 times per subreddit
-- ============================================================================
CREATE OR REPLACE VIEW best_posting_times AS
SELECT DISTINCT ON (subreddit)
  subreddit,
  ARRAY_AGG(
    json_build_object(
      'day', day_of_week,
      'hour', hour_of_day,
      'avg_upvotes', avg_upvotes,
      'score', score
    ) ORDER BY score DESC
  ) FILTER (WHERE score >= 70) AS top_times
FROM optimal_posting_times
WHERE post_count >= 5 -- Minimum sample size
GROUP BY subreddit;

-- ============================================================================
-- VIEW: user_scheduling_performance
-- Compare auto vs manual scheduling performance per user
-- ============================================================================
CREATE OR REPLACE VIEW user_scheduling_performance AS
SELECT
  user_id,
  scheduling_type,
  COUNT(*) as total_posts,
  AVG(actual_upvotes)::INTEGER as avg_upvotes,
  AVG(prediction_error)::INTEGER as avg_error,
  AVG(CASE WHEN actual_upvotes > predicted_upvotes THEN 1 ELSE 0 END)::DECIMAL(5,2) as beat_prediction_rate,
  AVG(confidence_score)::INTEGER as avg_confidence
FROM scheduling_experiments
WHERE actual_upvotes IS NOT NULL
GROUP BY user_id, scheduling_type;

-- ============================================================================
-- FUNCTION: calculate_optimal_score
-- Calculates a 0-100 score for a time slot
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_optimal_score(
  p_avg_upvotes DECIMAL,
  p_post_count INTEGER,
  p_success_rate DECIMAL
) RETURNS INTEGER AS $$
DECLARE
  upvote_score INTEGER;
  confidence_score INTEGER;
  success_score INTEGER;
BEGIN
  -- Upvote component (0-40 points)
  upvote_score := LEAST(40, (p_avg_upvotes / 10)::INTEGER);
  
  -- Confidence based on sample size (0-30 points)
  confidence_score := CASE
    WHEN p_post_count >= 50 THEN 30
    WHEN p_post_count >= 20 THEN 20
    WHEN p_post_count >= 10 THEN 15
    WHEN p_post_count >= 5 THEN 10
    ELSE 5
  END;
  
  -- Success rate component (0-30 points)
  success_score := (p_success_rate * 0.3)::INTEGER;
  
  RETURN upvote_score + confidence_score + success_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCTION: get_next_optimal_slot
-- Returns the next available optimal time slot for a user/subreddit
-- ============================================================================
CREATE OR REPLACE FUNCTION get_next_optimal_slot(
  p_user_id INTEGER,
  p_subreddit VARCHAR(100),
  p_after_time TIMESTAMP DEFAULT NOW()
) RETURNS TABLE (
  slot_time TIMESTAMP,
  predicted_upvotes INTEGER,
  confidence VARCHAR(20),
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.slot_time,
    cs.predicted_upvotes,
    cs.confidence_level,
    cs.reason
  FROM calendar_slots cs
  WHERE cs.user_id = p_user_id
    AND (p_subreddit IS NULL OR cs.subreddit = p_subreddit)
    AND cs.slot_time > p_after_time
    AND cs.is_available = true
    AND cs.is_optimal = true
  ORDER BY cs.predicted_upvotes DESC, cs.slot_time ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Add column to scheduled_posts for tracking
-- ============================================================================
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS was_auto_scheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS predicted_upvotes INTEGER,
ADD COLUMN IF NOT EXISTS optimal_score INTEGER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE optimal_posting_times IS 'Subreddit-wide optimal posting time analysis';
COMMENT ON TABLE user_posting_patterns IS 'Individual user posting preferences and performance';
COMMENT ON TABLE scheduling_experiments IS 'A/B test tracking for scheduling recommendations';
COMMENT ON TABLE calendar_slots IS 'Pre-calculated available time slots for quick scheduling';
COMMENT ON VIEW best_posting_times IS 'Top 3 optimal times per subreddit';
COMMENT ON VIEW user_scheduling_performance IS 'User performance comparison: auto vs manual';
