# 🚀 Production Deployment Guide for sailmcp.com

This guide will walk you through deploying Sail MCP to production on sailmcp.com with proper Docker socket permissions.

## 📋 Prerequisites

### 1. Server Requirements
- **VPS/Server**: Ubuntu 22.04 LTS (recommended) or similar
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 4GB minimum (8GB+ recommended)
- **Storage**: 50GB+ SSD
- **Domain**: sailmcp.com pointing to your server IP

### 2. Software Requirements
- Docker 24.0+
- Docker Compose 2.0+
- Git
- SSL certificate (automatically handled by Traefik)

## 🔧 Step-by-Step Deployment

### Step 1: Prepare the Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again to apply group changes
```

### Step 2: Clone and Configure

```bash
# Clone the repository
git clone https://github.com/your-username/sail.git
cd sail

# Create production environment file
cp .env.prod.example .env.prod

# Edit with your production values
nano .env.prod
```

**Required `.env.prod` values:**
```bash
DATABASE_NAME=sail_prod
DATABASE_USER=sail_user
DATABASE_PASSWORD=your-super-secure-password
JWT_SECRET=your-super-secure-jwt-secret-64-chars-minimum
ACME_EMAIL=your-email@sailmcp.com
```

### Step 3: Configure DNS

Point your domain to your server:
```
A     sailmcp.com           -> YOUR_SERVER_IP
A     traefik.sailmcp.com   -> YOUR_SERVER_IP
CNAME www.sailmcp.com       -> sailmcp.com
```

### Step 4: Deploy

```bash
# Run the deployment script
./deploy.sh
```

The deployment script will:
1. ✅ Verify prerequisites
2. 🔐 Set Docker socket permissions
3. 🐳 Build MCP server image
4. 🏗️ Start all services with SSL
5. 🗄️ Run database migrations
6. ✅ Verify deployment

## 🔐 Docker Socket Permissions (Critical!)

The key to fixing the Docker socket issue is in the deployment configuration:

### In `docker-compose.prod.yml`:
```yaml
backend:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock  # Mount Docker socket
```

### In the deployment script:
```bash
# Set proper permissions
sudo chmod 666 /var/run/docker.sock
```

### Alternative (More Secure):
Add the app user to the docker group:
```bash
# In the container, add app user to docker group
docker exec sail-backend-prod sh -c 'addgroup nodejs docker'
```

## 🔍 Verification

After deployment, verify everything works:

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# Test the API
curl https://sailmcp.com/api/exchanges

# Check logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Test MCP container creation
curl -X POST https://sailmcp.com/api/exchanges \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Test",
    "description": "Testing MCP container creation",
    "type": "local",
    "privacy": "private",
    "config": {"folderPath": "/app"}
  }'
```

## 🌐 Service URLs

After successful deployment:
- **Frontend**: https://sailmcp.com
- **API**: https://sailmcp.com/api
- **Traefik Dashboard**: https://traefik.sailmcp.com

## 🛠️ Maintenance

### Update Deployment
```bash
git pull origin main
./deploy.sh
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Backup Database
```bash
docker exec sail-postgres-prod pg_dump -U sail_user sail_prod > backup.sql
```

### Scale MCP Servers
The system automatically manages MCP server containers. Monitor with:
```bash
# View all MCP containers
docker ps --filter "label=sail.service=mcp-server"

# Check port usage
docker exec sail-backend-prod netstat -tlnp
```

## 🚨 Troubleshooting

### Docker Socket Permission Issues
```bash
# Check Docker socket permissions
ls -la /var/run/docker.sock

# Fix permissions
sudo chmod 666 /var/run/docker.sock

# Alternative: Add user to docker group in container
docker exec sail-backend-prod adduser nodejs docker
```

### SSL Certificate Issues
```bash
# Check Traefik logs
docker-compose -f docker-compose.prod.yml logs traefik

# Force certificate regeneration
docker-compose -f docker-compose.prod.yml restart traefik
```

### Database Connection Issues
```bash
# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection
docker exec sail-backend-prod node -e "
const { Pool } = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT NOW()').then(console.log).catch(console.error);
"
```

## 🎯 Production Optimization

### 1. Security Hardening
- Change default ports
- Set up firewall rules
- Enable fail2ban
- Regular security updates

### 2. Monitoring
Add monitoring stack:
```bash
# Add to docker-compose.prod.yml
  prometheus:
    image: prom/prometheus
  grafana:
    image: grafana/grafana
```

### 3. Backups
Set up automated backups:
```bash
# Database backup cron job
0 2 * * * docker exec sail-postgres-prod pg_dump -U sail_user sail_prod | gzip > /backups/sail-$(date +\%Y\%m\%d).sql.gz
```

## ✅ Success Indicators

You'll know the deployment succeeded when:
1. ✅ All containers show "Up" status
2. ✅ SSL certificates are automatically generated
3. ✅ Frontend loads at https://sailmcp.com
4. ✅ API responds at https://sailmcp.com/api/exchanges
5. ✅ Exchange creation works without Docker socket errors
6. ✅ MCP containers can be created successfully

Your Sail MCP platform is now ready for production use! 🎉