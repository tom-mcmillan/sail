# Production Deployment Guide for Sail MCP

## Prerequisites
- Server with Docker and Docker Compose installed
- Domain pointing to server (sailmcp.com)
- SSL certificates configured
- Environment variables configured

## Deployment Steps

### 1. SSH into Your Production Server
```bash
ssh your-username@your-server-ip
```

### 2. Navigate to Your Project Directory
```bash
cd /path/to/sail  # Or wherever your project is deployed
```

### 3. Pull Latest Changes
```bash
git pull origin main
```

### 4. Build and Deploy
```bash
# Stop existing containers
docker-compose -f docker-compose.prod.yml down

# Rebuild containers with latest changes
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### 5. Verify Deployment
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Test health endpoint
curl https://sailmcp.com/health

# Test OAuth metadata
curl https://sailmcp.com/.well-known/oauth-authorization-server
```

## Environment Variables Required

Make sure your `.env.prod` file contains:
```
DATABASE_NAME=your_db_name
DATABASE_USER=your_db_user  
DATABASE_PASSWORD=your_db_password
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Troubleshooting

### Check Container Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs

# Backend only
docker-compose -f docker-compose.prod.yml logs backend

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Database Issues
```bash
# Check database connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U your_db_user -d your_db_name -c "\dt"
```

### Restart Services
```bash
# Restart everything
docker-compose -f docker-compose.prod.yml restart

# Restart just backend
docker-compose -f docker-compose.prod.yml restart backend
```

## Testing the OAuth Consent Flow

1. Create a test exchange:
   ```bash
   curl -X POST https://sailmcp.com/api/exchanges \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Exchange",
       "description": "Testing OAuth flow",
       "type": "local_files"
     }'
   ```

2. Test OAuth authorization:
   ```bash
   # This should redirect to consent screen
   curl -I "https://sailmcp.com/oauth/authorize?response_type=code&client_id=test&redirect_uri=https://example.com/callback&scope=mcp:read"
   ```

3. Test consent screen access:
   ```bash
   curl https://sailmcp.com/oauth/consent?client_id=test&redirect_uri=https://example.com/callback&scope=mcp:read
   ```

## Claude.ai Integration Test

Once deployed:
1. Go to Claude.ai
2. Navigate to Settings > Integrations  
3. Add: `https://sailmcp.com/mcp/your-exchange-slug`
4. Complete OAuth flow
5. Test in chat

## Monitoring

### Key Endpoints to Monitor
- `https://sailmcp.com/health` - Service health
- `https://sailmcp.com/.well-known/oauth-authorization-server` - OAuth metadata
- `https://sailmcp.com/oauth/authorize` - OAuth authorization
- `https://sailmcp.com/mcp/{slug}` - MCP servers

### Log Monitoring
```bash
# Monitor in real-time
docker-compose -f docker-compose.prod.yml logs -f backend | grep -E "(OAuth|MCP|ERROR)"
```