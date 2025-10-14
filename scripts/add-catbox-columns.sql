-- Migration script to add Catbox support
-- Run this after deployment to enable Catbox features

-- Add catbox_userhash column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS catbox_userhash VARCHAR(255);

-- Create catbox_uploads table for tracking
CREATE TABLE IF NOT EXISTS catbox_uploads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  url VARCHAR(255) NOT NULL,
  filename VARCHAR(255),
  file_size INTEGER,
  upload_duration INTEGER,
  retry_count INTEGER DEFAULT 0,
  provider VARCHAR(50) DEFAULT 'catbox',
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS catbox_uploads_user_idx ON catbox_uploads(user_id);
CREATE INDEX IF NOT EXISTS catbox_uploads_url_idx ON catbox_uploads(url);
CREATE INDEX IF NOT EXISTS catbox_uploads_uploaded_at_idx ON catbox_uploads(uploaded_at);

-- To run this migration:
-- 1. Connect to your database
-- 2. Run: \i /path/to/add-catbox-columns.sql
-- 3. Or use: npm run db:push (after uncommenting the schema)
