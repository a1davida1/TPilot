-- Fix missing columns in reddit_post_outcomes
ALTER TABLE reddit_post_outcomes 
ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- Fix missing columns in reddit_communities
ALTER TABLE reddit_communities 
ADD COLUMN IF NOT EXISTS over18 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_images BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS subscribers INTEGER DEFAULT 0;

-- Create billing_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS billing_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount INTEGER,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Verify changes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'reddit_post_outcomes' 
AND column_name IN ('success', 'title', 'upvotes', 'views');

SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'reddit_communities' 
AND column_name IN ('over18', 'allow_images', 'subscribers');

SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'billing_history';
