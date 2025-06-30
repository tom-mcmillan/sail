#!/bin/bash

# Manual deployment script for Sail MCP Backend
# Use this if CI/CD is not set up or for emergency deployments

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PROJECT_ID="sail-mcp-production"
SERVICE_NAME="sail-backend"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${YELLOW}🚀 Deploying Sail MCP Backend${NC}"
echo "================================"

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

# Get the current git commit hash
GIT_SHA=$(git rev-parse --short HEAD)
echo -e "Git SHA: ${GIT_SHA}"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build Docker image
echo -e "${YELLOW}📦 Building Docker image...${NC}"
cd backend
docker build --platform linux/amd64 -t "${IMAGE_NAME}:${GIT_SHA}" -t "${IMAGE_NAME}:latest" .
cd ..

# Push to Container Registry
echo -e "${YELLOW}⬆️  Pushing to Container Registry...${NC}"
docker push "${IMAGE_NAME}:${GIT_SHA}"
docker push "${IMAGE_NAME}:latest"

# Deploy to Cloud Run
echo -e "${YELLOW}☁️  Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
    --image="${IMAGE_NAME}:${GIT_SHA}" \
    --region=${REGION} \
    --platform=managed \
    --port=3001 \
    --allow-unauthenticated \
    --set-env-vars="NODE_ENV=production,BASE_URL=https://mcp.sailmcp.com" \
    --set-secrets="DATABASE_URL=database-credentials:latest,JWT_SECRET=app-secrets:latest" \
    --service-account=sail-backend-sa@${PROJECT_ID}.iam.gserviceaccount.com

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format='value(status.url)')

echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "Service URL: ${SERVICE_URL}"
echo -e "Custom Domain: https://mcp.sailmcp.com"

# Update FRONTEND_URL if needed
echo -e "${YELLOW}📝 Note: If frontend URL has changed, update it with:${NC}"
echo "gcloud run services update ${SERVICE_NAME} --region=${REGION} --update-env-vars=\"FRONTEND_URL=<new-frontend-url>\""