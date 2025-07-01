import { AdapterInfo } from './base/AdapterInfo';
import { LegacyKnowledgeStoreAdapter } from './base/AdapterBridge';

interface GoogleDriveConfig {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  folderId?: string; // Specific folder to search, or root if not provided
  includeSharedDrives?: boolean;
  maxResults?: number;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink: string;
  parents?: string[];
  permissions?: any[];
}

export class GoogleDriveAdapter implements LegacyKnowledgeStoreAdapter {
  public readonly storeType = 'google_drive';
  public readonly displayName = 'Google Drive';
  public readonly description = 'Access Google Drive files and documents';
  public readonly requiredConfig = ['accessToken'];

  private config: GoogleDriveConfig;
  private baseUrl = 'https://www.googleapis.com/drive/v3';

  constructor(config: GoogleDriveConfig) {
    this.config = {
      includeSharedDrives: false,
      maxResults: 100,
      ...config
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response = await this.makeRequest('/about', { fields: 'user' });
      return { 
        healthy: true, 
        message: `Connected to Google Drive for ${response.user?.emailAddress || 'user'}` 
      };
    } catch (error: any) {
      return { 
        healthy: false, 
        message: `Google Drive API error: ${error.message}` 
      };
    }
  }

  async searchContent(query: string, options?: any): Promise<any[]> {
    try {
      // Build search query for Google Drive API
      let searchQuery = `fullText contains '${query}'`;
      
      // Add folder restriction if specified
      if (this.config.folderId) {
        searchQuery += ` and '${this.config.folderId}' in parents`;
      }

      // Exclude trashed files
      searchQuery += ' and trashed = false';

      const response = await this.makeRequest('/files', {
        q: searchQuery,
        fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents)',
        pageSize: this.config.maxResults,
        includeItemsFromAllDrives: this.config.includeSharedDrives,
        supportsAllDrives: this.config.includeSharedDrives
      });

      const results = await Promise.all(
        (response.files || []).map(async (file: DriveFile) => {
          let content = '';
          
          // Try to get text content for searchable files
          if (this.isTextFile(file.mimeType)) {
            try {
              content = await this.getFileContent(file.id);
              // Limit content length for search results
              content = content.substring(0, 500) + (content.length > 500 ? '...' : '');
            } catch (error) {
              console.warn(`Could not get content for file ${file.id}:`, error);
            }
          }

          return {
            title: file.name,
            content,
            url: file.webViewLink,
            type: this.getFileTypeFromMime(file.mimeType),
            fileId: file.id,
            mimeType: file.mimeType,
            size: file.size ? parseInt(file.size) : 0,
            lastModified: file.modifiedTime,
            score: this.calculateSearchScore(file, query, content)
          };
        })
      );

      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Google Drive search error:', error);
      return [];
    }
  }

  async getFileContent(fileId: string): Promise<string> {
    try {
      // First get file metadata to determine how to export
      const fileInfo = await this.makeRequest(`/files/${fileId}`, {
        fields: 'mimeType,name'
      });

      if (this.isGoogleDoc(fileInfo.mimeType)) {
        // Export Google Docs as plain text
        const response = await fetch(
          `${this.baseUrl}/files/${fileId}/export?mimeType=text/plain`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.accessToken}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to export Google Doc: ${response.status}`);
        }

        return await response.text();
      } else if (this.isTextFile(fileInfo.mimeType)) {
        // Download regular text files
        const response = await fetch(
          `${this.baseUrl}/files/${fileId}?alt=media`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.accessToken}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status}`);
        }

        return await response.text();
      } else {
        throw new Error(`Unsupported file type: ${fileInfo.mimeType}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  async listFiles(options?: any): Promise<any[]> {
    try {
      let query = 'trashed = false';
      
      if (this.config.folderId) {
        query += ` and '${this.config.folderId}' in parents`;
      }

      // Filter by file type if specified
      if (options?.fileType) {
        query += ` and mimeType contains '${options.fileType}'`;
      }

      const response = await this.makeRequest('/files', {
        q: query,
        fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents)',
        pageSize: this.config.maxResults,
        includeItemsFromAllDrives: this.config.includeSharedDrives,
        supportsAllDrives: this.config.includeSharedDrives,
        orderBy: 'modifiedTime desc'
      });

      return (response.files || []).map((file: DriveFile) => ({
        name: file.name,
        path: file.id, // Use file ID as path
        id: file.id,
        size: file.size ? parseInt(file.size) : 0,
        type: this.getFileTypeFromMime(file.mimeType),
        mimeType: file.mimeType,
        url: file.webViewLink,
        lastModified: file.modifiedTime
      }));
    } catch (error) {
      console.error('Google Drive list files error:', error);
      return [];
    }
  }

  async getResourceContent(resourceId: string): Promise<any> {
    const fileId = resourceId.replace('drive:', '');
    
    try {
      const content = await this.getFileContent(fileId);
      const fileInfo = await this.makeRequest(`/files/${fileId}`, {
        fields: 'name,mimeType,webViewLink'
      });

      return {
        content,
        mimeType: fileInfo.mimeType,
        uri: resourceId,
        name: fileInfo.name,
        url: fileInfo.webViewLink
      };
    } catch (error: any) {
      throw new Error(`Failed to get resource: ${error.message}`);
    }
  }

  async listResources(): Promise<any[]> {
    try {
      const files = await this.listFiles();
      
      return files
        .filter(file => this.isTextFile(file.mimeType) || this.isGoogleDoc(file.mimeType))
        .map(file => ({
          uri: `drive:${file.id}`,
          name: file.name,
          description: `Google Drive file: ${file.name}`,
          mimeType: file.mimeType,
          url: file.url
        }));
    } catch (error) {
      console.error('Google Drive list resources error:', error);
      return [];
    }
  }

  async listTools(): Promise<any[]> {
    return [
      {
        name: 'search_drive',
        description: 'Search for files in Google Drive',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            fileType: { type: 'string', description: 'Filter by file type (e.g., document, spreadsheet)' }
          },
          required: ['query']
        }
      },
      {
        name: 'get_drive_file',
        description: 'Get the contents of a specific Google Drive file',
        inputSchema: {
          type: 'object',
          properties: {
            fileId: { type: 'string', description: 'Google Drive file ID' }
          },
          required: ['fileId']
        }
      },
      {
        name: 'list_drive_folder',
        description: 'List files in a specific Google Drive folder',
        inputSchema: {
          type: 'object',
          properties: {
            folderId: { type: 'string', description: 'Google Drive folder ID' }
          },
          required: ['folderId']
        }
      }
    ];
  }

  async callTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'search_drive':
        return await this.searchContent(args.query, { fileType: args.fileType });
      
      case 'get_drive_file':
        const content = await this.getFileContent(args.fileId);
        const fileInfo = await this.makeRequest(`/files/${args.fileId}`, {
          fields: 'name,mimeType,webViewLink'
        });
        return { 
          fileId: args.fileId, 
          name: fileInfo.name,
          content,
          mimeType: fileInfo.mimeType,
          url: fileInfo.webViewLink
        };
      
      case 'list_drive_folder':
        const originalFolderId = this.config.folderId;
        this.config.folderId = args.folderId;
        const files = await this.listFiles();
        this.config.folderId = originalFolderId;
        return files;
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async listPrompts(): Promise<any[]> {
    return [
      {
        name: 'summarize_doc',
        description: 'Summarize a Google Drive document',
        arguments: [
          { name: 'file_id', description: 'Google Drive file ID', required: true }
        ]
      },
      {
        name: 'analyze_folder',
        description: 'Analyze all documents in a Google Drive folder',
        arguments: [
          { name: 'folder_id', description: 'Google Drive folder ID', required: true }
        ]
      }
    ];
  }

  async getPrompt(name: string, args?: any): Promise<any> {
    switch (name) {
      case 'summarize_doc':
        if (!args?.file_id) {
          throw new Error('file_id argument required for summarize_doc prompt');
        }
        const content = await this.getFileContent(args.file_id);
        const fileInfo = await this.makeRequest(`/files/${args.file_id}`, {
          fields: 'name'
        });
        return {
          description: `Summarize Google Drive document: ${fileInfo.name}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please summarize this Google Drive document:\n\nDocument: ${fileInfo.name}\n\n${content}`
              }
            }
          ]
        };
      
      case 'analyze_folder':
        if (!args?.folder_id) {
          throw new Error('folder_id argument required for analyze_folder prompt');
        }
        const originalFolderId = this.config.folderId;
        this.config.folderId = args.folder_id;
        const files = await this.listFiles();
        this.config.folderId = originalFolderId;
        
        return {
          description: `Analyze Google Drive folder contents`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please analyze this Google Drive folder:\n\nFiles found: ${files.length}\n\nFile types: ${JSON.stringify(this.analyzeFileTypes(files), null, 2)}`
              }
            }
          ]
        };
      
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  getAdapterInfo(): AdapterInfo {
    return {
      storeType: this.storeType,
      displayName: this.displayName,
      description: this.description,
      requiredConfig: this.requiredConfig
    };
  }

  private async makeRequest(endpoint: string, params?: any): Promise<any> {
    const url = new URL(this.baseUrl + endpoint);
    if (params) {
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'User-Agent': 'SailMCP/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private isGoogleDoc(mimeType: string): boolean {
    return [
      'application/vnd.google-apps.document',
      'application/vnd.google-apps.spreadsheet',
      'application/vnd.google-apps.presentation'
    ].includes(mimeType);
  }

  private isTextFile(mimeType: string): boolean {
    return mimeType.startsWith('text/') || 
           mimeType === 'application/json' ||
           mimeType === 'application/javascript' ||
           mimeType === 'application/xml' ||
           this.isGoogleDoc(mimeType);
  }

  private getFileTypeFromMime(mimeType: string): string {
    if (mimeType === 'application/vnd.google-apps.document') return 'google_doc';
    if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'google_sheets';
    if (mimeType === 'application/vnd.google-apps.presentation') return 'google_slides';
    if (mimeType.startsWith('text/')) return 'text';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    return 'unknown';
  }

  private calculateSearchScore(file: DriveFile, query: string, content: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Title match (high weight)
    if (file.name.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Content match (medium weight)
    if (content.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    // Google Docs get slight bonus for being more searchable
    if (this.isGoogleDoc(file.mimeType)) {
      score += 2;
    }

    // Recency bonus
    const daysSinceModified = (Date.now() - new Date(file.modifiedTime).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified < 30) {
      score += 1;
    }

    return score;
  }

  private analyzeFileTypes(files: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    files.forEach(file => {
      const type = file.type;
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }
}