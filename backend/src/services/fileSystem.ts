import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

export interface FileInfo {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  type: string;
  extension: string;
  lastModified: Date;
  isDirectory: boolean;
}

export interface FolderStats {
  fileCount: number;
  totalSize: number;
  fileTypes: string[];
  lastModified: Date;
}

export class FileSystemService extends EventEmitter {
  private watchedFolders = new Map<string, any>();

  constructor() {
    super();
  }

  async scanFolder(folderPath: string): Promise<FolderStats> {
    try {
      await fs.access(folderPath);
    } catch {
      throw new Error(`Folder path does not exist or is not accessible: ${folderPath}`);
    }

    const files = await this.getAllFiles(folderPath);
    const supportedFiles = files.filter(file => this.isSupportedFileType(file.extension));

    const fileTypes = [...new Set(supportedFiles.map(file => this.categorizeFileType(file.extension)))];
    const totalSize = supportedFiles.reduce((sum, file) => sum + file.size, 0);
    const lastModified = supportedFiles.length > 0 
      ? new Date(Math.max(...supportedFiles.map(file => file.lastModified.getTime())))
      : new Date();

    return {
      fileCount: supportedFiles.length,
      totalSize,
      fileTypes,
      lastModified
    };
  }

  async getAllFiles(folderPath: string, relativePath = ''): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden directories and common ignore patterns
          if (this.shouldIgnoreDirectory(entry.name)) {
            continue;
          }
          
          // Recursively scan subdirectories
          const subFiles = await this.getAllFiles(fullPath, relPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          // Skip hidden files
          if (entry.name.startsWith('.')) {
            continue;
          }

          const stats = await fs.stat(fullPath);
          const extension = path.extname(entry.name).toLowerCase().substring(1);
          
          files.push({
            name: entry.name,
            path: fullPath,
            relativePath: relPath,
            size: stats.size,
            type: this.categorizeFileType(extension),
            extension,
            lastModified: stats.mtime,
            isDirectory: false
          });
        }
      }
    } catch (error) {
      console.error(`Error scanning folder ${folderPath}:`, error);
    }
    
    return files;
  }

  async readFileContent(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > 10 * 1024 * 1024) { // 10MB limit
        return 'File too large to process';
      }

      const extension = path.extname(filePath).toLowerCase();
      
      // Handle different file types
      switch (extension) {
        case '.txt':
        case '.md':
        case '.json':
        case '.csv':
        case '.html':
        case '.rtf':
        case '.js':
        case '.ts':
        case '.jsx':
        case '.tsx':
        case '.py':
        case '.java':
        case '.c':
        case '.cpp':
        case '.h':
        case '.sh':
        case '.yaml':
        case '.yml':
        case '.xml':
        case '.sql':
        case '.php':
        case '.rb':
        case '.go':
        case '.rs':
          return await fs.readFile(filePath, 'utf-8');
        
        case '.pdf':
          // TODO: Implement PDF text extraction
          return 'PDF content extraction not yet implemented';
        
        case '.doc':
        case '.docx':
          // TODO: Implement Word document text extraction  
          return 'Word document content extraction not yet implemented';
        
        default:
          return 'Unsupported file type for content extraction';
      }
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return 'Error reading file content';
    }
  }

  private shouldIgnoreDirectory(dirName: string): boolean {
    const ignoredDirs = [
      'node_modules',
      '.git',
      '.svn',
      '__pycache__',
      '.DS_Store',
      'Thumbs.db',
      '.vscode',
      '.idea',
      'dist',
      'build',
      '.next',
      '.nuxt'
    ];
    
    return ignoredDirs.includes(dirName) || dirName.startsWith('.');
  }

  isSupportedFileType(extension: string): boolean {
    const supportedExtensions = [
      'txt', 'md', 'pdf', 'doc', 'docx', 
      'json', 'csv', 'html', 'rtf',
      'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h',
      'sh', 'yaml', 'yml', 'xml', 'sql', 'php', 'rb', 'go', 'rs'
    ];
    
    return supportedExtensions.includes(extension.toLowerCase());
  }

  private categorizeFileType(extension: string): string {
    const typeMap: { [key: string]: string } = {
      'txt': 'text',
      'md': 'markdown',
      'pdf': 'pdf',
      'doc': 'document',
      'docx': 'document',
      'json': 'json',
      'csv': 'csv',
      'html': 'html',
      'rtf': 'text'
    };
    
    return typeMap[extension.toLowerCase()] || 'unknown';
  }

  async validateFolderAccess(folderPath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      await fs.access(folderPath, fs.constants.R_OK);
      const stats = await fs.stat(folderPath);
      
      if (!stats.isDirectory()) {
        return { valid: false, error: 'Path is not a directory' };
      }
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: `Cannot access folder: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Method to search files within a folder
  async searchFiles(folderPath: string, query: string, limit = 10): Promise<FileInfo[]> {
    const allFiles = await this.getAllFiles(folderPath);
    const supportedFiles = allFiles.filter(file => this.isSupportedFileType(file.extension));
    
    const matchingFiles: FileInfo[] = [];
    const queryLower = query.toLowerCase();
    
    for (const file of supportedFiles) {
      // Search by filename and path first
      if (file.name.toLowerCase().includes(queryLower) ||
          file.relativePath.toLowerCase().includes(queryLower)) {
        matchingFiles.push(file);
        if (matchingFiles.length >= limit) break;
        continue;
      }
      
      // Search by file content for text-based files
      try {
        const content = await this.readFileContent(file.path);
        if (content && 
            content !== 'File too large to process' &&
            content !== 'Error reading file content' &&
            !content.includes('not yet implemented') &&
            content.toLowerCase().includes(queryLower)) {
          matchingFiles.push(file);
        }
      } catch (error) {
        // Skip files that can't be read
        console.error(`Error reading file for search ${file.path}:`, error);
      }
      
      // Stop if we've reached the limit
      if (matchingFiles.length >= limit) {
        break;
      }
    }
    
    return matchingFiles.slice(0, limit);
  }
}

export const fileSystemService = new FileSystemService();