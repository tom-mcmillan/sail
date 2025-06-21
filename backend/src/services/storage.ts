import fs from 'fs/promises';
import path from 'path';
import { config } from 'dotenv';

config();

class LocalStorageService {
  private storagePath: string;

  constructor() {
    // Create a local storage directory
    this.storagePath = path.join(process.cwd(), 'storage');
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
      console.log('✅ Created local storage directory:', this.storagePath);
    }
  }

  async uploadFile(fileName: string, fileBuffer: Buffer, contentType?: string): Promise<string> {
    try {
      const filePath = path.join(this.storagePath, fileName);
      await fs.writeFile(filePath, fileBuffer);
      
      // Return a local URL
      const localUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/files/${fileName}`;
      return localUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async downloadFile(fileName: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.storagePath, fileName);
      const fileBuffer = await fs.readFile(filePath);
      return fileBuffer;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, fileName);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async getFileUrl(fileName: string): Promise<string> {
    const localUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/files/${fileName}`;
    return localUrl;
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(this.storagePath);
      
      if (prefix) {
        return files.filter(file => file.startsWith(prefix));
      }
      
      return files;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  // Method to serve files via Express
  getFilePath(fileName: string): string {
    return path.join(this.storagePath, fileName);
  }
}

export const storageService = new LocalStorageService();