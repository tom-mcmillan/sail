import { KnowledgeStoreAdapter } from './base/KnowledgeStoreAdapter';
import { AdapterBridge, LegacyKnowledgeStoreAdapter } from './base/AdapterBridge';
import { LocalFileSystemAdapter } from './LocalFileSystemAdapter';
import { GitHubAdapter } from './GitHubAdapter';
import { GoogleDriveAdapter } from './GoogleDriveAdapter';
import { CompositeAdapter } from './CompositeAdapter';

interface AdapterInfo {
  storeType: string;
  displayName: string;
  description: string;
  requiredConfig: string[];
  adapterClass: typeof KnowledgeStoreAdapter;
  isLegacy?: boolean;
  legacyClass?: any;
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

  static registerLegacy(legacyAdapterClass: any) {
    // Create temporary instance to get metadata
    const tempInstance = new legacyAdapterClass({});
    
    const info: AdapterInfo = {
      storeType: tempInstance.storeType,
      displayName: tempInstance.displayName,
      description: tempInstance.description,
      requiredConfig: tempInstance.requiredConfig,
      adapterClass: AdapterBridge as any,
      isLegacy: true,
      legacyClass: legacyAdapterClass
    };
    
    this.adapters.set(tempInstance.storeType, info);
    console.log(`Registered legacy adapter: ${tempInstance.storeType} (${tempInstance.displayName})`);
  }

  static create(storeType: string, config: Record<string, any>): KnowledgeStoreAdapter {
    const adapterInfo = this.adapters.get(storeType);
    if (!adapterInfo) {
      throw new Error(`Unknown store type: ${storeType}. Available types: ${this.getAvailableTypes().join(', ')}`);
    }
    
    if (adapterInfo.isLegacy && adapterInfo.legacyClass) {
      // Create legacy adapter instance and wrap it in bridge
      const legacyInstance = new adapterInfo.legacyClass(config);
      return new AdapterBridge(legacyInstance, config);
    } else {
      // Create modern adapter instance
      return new (adapterInfo.adapterClass as any)(config);
    }
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
AdapterRegistry.registerLegacy(GitHubAdapter);
AdapterRegistry.registerLegacy(GoogleDriveAdapter);
AdapterRegistry.registerLegacy(CompositeAdapter);