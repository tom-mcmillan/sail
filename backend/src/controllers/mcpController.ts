import { Request, Response } from 'express';
import { db } from '../services/database';
import { StreamableHTTPTransport } from '../services/mcp/transport';
import { MCPServer } from '../services/mcp/server';
import { validateOAuthToken, requireScope } from '../middleware/oauth';
import { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '@modelcontextprotocol/sdk/types.js';

interface AuthenticatedRequest extends Request {
  oauth?: {
    clientId: string;
    scopes: string[];
    userId?: string;
  };
}

class MCPControllerClass {
  private transports: Map<string, StreamableHTTPTransport> = new Map();
  private servers: Map<string, MCPServer> = new Map();

  /**
   * Handle MCP requests using Streamable HTTP transport
   */
  async handleMCPRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const sessionId = req.headers['mcp-session-id'] as string;
      
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

      // Get or create transport for this exchange
      let transport = this.transports.get(slug);
      if (!transport) {
        transport = new StreamableHTTPTransport();
        this.transports.set(slug, transport);

        // Get or create MCP server
        let mcpServer = this.servers.get(slug);
        if (!mcpServer) {
          mcpServer = new MCPServer(exchange);
          this.servers.set(slug, mcpServer);
        }

        // Connect transport to server
        this.setupTransportHandlers(transport, mcpServer, exchange);
      }

      // Handle POST requests (JSON-RPC messages)
      if (req.method === 'POST') {
        await transport.handlePost(req, res, sessionId);
        return;
      }

      // Handle GET requests (SSE connection)
      if (req.method === 'GET') {
        await transport.handleGet(req, res, sessionId);
        return;
      }

      // Handle OPTIONS for CORS
      if (req.method === 'OPTIONS') {
        res.status(200).json({});
        return;
      }

      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not allowed'
        },
        id: null
      });

    } catch (error) {
      console.error('MCP request error:', error);
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
   * Set up handlers between transport and MCP server
   */
  private setupTransportHandlers(transport: StreamableHTTPTransport, mcpServer: MCPServer, exchange: any): void {
    const server = mcpServer.getServer();

    // Handle incoming messages from transport
    transport.on('message', async (message: JSONRPCMessage, respond: (response: JSONRPCResponse) => void) => {
      try {
        // Track analytics
        await this.trackAnalytics(exchange.id, message);

        // Process message through MCP server
        if ('method' in message) {
          // It's a request or notification
          const request = message as JSONRPCRequest;
          
          try {
            const result = await this.processRequest(server, request);
            
            if ('id' in request && request.id !== null) {
              // It's a request, send response
              respond({
                jsonrpc: '2.0',
                result,
                id: request.id
              });
            }
            // If it's a notification (no id), don't send response
          } catch (error: any) {
            if ('id' in request && request.id !== null) {
              respond({
                jsonrpc: '2.0',
                error: {
                  code: error.code || -32603,
                  message: error.message || 'Internal error',
                  data: error.data
                },
                id: request.id
              } as any);
            }
          }
        }
      } catch (error) {
        console.error('Error processing MCP message:', error);
        if ('id' in message && message.id !== null) {
          respond({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal error'
            },
            id: message.id
          } as any);
        }
      }
    });
  }

  /**
   * Process a JSON-RPC request through the MCP server
   */
  private async processRequest(server: any, request: JSONRPCRequest): Promise<any> {
    const handlers = server.requestHandlers;
    const handler = handlers.get(request.method);
    
    if (!handler) {
      throw {
        code: -32601,
        message: `Method not found: ${request.method}`
      };
    }

    return await handler(request);
  }

  /**
   * Track analytics for MCP requests
   */
  private async trackAnalytics(exchangeId: string, message: JSONRPCMessage): Promise<void> {
    try {
      if ('method' in message) {
        await db.query(`
          INSERT INTO analytics (exchange_id, query, response_time, created_at)
          VALUES ($1, $2, $3, NOW())
        `, [exchangeId, message.method, 0]); // Response time will be updated later
      }

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
   * Get analytics for an exchange (existing method)
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { exchangeId } = req.params;
      const userId = (req as any).user?.id;

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

  /**
   * Clean up resources for inactive exchanges
   */
  cleanup(): void {
    // This would be called periodically to clean up inactive transports/servers
    // For now, we'll keep them in memory for the session
  }
}

export const mcpController = new MCPControllerClass();