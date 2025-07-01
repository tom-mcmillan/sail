import { KnowledgeStoreAdapter, AdapterInfo } from './base/KnowledgeStoreAdapter';

export interface SourceConfig {
  id: string;
  type: string;
  config: Record<string, any>;
  weight?: number; // For result ranking
}

export class CompositeAdapter implements KnowledgeStoreAdapter {
  public readonly storeType = 'composite';
  public readonly displayName = 'Multi-Source Bundle';
  public readonly description = 'Aggregates content from multiple knowledge sources';
  public readonly requiredConfig = ['sources'];

  private adapters: Map<string, KnowledgeStoreAdapter> = new Map();
  private sources: SourceConfig[];

  constructor(config: { sources: SourceConfig[] }) {
    this.sources = config.sources;
  }

  async initialize(adapters: Map<string, KnowledgeStoreAdapter>): Promise<void> {
    this.adapters = adapters;
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    const healthChecks = await Promise.allSettled(
      Array.from(this.adapters.values()).map(adapter => adapter.healthCheck())
    );

    const failures = healthChecks
      .filter(result => result.status === 'rejected' || !result.value.healthy)
      .length;

    const total = healthChecks.length;
    
    if (failures === 0) {
      return { healthy: true, message: `All ${total} sources healthy` };
    } else if (failures < total) {
      return { healthy: true, message: `${total - failures}/${total} sources healthy` };
    } else {
      return { healthy: false, message: 'All sources unhealthy' };
    }
  }

  async searchContent(query: string, options?: any): Promise<any[]> {
    const searchPromises = Array.from(this.adapters.entries()).map(async ([sourceId, adapter]) => {
      try {
        const results = await adapter.searchContent(query, options);
        return results.map((result: any) => ({
          ...result,
          sourceId,
          sourceType: adapter.storeType,
          source: this.sources.find(s => s.id === sourceId)?.type || adapter.storeType
        }));
      } catch (error) {
        console.error(`Search failed for source ${sourceId}:`, error);
        return [];
      }
    });

    const allResults = await Promise.all(searchPromises);
    const flatResults = allResults.flat();

    // Aggregate and rank results
    return this.rankResults(flatResults, query);
  }

  async getFileContent(filePath: string, sourceId?: string): Promise<string> {
    if (sourceId && this.adapters.has(sourceId)) {
      return this.adapters.get(sourceId)!.getFileContent(filePath);
    }

    // Try each adapter until one succeeds
    for (const adapter of this.adapters.values()) {
      try {
        return await adapter.getFileContent(filePath);
      } catch (error) {
        continue;
      }
    }

    throw new Error(`File not found in any source: ${filePath}`);
  }

  async listFiles(options?: any): Promise<any[]> {
    const listPromises = Array.from(this.adapters.entries()).map(async ([sourceId, adapter]) => {
      try {
        const files = await adapter.listFiles(options);
        return files.map((file: any) => ({
          ...file,
          sourceId,
          sourceType: adapter.storeType,
          source: this.sources.find(s => s.id === sourceId)?.type || adapter.storeType
        }));
      } catch (error) {
        console.error(`List files failed for source ${sourceId}:`, error);
        return [];
      }
    });

    const allFiles = await Promise.all(listPromises);
    return allFiles.flat();
  }

  async getResourceContent(resourceId: string): Promise<any> {
    // Try to extract source from resourceId
    const [sourceId, ...pathParts] = resourceId.split(':');
    const path = pathParts.join(':');

    if (this.adapters.has(sourceId)) {
      return this.adapters.get(sourceId)!.getResourceContent(path);
    }

    // Fallback: try all adapters
    for (const adapter of this.adapters.values()) {
      try {
        return await adapter.getResourceContent(resourceId);
      } catch (error) {
        continue;
      }
    }

    throw new Error(`Resource not found in any source: ${resourceId}`);
  }

  async listResources(): Promise<any[]> {
    const resourcePromises = Array.from(this.adapters.entries()).map(async ([sourceId, adapter]) => {
      try {
        const resources = await adapter.listResources();
        return resources.map((resource: any) => ({
          ...resource,
          uri: `${sourceId}:${resource.uri}`, // Prefix with source ID
          sourceId,
          sourceType: adapter.storeType
        }));
      } catch (error) {
        console.error(`List resources failed for source ${sourceId}:`, error);
        return [];
      }
    });

    const allResources = await Promise.all(resourcePromises);
    return allResources.flat();
  }

  async listTools(): Promise<any[]> {
    const toolPromises = Array.from(this.adapters.entries()).map(async ([sourceId, adapter]) => {
      try {
        const tools = await adapter.listTools();
        return tools.map((tool: any) => ({
          ...tool,
          name: `${sourceId}_${tool.name}`, // Prefix with source ID
          sourceId,
          sourceType: adapter.storeType
        }));
      } catch (error) {
        console.error(`List tools failed for source ${sourceId}:`, error);
        return [];
      }
    });

    const allTools = await Promise.all(toolPromises);
    return allTools.flat();
  }

  async callTool(name: string, args: any): Promise<any> {
    // Extract source from tool name
    const [sourceId, ...toolNameParts] = name.split('_');
    const toolName = toolNameParts.join('_');

    if (this.adapters.has(sourceId)) {
      return this.adapters.get(sourceId)!.callTool(toolName, args);
    }

    throw new Error(`Tool not found: ${name}`);
  }

  async listPrompts(): Promise<any[]> {
    const promptPromises = Array.from(this.adapters.entries()).map(async ([sourceId, adapter]) => {
      try {
        const prompts = await adapter.listPrompts();
        return prompts.map((prompt: any) => ({
          ...prompt,
          name: `${sourceId}_${prompt.name}`, // Prefix with source ID
          sourceId,
          sourceType: adapter.storeType
        }));
      } catch (error) {
        console.error(`List prompts failed for source ${sourceId}:`, error);
        return [];
      }
    });

    const allPrompts = await Promise.all(promptPromises);
    return allPrompts.flat();
  }

  async getPrompt(name: string, args?: any): Promise<any> {
    // Extract source from prompt name
    const [sourceId, ...promptNameParts] = name.split('_');
    const promptName = promptNameParts.join('_');

    if (this.adapters.has(sourceId)) {
      return this.adapters.get(sourceId)!.getPrompt(promptName, args);
    }

    throw new Error(`Prompt not found: ${name}`);
  }

  getAdapterInfo(): AdapterInfo {
    return {
      storeType: this.storeType,
      displayName: this.displayName,
      description: this.description,
      requiredConfig: this.requiredConfig
    };
  }

  private rankResults(results: any[], query: string): any[] {
    // Simple ranking algorithm - can be enhanced
    return results
      .map(result => ({
        ...result,
        score: this.calculateRelevanceScore(result, query)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Limit results
  }

  private calculateRelevanceScore(result: any, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Title match (high weight)
    if (result.title?.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Content match (medium weight)
    if (result.content?.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    // File type bonus
    if (result.type === 'markdown' || result.type === 'text') {
      score += 2;
    }

    // Recency bonus (if file has date)
    if (result.lastModified) {
      const daysSinceModified = (Date.now() - new Date(result.lastModified).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 30) {
        score += 1;
      }
    }

    return score;
  }
}