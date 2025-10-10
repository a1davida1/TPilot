-- Create user_storage_assets table for tracking external image hosting
CREATE TABLE IF NOT EXISTS user_storage_assets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- imgur-anon, imgur-auth, s3, catbox, etc
  url TEXT NOT NULL, -- Direct URL to the asset
  delete_hash VARCHAR(255), -- For deletion (Imgur specific)
  source_filename VARCHAR(500), -- Original filename
  width INTEGER, -- Image dimensions
  height INTEGER,
  file_size INTEGER, -- Size in bytes
  mime_type VARCHAR(100), -- Content type
  metadata JSONB, -- Provider-specific metadata
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP -- Soft delete
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS user_storage_assets_user_id_idx ON user_storage_assets(user_id);
CREATE INDEX IF NOT EXISTS user_storage_assets_provider_idx ON user_storage_assets(provider);
CREATE INDEX IF NOT EXISTS user_storage_assets_created_at_idx ON user_storage_assets(created_at);

-- Add comment on table
COMMENT ON TABLE user_storage_assets IS 'Tracks user uploaded images to external hosting providers like Imgur, S3, Catbox';
COMMENT ON COLUMN user_storage_assets.provider IS 'The external hosting provider: imgur-anon, imgur-auth, s3, catbox, etc';
COMMENT ON COLUMN user_storage_assets.delete_hash IS 'Imgur-specific deletion hash for removing images';
COMMENT ON COLUMN user_storage_assets.metadata IS 'JSON blob for provider-specific data like album IDs, CDN URLs, etc';
