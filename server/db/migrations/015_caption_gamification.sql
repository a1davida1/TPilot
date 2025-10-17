-- Caption Analytics Gamification Extensions
-- Adds badges, predictions, daily challenges, and leaderboard support

-- Table: user_badges
-- Tracks achievement badges earned by users
CREATE TABLE IF NOT EXISTS user_badges (
  badge_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(50) NOT NULL, -- 'sharp_shooter', 'viral_writer', 'quick_decider', etc.
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB, -- Additional context (e.g., score that earned it)
  UNIQUE(user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_type ON user_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned ON user_badges(earned_at);

-- Table: caption_predictions
-- Users predict which caption style will perform better
CREATE TABLE IF NOT EXISTS caption_predictions (
  prediction_id SERIAL PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES caption_pairs(pair_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  predicted_style VARCHAR(50) NOT NULL, -- 'flirty' or 'slutty'
  predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  was_correct BOOLEAN, -- Updated after 24h when post metrics available
  actual_winner VARCHAR(50), -- Populated after results known
  confidence_score INTEGER CHECK (confidence_score >= 1 AND confidence_score <= 5), -- User's confidence level
  UNIQUE(pair_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_caption_predictions_user ON caption_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_caption_predictions_pair ON caption_predictions(pair_id);
CREATE INDEX IF NOT EXISTS idx_caption_predictions_predicted ON caption_predictions(predicted_at);

-- Table: daily_challenges
-- Daily caption writing challenges
CREATE TABLE IF NOT EXISTS daily_challenges (
  challenge_id SERIAL PRIMARY KEY,
  challenge_date DATE NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_date ON daily_challenges(challenge_date);

-- Table: challenge_submissions
-- User submissions for daily challenges
CREATE TABLE IF NOT EXISTS challenge_submissions (
  submission_id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES daily_challenges(challenge_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  vote_count INTEGER DEFAULT 0,
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_challenge ON challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_user ON challenge_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_votes ON challenge_submissions(vote_count DESC);

-- Table: challenge_votes
-- Voting on challenge submissions
CREATE TABLE IF NOT EXISTS challenge_votes (
  vote_id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES challenge_submissions(submission_id) ON DELETE CASCADE,
  voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_votes_submission ON challenge_votes(submission_id);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_voter ON challenge_votes(voter_id);

-- Table: caption_improvements
-- AI-generated improvement suggestions for rejected captions
CREATE TABLE IF NOT EXISTS caption_improvements (
  improvement_id SERIAL PRIMARY KEY,
  caption_id TEXT NOT NULL REFERENCES captions(caption_id),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggestion TEXT NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  was_helpful BOOLEAN -- User feedback on suggestion quality
);

CREATE INDEX IF NOT EXISTS idx_caption_improvements_caption ON caption_improvements(caption_id);
CREATE INDEX IF NOT EXISTS idx_caption_improvements_user ON caption_improvements(user_id);

-- View: user_leaderboard
-- Global leaderboard rankings
CREATE OR REPLACE VIEW user_leaderboard AS
SELECT
  u.id as user_id,
  u.username,
  COUNT(DISTINCT p.post_id) as total_posts,
  AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 24) as avg_upvotes_24h,
  STDDEV(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 24) as upvote_variance,
  COUNT(DISTINCT ub.badge_id) as badge_count,
  MAX(p.posted_at) as last_post_at
FROM users u
LEFT JOIN posts p ON u.id = p.creator_id
LEFT JOIN post_metrics pm ON p.post_id = pm.post_id
LEFT JOIN user_badges ub ON u.id = ub.user_id
WHERE p.posted_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.username
HAVING COUNT(DISTINCT p.post_id) >= 5 -- Minimum 5 posts to qualify
ORDER BY avg_upvotes_24h DESC NULLS LAST;

-- View: prediction_accuracy
-- Track user prediction accuracy
CREATE OR REPLACE VIEW prediction_accuracy AS
SELECT
  user_id,
  COUNT(*) as total_predictions,
  SUM(CASE WHEN was_correct = TRUE THEN 1 ELSE 0 END) as correct_predictions,
  ROUND(
    SUM(CASE WHEN was_correct = TRUE THEN 1 ELSE 0 END)::NUMERIC / 
    NULLIF(COUNT(*), 0), 
    3
  ) as accuracy_rate,
  AVG(confidence_score) as avg_confidence
FROM caption_predictions
WHERE was_correct IS NOT NULL
GROUP BY user_id;

-- View: badge_progress
-- Shows user progress toward each badge type
CREATE OR REPLACE VIEW badge_progress AS
WITH user_stats AS (
  SELECT
    cp.creator_id,
    COUNT(DISTINCT cc.choice_id) as total_choices,
    AVG(cc.time_to_choice_ms) as avg_choice_time,
    SUM(CASE WHEN cc.edited THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(cc.choice_id), 0) as edit_rate,
    MAX(pm.upvotes) as best_upvotes,
    COUNT(DISTINCT CASE WHEN pm.upvotes > 500 THEN p.post_id END) as viral_posts
  FROM caption_pairs cp
  LEFT JOIN caption_choices cc ON cp.pair_id = cc.pair_id
  LEFT JOIN posts p ON cc.chosen_caption_id = p.caption_id
  LEFT JOIN post_metrics pm ON p.post_id = pm.post_id AND pm.measured_at_hours = 24
  GROUP BY cp.creator_id
)
SELECT
  us.creator_id as user_id,
  CASE WHEN us.avg_choice_time < 5000 THEN TRUE ELSE FALSE END as can_earn_quick_decider,
  CASE WHEN us.edit_rate > 0.6 THEN TRUE ELSE FALSE END as can_earn_perfectionist,
  CASE WHEN us.viral_posts >= 3 THEN TRUE ELSE FALSE END as can_earn_viral_writer,
  CASE WHEN us.best_upvotes > 1000 THEN TRUE ELSE FALSE END as can_earn_superstar,
  us.total_choices,
  us.avg_choice_time,
  us.edit_rate,
  us.viral_posts
FROM user_stats us;

COMMENT ON TABLE user_badges IS 'Achievement badges earned by users for caption performance';
COMMENT ON TABLE caption_predictions IS 'User predictions of which caption style will perform better';
COMMENT ON TABLE daily_challenges IS 'Daily caption writing challenges for community engagement';
COMMENT ON TABLE challenge_submissions IS 'User submissions for daily caption challenges';
COMMENT ON TABLE challenge_votes IS 'Community votes on challenge submissions';
COMMENT ON TABLE caption_improvements IS 'AI-generated suggestions for improving rejected captions';
