import { KnowledgeStoreAdapter } from './base/KnowledgeStoreAdapter';
import { 
  ToolDefinition, 
  ResourceDefinition, 
  PromptDefinition, 
  ToolResult, 
  ResourceContent, 
  HealthStatus,
  SearchArgs,
  FetchArgs,
  ListArgs
} from './base/types';
import { fileSystemService } from '../services/fileSystem';
import path from 'path';

export class LocalFileSystemAdapter extends KnowledgeStoreAdapter {
  readonly storeType = 'local';
  readonly displayName = 'Local Files';
  readonly description = 'Search and access files from a local directory';
  readonly requiredConfig: string[] = ['folderPath'];
  
  private folderPath: string;
  
  constructor(config: Record<string, any>) {
    super(config);
    this.folderPath = config.folderPath || '/app';
    
    // Only validate if this isn't the temp instance for registration
    if (Object.keys(config).length > 0) {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Invalid config: ${validation.errors?.join(', ')}`);
      }
    }
  }

  getTools(): ToolDefinition[] {
    return [
      {
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
      },
      {
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
      },
      {
        name: 'list_files',
        description: 'List all available files',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { 
              type: 'number',
              description: 'Maximum number of files to return',
              default: 20,
              minimum: 1,
              maximum: 100
            }
          },
          required: [],
          additionalProperties: false
        }
      }
    ];
  }

  async getResources(): Promise<ResourceDefinition[]> {
    try {
      const files = await fileSystemService.getAllFiles(this.config.folderPath);
      const supportedFiles = files.filter(file => 
        fileSystemService.isSupportedFileType(file.extension)
      );

      return supportedFiles.slice(0, 100).map(file => ({
        uri: `file:///${this.storeType}/${file.relativePath}`,
        name: file.name,
        description: `${file.type} file (${this.formatFileSize(file.size)})`,
        mimeType: this.getMimeType(`.${file.extension}`)
      }));
    } catch (error) {
      console.error('Error getting resources:', error);
      return [];
    }
  }

  getPrompts(): PromptDefinition[] {
    return [
      {
        name: 'search_and_summarize',
        description: 'Search for documents and provide a summary',
        arguments: [
          {
            name: 'query',
            description: 'What to search for',
            required: true
          },
          {
            name: 'focus',
            description: 'What aspect to focus on in the summary',
            required: false
          }
        ]
      }
    ];
  }

  async executeTool(name: string, args: any): Promise<ToolResult> {
    try {
      switch (name) {
        case 'search':
          return await this.handleSearch(args as SearchArgs);
        case 'fetch':
          return await this.handleFetch(args as FetchArgs);
        case 'list_files':
          return await this.handleListFiles(args as ListArgs);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async handleSearch(args: SearchArgs): Promise<ToolResult> {
    const limit = args.limit || 10;
    const files = await fileSystemService.searchFiles(
      this.config.folderPath, 
      args.query, 
      limit
    );

    // Format results for ChatGPT compatibility
    const results = files.map((file, index) => {
      const id = this.createDocumentId(file.name, index);
      
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

    return {
      content: [{
        type: 'text',
        text: `Found ${results.length} documents matching "${args.query}":\n\n` + 
              results.map(r => `• ${r.title} (${r.id})`).join('\n') + 
              '\n\nUse the "fetch" tool with any document ID to retrieve the full content.'
      }]
    };
  }

  private async handleFetch(args: FetchArgs): Promise<ToolResult> {
    // Extract filename from ID pattern: doc-timestamp-index-cleanname
    const match = args.id.match(/doc-\d+-\d+-(.+)$/) || args.id.match(/doc-\d+-(.+)$/);
    if (!match) {
      throw new Error('Invalid document ID format');
    }
    
    // Convert clean name back to potential filename patterns
    const cleanName = match[1];
    const files = await fileSystemService.getAllFiles(this.config.folderPath);
    
    // Find file by matching the cleaned name pattern
    const file = files.find(f => {
      const fileCleanName = f.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      return fileCleanName === cleanName;
    });
    
    if (!file) {
      throw new Error(`Document not found for ID: ${args.id}`);
    }

    const fullPath = path.join(this.config.folderPath, file.relativePath);
    const content = await fileSystemService.readFileContent(fullPath);

    return {
      content: [{
        type: 'text',
        text: `# ${file.name}\n\n**File Information:**\n- Path: ${file.relativePath}\n- Size: ${this.formatFileSize(file.size)}\n- Type: ${file.type}\n- Modified: ${file.lastModified.toISOString()}\n\n**Content:**\n\n${content}`
      }]
    };
  }

  private async handleListFiles(args: ListArgs): Promise<ToolResult> {
    const allFiles = await fileSystemService.getAllFiles(this.config.folderPath);
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
  }

  async readResource(uri: string): Promise<ResourceContent> {
    const match = uri.match(/^file:\/\/\/([^\/]+)\/(.+)$/);
    if (!match || match[1] !== this.storeType) {
      throw new Error('Invalid resource URI');
    }

    const relativePath = match[2];
    const fullPath = path.join(this.config.folderPath, relativePath);
    
    // Security check
    if (!fullPath.startsWith(this.config.folderPath)) {
      throw new Error('Invalid file path');
    }

    const content = await fileSystemService.readFileContent(fullPath);
    const mimeType = this.getMimeType(path.extname(relativePath));

    return {
      contents: [{
        uri,
        mimeType,
        text: content
      }]
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const folderPath = this.config.folderPath;
      const validation = await fileSystemService.validateFolderAccess(folderPath);
      
      if (!validation.valid) {
        return {
          healthy: false,
          message: validation.error
        };
      }

      const stats = await fileSystemService.scanFolder(folderPath);
      
      return {
        healthy: true,
        message: `Connected to local folder with ${stats.fileCount} files`,
        details: {
          fileCount: stats.fileCount,
          totalSize: this.formatFileSize(stats.totalSize),
          fileTypes: stats.fileTypes
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}