import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';
import path from 'path';
import { db } from './services/database';
import { redis } from './services/redis';

// Import routes
import authRoutes from './routes/auth';
import exchangeRoutes from './routes/exchanges';
import mcpRoutes from './routes/mcp';
import universalMcpRoutes from './routes/universalMcp';
import oauthRoutes from './routes/oauth';

// Load environment variables
// In production, Docker Compose handles environment variables
if (process.env.NODE_ENV !== 'production') {
  config();
}

class SailMCPServer {
  private app: express.Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3001');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Debug logging
    console.log('Setting up middleware...');
    console.log('FRONTEND_URL from env:', process.env.FRONTEND_URL);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    // Security middleware
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    const baseOrigins = process.env.NODE_ENV === 'production' 
      ? ['https://sailmcp.com', 'https://www.sailmcp.com']
      : ['http://localhost:3000', 'http://localhost:3001'];
    
    // Add FRONTEND_URL if specified
    const allowedOrigins = process.env.FRONTEND_URL 
      ? [...baseOrigins, process.env.FRONTEND_URL]
      : baseOrigins;
    
    console.log('CORS allowed origins:', allowedOrigins);
    
    this.app.use(cors({
      origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.log('Blocked origin:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Mcp-Session-Id',
        'Last-Event-ID',
        'Cache-Control'
      ],
      exposedHeaders: ['Mcp-Session-Id']
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Logging middleware
    if (process.env.NODE_ENV !== 'test') {
      this.app.use(morgan('combined'));
    }

    // Trust proxy for rate limiting and IP detection
    this.app.set('trust proxy', 1);
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'Sail MCP Backend'
      });
    });

    // OAuth Authorization Server Metadata (RFC 8414)
    this.app.use('/.well-known', oauthRoutes);
    
    // OAuth endpoints
    this.app.use('/oauth', oauthRoutes);

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/exchanges', exchangeRoutes);
    
    // MCP routes (public)
    this.app.use('/mcp', mcpRoutes);
    
    // Universal MCP endpoint - works with all clients
    this.app.use('/', universalMcpRoutes);

    // File serving for local storage
    this.app.get('/files/:filename', async (req, res) => {
      try {
        const { filename } = req.params;
        const filePath = path.join(process.cwd(), 'storage', filename);
        res.sendFile(filePath);
      } catch {
        res.status(404).json({ error: 'File not found' });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Global error handler:', error);
      
      res.status(error.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Initialize database
      await db.createTables();
      console.log('✅ Database initialized');
      
      // Run migrations
      await db.migrate();
      console.log('✅ Database migrations completed');

      // Test Redis connection (disabled for initial deployment)
      // await redis.set('test', 'connection');
      // await redis.del('test');
      console.log('⚠️ Redis connection skipped for initial deployment');

      // Start server
      this.app.listen(this.port, () => {
        console.log(`🚀 SailMCP server running on port ${this.port}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV}`);
        console.log(`🌐 Base URL: ${process.env.BASE_URL}`);
        console.log(`🎯 Frontend URL: ${process.env.FRONTEND_URL}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    console.log('Shutting down gracefully...');
    
    try {
      await db.close();
      await redis.disconnect();
      console.log('✅ Connections closed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new SailMCPServer();
server.start().catch(console.error);

export default SailMCPServer;