#!/bin/bash

# Development setup script for Sail MCP
# Run this to set up your local development environment

set -e

echo "🚀 Setting up Sail MCP development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

echo "✅ Docker is running"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.local .env
    echo "✅ Created .env file from .env.local"
else
    echo "✅ .env file already exists"
fi

# Build and start services
echo "🏗️ Building and starting services..."
docker-compose down -v  # Clean start
docker-compose build --no-cache
docker-compose up -d postgres redis

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations
echo "🗄️ Running database migrations..."
docker-compose exec -T backend npm run migrate || true

# Start all services
echo "🚀 Starting all services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Check service health
echo "🔍 Checking service health..."

# Check backend
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy (http://localhost:3001)"
else
    echo "⚠️ Backend might not be ready yet. Check logs with: docker-compose logs backend"
fi

# Check frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is healthy (http://localhost:3000)"
else
    echo "⚠️ Frontend might not be ready yet. Check logs with: docker-compose logs frontend"
fi

# Check database
if docker-compose exec -T postgres pg_isready -U sail > /dev/null 2>&1; then
    echo "✅ Database is healthy"
else
    echo "❌ Database is not healthy"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is healthy"
else
    echo "❌ Redis is not healthy"
fi

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📱 Services:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"
echo "  PgAdmin:  http://localhost:5050 (admin@sailmcp.com / admin123)"
echo ""
echo "🔧 Useful commands:"
echo "  View logs:    docker-compose logs -f [service]"
echo "  Restart:      docker-compose restart [service]"
echo "  Stop all:     docker-compose down"
echo "  Clean reset:  docker-compose down -v && ./scripts/dev-setup.sh"
echo ""
echo "🧪 Test your MCP integration:"
echo "  curl http://localhost:3001/health"