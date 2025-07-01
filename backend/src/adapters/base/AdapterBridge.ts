import { KnowledgeStoreAdapter as BaseAdapter } from './KnowledgeStoreAdapter';
import { 
  ToolDefinition, 
  ResourceDefinition, 
  PromptDefinition, 
  ToolResult, 
  ResourceContent, 
  HealthStatus 
} from './types';

// Legacy interface that our current adapters use
export interface LegacyKnowledgeStoreAdapter {
  readonly storeType: string;
  readonly displayName: string;
  readonly description: string;
  readonly requiredConfig: string[];
  
  healthCheck(): Promise<{ healthy: boolean; message: string }>;
  searchContent(query: string, options?: any): Promise<any[]>;
  getFileContent(filePath: string): Promise<string>;
  listFiles(options?: any): Promise<any[]>;
  getResourceContent(resourceId: string): Promise<any>;
  listResources(): Promise<any[]>;
  listTools(): Promise<any[]>;
  callTool(name: string, args: any): Promise<any>;
  listPrompts(): Promise<any[]>;
  getPrompt(name: string, args?: any): Promise<any>;
  getAdapterInfo(): { storeType: string; displayName: string; description: string; requiredConfig: string[] };
}

// Bridge adapter that wraps legacy adapters to work with the new interface
export class AdapterBridge extends BaseAdapter {
  private legacyAdapter: LegacyKnowledgeStoreAdapter;
  
  public readonly storeType: string;
  public readonly displayName: string;
  public readonly description: string;
  public readonly requiredConfig: string[];

  constructor(legacyAdapter: LegacyKnowledgeStoreAdapter, config: Record<string, any>) {
    super(config);
    this.legacyAdapter = legacyAdapter;
    
    // Copy metadata from legacy adapter
    this.storeType = legacyAdapter.storeType;
    this.displayName = legacyAdapter.displayName;
    this.description = legacyAdapter.description;
    this.requiredConfig = legacyAdapter.requiredConfig;
  }

  async healthCheck(): Promise<HealthStatus> {
    const result = await this.legacyAdapter.healthCheck();
    return {
      healthy: result.healthy,
      message: result.message
    };
  }

  getTools(): ToolDefinition[] {
    // This is synchronous in the legacy interface, so we'll need to cache it
    // For now, return empty array and implement async loading later
    return [];
  }

  async getResources(): Promise<ResourceDefinition[]> {
    try {
      const resources = await this.legacyAdapter.listResources();
      return resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }));
    } catch (error) {
      console.error('Error getting resources:', error);
      return [];
    }
  }

  getPrompts(): PromptDefinition[] {
    // This is synchronous in the legacy interface, so we'll need to cache it
    // For now, return empty array and implement async loading later
    return [];
  }

  async executeTool(name: string, args: any): Promise<ToolResult> {
    try {
      const result = await this.legacyAdapter.callTool(name, args);
      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error executing tool: ${error.message}`
        }],
        isError: true
      };
    }
  }

  async readResource(uri: string): Promise<ResourceContent> {
    try {
      const content = await this.legacyAdapter.getResourceContent(uri);
      return {
        contents: [{
          uri,
          mimeType: content.mimeType || 'text/plain',
          text: content.content || JSON.stringify(content)
        }]
      };
    } catch (error: any) {
      throw new Error(`Failed to read resource ${uri}: ${error.message}`);
    }
  }

  // Additional legacy methods for compatibility
  async searchContent(query: string, options?: any): Promise<any[]> {
    return this.legacyAdapter.searchContent(query, options);
  }

  async getFileContent(filePath: string): Promise<string> {
    return this.legacyAdapter.getFileContent(filePath);
  }

  async listFiles(options?: any): Promise<any[]> {
    return this.legacyAdapter.listFiles(options);
  }

  async listTools(): Promise<any[]> {
    return this.legacyAdapter.listTools();
  }

  async listPrompts(): Promise<any[]> {
    return this.legacyAdapter.listPrompts();
  }

  async getPrompt(name: string, args?: any): Promise<any> {
    return this.legacyAdapter.getPrompt(name, args);
  }
}