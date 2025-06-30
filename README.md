# Sail MCP - Universal Knowledge Exchange Platform

Turn your local folders, Google Drive, and GitHub repositories into MCP (Model Context Protocol) servers that AI assistants can query through natural language.

## Architecture Overview

- **Frontend**: Next.js deployed on Vercel (`www.sailmcp.com`)
- **Backend**: Node.js/Express deployed on Google Cloud Run (`mcp.sailmcp.com`)
- **Database**: PostgreSQL on Google Cloud SQL
- **Storage**: Google Cloud Storage + Redis for caching

## Generated MCP URLs

The system generates industry-standard MCP URLs:
```
https://mcp.sailmcp.com/{slug}/mcp
```

Compatible with Claude.ai, ChatGPT, and other MCP clients.

## Prerequisites

- Node.js 18+
- Docker
- Google Cloud CLI (`gcloud`)
- Vercel CLI
- GoDaddy DNS access (for sailmcp.com)

## Quick Start Guide

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/tom-mcmillan/sail.git
cd sail

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies  
cd ../frontend
npm install
```

### 2. Environment Setup

#### Backend Environment Variables
Create `backend/.env`:
```bash
NODE_ENV=production
BASE_URL=https://mcp.sailmcp.com
FRONTEND_URL=https://frontend-{deployment-id}.vercel.app
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-jwt-secret-here
REDIS_URL=redis://localhost:6379
```

#### Frontend Environment Variables
Set in Vercel:
```bash
NEXT_PUBLIC_API_URL=https://sail-backend-{hash}.us-central1.run.app
NEXT_PUBLIC_BASE_URL=https://www.sailmcp.com
NODE_ENV=production
```

### 3. DNS Configuration

**GoDaddy DNS Records** (sailmcp.com):
```
Type: CNAME | Name: www    | Value: 103bffb9c2388684.vercel-dns-017.com
Type: CNAME | Name: mcp    | Value: ghs.googlehosted.com
```

### 4. Backend Deployment (Google Cloud Run)

```bash
cd backend

# Build and push Docker image
docker buildx build --platform linux/amd64 --push -t gcr.io/sail-mcp-production/sail-backend:latest .

# Deploy to Cloud Run
gcloud run deploy sail-backend \
  --image gcr.io/sail-mcp-production/sail-backend:latest \
  --region=us-central1 \
  --allow-unauthenticated

# Add custom domain
gcloud beta run domain-mappings create \
  --service=sail-backend \
  --domain=mcp.sailmcp.com \
  --region=us-central1

# Set environment variables
gcloud run services update sail-backend --region=us-central1 \
  --set-env-vars="BASE_URL=https://mcp.sailmcp.com,NODE_ENV=production,FRONTEND_URL=https://frontend-{deployment-id}.vercel.app"
```

### 5. Frontend Deployment (Vercel)

```bash
cd frontend

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://sail-backend-{hash}.us-central1.run.app

# Deploy
vercel --prod --yes
```

## Startup Order (Critical!)

When restarting the system, follow this exact order:

### 1. Start Backend Services
```bash
# 1. Ensure Cloud SQL is running
gcloud sql instances list

# 2. Ensure Redis is available
# (Cloud Memorystore or local Redis)

# 3. Deploy backend if needed
cd backend
gcloud run deploy sail-backend --image gcr.io/sail-mcp-production/sail-backend:latest --region=us-central1
```

### 2. Verify Backend Health
```bash
curl https://mcp.sailmcp.com/health
# Should return: {"status":"healthy",...}

curl https://mcp.sailmcp.com/.well-known/oauth-authorization-server
# Should return OAuth metadata
```

### 3. Update Frontend Environment
```bash
cd frontend

# Get the current frontend deployment URL
vercel ls

# Update backend CORS to allow current frontend
gcloud run services update sail-backend --region=us-central1 \
  --set-env-vars="FRONTEND_URL=https://frontend-{current-deployment}.vercel.app"
```

### 4. Test Integration
```bash
# Test exchange creation
curl -X POST https://sail-backend-{hash}.us-central1.run.app/api/exchanges \
  -H "Content-Type: application/json" \
  -H "Origin: https://frontend-{deployment}.vercel.app" \
  -d '{"name":"Test","description":"Test","type":"local","config":{"folderPath":"/test"}}'
```

## Common Issues & Solutions

### 1. "Failed to create MCP server"
**Cause**: CORS not allowing frontend origin
**Solution**:
```bash
# Check current frontend deployment URL
vercel ls

# Update backend CORS
gcloud run services update sail-backend --region=us-central1 \
  --set-env-vars="FRONTEND_URL=https://frontend-{actual-deployment}.vercel.app"
```

### 2. "Route not found" on OAuth consent
**Cause**: OAuth consent routes not deployed
**Solution**:
```bash
# Ensure latest code is deployed
git status  # Should be clean
git push    # If needed
# Redeploy backend with latest code
```

### 3. SSL Certificate Issues
**Cause**: Custom domain SSL not provisioned
**Solution**:
```bash
# Check domain mapping
gcloud beta run domain-mappings list --region=us-central1

# Wait 15-30 minutes for SSL provisioning
# Test with: curl -I https://mcp.sailmcp.com/health
```

### 4. Docker Build Timeouts
**Cause**: Large build context or slow network
**Solution**:
```bash
# Use source deployment instead
gcloud run deploy sail-backend --source . --region=us-central1
```

## Key URLs to Remember

- **Frontend**: https://www.sailmcp.com
- **Backend Health**: https://mcp.sailmcp.com/health  
- **OAuth Discovery**: https://mcp.sailmcp.com/.well-known/oauth-authorization-server
- **Backend Direct**: https://sail-backend-{hash}.us-central1.run.app
- **Frontend Direct**: https://frontend-{id}.vercel.app

## Testing Claude/ChatGPT Integration

1. **Create Exchange**: Go to www.sailmcp.com
2. **Copy MCP URL**: Format should be `https://mcp.sailmcp.com/{slug}/mcp`
3. **Add to AI Client**: 
   - Claude.ai → Settings → Integrations → Add MCP Server
   - ChatGPT → Settings → Integrations → Add Custom Integration
4. **OAuth Flow**: Should redirect to consent screen (not "Route not found")
5. **Test Tools**: Ask AI to search/read your knowledge base

## Debugging Commands

```bash
# Check backend logs
gcloud run services describe sail-backend --region=us-central1

# Check frontend logs  
vercel logs

# Test CORS
curl -I -X OPTIONS https://sail-backend-{hash}.us-central1.run.app/api/exchanges \
  -H "Origin: https://frontend-{deployment}.vercel.app"

# Test OAuth flow
curl "https://mcp.sailmcp.com/oauth/consent?client_id=test&redirect_uri=https://test.com&response_type=code&scope=mcp:read"
```

## Development vs Production

### Local Development
```bash
# Backend
cd backend
npm run dev  # Runs on localhost:3001

# Frontend  
cd frontend
npm run dev  # Runs on localhost:3000
```

### Production URLs
- Frontend: www.sailmcp.com (Vercel)
- MCP Endpoints: mcp.sailmcp.com (Cloud Run)
- Backend APIs: Direct Cloud Run URL for CORS

## Environment Variables Checklist

**Backend (Cloud Run)**:
- ✅ `NODE_ENV=production`
- ✅ `BASE_URL=https://mcp.sailmcp.com` 
- ✅ `FRONTEND_URL=https://frontend-{deployment}.vercel.app`
- ✅ `DATABASE_URL=postgresql://...`
- ✅ `JWT_SECRET=...`

**Frontend (Vercel)**:
- ✅ `NEXT_PUBLIC_API_URL=https://sail-backend-{hash}.us-central1.run.app`
- ✅ `NEXT_PUBLIC_BASE_URL=https://www.sailmcp.com`
- ✅ `NODE_ENV=production`

## Deployment Verification

After any deployment, verify:

1. ✅ Frontend loads: https://www.sailmcp.com
2. ✅ Backend health: https://mcp.sailmcp.com/health
3. ✅ OAuth discovery: https://mcp.sailmcp.com/.well-known/oauth-authorization-server  
4. ✅ Exchange creation works
5. ✅ MCP URLs generate correctly
6. ✅ OAuth consent screen loads (not "Route not found")

## Support

- **GitHub Issues**: https://github.com/tom-mcmillan/sail/issues
- **Documentation**: See `/docs` directory
- **MCP Protocol**: https://modelcontextprotocol.io

---

*Generated: 2025-06-30*  
*Architecture: Universal MCP with Vercel + Cloud Run*