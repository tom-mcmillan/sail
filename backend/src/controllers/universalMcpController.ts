import { Request, Response } from 'express';
import { db } from '../services/database';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { McpServerSDK } from '../services/McpServerSDK';

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
      
      // Determine knowledge store type (default to 'local' for backward compatibility)
      const knowledgeType = exchange.knowledge_type || 'local';
      
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
}

export const universalMcpController = new UniversalMCPControllerClass();