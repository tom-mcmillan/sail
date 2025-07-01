import Redis from 'ioredis';
import { config } from 'dotenv';

config();

class RedisService {
  private client?: Redis;

  constructor() {
    // Skip Redis connection if REDIS_URL is not set
    if (!process.env.REDIS_URL) {
      console.log('⚠️ Redis connection skipped - REDIS_URL not set');
      return;
    }

    this.client = new Redis(process.env.REDIS_URL);

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });

    this.client.on('connect', () => {
      console.log('Connected to Redis');
    });
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client) return;
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.expire(key, seconds);
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    await this.client.disconnect();
  }

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (!this.client) return;
    await this.client.setex(key, seconds, value);
  }

  async exists(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.exists(key);
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];
    return this.client.keys(pattern);
  }
}

export const redis = new RedisService();