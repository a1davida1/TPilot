-- Create scheduled_posts table for managing scheduled Reddit posts
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  content TEXT,
  image_url TEXT,
  caption TEXT,
  subreddit VARCHAR(100) NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  nsfw BOOLEAN DEFAULT false,
  spoiler BOOLEAN DEFAULT false,
  flair_id VARCHAR(100),
  flair_text VARCHAR(100),
  reddit_post_id VARCHAR(50), -- Store Reddit's post ID after successful posting
  reddit_post_url TEXT, -- Store the full Reddit URL after posting
  error_message TEXT, -- Store error if posting fails
  executed_at TIMESTAMP WITH TIME ZONE, -- When the post was actually executed
  cancelled_at TIMESTAMP WITH TIME ZONE, -- When the post was cancelled
  media_urls TEXT[], -- Array of media URLs for gallery posts
  send_replies BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS scheduled_posts_user_id_idx ON scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS scheduled_posts_status_idx ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS scheduled_posts_scheduled_for_idx ON scheduled_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS scheduled_posts_subreddit_idx ON scheduled_posts(subreddit);

-- Add comment on table
COMMENT ON TABLE scheduled_posts IS 'Stores scheduled Reddit posts for automated publishing';
COMMENT ON COLUMN scheduled_posts.status IS 'Status: pending, processing, completed, failed, or cancelled';
COMMENT ON COLUMN scheduled_posts.reddit_post_id IS 'Reddit post ID after successful submission';
COMMENT ON COLUMN scheduled_posts.media_urls IS 'Array of media URLs for gallery posts';
