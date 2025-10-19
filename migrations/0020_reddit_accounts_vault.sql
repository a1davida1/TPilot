-- Stage 1: Reddit OAuth Credential Vault
-- Separate table for encrypted Reddit tokens with audit trail

CREATE TABLE IF NOT EXISTS reddit_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Encrypted credentials
  refresh_token_encrypted TEXT NOT NULL,
  access_token_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for leak detection
  
  -- OAuth metadata
  reddit_username VARCHAR(255) NOT NULL,
  reddit_id VARCHAR(255) NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  
  -- Token lifecycle
  expires_at TIMESTAMP NOT NULL,
  last_rotated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Audit trail
  linked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  
  -- Constraints
  UNIQUE(user_id), -- One Reddit account per user
  UNIQUE(reddit_id) -- One app connection per Reddit account
);

-- Indexes for performance
CREATE INDEX idx_reddit_accounts_user_id ON reddit_accounts(user_id);
CREATE INDEX idx_reddit_accounts_reddit_id ON reddit_accounts(reddit_id);
CREATE INDEX idx_reddit_accounts_expires_at ON reddit_accounts(expires_at) WHERE revoked_at IS NULL;

-- Audit log table
CREATE TABLE IF NOT EXISTS reddit_account_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reddit_account_id INTEGER REFERENCES reddit_accounts(id) ON DELETE SET NULL,
  
  action VARCHAR(50) NOT NULL, -- 'linked', 'refreshed', 'revoked', 'unlinked'
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reddit_audit_user_id ON reddit_account_audit_log(user_id, created_at DESC);
CREATE INDEX idx_reddit_audit_action ON reddit_account_audit_log(action);

-- Comment on encryption
COMMENT ON COLUMN reddit_accounts.refresh_token_encrypted IS 'AES-256-GCM encrypted refresh token';
COMMENT ON COLUMN reddit_accounts.access_token_hash IS 'SHA-256 hash of access token for leak detection';
