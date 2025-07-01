import { redis } from './redis';
import { KnowledgeStoreAdapter } from '../adapters/base/KnowledgeStoreAdapter';

export interface SessionData {
  id: string;
  adapterType: string;
  adapterConfig: Record<string, any>;
  exchangeId: string;
  exchangeSlug: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export interface SessionStore {
  get(sessionId: string): Promise<SessionData | null>;
  set(sessionId: string, data: SessionData): Promise<void>;
  delete(sessionId: string): Promise<void>;
  cleanup(): Promise<void>;
  exists(sessionId: string): Promise<boolean>;
  updateActivity(sessionId: string): Promise<void>;
  getAll(): Promise<SessionData[]>;
}

/**
 * Redis-based session store with fallback to in-memory storage
 */
export class RedisSessionStore implements SessionStore {
  private memoryFallback: Map<string, SessionData> = new Map();
  private sessionTimeout: number;
  private keyPrefix: string;

  constructor(sessionTimeout: number = 30 * 60 * 1000, keyPrefix: string = 'mcp:session:') {
    this.sessionTimeout = sessionTimeout;
    this.keyPrefix = keyPrefix;
    
    // Clean up stale sessions periodically
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  private getKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  async get(sessionId: string): Promise<SessionData | null> {
    try {
      if (redis.isConnected()) {
        const data = await redis.get(this.getKey(sessionId));
        if (data) {
          const parsed = JSON.parse(data);
          return {
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            lastActivity: new Date(parsed.lastActivity),
            expiresAt: new Date(parsed.expiresAt)
          };
        }
      } else {
        // Fallback to memory store
        const data = this.memoryFallback.get(sessionId);
        if (data && data.expiresAt > new Date()) {
          return data;
        } else if (data) {
          this.memoryFallback.delete(sessionId);
        }
      }
      return null;
    } catch (error) {
      console.error('Session get error:', error);
      // Try memory fallback
      const data = this.memoryFallback.get(sessionId);
      return (data && data.expiresAt > new Date()) ? data : null;
    }
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.sessionTimeout);
      const sessionData = { ...data, expiresAt };

      if (redis.isConnected()) {
        const serialized = JSON.stringify(sessionData);
        await redis.setex(this.getKey(sessionId), Math.floor(this.sessionTimeout / 1000), serialized);
      } else {
        // Fallback to memory store
        this.memoryFallback.set(sessionId, sessionData);
      }
    } catch (error) {
      console.error('Session set error:', error);
      // Fallback to memory store
      this.memoryFallback.set(sessionId, { ...data, expiresAt: new Date(Date.now() + this.sessionTimeout) });
    }
  }

  async delete(sessionId: string): Promise<void> {
    try {
      if (redis.isConnected()) {
        await redis.del(this.getKey(sessionId));
      }
      this.memoryFallback.delete(sessionId);
    } catch (error) {
      console.error('Session delete error:', error);
      this.memoryFallback.delete(sessionId);
    }
  }

  async exists(sessionId: string): Promise<boolean> {
    try {
      if (redis.isConnected()) {
        const exists = await redis.exists(this.getKey(sessionId));
        return exists === 1;
      } else {
        const data = this.memoryFallback.get(sessionId);
        return data ? data.expiresAt > new Date() : false;
      }
    } catch (error) {
      console.error('Session exists error:', error);
      const data = this.memoryFallback.get(sessionId);
      return data ? data.expiresAt > new Date() : false;
    }
  }

  async updateActivity(sessionId: string): Promise<void> {
    try {
      const session = await this.get(sessionId);
      if (session) {
        session.lastActivity = new Date();
        await this.set(sessionId, session);
      }
    } catch (error) {
      console.error('Session update activity error:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Clean up memory fallback
      const now = new Date();
      for (const [sessionId, data] of this.memoryFallback.entries()) {
        if (data.expiresAt <= now) {
          this.memoryFallback.delete(sessionId);
        }
      }

      // Redis cleanup is handled automatically via TTL
      console.log(`🧹 Session cleanup completed. Memory sessions: ${this.memoryFallback.size}`);
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }

  async getAll(): Promise<SessionData[]> {
    try {
      const sessions: SessionData[] = [];

      if (redis.isConnected()) {
        const keys = await redis.keys(`${this.keyPrefix}*`);
        for (const key of keys) {
          const data = await redis.get(key);
          if (data) {
            const parsed = JSON.parse(data);
            sessions.push({
              ...parsed,
              createdAt: new Date(parsed.createdAt),
              lastActivity: new Date(parsed.lastActivity),
              expiresAt: new Date(parsed.expiresAt)
            });
          }
        }
      } else {
        // Use memory fallback
        const now = new Date();
        for (const data of this.memoryFallback.values()) {
          if (data.expiresAt > now) {
            sessions.push(data);
          }
        }
      }

      return sessions;
    } catch (error) {
      console.error('Session getAll error:', error);
      // Return memory fallback
      const now = new Date();
      return Array.from(this.memoryFallback.values()).filter(data => data.expiresAt > now);
    }
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    storageType: 'redis' | 'memory';
    memoryFallbackCount: number;
  }> {
    const sessions = await this.getAll();
    const now = new Date();
    const activeSessions = sessions.filter(s => s.lastActivity > new Date(now.getTime() - 5 * 60 * 1000)); // Active in last 5 minutes

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      storageType: redis.isConnected() ? 'redis' : 'memory',
      memoryFallbackCount: this.memoryFallback.size
    };
  }
}

/**
 * In-memory session store (legacy/fallback)
 */
export class MemorySessionStore implements SessionStore {
  private sessions: Map<string, SessionData> = new Map();
  private sessionTimeout: number;

  constructor(sessionTimeout: number = 30 * 60 * 1000) {
    this.sessionTimeout = sessionTimeout;
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  async get(sessionId: string): Promise<SessionData | null> {
    const data = this.sessions.get(sessionId);
    if (data && data.expiresAt > new Date()) {
      return data;
    } else if (data) {
      this.sessions.delete(sessionId);
    }
    return null;
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    const expiresAt = new Date(Date.now() + this.sessionTimeout);
    this.sessions.set(sessionId, { ...data, expiresAt });
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async exists(sessionId: string): Promise<boolean> {
    const data = this.sessions.get(sessionId);
    return data ? data.expiresAt > new Date() : false;
  }

  async updateActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      session.expiresAt = new Date(Date.now() + this.sessionTimeout);
    }
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    for (const [sessionId, data] of this.sessions.entries()) {
      if (data.expiresAt <= now) {
        this.sessions.delete(sessionId);
      }
    }
  }

  async getAll(): Promise<SessionData[]> {
    const now = new Date();
    return Array.from(this.sessions.values()).filter(data => data.expiresAt > now);
  }
}

// Default session store instance
export const sessionStore = new RedisSessionStore();