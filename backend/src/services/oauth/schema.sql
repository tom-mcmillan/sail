-- OAuth Clients table
CREATE TABLE IF NOT EXISTS oauth_clients (
  id VARCHAR(255) PRIMARY KEY,
  secret VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  redirect_uris TEXT NOT NULL, -- JSON array
  scopes TEXT[] NOT NULL,
  is_public BOOLEAN DEFAULT false,
  pkce_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- OAuth Authorization Codes table
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code VARCHAR(255) PRIMARY KEY,
  client_id VARCHAR(255) REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id UUID, -- NULL for client credentials
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  code_challenge VARCHAR(255),
  code_challenge_method VARCHAR(10),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- OAuth Access Tokens table
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  token TEXT PRIMARY KEY,
  client_id VARCHAR(255) REFERENCES oauth_clients(id) ON DELETE CASCADE,
  user_id UUID, -- NULL for client credentials
  scopes TEXT[] NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_client_id ON oauth_authorization_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_expires_at ON oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_client_id ON oauth_access_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires_at ON oauth_access_tokens(expires_at);