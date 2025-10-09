-- Migration: Add token versioning for instant revocation
-- Phase 2: Auth migration to JWT Bearer with refresh tokens
-- Date: 2025-10-08

-- Add token version column for instant revocation
-- When user logs out or changes password, increment this to invalidate all tokens
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Index for fast token version lookups during auth
CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(token_version);

-- Comments for documentation
COMMENT ON COLUMN users.token_version IS 'Incremented to revoke all user tokens instantly (logout, password change, security breach)';
