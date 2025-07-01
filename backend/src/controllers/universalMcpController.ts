import { Request, Response } from 'express';
import { db } from '../services/database';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { McpServerSDK } from '../services/McpServerSDK';
import { packetKeyController } from './packetKeyController';

interface AuthenticatedRequest extends Request {
  oauth?: {
    clientId: string;
    scopes: string[];
    userId?: string;
  };
}

class UniversalMCPControllerClass {
  private mcpServer: McpServerSDK;

  constructor() {
    this.mcpServer = new McpServerSDK();
  }

  /**
   * Handle packet key based MCP requests - no authentication required
   */
  async handlePacketKeyMCPRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      console.log(`Packet Key MCP Request: ${req.method} ${req.url}`);
      const { packetKey } = req.params;
      
      // Validate packet key and get exchange info
      const packetData = await packetKeyController.validatePacketKey(packetKey);
      
      if (!packetData) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32002,
            message: 'Invalid, expired, or deactivated packet key'
          },
          id: null
        });
        return;
      }

      // Log usage for analytics
      const clientInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        timestamp: new Date().toISOString()
      };
      
      await packetKeyController.logUsage(
        packetKey,
        clientInfo,
        req.body?.method || req.method,
        req.url
      );

      // Use the exchange data to handle the MCP request
      const exchange = packetData;
      const knowledgeType = exchange.type || exchange.knowledge_type || 'local';
      const adapterConfig = this.buildAdapterConfig(exchange, knowledgeType);
      
      // Create knowledge store adapter
      if (!AdapterRegistry.isSupported(knowledgeType)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Unsupported knowledge store type: ${knowledgeType}`
          },
          id: null
        });
        return;
      }

      const adapter = AdapterRegistry.create(knowledgeType, adapterConfig);
      
      // For composite adapters, initialize sub-adapters
      if (knowledgeType === 'composite' && 'initialize' in adapter) {
        const subAdapters = new Map();
        if (adapterConfig.sources) {
          for (const source of adapterConfig.sources) {
            try {
              const subAdapter = AdapterRegistry.create(source.type, source.config);
              subAdapters.set(source.id, subAdapter);
            } catch (error) {
              console.error(`Failed to create sub-adapter ${source.id}:`, error);
            }
          }
        }
        await (adapter as any).initialize(subAdapters);
      }
      
      // Health check the adapter
      const health = await adapter.healthCheck();
      if (!health.healthy) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32003,
            message: `Knowledge store unhealthy: ${health.message}`
          },
          id: null
        });
        return;
      }

      // Handle request through universal MCP server
      await this.mcpServer.handleRequest(req, res, adapter);

    } catch (error) {
      console.error('Packet Key MCP request error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        },
        id: null
      });
    }
  }

  /**
   * Handle universal MCP requests - works with any MCP client
   */
  async handleUniversalMCPRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      console.log(`Universal MCP Request: ${req.method} ${req.url}`);
      const { slug } = req.params;
      
      // Get exchange info
      const exchangeResult = await db.query(
        'SELECT * FROM exchanges WHERE slug = $1',
        [slug]
      );

      if (exchangeResult.rows.length === 0) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32002,
            message: 'MCP server not found'
          },
          id: null
        });
        return;
      }

      const exchange = exchangeResult.rows[0];
      
      // Determine knowledge store type (use 'type' field for new exchanges, fallback to 'knowledge_type' for backward compatibility)
      const knowledgeType = exchange.type || exchange.knowledge_type || 'local';
      
      // Get adapter configuration
      const adapterConfig = this.buildAdapterConfig(exchange, knowledgeType);
      
      // Create knowledge store adapter
      if (!AdapterRegistry.isSupported(knowledgeType)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Unsupported knowledge store type: ${knowledgeType}`
          },
          id: null
        });
        return;
      }

      const adapter = AdapterRegistry.create(knowledgeType, adapterConfig);
      
      // For composite adapters, initialize sub-adapters
      if (knowledgeType === 'composite' && 'initialize' in adapter) {
        const subAdapters = new Map();
        if (adapterConfig.sources) {
          for (const source of adapterConfig.sources) {
            try {
              const subAdapter = AdapterRegistry.create(source.type, source.config);
              subAdapters.set(source.id, subAdapter);
            } catch (error) {
              console.error(`Failed to create sub-adapter ${source.id}:`, error);
            }
          }
        }
        await (adapter as any).initialize(subAdapters);
      }
      
      // Health check the adapter
      const health = await adapter.healthCheck();
      if (!health.healthy) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32003,
            message: `Knowledge store unhealthy: ${health.message}`
          },
          id: null
        });
        return;
      }

      // Track analytics
      await this.trackAnalytics(exchange.id, req);

      // Handle request through universal MCP server
      await this.mcpServer.handleRequest(req, res, adapter);

    } catch (error) {
      console.error('Universal MCP request error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        },
        id: null
      });
    }
  }

  /**
   * Get information about available knowledge store types
   */
  async getAvailableAdapters(req: Request, res: Response): Promise<void> {
    try {
      const adapters = AdapterRegistry.getAllAdapterInfo();
      res.json({
        success: true,
        adapters: adapters.map(adapter => ({
          storeType: adapter.storeType,
          displayName: adapter.displayName,
          description: adapter.description,
          requiredConfig: adapter.requiredConfig
        }))
      });
    } catch (error) {
      console.error('Error getting adapters:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get available adapters'
      });
    }
  }

  /**
   * Get MCP server status and debug info
   */
  async getServerStatus(req: Request, res: Response): Promise<void> {
    try {
      const sessions = this.mcpServer.getSessionInfo();
      const adapters = AdapterRegistry.getAvailableTypes();
      
      res.json({
        success: true,
        status: {
          activeSessions: sessions.length,
          sessions: sessions,
          supportedAdapters: adapters,
          uptime: process.uptime()
        }
      });
    } catch (error) {
      console.error('Error getting server status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get server status'
      });
    }
  }

  private buildAdapterConfig(exchange: any, knowledgeType: string): Record<string, any> {
    // Build configuration based on knowledge store type and exchange config
    const baseConfig = exchange.config || {};
    
    switch (knowledgeType) {
      case 'local':
        return {
          folderPath: baseConfig.folderPath || exchange.config?.folderPath || '/app'
        };
      
      case 'github':
        return {
          owner: baseConfig.owner,
          repo: baseConfig.repo,
          token: baseConfig.token,
          branch: baseConfig.branch || 'main'
        };
      
      case 'google-drive':
        return {
          credentials: baseConfig.credentials,
          folderId: baseConfig.folderId,
          includeSubfolders: baseConfig.includeSubfolders || true
        };
      
      case 'zotero':
        return {
          apiKey: baseConfig.apiKey,
          userId: baseConfig.userId,
          collectionId: baseConfig.collectionId
        };
      
      case 'composite':
        return baseConfig; // For composite, the config is already properly structured
      
      default:
        return baseConfig;
    }
  }

  private async trackAnalytics(exchangeId: string, req: Request): Promise<void> {
    try {
      const method = req.body?.method || req.method;
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const clientIp = req.ip || req.connection.remoteAddress;

      await db.query(`
        INSERT INTO analytics (exchange_id, query, response_time, user_agent, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [exchangeId, method, 0, userAgent, clientIp]);

      // Update exchange last accessed
      await db.query(
        'UPDATE exchanges SET last_accessed = NOW(), queries_count = queries_count + 1 WHERE id = $1',
        [exchangeId]
      );
    } catch (error) {
      console.error('Analytics tracking error:', error);
      // Don't fail the request if analytics fails
    }
  }

  /**
   * Get analytics for an exchange
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { exchangeId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Verify ownership
      const exchangeResult = await db.query(
        'SELECT id FROM exchanges WHERE id = $1 AND user_id = $2',
        [exchangeId, userId]
      );

      if (exchangeResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Exchange not found'
        });
        return;
      }

      // Get analytics data
      const [queriesOverTime, topQueries, userAgents] = await Promise.all([
        db.query(`
          SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as queries
          FROM analytics 
          WHERE exchange_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY date
        `, [exchangeId]),
        
        db.query(`
          SELECT query, COUNT(*) as count
          FROM analytics 
          WHERE exchange_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
          GROUP BY query
          ORDER BY count DESC
          LIMIT 10
        `, [exchangeId]),
        
        db.query(`
          SELECT user_agent, COUNT(*) as count
          FROM analytics 
          WHERE exchange_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
          GROUP BY user_agent
          ORDER BY count DESC
          LIMIT 5
        `, [exchangeId])
      ]);

      res.json({
        success: true,
        data: {
          queriesOverTime: queriesOverTime.rows,
          topQueries: topQueries.rows,
          userAgents: userAgents.rows
        }
      });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics'
      });
    }
  }
}

export const universalMcpController = new UniversalMCPControllerClass();