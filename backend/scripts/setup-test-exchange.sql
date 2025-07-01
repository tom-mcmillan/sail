-- Production test exchange for Claude AI integration
-- This creates a public exchange that exposes documentation

-- Create test user if not exists
INSERT INTO users (id, email, name, password_hash, plan)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'claude-test@sailmcp.com',
  'Claude Test User',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiGc1CfnGI.y', -- password: test123
  'free'
) ON CONFLICT (id) DO NOTHING;

-- Create the Sail docs test exchange
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
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Sail Documentation',
  'Complete documentation for the Sail MCP platform - architecture, development guides, and resources',
  'local',
  'local',
  'sail-docs-demo',
  'public', -- Public so Claude can access without auth
  'active',
  '{"folderPath": "/app/storage/sail-docs"}',
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

-- Also create a test exchange with sample data
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
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Sample Knowledge Base',
  'A sample knowledge base with example documents for testing MCP integration',
  'local',
  'local',
  'sample-knowledge-base',
  'public',
  'active',
  '{"folderPath": "/app/storage/sample"}',
  '{"file_count": 5, "total_size": 25000, "processed_at": "2024-07-01T12:00:00Z"}',
  0,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Display the created exchanges
SELECT 
  name,
  slug,
  description,
  privacy,
  status,
  'https://mcp.sailmcp.com/' || slug || '/mcp' as mcp_url
FROM exchanges 
WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY created_at DESC;