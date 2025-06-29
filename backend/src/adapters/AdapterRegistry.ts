import { KnowledgeStoreAdapter } from './base/KnowledgeStoreAdapter';
import { LocalFileSystemAdapter } from './LocalFileSystemAdapter';

interface AdapterInfo {
  storeType: string;
  displayName: string;
  description: string;
  requiredConfig: string[];
  adapterClass: typeof KnowledgeStoreAdapter;
}

export class AdapterRegistry {
  private static adapters = new Map<string, AdapterInfo>();

  static register(adapterClass: typeof KnowledgeStoreAdapter) {
    // Create temporary instance to get metadata
    const tempInstance = new (adapterClass as any)({});
    
    const info: AdapterInfo = {
      storeType: tempInstance.storeType,
      displayName: tempInstance.displayName,
      description: tempInstance.description,
      requiredConfig: tempInstance.requiredConfig,
      adapterClass
    };
    
    this.adapters.set(tempInstance.storeType, info);
    console.log(`Registered adapter: ${tempInstance.storeType} (${tempInstance.displayName})`);
  }

  static create(storeType: string, config: Record<string, any>): KnowledgeStoreAdapter {
    const adapterInfo = this.adapters.get(storeType);
    if (!adapterInfo) {
      throw new Error(`Unknown store type: ${storeType}. Available types: ${this.getAvailableTypes().join(', ')}`);
    }
    
    // Create instance with config
    return new (adapterInfo.adapterClass as any)(config);
  }

  static getAvailableTypes(): string[] {
    return Array.from(this.adapters.keys());
  }

  static getAdapterInfo(storeType: string): AdapterInfo | undefined {
    return this.adapters.get(storeType);
  }

  static getAllAdapterInfo(): AdapterInfo[] {
    return Array.from(this.adapters.values());
  }

  static isSupported(storeType: string): boolean {
    return this.adapters.has(storeType);
  }
}

// Register built-in adapters
AdapterRegistry.register(LocalFileSystemAdapter);

// TODO: Register additional adapters as they're implemented
// AdapterRegistry.register(GitHubAdapter);
// AdapterRegistry.register(GoogleDriveAdapter);
// AdapterRegistry.register(ZoteroAdapter);