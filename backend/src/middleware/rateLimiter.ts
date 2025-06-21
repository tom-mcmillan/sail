import { Request, Response, NextFunction } from 'express';
import { redis } from '../services/redis';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}

export const createRateLimit = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = options.keyGenerator ? options.keyGenerator(req) : `rate_limit:${req.ip}`;
    const windowStart = Math.floor(Date.now() / options.windowMs);
    const redisKey = `${key}:${windowStart}`;

    try {
      const requests = await redis.incr(redisKey);
      
      if (requests === 1) {
        await redis.expire(redisKey, Math.ceil(options.windowMs / 1000));
      }
      
      if (requests > options.maxRequests) {
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(options.windowMs / 1000)
        });
        return;
      }
      
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, options.maxRequests - requests).toString(),
        'X-RateLimit-Reset': new Date(Date.now() + options.windowMs).toISOString()
      });
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Continue on redis errors
    }
  };
};

// Rate limiters for different endpoints
export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100
});

export const mcpRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000
});

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5
});