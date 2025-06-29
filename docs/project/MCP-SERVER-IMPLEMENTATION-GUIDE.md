# Building a Production-Ready MCP Server: Technical Implementation Guide

This guide provides detailed technical instructions for engineers building Model Context Protocol (MCP) servers that integrate with external knowledge stores. Based on the architecture and lessons learned from the Zotero MCP Server implementation, this guide covers the essential patterns, integration strategies, and deployment approaches needed for production-ready MCP servers.

## Table of Contents

1. [Core MCP Server Architecture](#core-mcp-server-architecture)
2. [Multi-Transport Support Implementation](#multi-transport-support-implementation)
3. [External API Integration Patterns](#external-api-integration-patterns)
4. [Tool Design and Implementation](#tool-design-and-implementation)
5. [HTTP/SSE Server Implementation](#httpsse-server-implementation)
6. [Desktop Extension Packaging](#desktop-extension-packaging)
7. [Cloud Deployment Architecture](#cloud-deployment-architecture)
8. [Error Handling and Resilience](#error-handling-and-resilience)
9. [Performance Optimization Strategies](#performance-optimization-strategies)
10. [Security Best Practices](#security-best-practices)

## Core MCP Server Architecture

### Basic Server Setup

Start with a class-based architecture that encapsulates your MCP server:

```javascript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from "@modelcontextprotocol/sdk/types.js";

export class YourMCPServer {
  constructor() {
    // Initialize MCP server with metadata
    this.server = new Server(
      {
        name: "your-server-name",
        version: "0.1.0",
        description: "Brief description of your server"
      },
      {
        capabilities: {
          tools: {} // Enable tool support
        }
      }
    );
    
    // Initialize your external service credentials
    this.apiKey = process.env.YOUR_API_KEY;
    this.baseUrl = 'https://api.yourservice.com';
    
    // Set up tool handlers
    this.setupToolHandlers();
  }
  
  setupToolHandlers() {
    // Register handler for listing available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: this.getToolDefinitions() };
    });
    
    // Register handler for tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return await this.executeTool(name, args);
    });
  }
}
```

### Key Architecture Decisions

1. **Class-based structure**: Encapsulates state and provides clear organization
2. **Environment-based configuration**: Never hardcode credentials in source
3. **Async/await patterns**: Use throughout for clean async handling
4. **Error boundaries**: Wrap all tool executions in try-catch blocks

## Multi-Transport Support Implementation

### Stdio Transport (Default)

For direct integration with AI assistants:

```javascript
async run() {
  const transport = new StdioServerTransport();
  await this.server.connect(transport);
  console.error("MCP server running on stdio");
}
```

### HTTP REST Wrapper

Create an Express wrapper for REST API access:

```javascript
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize your MCP server instance
const mcpServer = new YourMCPServer();

// Map MCP tools to REST endpoints
app.post('/tools/:toolName', async (req, res) => {
  try {
    const result = await mcpServer.executeTool(req.params.toolName, req.body);
    res.json(JSON.parse(result.content[0].text));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Server-Sent Events (SSE) Implementation

For real-time MCP protocol over HTTP:

```javascript
// SSE endpoint for MCP protocol
app.get('/sse', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send initial capabilities
  sendSSEMessage(res, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {
      serverInfo: { name: 'your-server', version: '0.1.0' },
      capabilities: { tools: { listTools: true, callTool: true } }
    }
  });
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE connection closed');
  });
});

// Handle MCP-over-SSE requests
app.post('/sse', async (req, res) => {
  const { method, params, id } = req.body;
  
  switch (method) {
    case 'tools/list':
      res.json({
        jsonrpc: '2.0',
        id,
        result: { tools: mcpServer.getToolDefinitions() }
      });
      break;
      
    case 'tools/call':
      const result = await mcpServer.executeTool(params.name, params.arguments);
      res.json({
        jsonrpc: '2.0',
        id,
        result: { content: result.content, isError: false }
      });
      break;
  }
});
```

## External API Integration Patterns

### Robust API Client Implementation

Create a dedicated method for external API calls with proper error handling:

```javascript
async makeAPIRequest(endpoint, params = {}, options = {}) {
  const url = new URL(`${this.baseUrl}${endpoint}`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });
  
  const requestOptions = {
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'Your-MCP-Server/0.1.0',
      'Content-Type': 'application/json',
      ...options.headers
    },
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined
  };
  
  // Implement retry logic with exponential backoff
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url.toString(), requestOptions);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError;
}
```

### Pagination Handling

Implement a generic pagination handler:

```javascript
async *paginatedRequest(endpoint, params = {}, pageSize = 100) {
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const response = await this.makeAPIRequest(endpoint, {
      ...params,
      limit: pageSize,
      offset: offset
    });
    
    yield response.items || response;
    
    hasMore = response.items && response.items.length === pageSize;
    offset += pageSize;
  }
}

// Usage example
async getAllItems() {
  const allItems = [];
  for await (const batch of this.paginatedRequest('/items')) {
    allItems.push(...batch);
  }
  return allItems;
}
```

## Tool Design and Implementation

### Tool Definition Schema

Define tools with comprehensive schemas:

```javascript
getToolDefinitions() {
  return [
    {
      name: "search_items",
      description: "Search for items in the knowledge store",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query string"
          },
          filters: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["article", "book", "report"],
                description: "Filter by item type"
              },
              dateFrom: {
                type: "string",
                format: "date",
                description: "Filter items from this date"
              }
            }
          },
          limit: {
            type: "number",
            description: "Maximum results (default: 20)",
            default: 20,
            minimum: 1,
            maximum: 100
          }
        },
        required: ["query"]
      }
    }
  ];
}
```

### Tool Implementation Pattern

Implement tools with consistent error handling and response formatting:

```javascript
async executeTool(toolName, args) {
  try {
    // Validate required arguments
    this.validateToolArguments(toolName, args);
    
    switch (toolName) {
      case "search_items":
        return await this.searchItems(args);
      case "get_item_details":
        return await this.getItemDetails(args);
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${toolName}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error.message}`
    );
  }
}

async searchItems(args) {
  const { query, filters = {}, limit = 20 } = args;
  
  // Build API request
  const searchParams = {
    q: query,
    limit: Math.min(limit, 100) // Enforce maximum
  };
  
  // Apply filters
  if (filters.type) {
    searchParams.type = filters.type;
  }
  
  const results = await this.makeAPIRequest('/search', searchParams);
  
  // Format response according to MCP spec
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          query,
          total_results: results.totalCount,
          returned: results.items.length,
          items: results.items.map(item => this.formatItem(item))
        }, null, 2)
      }
    ]
  };
}
```

## HTTP/SSE Server Implementation

### Production-Ready Express Server

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(error.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});
```

## Desktop Extension Packaging

### Extension Manifest Structure

Create a `manifest.json` for Claude Desktop:

```json
{
  "manifest_version": "0.1",
  "name": "your-knowledge-store",
  "display_name": "Your Knowledge Store",
  "version": "1.0.0",
  "description": "Access your knowledge store through Claude",
  "author": {
    "name": "Your Name",
    "url": "https://github.com/yourusername"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/your-mcp-server"
  },
  "icon": "assets/logo.png",
  "server": {
    "type": "node",
    "entry_point": "server/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/server/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  },
  "tools": [
    {
      "name": "search_items",
      "description": "Search your knowledge store"
    }
  ],
  "platforms": ["darwin", "win32", "linux"]
}
```

### Building the Extension

Create a build script:

```javascript
// build-extension.js
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

async function buildExtension() {
  const extensionDir = './desktop-extension';
  const serverDir = path.join(extensionDir, 'server');
  
  // Clean and create directories
  await fs.remove(serverDir);
  await fs.ensureDir(serverDir);
  
  // Copy server files
  await fs.copy('./src', serverDir, {
    filter: (src) => !src.includes('node_modules')
  });
  
  // Copy package.json and install production dependencies
  await fs.copy('./package.json', path.join(serverDir, 'package.json'));
  
  console.log('Installing production dependencies...');
  execSync('npm ci --only=production', {
    cwd: serverDir,
    stdio: 'inherit'
  });
  
  // Build the .dxt file
  console.log('Building extension package...');
  execSync('npx @anthropic-ai/dxt pack', {
    cwd: extensionDir,
    stdio: 'inherit'
  });
  
  console.log('Extension built successfully!');
}

buildExtension().catch(console.error);
```

## Cloud Deployment Architecture

### Dockerfile for Production

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy dependencies and application
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start the server
CMD ["node", "http-server-sse.js"]
```

### Cloud Run Deployment Script

```bash
#!/bin/bash
set -euo pipefail

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-your-project-id}
SERVICE_NAME="your-mcp-server"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Build and push image
echo "Building Docker image..."
docker build -t ${IMAGE_NAME}:latest .
docker push ${IMAGE_NAME}:latest

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 100 \
  --min-instances 0 \
  --max-instances 10 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="YOUR_API_KEY=your-api-key:latest"

echo "Deployment complete!"
```

### GitHub Actions CI/CD

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: your-mcp-server
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - id: 'auth'
      uses: 'google-github-actions/auth@v1'
      with:
        credentials_json: '${{ secrets.GCP_SA_KEY }}'
    
    - name: 'Set up Cloud SDK'
      uses: 'google-github-actions/setup-gcloud@v1'
    
    - name: 'Configure Docker'
      run: gcloud auth configure-docker
    
    - name: 'Build and Push'
      run: |
        docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA .
        docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA
    
    - name: 'Deploy to Cloud Run'
      run: |
        gcloud run deploy $SERVICE_NAME \
          --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA \
          --region $REGION \
          --platform managed
```

## Error Handling and Resilience

### Comprehensive Error Handling

```javascript
class APIError extends Error {
  constructor(message, statusCode, details = {}) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// In your API client
async makeAPIRequest(endpoint, options = {}) {
  try {
    const response = await fetch(url, requestOptions);
    
    // Handle different error scenarios
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 60;
      throw new APIError(
        'Rate limit exceeded',
        429,
        { retryAfter: parseInt(retryAfter) }
      );
    }
    
    if (response.status === 401) {
      throw new APIError('Invalid API credentials', 401);
    }
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new APIError(
        `API request failed: ${response.statusText}`,
        response.status,
        { body: errorBody }
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    // Network errors
    if (error.code === 'ECONNREFUSED') {
      throw new APIError('Service unavailable', 503);
    }
    
    throw new APIError(`Network error: ${error.message}`, 500);
  }
}
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.nextAttempt = Date.now();
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
}

// Usage
const breaker = new CircuitBreaker();
const result = await breaker.execute(() => this.makeAPIRequest('/endpoint'));
```

## Performance Optimization Strategies

### In-Memory Caching

```javascript
class CacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 300000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  set(key, value) {
    // Implement LRU eviction if needed
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }
  
  clear() {
    this.cache.clear();
  }
}

// Integration with API calls
async getCachedData(endpoint, params) {
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
  
  // Check cache first
  const cached = this.cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch and cache
  const data = await this.makeAPIRequest(endpoint, params);
  this.cache.set(cacheKey, data);
  return data;
}
```

### Request Batching

```javascript
class BatchProcessor {
  constructor(processFn, options = {}) {
    this.processFn = processFn;
    this.batchSize = options.batchSize || 50;
    this.delay = options.delay || 100;
    this.queue = [];
    this.timeout = null;
  }
  
  async add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else {
        this.scheduleFlush();
      }
    });
  }
  
  scheduleFlush() {
    if (this.timeout) return;
    
    this.timeout = setTimeout(() => {
      this.flush();
    }, this.delay);
  }
  
  async flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0, this.batchSize);
    const items = batch.map(b => b.item);
    
    try {
      const results = await this.processFn(items);
      batch.forEach((b, i) => b.resolve(results[i]));
    } catch (error) {
      batch.forEach(b => b.reject(error));
    }
  }
}

// Usage
const batchProcessor = new BatchProcessor(async (items) => {
  return await this.makeAPIRequest('/batch', { items });
});

// Individual requests get batched automatically
const result = await batchProcessor.add({ id: 123 });
```

## Security Best Practices

### Environment Variable Management

```javascript
// config.js
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define and validate configuration schema
const configSchema = z.object({
  API_KEY: z.string().min(1),
  API_BASE_URL: z.string().url(),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z.string().transform(s => s.split(',')).optional(),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100')
});

// Validate and export configuration
export const config = (() => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    console.error('Configuration validation failed:', error.errors);
    process.exit(1);
  }
})();
```

### Request Validation

```javascript
import { z } from 'zod';

// Define schemas for each tool
const toolSchemas = {
  search_items: z.object({
    query: z.string().min(1).max(200),
    filters: z.object({
      type: z.enum(['article', 'book', 'report']).optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional()
    }).optional(),
    limit: z.number().min(1).max(100).default(20)
  }),
  
  get_item_details: z.object({
    item_id: z.string().uuid(),
    include_metadata: z.boolean().default(false)
  })
};

// Validate tool arguments
validateToolArguments(toolName, args) {
  const schema = toolSchemas[toolName];
  if (!schema) {
    throw new Error(`No schema defined for tool: ${toolName}`);
  }
  
  try {
    return schema.parse(args);
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid arguments: ${error.errors.map(e => e.message).join(', ')}`
    );
  }
}
```

### API Key Rotation Support

```javascript
class APIKeyManager {
  constructor(options = {}) {
    this.keys = options.keys || [process.env.API_KEY];
    this.currentIndex = 0;
    this.rotationInterval = options.rotationInterval || 3600000; // 1 hour
    this.setupRotation();
  }
  
  getCurrentKey() {
    return this.keys[this.currentIndex];
  }
  
  rotateKey() {
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    console.log(`Rotated to API key index: ${this.currentIndex}`);
  }
  
  setupRotation() {
    if (this.keys.length > 1) {
      setInterval(() => this.rotateKey(), this.rotationInterval);
    }
  }
  
  handleKeyFailure() {
    if (this.keys.length > 1) {
      console.error('API key failed, rotating to next key');
      this.rotateKey();
      return true; // Retry with new key
    }
    return false;
  }
}
```

## Testing Strategies

### Integration Testing

```javascript
// test/integration/mcp-server.test.js
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { YourMCPServer } from '../src/mcp-server.js';

describe('MCP Server Integration Tests', () => {
  let server;
  
  beforeAll(() => {
    server = new YourMCPServer();
  });
  
  describe('Tool Execution', () => {
    it('should search items successfully', async () => {
      const result = await server.executeTool('search_items', {
        query: 'test query',
        limit: 5
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const data = JSON.parse(result.content[0].text);
      expect(data.query).toBe('test query');
      expect(data.items).toBeInstanceOf(Array);
      expect(data.items.length).toBeLessThanOrEqual(5);
    });
    
    it('should handle missing required arguments', async () => {
      await expect(
        server.executeTool('search_items', {})
      ).rejects.toThrow('Invalid arguments');
    });
  });
});
```

### Load Testing

```javascript
// test/load/stress-test.js
import autocannon from 'autocannon';

async function runLoadTest() {
  const result = await autocannon({
    url: 'http://localhost:8080',
    connections: 10,
    pipelining: 1,
    duration: 30,
    requests: [
      {
        method: 'POST',
        path: '/tools/search_items',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'test',
          limit: 10
        })
      }
    ]
  });
  
  console.log('Load test results:', result);
}

runLoadTest().catch(console.error);
```

## Monitoring and Observability

### Structured Logging

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'mcp-server',
    version: process.env.npm_package_version
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add request context
export function createRequestLogger(requestId) {
  return logger.child({ requestId });
}

// Usage in tools
async executeTool(toolName, args, requestId) {
  const log = createRequestLogger(requestId);
  
  log.info('Tool execution started', { toolName, args });
  
  try {
    const result = await this[toolName](args);
    log.info('Tool execution completed', { toolName, duration });
    return result;
  } catch (error) {
    log.error('Tool execution failed', { toolName, error });
    throw error;
  }
}
```

### Metrics Collection

```javascript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Define metrics
const toolExecutions = new Counter({
  name: 'mcp_tool_executions_total',
  help: 'Total number of tool executions',
  labelNames: ['tool_name', 'status']
});

const toolDuration = new Histogram({
  name: 'mcp_tool_duration_seconds',
  help: 'Tool execution duration in seconds',
  labelNames: ['tool_name'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const activeConnections = new Gauge({
  name: 'mcp_active_connections',
  help: 'Number of active connections'
});

// Instrument your code
async executeTool(toolName, args) {
  const timer = toolDuration.startTimer({ tool_name: toolName });
  
  try {
    const result = await this[toolName](args);
    toolExecutions.inc({ tool_name: toolName, status: 'success' });
    return result;
  } catch (error) {
    toolExecutions.inc({ tool_name: toolName, status: 'error' });
    throw error;
  } finally {
    timer();
  }
}

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Conclusion

Building a production-ready MCP server requires careful attention to:

1. **Architecture**: Clean separation of concerns with multi-transport support
2. **Integration**: Robust API client with retry logic and error handling
3. **Performance**: Caching, batching, and pagination for scalability
4. **Security**: Proper credential management and request validation
5. **Deployment**: Containerization and cloud-native deployment strategies
6. **Monitoring**: Comprehensive logging and metrics for observability

Remember to:
- Start simple and iterate
- Test thoroughly at each integration point
- Monitor performance and errors in production
- Keep security as a primary concern
- Document your API and tools comprehensively

This guide provides the technical foundation needed to build MCP servers that can reliably integrate with any knowledge store or external service while maintaining the flexibility to deploy across multiple environments.