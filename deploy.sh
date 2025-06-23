#!/bin/bash

# Sail MCP Production Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Starting Sail MCP deployment to sailmcp.com..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root. Please run as a regular user with Docker permissions.${NC}"
   exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if user is in docker group
if ! groups $USER | grep -q '\bdocker\b'; then
    echo -e "${RED}❌ User $USER is not in the docker group. Please add user to docker group and restart session.${NC}"
    echo -e "${YELLOW}Run: sudo usermod -aG docker $USER${NC}"
    echo -e "${YELLOW}Then logout and login again.${NC}"
    exit 1
fi

# Check if .env.prod file exists
if [[ ! -f .env.prod ]]; then
    echo -e "${YELLOW}⚠️  .env.prod file not found. Please create it based on .env.prod.example${NC}"
    echo -e "${BLUE}Copying .env.prod.example to .env.prod...${NC}"
    cp .env.prod.example .env.prod
    echo -e "${RED}❌ Please edit .env.prod with your production values before continuing.${NC}"
    exit 1
fi

# Load environment variables
source .env.prod

echo -e "${BLUE}📋 Pre-deployment checklist:${NC}"
echo "✅ Docker installed and running"
echo "✅ User has Docker permissions"
echo "✅ Environment file configured"

# Create necessary directories
echo -e "${BLUE}📁 Creating storage directories...${NC}"
mkdir -p backend/storage
mkdir -p data/postgres
mkdir -p data/redis

# Set proper permissions for Docker socket access
echo -e "${BLUE}🔐 Setting up Docker socket permissions...${NC}"
sudo chmod 666 /var/run/docker.sock || echo -e "${YELLOW}⚠️  Could not set Docker socket permissions. This might cause issues with MCP container creation.${NC}"

# Build the MCP server image
echo -e "${BLUE}🐳 Building MCP server image...${NC}"
cd backend
docker build -f Dockerfile.mcp -t sail-mcp-server .
cd ..

# Stop any existing containers
echo -e "${BLUE}🛑 Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down || true

# Pull latest images
echo -e "${BLUE}📥 Pulling latest base images...${NC}"
docker-compose -f docker-compose.prod.yml pull postgres redis traefik

# Build and start services
echo -e "${BLUE}🏗️  Building and starting services...${NC}"
docker-compose -f docker-compose.prod.yml up --build -d

# Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 10

# Run database migrations
echo -e "${BLUE}🗄️  Running database migrations...${NC}"
cd backend
npm run migrate
cd ..

# Check service status
echo -e "${BLUE}🔍 Checking service status...${NC}"
docker-compose -f docker-compose.prod.yml ps

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Service URLs:${NC}"
echo -e "🌐 Frontend: https://sailmcp.com"
echo -e "🔌 API: https://sailmcp.com/api"
echo -e "📈 Traefik Dashboard: https://traefik.sailmcp.com"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Wait 2-3 minutes for SSL certificates to be generated"
echo "2. Test the application at https://sailmcp.com"
echo "3. Monitor logs with: docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo -e "${GREEN}🎉 Sail MCP is now live on sailmcp.com!${NC}"