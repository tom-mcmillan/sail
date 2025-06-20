# GetSail Deployment Guide

This guide covers deploying the complete GetSail knowledge exchange platform, including the web frontend, API backend, database, and MCP server infrastructure.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                 Load Balancer                   │
│              (nginx/CloudFlare)                 │
└─────────────────────┬───────────────────────────┘
                      │
       ┌──────────────┼──────────────┐
       │              │              │
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Frontend  │ │ API Server  │ │MCP Servers  │
│  (Next.js)  │ │ (Node.js)   │ │  (Docker)   │
│             │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘
       │              │              │
       └──────────────┼──────────────┘
                      │
            ┌─────────┼─────────┐
            │         │         │
      ┌─────────┐ ┌─────────┐ ┌─────────┐
      │PostgreSQL│ │  Redis  │ │ Object  │
      │Database │ │ Cache   │ │Storage  │
      └─────────┘ └─────────┘ └─────────┘
```

## Prerequisites

### System Requirements
- **Server**: 4+ CPU cores, 8GB+ RAM, 100GB+ SSD
- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **Docker**: Version 20.10+
- **Node.js**: Version 18+
- **PostgreSQL**: Version 13+
- **Redis**: Version 6+

### Domain & SSL
- Domain name (e.g., getsail.net)
- SSL certificate (Let's Encrypt recommended)
- DNS configured to point to your server

## Step 1: Server Setup

### Initial Server Configuration
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server
```

### Configure PostgreSQL
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE getsail;
CREATE USER getsail_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE getsail TO getsail_user;
\q

# Enable and start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Configure Redis
```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Add/modify these lines:
bind 127.0.0.1
requirepass your_redis_password
maxmemory 256mb
maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

## Step 2: Application Deployment

### Clone Repository
```bash
cd /opt
sudo git clone https://github.com/yourusername/getsail.git
sudo chown -R $USER:$USER getsail
cd getsail
```

### Environment Configuration
```bash
# Create environment file
cat > .env << EOF
# Database
DATABASE_URL=postgresql://getsail_user:your_secure_password@localhost:5432/getsail

# Redis
REDIS_URL=redis://:your_redis_password@localhost:6379

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# Base URL
BASE_URL=https://getsail.net

# Frontend URL
FRONTEND_URL=https://getsail.net

# Object Storage (S3 or compatible)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=getsail-storage

# Google OAuth (for Google Drive integration)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth (for private repos)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Environment
NODE_ENV=production
EOF
```

### Backend Deployment
```bash
# Install backend dependencies
cd backend
npm install --production

# Run database migrations
npm run migrate

# Create systemd service
sudo cat > /etc/systemd/system/getsail-api.service << EOF
[Unit]
Description=GetSail API Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/getsail/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/getsail/.env

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable getsail-api
sudo systemctl start getsail-api
```

### Frontend Deployment
```bash
# Install frontend dependencies
cd ../frontend
npm install

# Build for production
npm run build

# Start frontend service
sudo cat > /etc/systemd/system/getsail-frontend.service << EOF
[Unit]
Description=GetSail Frontend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/getsail/frontend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/getsail/.env

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable getsail-frontend
sudo systemctl start getsail-frontend
```

## Step 3: Docker MCP Server Image

### Build MCP Server Image
```dockerfile
# Create Dockerfile for MCP servers
cat > docker/mcp-server/Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3000

CMD ["node", "mcp-server.js"]
EOF

# Build the image
cd docker/mcp-server
docker build -t getsail/mcp-server:latest .
```

### MCP Server Manager Service
```bash
# Create MCP server manager
sudo cat > /etc/systemd/system/getsail-mcp-manager.service << EOF
[Unit]
Description=GetSail MCP Server Manager
After=network.target docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/getsail
ExecStart=/usr/bin/node mcp-manager.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/getsail/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable getsail-mcp-manager
sudo systemctl start getsail-mcp-manager
```

## Step 4: Nginx Configuration

### Main Nginx Configuration
```nginx
# /etc/nginx/sites-available/getsail.net
server {
    listen 80;
    server_name getsail.net www.getsail.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name getsail.net www.getsail.net;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/getsail.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/getsail.net/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=mcp:10m rate=1000r/m;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Increase timeouts for file uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # MCP routes - dynamic routing to Docker containers
    location /mcp/ {
        limit_req zone=mcp burst=50 nodelay;
        
        # Extract exchange slug
        if ($request_uri ~ ^/mcp/([^/]+)/?(.*)$) {
            set $exchange_slug $1;
            set $mcp_path $2;
        }
        
        # Route to appropriate container
        proxy_pass http://localhost:3001/mcp/$exchange_slug/$mcp_path;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers for MCP
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Static files with caching
    location /static/ {
        alias /opt/getsail/frontend/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Enable Nginx Configuration
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/getsail.net /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Obtain SSL certificate
sudo certbot --nginx -d getsail.net -d www.getsail.net

# Restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 5: Monitoring & Logging

### Log Management
```bash
# Configure log rotation
sudo cat > /etc/logrotate.d/getsail << EOF
/opt/getsail/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        sudo systemctl reload getsail-api
        sudo systemctl reload getsail-frontend
    endscript
}
EOF
```

### Monitoring Setup
```bash
# Install monitoring tools
sudo apt install -y prometheus node-exporter grafana

# Configure Prometheus
sudo cat > /etc/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'getsail-api'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
      
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
EOF

# Start monitoring services
sudo systemctl enable prometheus grafana-server node-exporter
sudo systemctl start prometheus grafana-server node-exporter
```

## Step 6: Backup Strategy

### Database Backups
```bash
# Create backup script
cat > /opt/getsail/scripts/backup-