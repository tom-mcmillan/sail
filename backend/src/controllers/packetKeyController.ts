import { Request, Response } from 'express';
import { db } from '../services/database';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export class PacketKeyController {
  
  /**
   * Generate a packet key for an exchange
   */
  async generatePacketKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { exchangeId, name, description, maxUsage, expiresInDays } = req.body;
      
      // For demo purposes, allow test user
      const testUserId = '00000000-0000-0000-0000-000000000001';
      const userId = req.user?.id || testUserId;

      if (!exchangeId) {
        res.status(400).json({
          success: false,
          error: 'Exchange ID is required'
        });
        return;
      }

      // Verify exchange exists and user owns it
      const exchangeResult = await db.query(
        'SELECT id FROM exchanges WHERE id = $1 AND user_id = $2',
        [exchangeId, userId]
      );

      if (exchangeResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Exchange not found or access denied'
        });
        return;
      }

      // Calculate expiration date
      let expiresAt = null;
      if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      // Generate unique packet identifiers
      const identifiersResult = await db.query('SELECT * FROM generate_packet_identifiers($1)', [name]);
      const { packet_id, access_key } = identifiersResult.rows[0];

      // Insert packet key
      const insertResult = await db.query(`
        INSERT INTO packet_keys (packet_id, access_key, exchange_id, creator_id, name, description, max_usage, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [packet_id, access_key, exchangeId, userId, name, description, maxUsage, expiresAt]);

      const createdKey = insertResult.rows[0];

      res.status(201).json({
        success: true,
        data: {
          packetId: createdKey.packet_id,
          accessKey: createdKey.access_key,
          mcpUrl: `${process.env.BASE_URL}/${createdKey.packet_id}/mcp`,
          name: createdKey.name,
          description: createdKey.description,
          maxUsage: createdKey.max_usage,
          expiresAt: createdKey.expires_at,
          createdAt: createdKey.created_at,
          instructions: {
            mcpUrl: `${process.env.BASE_URL}/${createdKey.packet_id}/mcp`,
            accessKey: createdKey.access_key,
            usage: "Add the MCP URL to Claude AI, then provide the access key when prompted for authorization"
          }
        }
      });

    } catch (error) {
      console.error('Generate packet key error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate packet key'
      });
    }
  }

  /**
   * List packet keys for a user
   */
  async listPacketKeys(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // For demo purposes, allow test user
      const testUserId = '00000000-0000-0000-0000-000000000001';
      const userId = req.user?.id || testUserId;

      const result = await db.query(`
        SELECT pk.*, e.name as exchange_name, e.description as exchange_description
        FROM packet_keys pk
        JOIN exchanges e ON pk.exchange_id = e.id
        WHERE pk.creator_id = $1
        ORDER BY pk.created_at DESC
      `, [userId]);

      const packetKeys = result.rows.map(key => ({
        packetKey: key.key,
        mcpUrl: `${process.env.BASE_URL}/pk/${key.key}`,
        name: key.name,
        description: key.description,
        exchangeName: key.exchange_name,
        exchangeDescription: key.exchange_description,
        usageCount: key.usage_count,
        maxUsage: key.max_usage,
        expiresAt: key.expires_at,
        lastUsedAt: key.last_used_at,
        isActive: key.is_active,
        createdAt: key.created_at
      }));

      res.json({
        success: true,
        data: packetKeys
      });

    } catch (error) {
      console.error('List packet keys error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list packet keys'
      });
    }
  }

  /**
   * Get packet key details and analytics
   */
  async getPacketKeyDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      
      // For demo purposes, allow test user
      const testUserId = '00000000-0000-0000-0000-000000000001';
      const userId = req.user?.id || testUserId;

      const result = await db.query(`
        SELECT pk.*, e.name as exchange_name, e.description as exchange_description
        FROM packet_keys pk
        JOIN exchanges e ON pk.exchange_id = e.id
        WHERE pk.key = $1 AND pk.creator_id = $2
      `, [key, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Packet key not found'
        });
        return;
      }

      const packetKey = result.rows[0];

      // Get usage analytics
      const analyticsResult = await db.query(`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as usage_count
        FROM packet_key_usage
        WHERE packet_key = $1 AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `, [key]);

      res.json({
        success: true,
        data: {
          packetKey: packetKey.key,
          mcpUrl: `${process.env.BASE_URL}/pk/${packetKey.key}`,
          name: packetKey.name,
          description: packetKey.description,
          exchangeName: packetKey.exchange_name,
          exchangeDescription: packetKey.exchange_description,
          usageCount: packetKey.usage_count,
          maxUsage: packetKey.max_usage,
          expiresAt: packetKey.expires_at,
          lastUsedAt: packetKey.last_used_at,
          isActive: packetKey.is_active,
          createdAt: packetKey.created_at,
          analytics: analyticsResult.rows
        }
      });

    } catch (error) {
      console.error('Get packet key details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get packet key details'
      });
    }
  }

  /**
   * Revoke/deactivate a packet key
   */
  async revokePacketKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      
      // For demo purposes, allow test user
      const testUserId = '00000000-0000-0000-0000-000000000001';
      const userId = req.user?.id || testUserId;

      const result = await db.query(`
        UPDATE packet_keys 
        SET is_active = false, updated_at = NOW()
        WHERE key = $1 AND creator_id = $2
        RETURNING *
      `, [key, userId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Packet key not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Packet key revoked successfully',
        data: {
          packetKey: result.rows[0].key,
          isActive: result.rows[0].is_active
        }
      });

    } catch (error) {
      console.error('Revoke packet key error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke packet key'
      });
    }
  }

  /**
   * Validate and get exchange info by packet ID and access key (used by MCP endpoint)
   */
  async validatePacketAccess(packetId: string, accessKey: string): Promise<any> {
    try {
      const result = await db.query(`
        SELECT pk.*, e.*
        FROM packet_keys pk
        JOIN exchanges e ON pk.exchange_id = e.id
        WHERE pk.packet_id = $1 AND pk.access_key = $2 AND pk.is_active = true
        AND (pk.expires_at IS NULL OR pk.expires_at > NOW())
        AND (pk.max_usage IS NULL OR pk.usage_count < pk.max_usage)
      `, [packetId, accessKey]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];

    } catch (error) {
      console.error('Validate packet access error:', error);
      return null;
    }
  }

  /**
   * Get packet info by ID only (for basic validation)
   */
  async getPacketInfo(packetId: string): Promise<any> {
    try {
      const result = await db.query(`
        SELECT pk.packet_id, pk.name, pk.description, pk.is_active, e.name as exchange_name
        FROM packet_keys pk
        JOIN exchanges e ON pk.exchange_id = e.id
        WHERE pk.packet_id = $1 AND pk.is_active = true
        AND (pk.expires_at IS NULL OR pk.expires_at > NOW())
      `, [packetId]);

      return result.rows[0] || null;

    } catch (error) {
      console.error('Get packet info error:', error);
      return null;
    }
  }

  /**
   * Log packet access usage
   */
  async logUsage(accessKey: string, clientInfo: any, method: string, resource?: string): Promise<void> {
    try {
      await db.query(`
        INSERT INTO packet_key_usage (access_key, client_info, method, resource_accessed)
        VALUES ($1, $2, $3, $4)
      `, [accessKey, JSON.stringify(clientInfo), method, resource]);

    } catch (error) {
      console.error('Log packet usage error:', error);
      // Don't throw - usage logging shouldn't break the main flow
    }
  }
}

export const packetKeyController = new PacketKeyController();