# Project Fundamentals

## Overview
This document outlines the core fundamentals, primitives, and resources for the Sail MCP knowledge packet system. Use this as the authoritative reference for project architecture, deployment, and implementation decisions.

## GCP Infrastructure

### Organization
sailmcp.com
- Type: Organization
- ID: 960203342031

### Project
Sail MCP Production Platform
- Type: Project	
- ID: sail-mcp-production

## Production Architecture

### Domain Setup
#### sailmcp.com (Main Domain)
- Registered: GoDaddy
- Hosting: Vercel (Frontend)
- Purpose: Marketing site / Frontend application
- Status: Correctly points to Vercel only

#### mcp.sailmcp.com (Subdomain)
- Created: GoDaddy DNS
- Mapped to: sail-backend Cloud Run service
- Purpose: All client MCP integrations
- Example URL: https://mcp.sailmcp.com/{packet-id}/mcp
- Status: Active and verified (green check)

### Cloud Run Service (SINGLE SERVICE)

#### sail-backend
- Purpose: MCP packet server for client integrations  
- Domain: mcp.sailmcp.com
- URL Pattern: https://mcp.sailmcp.com/{packet-id}/mcp
- Deployment: Continuous deployment from GitHub (main branch)
- Docker: backend/Dockerfile, handled automatically by Cloud Build
- Trigger: Push to main branch → automatic deployment
- Status: PRODUCTION
- Note: This is the ONLY Cloud Run service (sailmcp-backend deleted on 2025-07-02)

### Cloud SQL (PostgreSQL)
- Type: Cloud SQL Database
- Instance IP: 34.135.247.25
- Database: sail_prod
- User: sail_user
- SSL: Enabled
- Region: [To be confirmed]

### Cloud Run Jobs
- Status: None needed
- Reason: MCP server only needs to handle real-time HTTP requests, no batch processing required

## Resources & Configuration

### GitHub Repository
- URL: https://github.com/tom-mcmillan/sail
- Branch: main (triggers automatic deployment)

### Key Files
- `/backend/Dockerfile` - Production container build
- `/backend/src/mcp-packet-server.ts` - Main server implementation  
- `/backend/simple-package.json` - Dependencies
- `/backend/deploy.sh` - DEPRECATED (use continuous deployment)

### Authentication & Access
- GCP User: tom@sailmcp.com (ONLY - never use other accounts)
- GCP Project: sail-mcp-production
- GitHub: Connected for continuous deployment

### APIs & External Services
- Cloud Run API
- Cloud Build API  
- Container Registry API
- Cloud SQL Admin API
- Google Drive API (for future integration)

### Services NOT Used (for clarity)
- Secret Manager (credentials in environment variables)
- Cloud Storage (using local file system)
- Cloud Logging (using console.log)
- VPC/Networking (using default)
- Load Balancers (Cloud Run handles this)

## Docker Configuration

### Production Setup (CLEANED UP)
- **File**: `/backend/Dockerfile` (ONLY Dockerfile)
- **Strategy**: Multi-stage build (builder + production)
- **Base Image**: node:18-alpine (smaller, secure)
- **Build Process**: TypeScript compiled to JavaScript
- **Runtime**: Node.js (compiled JS, not tsx)
- **User**: nodejs (non-root, UID 1001)
- **Health Check**: Built-in health endpoint monitoring
- **Dependencies**: simple-package.json (minimal: MCP SDK, Express, Zod)

### Docker Best Practices Applied:
✅ **Security**: Non-root user (nodejs:1001)  
✅ **Performance**: Compiled TypeScript, not runtime compilation  
✅ **Size**: Alpine base image (~40MB vs ~400MB)  
✅ **Caching**: Multi-stage build for better layer caching  
✅ **Health**: Built-in health check for Cloud Run  
✅ **Clean**: Only production dependencies in final image  
✅ **Simple**: Single Dockerfile, clear purpose  

### Removed Files:
- ❌ Dockerfile.simple (duplicate)
- ❌ Dockerfile.backup (old approach)  
- ❌ Dockerfile.dev (development only)
- ❌ Dockerfile.mcp (different purpose)

### Build Process:
1. **Builder stage**: Install deps + compile TypeScript
2. **Production stage**: Copy compiled JS + production deps only
3. **Result**: Small, secure, fast container

