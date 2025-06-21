import { Request, Response } from 'express';
import { db } from '../services/database';
import { redis } from '../services/redis';

export class MCPController {
  async handleMCPRequest(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      
      // Get exchange info
      const exchangeResult = await db.query(
        'SELECT * FROM exchanges WHERE slug = $1 AND status = $2',
        [slug, 'active']
      );

      if (exchangeResult.rows.length === 0) {
        res.status(404).json({ 
          error: 'Exchange not found or inactive' 
        });
        return;
      }

      const exchange = exchangeResult.rows[0];

      // Check privacy settings
      if (exchange.privacy === 'private') {
        // TODO: Implement proper authentication for private exchanges
        // For now, we'll allow access but this should be secured
      }

      // Update last accessed time and increment query count
      await db.query(
        'UPDATE exchanges SET last_accessed = NOW(), queries_count = queries_count + 1 WHERE id = $1',
        [exchange.id]
      );

      // Log analytics
      await db.query(
        'INSERT INTO analytics (exchange_id, query, user_agent, ip_address) VALUES ($1, $2, $3, $4)',
        [exchange.id, req.url, req.get('User-Agent'), req.ip]
      );

      // Route to appropriate MCP handler based on exchange type
      const mcpResponse = await this.routeMCPRequest(exchange, req);
      
      res.json(mcpResponse);
    } catch (error) {
      console.error('MCP request error:', error);
      res.status(500).json({ 
        error: 'MCP request failed' 
      });
    }
  }

  private async routeMCPRequest(exchange: any, req: Request): Promise<any> {
    switch (exchange.type) {
      case 'local':
        return await this.handleLocalMCPRequest(exchange, req);
      case 'google-drive':
        return await this.handleGoogleDriveMCPRequest(exchange, req);
      case 'github':
        return await this.handleGitHubMCPRequest(exchange, req);
      default:
        throw new Error(`Unknown exchange type: ${exchange.type}`);
    }
  }

  private async handleLocalMCPRequest(exchange: any, req: Request): Promise<any> {
    const { metadata, config } = exchange;
    
    if (req.url.includes('/tools')) {
      return {
        tools: [
          {
            name: 'search_documents',
            description: 'Search through uploaded documents',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', default: 10 }
              },
              required: ['query']
            }
          },
          {
            name: 'get_document',
            description: 'Get a specific document by ID',
            inputSchema: {
              type: 'object',
              properties: {
                document_id: { type: 'string', description: 'Document ID' }
              },
              required: ['document_id']
            }
          }
        ]
      };
    }

    // Handle tool calls and other MCP operations
    return { 
      message: 'Local MCP handler active',
      exchange_name: exchange.name,
      type: 'local',
      available_tools: ['search_documents', 'get_document']
    };
  }

  private async handleGoogleDriveMCPRequest(exchange: any, req: Request): Promise<any> {
    if (req.url.includes('/tools')) {
      return {
        tools: [
          {
            name: 'search_drive',
            description: 'Search Google Drive documents',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', default: 10 }
              },
              required: ['query']
            }
          },
          {
            name: 'get_document',
            description: 'Get Google Drive document content',
            inputSchema: {
              type: 'object',
              properties: {
                document_id: { type: 'string', description: 'Google Drive document ID' }
              },
              required: ['document_id']
            }
          }
        ]
      };
    }

    return { 
      message: 'Google Drive MCP handler active',
      exchange_name: exchange.name,
      type: 'google-drive',
      available_tools: ['search_drive', 'get_document']
    };
  }

  private async handleGitHubMCPRequest(exchange: any, req: Request): Promise<any> {
    if (req.url.includes('/tools')) {
      return {
        tools: [
          {
            name: 'search_code',
            description: 'Search repository code and documentation',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', default: 10 }
              },
              required: ['query']
            }
          },
          {
            name: 'get_file',
            description: 'Get file content from repository',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: 'File path in repository' }
              },
              required: ['file_path']
            }
          },
          {
            name: 'list_commits',
            description: 'List recent commits',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', default: 10 }
              }
            }
          }
        ]
      };
    }

    return { 
      message: 'GitHub MCP handler active',
      exchange_name: exchange.name,
      type: 'github',
      available_tools: ['search_code', 'get_file', 'list_commits']
    };
  }

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
}

export const mcpController = new MCPController();