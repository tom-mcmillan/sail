-- Insert OAuth clients for Claude and ChatGPT
INSERT INTO oauth_clients (id, name, redirect_uris, scopes, is_public, pkce_required)
VALUES 
  ('claudeai', 'Claude AI', '["https://claude.ai/auth/callback","https://claude.ai/integrations/callback","https://claude.ai/oauth/callback"]', ARRAY['mcp:read', 'mcp:write'], true, false),
  ('chatgpt', 'ChatGPT', '["https://chat.openai.com/aip/oauth/callback","https://chat.openai.com/auth/callback","https://chat.openai.com/oauth/callback"]', ARRAY['mcp:read', 'mcp:write'], true, false)
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  redirect_uris = EXCLUDED.redirect_uris,
  scopes = EXCLUDED.scopes;