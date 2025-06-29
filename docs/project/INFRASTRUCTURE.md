# Sail MCP Infrastructure Guide

## 🚀 Production-Ready Architecture

Sail now has a complete infrastructure setup supporting both local development and production scale.

## Quick Start

### Local Development (30 seconds)
```bash
# Clone and setup
git clone [repo]
cd sail
./scripts/dev-setup.sh

# Your app is running at:
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
# PgAdmin: http://localhost:5050
```

### Production Deployment
```bash
# Set up GCP infrastructure
./deployment/cloud-sql-setup.sh your-project-id

# Deploy via GitHub Actions
git push origin main
```

## Architecture Overview

### Local Development
- **Docker Compose** with hot reloading
- **PostgreSQL 15** for database
- **Redis 7** for caching/sessions
- **Volume mounts** for instant code changes

### Production (Auto-scaling)
- **Google Cloud Run** for serverless containers
- **Cloud SQL** for managed PostgreSQL
- **Cloud Memorystore** for managed Redis
- **Secret Manager** for credentials
- **GitHub Actions** for CI/CD

## Infrastructure Components

### Development Stack
```yaml
Services:
  - Frontend (Next.js) → :3000
  - Backend (Express) → :3001  
  - PostgreSQL → :5432
  - Redis → :6379
  - PgAdmin → :5050
```

### Production Stack
```yaml
Google Cloud:
  - Cloud Run (Backend) → Auto-scaling 1-100 instances
  - Cloud Run (Frontend) → Auto-scaling 0-50 instances
  - Cloud SQL (PostgreSQL) → Managed database
  - Cloud Memorystore (Redis) → Managed cache
  - Secret Manager → Secure credentials
  - Container Registry → Docker images
```

## Scaling Characteristics

### Current VM Approach
- ❌ Fixed cost: ~$30/month (always running)
- ❌ Manual scaling: Can't handle traffic spikes
- ❌ Single point of failure
- ❌ Manual deployments

### New Cloud Run Approach  
- ✅ Pay-per-use: ~$10-50/month (scales to zero)
- ✅ Auto-scaling: 0 to 100 instances in seconds
- ✅ Built-in redundancy: 99.9% uptime SLA
- ✅ Automated deployments: Zero downtime

## Development Workflow

### Daily Development
```bash
# Start everything
docker-compose up

# Work on backend (hot reload enabled)
cd backend && npm run dev

# Work on frontend (hot reload enabled)  
cd frontend && npm run dev

# View logs
docker-compose logs -f backend
```

### Testing MCP Integrations
```bash
# Test Claude SSE endpoint
curl http://localhost:3001/mcp/test-5965ec3f/sse/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "initialize", ...}'

# Test ChatGPT tools
curl http://localhost:3001/mcp/test-5965ec3f \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", ...}'
```

## Production Deployment

### Initial Setup (One-time)
```bash
# 1. Set up GCP infrastructure
./deployment/cloud-sql-setup.sh your-project-id

# 2. Configure GitHub Secrets
# - GCP_PROJECT_ID: your-project-id
# - GCP_SA_KEY: service-account-json-key

# 3. Push to deploy
git push origin main
```

### Automatic Deployments
- **Every push to main** triggers deployment
- **Tests run first** (lint, type-check, unit tests)
- **Zero downtime** rolling updates
- **Automatic rollback** on failure

## Monitoring & Observability

### Health Checks
- **Startup probes** ensure services are ready
- **Liveness probes** restart unhealthy containers
- **Health endpoints** at `/health`

### Logging
- **Structured JSON logs** for Cloud Logging
- **Request tracing** through all services
- **Error aggregation** in Cloud Error Reporting

### Metrics (TODO)
- **Response times** for MCP endpoints
- **Success rates** for Claude/ChatGPT integrations
- **Resource usage** and scaling patterns

## Security

### Development
- **Non-root containers** for security
- **Environment isolation** via Docker
- **Local secrets** in .env file

### Production
- **Secret Manager** for all credentials
- **IAM roles** with minimal permissions
- **VPC networks** for isolation
- **HTTPS everywhere** with managed certificates

## Cost Optimization

### Cloud Run Pricing Model
```
Backend (2 CPU, 2GB RAM):
- Idle: $0 (scales to zero)
- Light usage: ~$10/month
- Heavy usage: ~$50/month

Frontend (1 CPU, 1GB RAM):
- Idle: $0 (scales to zero)
- CDN cached: ~$5/month

Database:
- Cloud SQL (f1-micro): ~$15/month
- Cloud Memorystore: ~$10/month

Total: $10-80/month based on usage
```

## Migration Timeline

### Phase 1: Local Development ✅ COMPLETE
- [x] Docker Compose setup
- [x] Development Dockerfiles
- [x] Hot reloading
- [x] Database migrations

### Phase 2: Production Infrastructure ✅ COMPLETE
- [x] Cloud Run configuration
- [x] Cloud SQL setup
- [x] GitHub Actions CI/CD
- [x] Secret management

### Phase 3: Migration (Next)
- [ ] Deploy Cloud SQL instance
- [ ] Migrate data from VM
- [ ] Switch traffic to Cloud Run
- [ ] Decomission VM

### Phase 4: Optimization (Future)
- [ ] Add monitoring dashboards
- [ ] Set up alerting
- [ ] Performance optimization
- [ ] Cost analysis

## Emergency Procedures

### Quick Rollback
```bash
# Rollback to previous version
gcloud run services update-traffic sail-backend \
  --to-revisions=PREVIOUS=100 \
  --region=us-central1
```

### Scale Down (Cost Control)
```bash
# Set max instances to 0 (emergency stop)
gcloud run services update sail-backend \
  --max-instances=0 \
  --region=us-central1
```

### Debug Production
```bash
# View live logs
gcloud logging tail --filter="resource.type=cloud_run_revision"

# Connect to Cloud SQL
gcloud sql connect sail-postgres-prod --user=sail_user
```

## Next Steps

1. **Test local development** with `./scripts/dev-setup.sh`
2. **Set up GCP project** with `./deployment/cloud-sql-setup.sh`
3. **Configure GitHub secrets** for automated deployment
4. **Push to main branch** to deploy to production
5. **Monitor performance** and optimize scaling

Your infrastructure is now production-ready and can handle thousands of concurrent MCP connections! 🚀# GetSail Knowledge Exchange Platform Architecture

## Overview
GetSail enables users to share their knowledge sources (local files, Google Drive, GitHub repos) as MCP servers that others can connect to via AI assistants.

## User Flow

### Knowledge Provider Flow
1. Visit getsail.net
2. Choose knowledge source type:
   - 📁 **Local Files/Folder** - Upload or sync a folder
   - 📄 **Google Drive** - Connect specific docs/folders 
   - 🔗 **GitHub Repository** - Connect public/private repos
3. Configure access permissions and scope
4. Click "Create Knowledge Exchange"
5. Receive shareable MCP URL: `https://getsail.net/mcp/{unique-id}`

### Knowledge Consumer Flow
1. Receive MCP URL from peer
2. Add URL to AI assistant's MCP integrations
3. Start asking questions about peer's knowledge
4. AI assistant uses MCP tools to search and retrieve content

## Architecture Components

### Frontend (React/Next.js)
```
┌─────────────────────────────────────────┐
│           getsail.net                   │
├─────────────────────────────────────────┤
│  🏠 Landing Page                        │
│  ⚙️  Knowledge Source Setup             │
│  📊 Dashboard (Active Exchanges)        │
│  🔗 Share Links Management              │
│  📈 Analytics (Usage Stats)             │
└─────────────────────────────────────────┘
```

### Backend Services
```
┌─────────────────────────────────────────┐
│        API Gateway (Express/FastAPI)   │
├─────────────────────────────────────────┤
│  🔐 Authentication & Authorization      │
│  📝 Knowledge Source Registration       │
│  🔗 MCP Server Provisioning            │
│  📊 Usage Analytics                     │
│  💾 Metadata Storage                    │
└─────────────────────────────────────────┘
                     │
┌─────────────────────────────────────────┐
│       Dynamic MCP Server Farm          │
├─────────────────────────────────────────┤
│  🐳 Docker Containers                   │
│  📡 Individual MCP Servers              │
│  🔄 Auto-scaling                        │
│  📈 Load Balancing                      │
└─────────────────────────────────────────┘
```

### Data Storage
```
┌─────────────────────────────────────────┐
│          PostgreSQL                     │
├─────────────────────────────────────────┤
│  👤 Users & Authentication              │
│  🔗 Knowledge Exchanges                 │
│  🔑 API Keys & Permissions              │
│  📊 Usage Analytics                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           Redis Cache                   │
├─────────────────────────────────────────┤
│  ⚡ Search Results Cache                │
│  🔄 Session Management                  │
│  🎯 Rate Limiting                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│        Object Storage (S3/MinIO)       │
├─────────────────────────────────────────┤
│  📁 Uploaded Documents                  │
│  🔍 Search Indices                      │
│  📸 Document Thumbnails                 │
└─────────────────────────────────────────┘
```

## API Endpoints

### Knowledge Source Management
```
POST   /api/sources/local          # Upload local files
POST   /api/sources/google-drive   # Connect Google Drive
POST   /api/sources/github         # Connect GitHub repo
GET    /api/sources                # List user's sources
DELETE /api/sources/{id}           # Remove source
```

### MCP Server Management
```
POST   /api/mcp/create            # Create new MCP exchange
GET    /api/mcp/{exchange-id}     # Get exchange details
PUT    /api/mcp/{exchange-id}     # Update permissions
DELETE /api/mcp/{exchange-id}     # Deactivate exchange
```

### Analytics & Usage
```
GET    /api/analytics/usage       # Usage statistics
GET    /api/analytics/popular     # Popular searches
POST   /api/analytics/track       # Track search/access
```

## MCP Server URLs

### URL Structure
```
https://getsail.net/mcp/{exchange-id}
```

Where `exchange-id` is a unique identifier like:
- `getsail.net/mcp/ai-research-2024-jdoe`
- `getsail.net/mcp/startup-docs-acme-corp`
- `getsail.net/mcp/family-recipes-smith`

### Dynamic MCP Server Endpoints
```
https://getsail.net/mcp/{exchange-id}/
├── tools/                    # MCP tools discovery
├── resources/               # MCP resources list
├── search                   # Search endpoint
├── document/{doc-id}        # Document retrieval
├── metadata                 # Source metadata
└── health                   # Server health check
```

## Security & Privacy

### Access Control
- **Private Exchanges**: Require API key or invitation
- **Public Exchanges**: Open access with rate limiting
- **Time-limited**: Optional expiration dates
- **IP Restrictions**: Whitelist specific IPs/domains

### Data Protection
- **Encryption**: All data encrypted at rest and in transit
- **Anonymization**: Remove PII from shared content
- **Audit Logs**: Track all access and modifications
- **GDPR Compliance**: Right to delete, data portability

### API Security
- **Rate Limiting**: Prevent abuse
- **Authentication**: JWT tokens for API access
- **CORS**: Proper cross-origin policies
- **Input Validation**: Sanitize all inputs

## Scalability Strategy

### Microservices Architecture
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Auth Service  │  │  Source Service │  │   MCP Service   │
│   (User Mgmt)   │  │ (Data Ingestion)│  │ (Query Engine)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                      │                      │
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Analytics Svc   │  │  Search Service │  │  Notify Service │
│  (Usage Stats)  │  │ (Elasticsearch) │  │   (Webhooks)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Container Orchestration
- **Kubernetes**: Auto-scaling MCP servers
- **Docker**: Isolated MCP server instances
- **Load Balancer**: Distribute traffic efficiently
- **Health Checks**: Auto-restart failed servers

### Performance Optimization
- **CDN**: Cache static content globally
- **Search Indexing**: Pre-built search indices
- **Lazy Loading**: Load content on demand
- **Connection Pooling**: Efficient database connections

## Monetization Strategy

### Freemium Model
- **Free Tier**: 3 knowledge sources, 100 queries/month
- **Pro Tier**: Unlimited sources, 10K queries/month, $10/mo
- **Team Tier**: Multi-user, analytics, custom domains, $50/mo
- **Enterprise**: On-premise, SLA, dedicated support, custom pricing

### Usage-Based Pricing
- **Per Query**: $0.001 per search query
- **Storage**: $0.10/GB/month for uploaded files
- **Bandwidth**: $0.05/GB for data transfer

## Technical Implementation

### Knowledge Source Connectors

#### Local Files Connector
```javascript
class LocalFilesConnector {
  async upload(files, userId) {
    // Process uploaded files
    // Extract text content
    // Build search index
    // Store in object storage
  }
  
  async sync(folderId, userId) {
    // Sync with user's local folder
    // Detect changes
    // Update indices
  }
}
```

#### Google Drive Connector
```javascript
class GoogleDriveConnector {
  async connect(credentials, folderId, userId) {
    // Validate Google OAuth
    // Fetch folder contents
    // Extract document text
    // Build search index
  }
  
  async sync(exchangeId) {
    // Check for updates
    // Refresh content
    // Update search indices
  }
}
```

#### GitHub Connector
```javascript
class GitHubConnector {
  async connect(token, owner, repo, userId) {
    // Validate GitHub token
    // Clone repository metadata
    // Index code and documentation
    // Track commits and issues
  }
}
```

### Dynamic MCP Server Factory
```javascript
class MCPServerFactory {
  async createServer(exchangeId, config) {
    // Spin up new Docker container
    // Configure MCP server with user's data
    // Register DNS and SSL
    // Start health monitoring
  }
  
  async destroyServer(exchangeId) {
    // Graceful shutdown
    // Clean up resources
    // Update DNS records
  }
}
```

### Smart Search Engine
```javascript
class SmartSearchEngine {
  async search(query, exchangeId, context) {
    // Natural language processing
    // Semantic search across documents
    // Rank results by relevance
    // Return formatted responses
  }
  
  async generateSummary(documentId, query) {
    // Extract relevant sections
    // Generate AI summary
    // Include source references
  }
}
```

## User Experience Features

### Knowledge Provider Features
- **Drag & Drop Upload**: Easy file uploads
- **Real-time Sync**: Auto-sync with sources
- **Preview**: See how content appears to consumers
- **Analytics**: Track usage and popular queries
- **Access Control**: Granular permissions

### Knowledge Consumer Features
- **Smart Search**: Natural language queries
- **Source Attribution**: Clear source references
- **Related Content**: Find similar documents
- **Export Results**: Save search results
- **Collaboration**: Share findings with team

### AI Assistant Integration
- **One-Click Setup**: Easy MCP URL integration
- **Rich Responses**: Formatted answers with sources
- **Context Awareness**: Remember previous queries
- **Multi-Source**: Query across multiple exchanges
- **Smart Suggestions**: Recommend related content

## Sample Knowledge Exchange Types

### Academic Research
- Research papers and datasets
- Collaboration between universities
- Cross-institutional knowledge sharing

### Corporate Knowledge
- Internal documentation
- Best practices and procedures
- Cross-team collaboration

### Family Archives
- Family history and photos
- Recipes and traditions
- Shared memories and documents

### Open Source Projects
- Code documentation
- Issue tracking
- Community knowledge base

This architecture provides a scalable, secure, and user-friendly platform for knowledge exchange while maintaining proper access controls and monetization opportunities.