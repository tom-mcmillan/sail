import { Request, Response } from 'express';
import { db } from '../services/database';
import { redis } from '../services/redis';
import { fileSystemService } from '../services/fileSystem';

export class MCPController {
  async handleMCPRequest(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const method = req.method;
      const path = req.path;
      
      // Get exchange info
      const exchangeResult = await db.query(
        'SELECT * FROM exchanges WHERE slug = $1',
        [slug]
      );

      if (exchangeResult.rows.length === 0) {
        res.status(404).json({ 
          error: 'MCP server not found',
          jsonrpc: '2.0',
          id: null
        });
        return;
      }

      const exchange = exchangeResult.rows[0];

      // Handle MCP server discovery (GET request to root)
      if (method === 'GET' && !req.url.includes('/tools') && !req.url.includes('/call')) {
        res.json({
          name: exchange.name,
          version: '1.0.0',
          description: exchange.description,
          capabilities: {
            tools: {},
            resources: {}
          },
          serverInfo: {
            name: exchange.name,
            version: '1.0.0'
          }
        });
        return;
      }

      // Handle tools discovery
      if (method === 'GET' && req.url.includes('/tools')) {
        const tools = await this.getToolsForExchange(exchange);
        res.json({
          jsonrpc: '2.0',
          result: {
            tools: tools
          }
        });
        return;
      }

      // Handle tool calls (POST requests)
      if (method === 'POST') {
        const mcpResponse = await this.handleToolCall(exchange, req);
        res.json(mcpResponse);
        return;
      }

      // Update analytics
      await db.query(
        'UPDATE exchanges SET last_accessed = NOW(), queries_count = queries_count + 1 WHERE id = $1',
        [exchange.id]
      );

      // Default response
      res.json({
        jsonrpc: '2.0',
        result: {
          message: 'MCP server active',
          server: exchange.name
        }
      });

    } catch (error) {
      console.error('MCP request error:', error);
      res.status(500).json({ 
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error'
        },
        id: null
      });
    }
  }

  private async getToolsForExchange(exchange: any): Promise<any[]> {
    switch (exchange.type) {
      case 'local':
        return [
          {
            name: 'search_documents',
            description: 'Search through documents in the folder',
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
            description: 'Get content of a specific document',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: 'Relative path to the file' }
              },
              required: ['file_path']
            }
          },
          {
            name: 'list_files',
            description: 'List all available files',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', default: 20 }
              }
            }
          }
        ];
      default:
        return [];
    }
  }

  private async handleToolCall(exchange: any, req: Request): Promise<any> {
    try {
      const { method, params, id } = req.body;
      
      if (method === 'tools/call') {
        const { name, arguments: args } = params;
        
        let result;
        switch (name) {
          case 'search_documents':
            result = await this.searchDocuments(exchange.config.folderPath, args.query, args.limit || 10);
            break;
          case 'get_document':
            result = await this.getDocument(exchange.config.folderPath, args.file_path);
            break;
          case 'list_files':
            result = await this.listFiles(exchange.config.folderPath, args.limit || 20);
            break;
          default:
            return {
              jsonrpc: '2.0',
              error: {
                code: -32601,
                message: `Method ${name} not found`
              },
              id
            };
        }
        
        return {
          jsonrpc: '2.0',
          result,
          id
        };
      }
      
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found'
        },
        id
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        },
        id: req.body?.id
      };
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
    const { folderPath } = config;

    if (!folderPath) {
      return { error: 'No folder path configured for this exchange' };
    }
    
    if (req.url.includes('/tools')) {
      return {
        tools: [
          {
            name: 'search_documents',
            description: 'Search through documents in the folder',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', default: 10, minimum: 1, maximum: 50 }
              },
              required: ['query']
            }
          },
          {
            name: 'get_document',
            description: 'Get content of a specific document by relative path',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: { type: 'string', description: 'Relative path to the file' }
              },
              required: ['file_path']
            }
          },
          {
            name: 'list_files',
            description: 'List all available files in the folder',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', default: 20, minimum: 1, maximum: 100 }
              }
            }
          }
        ]
      };
    }

    // Handle tool calls based on the request body
    if (req.method === 'POST' && req.body) {
      const { name: toolName, arguments: toolArgs } = req.body;
      
      switch (toolName) {
        case 'search_documents':
          return await this.searchDocuments(folderPath, toolArgs.query, toolArgs.limit || 10);
        
        case 'get_document':
          return await this.getDocument(folderPath, toolArgs.file_path);
        
        case 'list_files':
          return await this.listFiles(folderPath, toolArgs.limit || 20);
      }
    }

    // Default response for MCP server info
    return { 
      name: exchange.name,
      description: exchange.description,
      type: 'local',
      folder_path: folderPath,
      status: 'active',
      available_tools: ['search_documents', 'get_document', 'list_files'],
      file_stats: metadata
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

  // Helper methods for local file operations
  private async searchDocuments(folderPath: string, query: string, limit: number): Promise<any> {
    try {
      const files = await fileSystemService.searchFiles(folderPath, query, limit);
      
      return {
        content: [{
          type: 'text',
          text: `Found ${files.length} documents matching "${query}":\n\n` +
                files.map(file => 
                  `📄 **${file.name}**\n` +
                  `   Path: ${file.relativePath}\n` +
                  `   Size: ${this.formatFileSize(file.size)}\n` +
                  `   Type: ${file.type}\n` +
                  `   Modified: ${file.lastModified.toLocaleDateString()}\n`
                ).join('\n')
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching documents: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  private async getDocument(folderPath: string, relativePath: string): Promise<any> {
    try {
      const fullPath = require('path').join(folderPath, relativePath);
      
      // Security check - ensure the path is within the folder
      if (!fullPath.startsWith(folderPath)) {
        throw new Error('Invalid file path - outside of allowed folder');
      }

      const content = await fileSystemService.readFileContent(fullPath);
      
      return {
        content: [{
          type: 'text',
          text: `**File: ${relativePath}**\n\n${content}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error reading document: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  private async listFiles(folderPath: string, limit: number): Promise<any> {
    try {
      const allFiles = await fileSystemService.getAllFiles(folderPath);
      const supportedFiles = allFiles
        .filter(file => fileSystemService.isSupportedFileType(file.extension))
        .slice(0, limit);
      
      return {
        content: [{
          type: 'text',
          text: `📁 **Available Documents** (${supportedFiles.length} of ${allFiles.length} total files)\n\n` +
                supportedFiles.map(file => 
                  `📄 **${file.name}**\n` +
                  `   Path: ${file.relativePath}\n` +
                  `   Size: ${this.formatFileSize(file.size)}\n` +
                  `   Type: ${file.type}\n` +
                  `   Modified: ${file.lastModified.toLocaleDateString()}\n`
                ).join('\n')
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing files: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const mcpController = new MCPController();