import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  PingRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { fileSystemService } from '../fileSystem';
import { db } from '../database';

export class MCPServer {
  private server: Server;
  private exchange: any;

  constructor(exchange: any) {
    this.exchange = exchange;
    
    // Initialize MCP server with capabilities
    this.server = new Server(
      {
        name: exchange.name,
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {
            subscribe: false // Not supported by Claude Desktop yet
          }
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle initialization
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      return {
        protocolVersion: '1.0',
        capabilities: {
          tools: {},
          resources: {
            subscribe: false
          }
        },
        serverInfo: {
          name: this.exchange.name,
          version: '1.0.0',
          description: this.exchange.description
        }
      };
    });

    // Handle ping
    this.server.setRequestHandler(PingRequestSchema, async () => {
      return {};
    });

    // Handle list tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.getToolsForExchange();
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        let result;
        
        switch (name) {
          case 'search':
            result = await this.handleSearch(args as { query: string; limit?: number });
            break;
          case 'fetch':
            result = await this.handleFetch(args as { id: string });
            break;
          case 'search_documents':
            result = await this.handleSearchDocuments(args as { query: string; limit?: number });
            break;
          case 'get_document':
            result = await this.handleGetDocument(args as { file_path: string });
            break;
          case 'list_files':
            result = await this.handleListFiles(args as { limit?: number });
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return result;
      } catch (error) {
        throw {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        };
      }
    });

    // Handle list resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await this.getResourcesForExchange();
      return { resources };
    });

    // Handle read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const resource = await this.readResource(uri);
      return resource;
    });
  }

  private getToolsForExchange(): any[] {
    const tools = [];

    // ChatGPT requires exactly these two tools with specific schemas
    tools.push({
      name: 'search',
      description: 'Search for documents matching a query',
      inputSchema: {
        type: 'object',
        properties: {
          query: { 
            type: 'string', 
            description: 'Search query to find documents' 
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10,
            minimum: 1,
            maximum: 50
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    });

    tools.push({
      name: 'fetch',
      description: 'Retrieve a document by its ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: { 
            type: 'string', 
            description: 'Document ID to retrieve' 
          }
        },
        required: ['id'],
        additionalProperties: false
      }
    });

    // Add original tools for backward compatibility
    if (this.exchange.type === 'local') {
      tools.push({
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
      });

      tools.push({
        name: 'get_document',
        description: 'Get content of a specific document',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to the file' }
          },
          required: ['file_path']
        }
      });

      tools.push({
        name: 'list_files',
        description: 'List all available files',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 20 }
          }
        }
      });
    }

    return tools;
  }

  // ChatGPT-specific search implementation
  private async handleSearch(args: { query: string; limit?: number }): Promise<any> {
    try {
      const limit = args.limit || 10;
      const files = await fileSystemService.searchFiles(
        this.exchange.config.folderPath, 
        args.query, 
        limit
      );

      // Format results exactly as ChatGPT expects
      const results = files.map((file, index) => {
        // Create consistent, unique IDs
        const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const id = `doc-${Date.now()}-${index}-${cleanName}`;
        
        return {
          id: id,
          title: file.name,
          text: `File: ${file.name}\nPath: ${file.relativePath}\nSize: ${this.formatFileSize(file.size)}\nModified: ${file.lastModified.toISOString()}\nType: ${file.type}`,
          url: `${process.env.BASE_URL || 'https://sailmcp.com'}/files/${encodeURIComponent(file.relativePath)}`,
          metadata: {
            size: file.size,
            type: file.type,
            extension: file.extension,
            lastModified: file.lastModified.toISOString()
          }
        };
      });

      // Return results in the format ChatGPT expects
      return {
        content: [{
          type: 'text',
          text: `Found ${results.length} documents matching "${args.query}":\n\n` + 
                results.map(r => `• ${r.title} (${r.id})`).join('\n') + 
                '\n\nUse the "fetch" tool with any document ID to retrieve the full content.'
        }],
        results: results // Include results for potential processing
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  // ChatGPT-specific fetch implementation
  private async handleFetch(args: { id: string }): Promise<any> {
    try {
      // Extract filename from ID pattern: doc-timestamp-index-cleanname
      const match = args.id.match(/doc-\d+-\d+-(.+)$/);
      if (!match) {
        throw new Error('Invalid document ID format');
      }
      
      // Convert clean name back to potential filename patterns
      const cleanName = match[1];
      const files = await fileSystemService.getAllFiles(this.exchange.config.folderPath);
      
      // Find file by matching the cleaned name pattern
      const file = files.find(f => {
        const fileCleanName = f.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        return fileCleanName === cleanName;
      });
      
      if (!file) {
        throw new Error(`Document not found for ID: ${args.id}`);
      }

      const fullPath = require('path').join(this.exchange.config.folderPath, file.relativePath);
      const content = await fileSystemService.readFileContent(fullPath);

      // Return content in the format ChatGPT expects
      return {
        content: [{
          type: 'text',
          text: `# ${file.name}\n\n**File Information:**\n- Path: ${file.relativePath}\n- Size: ${this.formatFileSize(file.size)}\n- Type: ${file.type}\n- Modified: ${file.lastModified.toISOString()}\n\n**Content:**\n\n${content}`
        }],
        document: {
          id: args.id,
          title: file.name,
          content: content,
          url: `${process.env.BASE_URL || 'https://sailmcp.com'}/files/${encodeURIComponent(file.relativePath)}`,
          metadata: {
            size: file.size,
            type: file.type,
            extension: file.extension,
            lastModified: file.lastModified.toISOString(),
            path: file.relativePath
          }
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error fetching document: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  // Original tool implementations
  private async handleSearchDocuments(args: { query: string; limit?: number }): Promise<any> {
    try {
      const files = await fileSystemService.searchFiles(
        this.exchange.config.folderPath,
        args.query,
        args.limit || 10
      );

      return {
        content: [{
          type: 'text',
          text: `Found ${files.length} documents matching "${args.query}":\n\n` +
                files.map(file => 
                  `📄 **${file.name}**\n` +
                  `   Path: ${file.relativePath}\n` +
                  `   Size: ${this.formatFileSize(file.size)}\n` +
                  `   Modified: ${file.lastModified.toLocaleDateString()}\n`
                ).join('\n')
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  private async handleGetDocument(args: { file_path: string }): Promise<any> {
    try {
      const fullPath = require('path').join(this.exchange.config.folderPath, args.file_path);
      
      // Security check
      if (!fullPath.startsWith(this.exchange.config.folderPath)) {
        throw new Error('Invalid file path');
      }

      const content = await fileSystemService.readFileContent(fullPath);
      
      return {
        content: [{
          type: 'text',
          text: `**File: ${args.file_path}**\n\n${content}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  private async handleListFiles(args: { limit?: number }): Promise<any> {
    try {
      const allFiles = await fileSystemService.getAllFiles(this.exchange.config.folderPath);
      const supportedFiles = allFiles
        .filter(file => fileSystemService.isSupportedFileType(file.extension))
        .slice(0, args.limit || 20);
      
      return {
        content: [{
          type: 'text',
          text: `📁 **Available Documents** (${supportedFiles.length} files)\n\n` +
                supportedFiles.map(file => 
                  `📄 ${file.name} (${file.relativePath})`
                ).join('\n')
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  private async getResourcesForExchange(): Promise<any[]> {
    if (this.exchange.type !== 'local') return [];

    try {
      const files = await fileSystemService.getAllFiles(this.exchange.config.folderPath);
      const supportedFiles = files.filter(file => 
        fileSystemService.isSupportedFileType(file.extension)
      );

      return supportedFiles.slice(0, 100).map(file => ({
        uri: `file:///${this.exchange.slug}/${file.relativePath}`,
        name: file.name,
        description: `${file.type} file (${this.formatFileSize(file.size)})`,
        mimeType: this.getMimeType(file.extension)
      }));
    } catch (error) {
      console.error('Error getting resources:', error);
      return [];
    }
  }

  private async readResource(uri: string): Promise<any> {
    const match = uri.match(/^file:\/\/\/([^\/]+)\/(.+)$/);
    if (!match || match[1] !== this.exchange.slug) {
      throw new Error('Invalid resource URI');
    }

    const relativePath = match[2];
    const fullPath = require('path').join(this.exchange.config.folderPath, relativePath);
    
    // Security check
    if (!fullPath.startsWith(this.exchange.config.folderPath)) {
      throw new Error('Invalid file path');
    }

    const content = await fileSystemService.readFileContent(fullPath);
    const mimeType = this.getMimeType(require('path').extname(relativePath));

    return {
      contents: [{
        uri,
        mimeType,
        text: content
      }]
    };
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.py': 'text/x-python',
      '.java': 'text/x-java',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++',
      '.h': 'text/x-c',
      '.sh': 'text/x-shellscript',
      '.yaml': 'text/x-yaml',
      '.yml': 'text/x-yaml'
    };

    return mimeTypes[extension.toLowerCase()] || 'text/plain';
  }

  getServer(): Server {
    return this.server;
  }
}