-- Add packet key system for knowledge packet sharing
-- This migration adds tables for packet keys and OAuth token storage

-- OAuth tokens storage (encrypted)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL CHECK (service IN ('github', 'google_drive', 'notion', 'slack')),
  access_token TEXT NOT NULL, -- Should be encrypted in production
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, service)
);

-- Packet keys table
CREATE TABLE IF NOT EXISTS packet_keys (
  key VARCHAR(20) PRIMARY KEY, -- Format: sail-pk-xxxxxxxx
  exchange_id UUID NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255),
  description TEXT,
  permissions JSONB DEFAULT '{"read": true, "write": false}',
  usage_count INTEGER DEFAULT 0,
  max_usage INTEGER, -- NULL means unlimited
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL means never expires
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Packet key usage analytics
CREATE TABLE IF NOT EXISTS packet_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_key VARCHAR(20) NOT NULL REFERENCES packet_keys(key) ON DELETE CASCADE,
  client_info JSONB, -- User agent, IP (hashed), etc.
  method VARCHAR(100),
  resource_accessed TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_service ON oauth_tokens(user_id, service);
CREATE INDEX IF NOT EXISTS idx_packet_keys_exchange ON packet_keys(exchange_id);
CREATE INDEX IF NOT EXISTS idx_packet_keys_creator ON packet_keys(creator_id);
CREATE INDEX IF NOT EXISTS idx_packet_keys_active ON packet_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_packet_key_usage_key ON packet_key_usage(packet_key);
CREATE INDEX IF NOT EXISTS idx_packet_key_usage_created ON packet_key_usage(created_at);

-- Function to generate unique packet key
CREATE OR REPLACE FUNCTION generate_packet_key() RETURNS VARCHAR AS $$
DECLARE
  new_key VARCHAR;
  key_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 8-character string
    new_key := 'sail-pk-' || lower(substring(md5(random()::text), 1, 8));
    
    -- Check if key already exists
    SELECT EXISTS(SELECT 1 FROM packet_keys WHERE key = new_key) INTO key_exists;
    
    -- Exit loop if key is unique
    EXIT WHEN NOT key_exists;
  END LOOP;
  
  RETURN new_key;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update usage count
CREATE OR REPLACE FUNCTION update_packet_key_usage() RETURNS TRIGGER AS $$
BEGIN
  UPDATE packet_keys 
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE key = NEW.packet_key;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_packet_key_usage_trigger
AFTER INSERT ON packet_key_usage
FOR EACH ROW EXECUTE FUNCTION update_packet_key_usage();

-- ROLLBACK
DROP TRIGGER IF EXISTS update_packet_key_usage_trigger ON packet_key_usage;
DROP FUNCTION IF EXISTS update_packet_key_usage();
DROP FUNCTION IF EXISTS generate_packet_key();
DROP INDEX IF EXISTS idx_packet_key_usage_created;
DROP INDEX IF EXISTS idx_packet_key_usage_key;
DROP INDEX IF EXISTS idx_packet_keys_active;
DROP INDEX IF EXISTS idx_packet_keys_creator;
DROP INDEX IF EXISTS idx_packet_keys_exchange;
DROP INDEX IF EXISTS idx_oauth_tokens_user_service;
DROP TABLE IF EXISTS packet_key_usage;
DROP TABLE IF EXISTS packet_keys;
DROP TABLE IF EXISTS oauth_tokens;