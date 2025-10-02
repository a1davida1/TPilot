-- Create table to persist Reddit posting outcomes for compliance tracking
CREATE TABLE IF NOT EXISTS reddit_post_outcomes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subreddit VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  reason TEXT,
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reddit_post_outcomes_user_idx
  ON reddit_post_outcomes (user_id, occurred_at);

CREATE INDEX IF NOT EXISTS reddit_post_outcomes_status_idx
  ON reddit_post_outcomes (status);

CREATE INDEX IF NOT EXISTS reddit_post_outcomes_subreddit_idx
  ON reddit_post_outcomes (subreddit);
