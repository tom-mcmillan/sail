# Sail MCP Integration Briefing Document

## Project Overview

**Sail** is a knowledge exchange platform using the Model Context Protocol (MCP) to enable bidirectional knowledge flow between personal repositories and LLM conversations.

**Vision**: 
- **GET**: Share knowledge from personal stores (files, GitHub, Drive) → others via MCP servers
- **POST**: Capture insights from LLM conversations → back to personal stores  
- **Utility Model**: Infrastructure-like pricing, not SaaS subscription

## Current Implementation Status

### Architecture
- **Monorepo**: Frontend (React) + Backend (Node.js/Express) + Docs
- **MCP Server**: `/backend/mcp-server.js` - standalone implementation
- **OAuth Server**: Full OAuth 2.0 + PKCE implementation in `/backend/src/services/oauth/`
- **Transport**: Streamable HTTP with optional session management
- **Tools**: `search_documents`, `get_document`, `list_files` + ChatGPT-optimized `search`, `fetch`

### Integration Status

| Platform | Status | Transport | Auth | Tools Required |
|----------|--------|-----------|------|----------------|
| **Claude Desktop** | ✅ Working | stdio | None | Any MCP tools |
| **Claude Web** | 🔄 Close | SSE | OAuth | Any MCP tools |
| **OpenAI Responses API** | ✅ Ready | HTTP/SSE | Headers | Any MCP tools |
| **ChatGPT Web** | ✅ Ready | Custom | OAuth | `search`, `fetch` only |

## Critical Technical Requirements

### Claude Web App Integration
- **URL Format**: Must end with `/sse/` (e.g., `https://sailmcp.com/mcp/{slug}/sse/`)
- **Transport**: Server-Sent Events (SSE) - legacy but required
- **Authentication**: OAuth 2.0 consent flow via Settings > Integrations
- **Tools**: Full MCP protocol support (tools, resources, prompts)
- **CORS**: Must allow `mcp-session-id` header
- **Current Issue**: Missing `/sse/` endpoint format

### OpenAI Responses API Integration  
- **URL Format**: `https://sailmcp.com/mcp/{slug}` (current format works)
- **Transport**: Both Streamable HTTP and SSE supported
- **Authentication**: Headers-based, no OAuth needed
- **Tools**: Full MCP protocol support
- **Status**: Should work immediately with current implementation

### ChatGPT Web Integration
- **Access**: Pro+ plans only, via custom connectors
- **Tools**: Exactly `search` and `fetch` tools (already implemented)
- **Authentication**: OAuth consent flow
- **Status**: Tools already compliant

## Key Implementation Details

### Your Current Tools (Already Compliant)
```javascript
// In /backend/src/services/mcp/server.ts
tools: [
  {
    name: "search",
    description: "Searches for resources using the provided query string",
    inputSchema: { query: z.string() }
  },
  {
    name: "fetch", 
    description: "Retrieves detailed content for a specific resource",
    inputSchema: { id: z.string() }
  }
]
```

### OAuth Implementation (Working)
- **Authorization Server**: `/backend/src/services/oauth/authServer.ts`
- **Endpoints**: `/oauth/authorize`, `/oauth/consent`, `/oauth/token`, `/oauth/introspect`
- **PKCE Support**: ✅ Implemented
- **Dynamic Client Registration**: ✅ Supported

### Transport Implementation
- **Streamable HTTP**: `/backend/src/services/mcp/transport.ts`
- **Session Management**: Uses `mcp-session-id` headers
- **SSE Support**: Partially implemented, needs `/sse/` endpoint

## Critical Insights from Documentation Review

### Claude.ai Specifics
- Requires SSE transport ending in `/sse/`
- OAuth flow: User connects via Settings > Integrations → redirected to your OAuth server
- Session management optional but recommended
- Full MCP protocol support (tools, resources, prompts)

### OpenAI Responses API Specifics
- Supports both Streamable HTTP and SSE
- Authentication via `headers` parameter (no OAuth needed)
- Tool filtering with `allowed_tools` parameter
- Approval system (can be disabled with `require_approval: "never"`)
- Full MCP protocol support

### ChatGPT Web Specifics
- Deep Research focus - only `search` and `fetch` tools
- Must match exact OpenAI schema (your tools already do)
- Custom connector setup in ChatGPT settings
- OAuth consent flow for authentication

## Immediate Action Items

### 1. Test OpenAI Responses API (Should Work Now)
```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
  "model": "gpt-4.1",
  "tools": [{"type": "mcp", "server_label": "sail", "server_url": "https://sailmcp.com/mcp/your-exchange-slug", "require_approval": "never"}],
  "input": "What files are available in my knowledge base?"
}'
```

### 2. Fix Claude Web SSE Integration
- Add `/sse/` endpoint to your routing
- Ensure SSE transport handles Claude's expected format
- Test CORS headers for `mcp-session-id`

### 3. Knowledge Source Priority
Based on integration capabilities:
1. **GitHub** - Rich structured data, good for both Claude and OpenAI
2. **Documents/Research** - Perfect for OpenAI's deep research focus
3. **Google Drive** - Broad user appeal, document workflows
4. **Local Folders** - Easy implementation, good for testing

## File Locations (Key Implementation Files)

### Core MCP Implementation
- `/backend/mcp-server.js` - Main MCP server
- `/backend/src/services/mcp/server.ts` - Core server with ChatGPT-optimized tools
- `/backend/src/services/mcp/transport.ts` - Transport layer implementation

### Authentication
- `/backend/src/services/oauth/authServer.ts` - OAuth 2.0 server implementation
- `/backend/src/server.ts` - Main Express server with CORS and auth middleware

### Documentation
- `/docs/mcp-reference/` - Comprehensive MCP integration reference docs
  - `/platforms/openai/` - OpenAI/ChatGPT integration specifics
  - `/examples/replit-example/` - Complete working MCP server example
  - `/core/llms-full.txt` - Full MCP protocol specification
- `/docs/claude-integration-guide.md` - Claude-specific integration guide
- `/docs/MCP-SERVER-IMPLEMENTATION-GUIDE.md` - Production MCP server guide

## Testing Endpoints

### Current Working Endpoints
- `POST https://sailmcp.com/mcp/{slug}` - Streamable HTTP (works with OpenAI)
- `GET https://sailmcp.com/mcp/{slug}` - SSE notifications
- `DELETE https://sailmcp.com/mcp/{slug}` - Session cleanup

### Missing Endpoint (Claude Web)
- `GET https://sailmcp.com/mcp/{slug}/sse/` - Claude web SSE endpoint

## Quick Wins

1. **Test OpenAI Responses API** - Should work with current implementation
2. **Add `/sse/` endpoint** - Minimal change to fix Claude web integration  
3. **Document working integrations** - Build confidence and user base

## Knowledge Sources Strategy

Focus on **GitHub integration first** because:
- Rich, structured data (code + docs + issues)
- Appeals to both Claude (full MCP) and OpenAI (research) use cases
- Clear access patterns and permissions
- Good for demonstrating both GET and POST capabilities

---

*This briefing document represents the current state of Sail MCP integrations as of our documentation review. Update as implementation progresses.*