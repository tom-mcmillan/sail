import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Docker from 'dockerode';
import { db } from '../services/database';
import { redis } from '../services/redis';
import { fileSystemService } from '../services/fileSystem';
import { DockerSecurityService } from '../services/dockerSecurity';
import { Exchange, CreateExchangeRequest } from '../types';
import { AdapterRegistry } from '../adapters/AdapterRegistry';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export class ExchangeController {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }
  async createExchange(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, description, type, privacy = 'private', config = {} } = req.body as CreateExchangeRequest;
      
      // For demo purposes, allow test user
      const testUserId = '00000000-0000-0000-0000-000000000001';
      const userId = req.user?.id || testUserId;

      if (!name || !description || !type) {
        res.status(400).json({
          success: false,
          error: 'Name, description, and type are required'
        });
        return;
      }

      // Generate unique slug
      const baseSlug = name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      const slug = `${baseSlug}-${uuidv4().substring(0, 8)}`;

      // Check if slug already exists (very unlikely but safety check)
      const existingExchange = await db.query('SELECT id FROM exchanges WHERE slug = $1', [slug]);
      if (existingExchange.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: 'Exchange name conflicts with existing exchange'
        });
        return;
      }

      // Create exchange record
      const exchangeResult = await db.query(
        `INSERT INTO exchanges (user_id, name, description, type, slug, privacy, config) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [userId, name, description, type, slug, privacy, JSON.stringify(config)]
      );

      const exchange = exchangeResult.rows[0];

      // Start processing the exchange asynchronously
      this.processExchange(exchange).catch(console.error);

      res.status(201).json({
        success: true,
        data: {
          ...exchange,
          url: `${process.env.BASE_URL}/${slug}/mcp`
        }
      });
    } catch (error) {
      console.error('Create exchange error:', error);
      res.status(500).json({
        success: false,
        error: `Failed to create exchange: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  async createBundledExchange(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, description, sources, privacy = 'private' } = req.body;
      
      // For demo purposes, allow test user
      const testUserId = '00000000-0000-0000-0000-000000000001';
      const userId = req.user?.id || testUserId;

      if (!name || !description || !sources || !Array.isArray(sources) || sources.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Name, description, and sources array are required'
        });
        return;
      }

      // Validate each source configuration
      for (const source of sources) {
        if (!source.type || !source.config) {
          res.status(400).json({
            success: false,
            error: 'Each source must have type and config'
          });
          return;
        }

        if (!AdapterRegistry.isSupported(source.type)) {
          res.status(400).json({
            success: false,
            error: `Unsupported source type: ${source.type}. Supported types: ${AdapterRegistry.getAvailableTypes().join(', ')}`
          });
          return;
        }
      }

      // Generate unique slug
      const baseSlug = name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      const slug = `${baseSlug}-${uuidv4().substring(0, 8)}`;

      // Check if slug already exists
      const existingExchange = await db.query('SELECT id FROM exchanges WHERE slug = $1', [slug]);
      if (existingExchange.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: 'Exchange name conflicts with existing exchange'
        });
        return;
      }

      // Prepare composite adapter configuration
      const compositeConfig = {
        sources: sources.map((source: any, index: number) => ({
          id: `source_${index}`,
          type: source.type,
          config: source.config,
          weight: source.weight || 1
        }))
      };

      // Create exchange record with composite type
      const exchangeResult = await db.query(
        `INSERT INTO exchanges (user_id, name, description, type, slug, privacy, config) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [userId, name, description, 'composite', slug, privacy, JSON.stringify(compositeConfig)]
      );

      const exchange = exchangeResult.rows[0];

      // Start processing the exchange asynchronously
      this.processExchange(exchange).catch(console.error);

      res.status(201).json({
        success: true,
        data: {
          ...exchange,
          url: `${process.env.BASE_URL}/${slug}/mcp`,
          sourceCount: sources.length
        }
      });
    } catch (error) {
      console.error('Create bundled exchange error:', error);
      res.status(500).json({
        success: false,
        error: `Failed to create bundled exchange: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  async getExchanges(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // For demo purposes, allow test user
      const testUserId = '00000000-0000-0000-0000-000000000001';
      const userId = req.user?.id || testUserId;
      const { page = 1, limit = 20, type, status } = req.query;

      let query = 'SELECT * FROM exchanges WHERE user_id = $1';
      const params: any[] = [userId];
      let paramCount = 1;

      if (type) {
        paramCount++;
        query += ` AND type = $${paramCount}`;
        params.push(type);
      }

      if (status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(status);
      }

      query += ' ORDER BY created_at DESC';

      if (limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(Number(limit));

        if (page && Number(page) > 1) {
          paramCount++;
          query += ` OFFSET $${paramCount}`;
          params.push((Number(page) - 1) * Number(limit));
        }
      }

      const result = await db.query(query, params);

      const exchanges = result.rows.map(exchange => ({
        ...exchange,
        url: `${process.env.BASE_URL}/${exchange.slug}/mcp`
      }));

      res.json({
        success: true,
        data: exchanges
      });
    } catch (error) {
      console.error('Get exchanges error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve exchanges'
      });
    }
  }

  async getExchange(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }
      
      const userId = req.user.id;

      const result = await db.query(
        'SELECT * FROM exchanges WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Exchange not found'
        });
        return;
      }

      const exchange = result.rows[0];
      res.json({
        success: true,
        data: {
          ...exchange,
          url: `${process.env.BASE_URL}/${exchange.slug}/mcp`
        }
      });
    } catch (error) {
      console.error('Get exchange error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve exchange'
      });
    }
  }

  async updateExchange(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, privacy, config } = req.body;
      
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }
      
      const userId = req.user.id;

      const result = await db.query(
        `UPDATE exchanges 
         SET name = COALESCE($1, name), 
             description = COALESCE($2, description),
             privacy = COALESCE($3, privacy),
             config = COALESCE($4, config),
             updated_at = NOW()
         WHERE id = $5 AND user_id = $6 
         RETURNING *`,
        [name, description, privacy, config ? JSON.stringify(config) : null, id, userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Exchange not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update exchange error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update exchange'
      });
    }
  }

  async deleteExchange(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }
      
      const userId = req.user.id;

      // Get exchange details first
      const exchangeResult = await db.query(
        'SELECT * FROM exchanges WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (exchangeResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Exchange not found'
        });
        return;
      }

      const exchange = exchangeResult.rows[0];

      // Stop and remove Docker container if exists
      if (exchange.container_id) {
        try {
          await this.stopMCPContainer(exchange.container_id);
          console.log(`Container stopped: ${exchange.container_id}`);
        } catch (error) {
          console.error('Error stopping container:', error);
        }
      }

      // Delete from database
      await db.query('DELETE FROM exchanges WHERE id = $1', [id]);

      res.json({
        success: true,
        message: 'Exchange deleted successfully'
      });
    } catch (error) {
      console.error('Delete exchange error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete exchange'
      });
    }
  }

  async getPublicExchanges(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, search = '', type = '' } = req.query;
      
      let query = `
        SELECT e.*, u.name as owner_name
        FROM exchanges e
        JOIN users u ON e.user_id = u.id
        WHERE e.privacy = 'public' AND e.status = 'active'
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        query += ` AND (e.name ILIKE $${paramCount} OR e.description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (type) {
        paramCount++;
        query += ` AND e.type = $${paramCount}`;
        params.push(type);
      }

      query += ` ORDER BY e.queries_count DESC, e.created_at DESC`;
      
      if (limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(Number(limit));

        if (page && Number(page) > 1) {
          paramCount++;
          query += ` OFFSET $${paramCount}`;
          params.push((Number(page) - 1) * Number(limit));
        }
      }

      const result = await db.query(query, params);
      
      const exchanges = result.rows.map(exchange => ({
        id: exchange.id,
        name: exchange.name,
        description: exchange.description,
        type: exchange.type,
        owner: exchange.owner_name,
        queries_count: exchange.queries_count,
        created_at: exchange.created_at,
        url: `${process.env.BASE_URL}/${exchange.slug}/mcp`
      }));

      res.json({
        success: true,
        data: exchanges
      });
    } catch (error) {
      console.error('Get public exchanges error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve public exchanges'
      });
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  private async processExchange(exchange: Exchange): Promise<void> {
    try {
      console.log(`Processing exchange: ${exchange.name}`);
      
      // Update status to processing
      await db.query(
        'UPDATE exchanges SET status = $1 WHERE id = $2',
        ['processing', exchange.id]
      );

      let metadata = {};
      let success = false;

      switch (exchange.type) {
        case 'local':
          metadata = await this.processLocalFiles(exchange);
          success = true;
          break;
        case 'google-drive':
          metadata = await this.processGoogleDrive(exchange);
          success = true;
          break;
        case 'github':
          metadata = await this.processGitHub(exchange);
          success = true;
          break;
      }

      if (success) {
        // Start MCP server container
        const port = await this.getAvailablePort();
        const containerId = await this.startMCPContainer(exchange, port);

        const updatedMetadata = {
          ...metadata,
          container_id: containerId,
          port: port,
          mcp_url: `${process.env.BASE_URL}/${exchange.slug}/mcp`
        };

        await db.query(
          'UPDATE exchanges SET status = $1, metadata = $2, container_id = $3 WHERE id = $4',
          ['active', JSON.stringify(updatedMetadata), containerId, exchange.id]
        );

        console.log(`Exchange ${exchange.name} is now active`);
      } else {
        await db.query(
          'UPDATE exchanges SET status = $1 WHERE id = $2',
          ['error', exchange.id]
        );
      }
    } catch (error) {
      console.error('Exchange processing error:', error);
      await db.query(
        'UPDATE exchanges SET status = $1 WHERE id = $2',
        ['error', exchange.id]
      );
    }
  }

  private async processLocalFiles(exchange: Exchange): Promise<any> {
    // Process folder path from the config
    const { folderPath } = exchange.config;
    
    if (!folderPath) {
      throw new Error('Folder path is required for local exchanges');
    }

    // Scan the folder to get metadata
    const folderStats = await fileSystemService.scanFolder(folderPath);
    
    return {
      type: 'local',
      folder_path: folderPath,
      file_count: folderStats.fileCount,
      total_size: folderStats.totalSize,
      file_types: folderStats.fileTypes,
      last_scanned: new Date().toISOString(),
      processed_at: new Date().toISOString()
    };
  }

  private async processGoogleDrive(exchange: Exchange): Promise<any> {
    // Process Google Drive connection
    const { credentials, folderId } = exchange.config;
    
    return {
      type: 'google-drive',
      folder_id: folderId,
      processed_at: new Date().toISOString()
    };
  }

  private async processGitHub(exchange: Exchange): Promise<any> {
    // Process GitHub repository
    const { token, owner, repo } = exchange.config;
    
    return {
      type: 'github',
      repository: `${owner}/${repo}`,
      processed_at: new Date().toISOString()
    };
  }

  private getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const typeMap: { [key: string]: string } = {
      'txt': 'text',
      'md': 'markdown',
      'pdf': 'pdf',
      'doc': 'document',
      'docx': 'document',
      'json': 'json',
      'csv': 'csv',
      'html': 'html'
    };
    return typeMap[ext || ''] || 'unknown';
  }


  private async getAvailablePort(): Promise<number> {
    const basePort = parseInt(process.env.MCP_SERVER_BASE_PORT || '4000');
    
    // Get all active container ports from database
    const result = await db.query(
      'SELECT metadata FROM exchanges WHERE status = $1 AND metadata IS NOT NULL',
      ['active']
    );
    
    const usedPorts = new Set<number>();
    result.rows.forEach(row => {
      try {
        const metadata = JSON.parse(row.metadata);
        if (metadata.port) {
          usedPorts.add(metadata.port);
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });
    
    // Find next available port
    let port = basePort;
    while (usedPorts.has(port)) {
      port++;
    }
    
    return port;
  }

  private async startMCPContainer(exchange: Exchange, port: number): Promise<string> {
    try {
      const imageName = process.env.MCP_SERVER_IMAGE || 'sail-mcp-server';
      
      // Prepare container environment and binds
      const containerEnv = [
        `EXCHANGE_SLUG=${exchange.slug}`,
        `API_URL=${process.env.BASE_URL || 'http://localhost:3001'}`,
        `PORT=${port}`
      ];

      const containerLabels = {
        'sail.exchange.id': exchange.id,
        'sail.exchange.slug': exchange.slug,
        'sail.service': 'mcp-server',
        'sail.version': '1.0.0'
      };

      const containerBinds = process.env.NODE_ENV === 'development' ? [
        `${process.cwd()}/storage:/app/storage:ro` // Read-only access to storage in development
      ] : [];

      // Create container with security policies and resource limits
      const containerConfig = DockerSecurityService.createSecureContainerConfig(
        imageName,
        [exchange.slug],
        containerEnv,
        port,
        containerLabels,
        containerBinds
      );

      const container = await this.docker.createContainer(containerConfig);

      // Start container
      await container.start();
      
      console.log(`MCP container started for exchange ${exchange.slug} on port ${port}`);
      return container.id;
    } catch (error) {
      console.error('Error starting MCP container:', error);
      throw error;
    }
  }

  private async stopMCPContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      
      // Stop the container
      await container.stop({ t: 10 }); // 10 second timeout
      
      // Remove the container
      await container.remove();
      
      console.log(`MCP container ${containerId} stopped and removed`);
    } catch (error: any) {
      if (error.statusCode === 404) {
        // Container doesn't exist, which is fine
        console.log(`Container ${containerId} not found (already removed)`);
      } else {
        console.error('Error stopping MCP container:', error);
        throw error;
      }
    }
  }
}

export const exchangeController = new ExchangeController();