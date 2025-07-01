-- Create test exchange for MCP Inspector testing
INSERT INTO exchanges (
  slug,
  name,
  description,
  type,
  knowledge_type,
  status,
  privacy,
  config,
  metadata
) VALUES (
  'local-files-test-125866fe',
  'Test MCP Exchange',
  'Test exchange for MCP Inspector',
  'local',
  'local',
  'active',
  'public',
  '{"path": "/tmp/test-mcp"}',
  '{"test": true}'
) ON CONFLICT (slug) DO UPDATE
SET status = 'active',
    updated_at = NOW();