-- Initial database schema
-- This migration creates all the core tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exchanges table
CREATE TABLE IF NOT EXISTS exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('local', 'github', 'google-drive', 'zotero')),
  knowledge_type VARCHAR(50) DEFAULT 'local' CHECK (knowledge_type IN ('local', 'github', 'google-drive', 'zotero')),
  slug VARCHAR(255) UNIQUE NOT NULL,
  privacy VARCHAR(20) DEFAULT 'private' CHECK (privacy IN ('private', 'public')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'active', 'error', 'inactive')),
  config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  container_id VARCHAR(255),
  port INTEGER,
  queries_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response_time INTEGER DEFAULT 0,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  permissions JSONB DEFAULT '[]',
  last_used TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OAuth clients table
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id VARCHAR(255) PRIMARY KEY,
  client_secret VARCHAR(255),
  client_name VARCHAR(255) NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  grant_types VARCHAR(50)[] DEFAULT ARRAY['authorization_code'],
  response_types VARCHAR(50)[] DEFAULT ARRAY['code'],
  scope VARCHAR(500) DEFAULT 'mcp:read',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OAuth authorization codes table
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code VARCHAR(255) PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scope VARCHAR(500),
  code_challenge VARCHAR(255),
  code_challenge_method VARCHAR(10) DEFAULT 'S256',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OAuth access tokens table
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  access_token VARCHAR(255) PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  scope VARCHAR(500),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_exchanges_user_id ON exchanges(user_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_slug ON exchanges(slug);
CREATE INDEX IF NOT EXISTS idx_exchanges_status ON exchanges(status);
CREATE INDEX IF NOT EXISTS idx_exchanges_privacy ON exchanges(privacy);
CREATE INDEX IF NOT EXISTS idx_exchanges_created_at ON exchanges(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_exchange_id ON analytics(exchange_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_client_id ON oauth_authorization_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires_at ON oauth_authorization_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client_id ON oauth_access_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_access_tokens(expires_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchanges_updated_at BEFORE UPDATE ON exchanges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_clients_updated_at BEFORE UPDATE ON oauth_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ROLLBACK
-- Drop triggers first
DROP TRIGGER IF EXISTS update_oauth_clients_updated_at ON oauth_clients;
DROP TRIGGER IF EXISTS update_exchanges_updated_at ON exchanges;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_oauth_tokens_expires_at;
DROP INDEX IF EXISTS idx_oauth_tokens_client_id;
DROP INDEX IF EXISTS idx_oauth_codes_expires_at;
DROP INDEX IF EXISTS idx_oauth_codes_client_id;
DROP INDEX IF EXISTS idx_api_keys_key_hash;
DROP INDEX IF EXISTS idx_api_keys_user_id;
DROP INDEX IF EXISTS idx_sessions_expires_at;
DROP INDEX IF EXISTS idx_sessions_user_id;
DROP INDEX IF EXISTS idx_analytics_created_at;
DROP INDEX IF EXISTS idx_analytics_exchange_id;
DROP INDEX IF EXISTS idx_exchanges_created_at;
DROP INDEX IF EXISTS idx_exchanges_privacy;
DROP INDEX IF EXISTS idx_exchanges_status;
DROP INDEX IF EXISTS idx_exchanges_slug;
DROP INDEX IF EXISTS idx_exchanges_user_id;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS oauth_access_tokens;
DROP TABLE IF EXISTS oauth_authorization_codes;
DROP TABLE IF EXISTS oauth_clients;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS analytics;
DROP TABLE IF EXISTS exchanges;
DROP TABLE IF EXISTS users;