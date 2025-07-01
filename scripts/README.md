# Sail MCP Test Scripts

This directory contains test scripts for validating the Sail MCP multi-source bundling functionality.

## Scripts

### test-mvp.js

Comprehensive test script that validates the entire multi-source MCP bundling MVP:

- Tests available adapter registration
- Creates single-source exchanges (baseline functionality)
- Creates bundled exchanges (main MVP feature)
- Verifies configuration and lists all exchanges
- Provides summary and next steps

**Usage:**
```bash
node scripts/test-mvp.js
```

**Expected Output:**
- ✅ All 4 adapter types available (local, github, google_drive, composite)
- ✅ Single-source exchange creation works
- ✅ Bundled exchange creation with multiple sources
- ✅ Proper configuration with source weights and types
- Generated MCP URLs ready for Claude AI integration

### test-bundled-exchange.js

Focused test script for creating bundled exchanges with GitHub and Google Drive sources.

**Usage:**
```bash
node scripts/test-bundled-exchange.js
```

## Integration with Claude AI

Once bundled exchanges are created, use the generated MCP URLs in Claude AI:

1. Copy the MCP URL from the test output (e.g., `https://mcp.sailmcp.com/investor-bundle-abc123/mcp`)
2. Add it as an MCP server in Claude AI web interface
3. Test cross-source search and content retrieval
4. Validate tools and prompts from all bundled sources

## MVP Architecture

The bundled exchange MVP enables:

- **GitHub Integration**: Repository files, issues, pull requests
- **Google Drive Integration**: Documents, spreadsheets, presentations  
- **Local File Integration**: Server-side file access
- **Composite Bundling**: Unified search across all sources
- **Production Deployment**: Cloud Run infrastructure

## Required Credentials

For production use, replace demo tokens with real credentials:

- GitHub: Personal access token with repo permissions
- Google Drive: OAuth access token with drive.readonly scope
- Local: Valid server file paths

## Next Steps

1. ✅ Multi-source adapter implementation
2. ✅ Bundled exchange API endpoints  
3. ✅ Production deployment pipeline
4. 🔄 Claude AI integration testing
5. 📋 Real credential configuration
6. 📈 Performance optimization and caching