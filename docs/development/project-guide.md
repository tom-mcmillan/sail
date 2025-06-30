# Sail MCP Project Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Development Setup](#development-setup)
6. [Key Features](#key-features)
7. [Deployment](#deployment)
8. [API Documentation](#api-documentation)
9. [Testing](#testing)
10. [Contributing](#contributing)
11. [Troubleshooting](#troubleshooting)

## Project Overview

**Sail MCP** is a Universal Knowledge Exchange Platform that transforms local folders, Google Drive, and GitHub repositories into MCP (Model Context Protocol) servers that AI assistants like Claude and ChatGPT can query through natural language.

### Vision
Enable seamless knowledge sharing between humans and AI by making any data source accessible through a standardized protocol.

### Core Value Proposition
- **For Researchers**: Share research papers and datasets with AI assistants
- **For Developers**: Make codebases and documentation AI-queryable
- **For Teams**: Create shared knowledge bases accessible to AI tools

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Claude.ai     │     │    ChatGPT      │     │  Other MCP      │
│                 │     │                 │     │  Clients        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                         │
         └───────────────────────┴─────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   mcp.sailmcp.com       │
                    │   (Universal MCP)       │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │   OAuth 2.0       │  │
                    │  │   Authorization   │  │
                    │  └───────────────────┘  │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │   MCP Protocol    │  │
                    │  │   Implementation  │  │
                    │  └───────────────────┘  │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌────────▼────────┐   ┌──────────▼────────┐   ┌─────────▼────────┐
│ Local Filesystem│   │   Google Drive    │   │     GitHub       │
│    Adapter      │   │     Adapter       │   │    Adapter       │
└─────────────────┘   └───────────────────┘   └──────────────────┘
```

### Key Components

1. **Frontend (www.sailmcp.com)**
   - Next.js 15 application
   - User interface for creating/managing MCP servers
   - Deployed on Vercel

2. **Backend (mcp.sailmcp.com)**
   - Node.js/Express API server
   - Universal MCP endpoint
   - OAuth 2.0 authorization server
   - Deployed on Google Cloud Run

3. **Database**
   - PostgreSQL on Google Cloud SQL
   - Stores user data, exchanges, OAuth tokens

4. **Knowledge Store Adapters**
   - Pluggable architecture for different data sources
   - Currently supports: Local filesystem
   - Planned: Google Drive, GitHub, Zotero

## Technology Stack

### Frontend
- **Framework**: Next.js 15.3.4
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Custom components with Lucide icons
- **State Management**: React hooks
- **Deployment**: Vercel

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Language**: TypeScript
- **MCP SDK**: @modelcontextprotocol/sdk
- **Database**: PostgreSQL 15
- **Cache**: Redis (optional)
- **Container**: Docker
- **Deployment**: Google Cloud Run

### Infrastructure
- **Cloud Provider**: Google Cloud Platform
- **DNS**: GoDaddy → Vercel/GCP
- **SSL**: Automatic via Cloud Run and Vercel
- **Secrets**: Google Secret Manager
- **CI/CD**: Cloud Build + GitHub

## Project Structure

```
sail/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/            # App router pages
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utility functions
│   │   ├── types/          # TypeScript types
│   │   └── constants/      # App constants
│   ├── public/             # Static assets
│   └── package.json
│
├── backend/                  # Express backend application
│   ├── src/
│   │   ├── adapters/       # Knowledge store adapters
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── types/          # TypeScript types
│   │   └── server.ts       # Main server file
│   ├── scripts/            # Utility scripts
│   ├── Dockerfile          # Container configuration
│   └── package.json
│
├── docs/                     # Documentation
│   ├── development/        # Development guides
│   └── project/            # Project documentation
│
├── scripts/                  # Project-wide scripts
├── .github/                  # GitHub Actions workflows
└── cloudbuild.yaml          # Cloud Build configuration
```

## Development Setup

### Prerequisites
- Node.js 18+
- Docker Desktop
- Google Cloud SDK (`gcloud`)
- PostgreSQL (local)
- Redis (optional)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/tom-mcmillan/sail.git
   cd sail
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   
   # Create .env file
   cat > .env << EOF
   NODE_ENV=development
   PORT=3001
   DATABASE_URL=postgresql://localhost/sail_dev
   JWT_SECRET=your-dev-secret
   BASE_URL=http://localhost:3001
   FRONTEND_URL=http://localhost:3000
   EOF
   
   # Run database migrations
   npm run migrate
   
   # Start development server
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   
   # Create .env.local file
   cat > .env.local << EOF
   NEXT_PUBLIC_API_URL=http://localhost:3001/api
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   EOF
   
   # Start development server
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001
   - Health check: http://localhost:3001/health

## Key Features

### 1. Universal MCP Server
- Single endpoint serves both Claude and ChatGPT
- Automatic transport detection (SSE vs HTTP)
- Session-based state management

### 2. OAuth 2.0 Implementation
- RFC-compliant authorization server
- Support for public clients (Claude, ChatGPT)
- PKCE support for enhanced security

### 3. Knowledge Store Adapters
- **LocalFileSystemAdapter**: Query local folders
  - Search documents by content
  - Fetch full file contents
  - List available files
  - Security: Path traversal protection

### 4. Exchange Management
- Create MCP servers for different data sources
- Generate shareable URLs
- Track usage analytics
- Privacy controls (public/private)

## Deployment

### Frontend Deployment (Automatic)
- Pushes to `main` branch auto-deploy to Vercel
- Preview deployments for pull requests
- Production URL: https://www.sailmcp.com

### Backend Deployment

#### Option 1: Automatic (Cloud Build)
```bash
# One-time setup
./scripts/setup-cicd.sh

# Then just push to main branch
git push origin main
```

#### Option 2: Manual
```bash
./scripts/deploy-backend.sh
```

### Environment Variables

#### Backend (Cloud Run)
- `NODE_ENV=production`
- `BASE_URL=https://mcp.sailmcp.com`
- `FRONTEND_URL=https://www.sailmcp.com`
- `DATABASE_URL` (from Secret Manager)
- `JWT_SECRET` (from Secret Manager)

#### Frontend (Vercel)
- `NEXT_PUBLIC_API_URL=https://sail-backend-*.run.app`
- `NEXT_PUBLIC_BASE_URL=https://www.sailmcp.com`

## API Documentation

### Public Endpoints

#### Health Check
```
GET /health
Response: { status: 'healthy', timestamp: '...', uptime: 123 }
```

#### OAuth Discovery
```
GET /.well-known/oauth-authorization-server
Response: OAuth 2.0 metadata (RFC 8414)
```

#### Universal MCP
```
GET|POST /{slug}/mcp
Headers: 
  - Accept: application/json, text/event-stream
  - Mcp-Session-Id: {session-id}
Body: JSON-RPC 2.0 request
```

### Protected Endpoints

#### Create Exchange
```
POST /api/exchanges
Headers: Authorization: Bearer {token}
Body: {
  name: string,
  description: string,
  type: 'local' | 'google-drive' | 'github',
  knowledge_type: string,
  config: object
}
```

## Testing

### Backend Testing
```bash
cd backend
npm run test        # Run unit tests
npm run test:e2e    # Run end-to-end tests
npm run lint        # Run linter
npm run type-check  # Check TypeScript
```

### Frontend Testing
```bash
cd frontend
npm run lint        # Run linter
npm run type-check  # Check TypeScript
```

### Manual Testing

1. **Test MCP Connection**
   - Create an exchange at www.sailmcp.com
   - Copy the MCP URL
   - Add to Claude.ai settings
   - Verify OAuth flow completes
   - Test search/fetch commands

2. **Test OAuth Flow**
   ```bash
   curl "https://mcp.sailmcp.com/oauth/consent?client_id=claudeai&redirect_uri=https://claude.ai/oauth/callback&response_type=code&scope=mcp:read"
   ```

## Contributing

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes**
   - Follow TypeScript best practices
   - Add appropriate error handling
   - Update documentation

3. **Test thoroughly**
   - Run local tests
   - Test OAuth flows
   - Verify MCP functionality

4. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add new adapter for Notion"
   git commit -m "fix: resolve OAuth redirect issue"
   git commit -m "docs: update API documentation"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature
   ```

### Code Style
- Use TypeScript strict mode
- Follow ESLint rules
- Prefer functional components
- Use async/await over promises
- Add JSDoc comments for public APIs

## Troubleshooting

### Common Issues

#### "Failed to create MCP server"
- Check CORS configuration
- Verify frontend URL in backend env vars
- Check browser console for errors

#### OAuth "Route not found"
- Ensure backend is deployed with latest code
- Check OAuth client exists in database
- Verify redirect URIs match exactly

#### Cold Start Delays
- First request may take 10-20 seconds
- Consider keeping warm with scheduled pings
- Monitor in Cloud Run metrics

#### Database Connection Issues
- Verify Cloud SQL instance is running
- Check DATABASE_URL secret
- Ensure service account has permissions

### Debug Commands

```bash
# Check backend logs
gcloud run services logs read sail-backend --region=us-central1 --limit=50

# Test OAuth clients
psql $DATABASE_URL -c "SELECT id, name FROM oauth_clients;"

# Check deployed revision
gcloud run services describe sail-backend --region=us-central1

# Monitor builds
gcloud builds list --limit=5
```

### Getting Help

1. Check existing issues: https://github.com/tom-mcmillan/sail/issues
2. Review logs in GCP Console
3. Test with direct Cloud Run URL first
4. Verify environment variables

---

*Last Updated: June 30, 2025*
*Version: 1.0.0*