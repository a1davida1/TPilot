-- Caption Analytics Tables for One-Click Posting
-- Tracks caption A/B testing, user choices, and post outcomes
-- Privacy-safe: stores metadata only, no image bytes

-- Table: captions
-- Stores generated caption text with model and style metadata
CREATE TABLE IF NOT EXISTS captions (
  caption_id TEXT PRIMARY KEY,
  model TEXT NOT NULL, -- e.g., 'grok-4-fast', 'claude-3-opus'
  style TEXT NOT NULL, -- e.g., 'flirty', 'slutty'
  text TEXT NOT NULL,
  prompt_hash TEXT, -- Hash of prompt for cache lookup
  category TEXT, -- Content category (e.g., 'lingerie', 'fitness')
  tags TEXT[], -- Content tags
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_captions_prompt_hash ON captions(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_captions_created_at ON captions(created_at);
CREATE INDEX IF NOT EXISTS idx_captions_style ON captions(style);

-- Table: caption_pairs
-- Links two captions shown together for A/B testing
CREATE TABLE IF NOT EXISTS caption_pairs (
  pair_id TEXT PRIMARY KEY,
  caption_id_a TEXT NOT NULL REFERENCES captions(caption_id),
  caption_id_b TEXT NOT NULL REFERENCES captions(caption_id),
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  tags TEXT[],
  protection_preset TEXT, -- 'fast', 'medium', 'max'
  device_bucket TEXT, -- 'mobile', 'tablet', 'desktop'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_caption_pairs_creator ON caption_pairs(creator_id);
CREATE INDEX IF NOT EXISTS idx_caption_pairs_created_at ON caption_pairs(created_at);

-- Table: caption_choices
-- Records which caption the user selected
CREATE TABLE IF NOT EXISTS caption_choices (
  choice_id SERIAL PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES caption_pairs(pair_id) ON DELETE CASCADE,
  chosen_caption_id TEXT NOT NULL REFERENCES captions(caption_id),
  time_to_choice_ms INTEGER NOT NULL,
  edited BOOLEAN DEFAULT FALSE,
  edit_delta_chars INTEGER, -- Character count difference if edited
  auto_selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_caption_choices_pair ON caption_choices(pair_id);
CREATE INDEX IF NOT EXISTS idx_caption_choices_caption ON caption_choices(chosen_caption_id);
CREATE INDEX IF NOT EXISTS idx_caption_choices_created_at ON caption_choices(created_at);

-- Table: posts
-- Links posted content to captions and tracks submission
CREATE TABLE IF NOT EXISTS posts (
  post_id SERIAL PRIMARY KEY,
  reddit_post_id TEXT UNIQUE, -- Reddit's ID (e.g., 't3_abc123')
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subreddit TEXT NOT NULL,
  caption_id TEXT REFERENCES captions(caption_id),
  pair_id TEXT REFERENCES caption_pairs(pair_id),
  nsfw_flag BOOLEAN DEFAULT TRUE,
  flair TEXT,
  protection_preset TEXT,
  metrics_ssim REAL, -- SSIM quality score
  metrics_phash_delta INTEGER, -- pHash distance from original
  upload_latency_ms INTEGER,
  reddit_api_latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_for TIMESTAMP, -- NULL if posted immediately
  posted_at TIMESTAMP -- Actual post time
);

CREATE INDEX IF NOT EXISTS idx_posts_creator ON posts(creator_id);
CREATE INDEX IF NOT EXISTS idx_posts_reddit_id ON posts(reddit_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_posts_caption ON posts(caption_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Table: post_metrics
-- Tracks post performance over time
CREATE TABLE IF NOT EXISTS post_metrics (
  metric_id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  measured_at_hours INTEGER NOT NULL, -- Hours after posting (1, 24, etc.)
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  vote_rate_per_min REAL, -- Upvotes per minute in window
  removed BOOLEAN DEFAULT FALSE,
  removal_reason TEXT,
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, measured_at_hours)
);

CREATE INDEX IF NOT EXISTS idx_post_metrics_post ON post_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_metrics_measured_at ON post_metrics(measured_at);

-- Table: protection_metrics
-- Tracks ImageShield performance
CREATE TABLE IF NOT EXISTS protection_metrics (
  metric_id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(post_id) ON DELETE CASCADE,
  ssim REAL NOT NULL,
  phash_delta INTEGER,
  preset TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  downscaled BOOLEAN DEFAULT FALSE,
  original_width INTEGER,
  original_height INTEGER,
  final_width INTEGER,
  final_height INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_protection_metrics_post ON protection_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_protection_metrics_preset ON protection_metrics(preset);

-- Views for analytics queries

-- View: caption_performance
-- Aggregate caption choice rates and post performance by style
CREATE OR REPLACE VIEW caption_performance AS
SELECT
  c.style,
  COUNT(DISTINCT cc.choice_id) AS times_chosen,
  COUNT(DISTINCT cp.pair_id) AS times_shown,
  ROUND(COUNT(DISTINCT cc.choice_id)::NUMERIC / NULLIF(COUNT(DISTINCT cp.pair_id), 0), 3) AS choice_rate,
  AVG(cc.time_to_choice_ms) AS avg_time_to_choice_ms,
  SUM(CASE WHEN cc.edited THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(cc.choice_id), 0) AS edit_rate,
  AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 24) AS avg_upvotes_24h,
  AVG(pm.comments) FILTER (WHERE pm.measured_at_hours = 24) AS avg_comments_24h
FROM captions c
LEFT JOIN caption_choices cc ON c.caption_id = cc.chosen_caption_id
LEFT JOIN caption_pairs cp ON c.caption_id IN (cp.caption_id_a, cp.caption_id_b)
LEFT JOIN posts p ON cc.chosen_caption_id = p.caption_id
LEFT JOIN post_metrics pm ON p.post_id = pm.post_id
GROUP BY c.style;

-- View: subreddit_performance
-- Aggregate post performance by subreddit
CREATE OR REPLACE VIEW subreddit_performance AS
SELECT
  p.subreddit,
  COUNT(DISTINCT p.post_id) AS total_posts,
  AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 1) AS avg_upvotes_1h,
  AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 24) AS avg_upvotes_24h,
  AVG(pm.comments) FILTER (WHERE pm.measured_at_hours = 24) AS avg_comments_24h,
  SUM(CASE WHEN pm.removed THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(pm.metric_id), 0) AS removal_rate,
  MAX(p.posted_at) AS last_posted_at
FROM posts p
LEFT JOIN post_metrics pm ON p.post_id = pm.post_id
GROUP BY p.subreddit
ORDER BY avg_upvotes_24h DESC NULLS LAST;

-- View: creator_caption_preferences
-- Track individual creator preferences by style
CREATE OR REPLACE VIEW creator_caption_preferences AS
SELECT
  cp.creator_id,
  c.style,
  COUNT(cc.choice_id) AS times_chosen,
  AVG(cc.time_to_choice_ms) AS avg_choice_time_ms,
  SUM(CASE WHEN cc.edited THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(cc.choice_id), 0) AS edit_rate
FROM caption_pairs cp
JOIN caption_choices cc ON cp.pair_id = cc.pair_id
JOIN captions c ON cc.chosen_caption_id = c.caption_id
GROUP BY cp.creator_id, c.style;

COMMENT ON TABLE captions IS 'Stores AI-generated caption text with model/style metadata';
COMMENT ON TABLE caption_pairs IS 'Links two captions shown together for A/B testing';
COMMENT ON TABLE caption_choices IS 'Records which caption the user selected and edit behavior';
COMMENT ON TABLE posts IS 'Tracks Reddit posts with associated captions and ImageShield metrics';
COMMENT ON TABLE post_metrics IS 'Time-series metrics for post performance (upvotes, comments, removals)';
COMMENT ON TABLE protection_metrics IS 'ImageShield quality and performance metrics per post';
