-- Create a test exchange for the Sail documentation
-- This will expose the /docs folder via MCP

-- First, ensure we have a test user (or use an existing one)
INSERT INTO users (id, email, name, password_hash, plan)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'test@sailmcp.com',
  'Test User',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiGc1CfnGI.y', -- password: test123
  'free'
) ON CONFLICT (id) DO NOTHING;

-- Create the test exchange
INSERT INTO exchanges (
  id,
  user_id,
  name,
  description,
  type,
  knowledge_type,
  slug,
  privacy,
  status,
  config,
  metadata,
  queries_count,
  created_at,
  updated_at
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Sail Documentation',
  'Complete documentation for the Sail MCP platform including development guides and architecture',
  'local',
  'local',
  'sail-docs-test-001',
  'public', -- Making it public so no auth needed for testing
  'active',
  '{"folderPath": "/Users/thomasmcmillan/projects/sail/docs"}',
  '{"file_count": 10, "total_size": 50000, "processed_at": "2024-07-01T12:00:00Z"}',
  0,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  config = EXCLUDED.config,
  privacy = EXCLUDED.privacy,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Show the created exchange
SELECT 
  name,
  slug,
  privacy,
  status,
  'http://localhost:3001/' || slug || '/mcp' as local_url,
  'https://sailmcp.com/' || slug || '/mcp' as production_url
FROM exchanges 
WHERE slug = 'sail-docs-test-001';