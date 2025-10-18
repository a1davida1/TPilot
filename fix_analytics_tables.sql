-- Create reddit_posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS reddit_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subreddit VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    caption TEXT,
    reddit_id VARCHAR(20) UNIQUE,
    reddit_url TEXT,
    image_urls TEXT[],
    scheduled_for TIMESTAMP,
    posted_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'draft',
    upvotes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for reddit_posts
CREATE INDEX IF NOT EXISTS idx_reddit_posts_user ON reddit_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_subreddit ON reddit_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_status ON reddit_posts(status);
CREATE INDEX IF NOT EXISTS idx_reddit_posts_posted_at ON reddit_posts(posted_at);

-- Create post_analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS post_analytics (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    measured_at TIMESTAMP DEFAULT NOW(),
    upvotes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2),
    visibility_score INTEGER,
    trending_score INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for post_analytics
CREATE INDEX IF NOT EXISTS idx_post_analytics_post ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_user ON post_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_measured ON post_analytics(measured_at);

-- Create caption_analytics table if it doesn't exist  
CREATE TABLE IF NOT EXISTS caption_analytics (
    id SERIAL PRIMARY KEY,
    caption_id INTEGER,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    style VARCHAR(50),
    prompt_type VARCHAR(50),
    performance_score DECIMAL(5,2),
    engagement_rate DECIMAL(5,2),
    upvotes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    click_through_rate DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for caption_analytics
CREATE INDEX IF NOT EXISTS idx_caption_analytics_user ON caption_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_caption_analytics_style ON caption_analytics(style);
CREATE INDEX IF NOT EXISTS idx_caption_analytics_created ON caption_analytics(created_at);

-- Create reddit_communities table if it doesn't exist
CREATE TABLE IF NOT EXISTS reddit_communities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    description TEXT,
    subscribers INTEGER DEFAULT 0,
    is_nsfw BOOLEAN DEFAULT FALSE,
    rules JSONB,
    post_types TEXT[],
    flairs JSONB,
    peak_hours JSONB,
    engagement_rate DECIMAL(5,2),
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for reddit_communities
CREATE INDEX IF NOT EXISTS idx_reddit_communities_name ON reddit_communities(name);
CREATE INDEX IF NOT EXISTS idx_reddit_communities_nsfw ON reddit_communities(is_nsfw);
