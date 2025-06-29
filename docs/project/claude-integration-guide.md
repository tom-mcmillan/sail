# Claude.ai Integration Guide for Sail MCP

## Prerequisites
- Claude Pro, Max, Team, or Enterprise subscription
- A running Sail MCP server instance
- An exchange created with knowledge sources connected

## Integration Steps

### 1. Create an Exchange on Sail
1. Go to https://sailmcp.com
2. Create a new exchange
3. Connect your knowledge source (files, Google Drive, GitHub)
4. Note the MCP server URL: `https://sailmcp.com/mcp/{your-exchange-slug}`

### 2. Add to Claude.ai
1. Go to Claude.ai and sign in
2. Navigate to **Settings > Integrations**
3. Click **"Add custom integration"**
4. Enter your MCP server URL
5. Click **"Add"**

### 3. OAuth Authorization
1. You'll be redirected to Sail's OAuth consent screen
2. Review the permissions requested
3. Click **"Approve"** to grant access
4. You'll be redirected back to Claude.ai

### 4. Enable the Integration
1. In your Claude chat, click the **"Search and tools"** menu
2. Find your Sail MCP integration
3. Click **"Connect"** if needed
4. Enable the specific tools you want to use

## Testing Your Integration

### Quick Test Commands
Once connected, try these in Claude:
- "What files are available in my knowledge exchange?"
- "Can you read [specific file] from my exchange?"
- "Search for [keyword] in my knowledge base"

### Troubleshooting

**Integration not showing up?**
- Ensure you have a Claude Pro/Max/Team/Enterprise subscription
- Check that your MCP server URL is correct
- Verify the server is running and accessible

**OAuth error?**
- Check browser console for errors
- Ensure cookies are enabled
- Try clearing browser cache and retrying

**Tools not working?**
- Make sure tools are enabled in the "Search and tools" menu
- Check that your exchange has content
- Verify file permissions in your knowledge source

## Security Considerations

1. **Only share exchange URLs with trusted users**
   - Anyone with the URL can request access
   - OAuth ensures they need approval

2. **Review permissions carefully**
   - `mcp:read` - Read access to your knowledge
   - `mcp:write` - Modify access (if enabled)

3. **Monitor access**
   - Check your Sail dashboard for access logs
   - Revoke access anytime from Sail settings

## Developer Notes

### MCP Server Endpoints
Your MCP server exposes these endpoints:
- `POST /mcp/{slug}` - JSON-RPC messages
- `GET /mcp/{slug}` - SSE connection
- `DELETE /mcp/{slug}` - Disconnect

### OAuth Flow
1. Authorization: `/oauth/authorize`
2. Consent: `/oauth/consent` 
3. Token: `/oauth/token`
4. Introspection: `/oauth/introspect`

### Testing Locally
```bash
# Test MCP initialization
curl -X POST https://sailmcp.com/mcp/your-slug \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {}
    },
    "id": 1
  }'

# Expected response
{
  "jsonrpc": "2.0",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": {}
    }
  },
  "id": 1
}
```