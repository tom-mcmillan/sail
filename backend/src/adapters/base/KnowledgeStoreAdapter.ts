import { 
  ToolDefinition, 
  ResourceDefinition, 
  PromptDefinition, 
  ToolResult, 
  ResourceContent, 
  ConfigValidationResult, 
  HealthStatus 
} from './types';

export abstract class KnowledgeStoreAdapter {
  protected config: Record<string, any>;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  // Metadata about this adapter
  abstract readonly storeType: string;
  abstract readonly displayName: string;
  abstract readonly description: string;
  abstract readonly requiredConfig: string[];

  // Core MCP capabilities
  abstract getTools(): ToolDefinition[];
  abstract getResources(): Promise<ResourceDefinition[]>;
  abstract getPrompts(): PromptDefinition[];

  // Tool execution
  abstract executeTool(name: string, args: any): Promise<ToolResult>;

  // Resource access
  abstract readResource(uri: string): Promise<ResourceContent>;

  // Configuration validation
  validateConfig(config: Record<string, any>): ConfigValidationResult {
    const missing = this.requiredConfig.filter(key => !config[key]);
    if (missing.length > 0) {
      return {
        valid: false,
        errors: [`Missing required config: ${missing.join(', ')}`]
      };
    }
    return { valid: true };
  }

  // Health check
  abstract healthCheck(): Promise<HealthStatus>;

  // Helper method to format file size
  protected formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Helper method to create consistent document IDs
  protected createDocumentId(name: string, index?: number): string {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const timestamp = Date.now();
    const suffix = index !== undefined ? `-${index}` : '';
    return `doc-${timestamp}${suffix}-${cleanName}`;
  }

  // Helper method to get MIME type from extension
  protected getMimeType(extension: string): string {
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
}