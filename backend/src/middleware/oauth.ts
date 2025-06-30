import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../services/database';

interface AuthenticatedRequest extends Request {
  oauth?: {
    clientId: string;
    scopes: string[];
    userId?: string;
  };
}

export async function validateOAuthToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authorization = req.headers.authorization;
    
    // Allow certain MCP discovery requests without authentication for Claude compatibility
    if (!authorization || !authorization.startsWith('Bearer ')) {
      // Check if this is an initial discovery/capability request (but not from Claude which needs OAuth)
      const body = req.body;
      const isClaudeRequest = req.headers['user-agent']?.toLowerCase().includes('claude');
      
      // Always allow initialize method even for Claude (needed for session establishment)
      const isInitializeRequest = body && body.method === 'initialize';
      const isOtherDiscoveryRequest = body && body.method && (
        body.method === 'tools/list' ||
        body.method === 'resources/list' ||
        body.method === 'prompts/list'
      ) && !isClaudeRequest;
      
      const isDiscoveryRequest = isInitializeRequest || isOtherDiscoveryRequest;
      
      // Also allow GET requests to MCP endpoints for initial discovery (but not for Claude OAuth trigger)
      const isMCPGetRequest = req.method === 'GET' && req.path.includes('/mcp') && !req.headers['user-agent']?.includes('claude');
      
      if (isDiscoveryRequest || isMCPGetRequest) {
        console.log('Allowing unauthenticated discovery request:', body?.method || req.method);
        // Set minimal OAuth context for discovery
        req.oauth = {
          clientId: 'discovery',
          scopes: ['mcp:read'],
          userId: undefined
        };
        next();
        return;
      }
      
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Bearer token required'
      });
      return;
    }

    const token = authorization.substring(7); // Remove 'Bearer ' prefix
    const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Check if token exists in database and is not expired
      const tokenResult = await db.query(
        'SELECT * FROM oauth_access_tokens WHERE token = $1 AND expires_at > NOW()',
        [token]
      );

      if (tokenResult.rows.length === 0) {
        res.status(401).json({
          error: 'invalid_token',
          error_description: 'Token expired or invalid'
        });
        return;
      }

      const tokenData = tokenResult.rows[0];

      // Add OAuth info to request
      req.oauth = {
        clientId: decoded.client_id,
        scopes: decoded.scopes || [],
        userId: tokenData.user_id
      };

      next();
    } catch (jwtError) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid token format'
      });
      return;
    }
  } catch (error) {
    console.error('OAuth token validation error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Token validation failed'
    });
  }
}

export function requireScope(requiredScope: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.oauth) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Authentication required'
      });
      return;
    }

    if (!req.oauth.scopes.includes(requiredScope)) {
      res.status(403).json({
        error: 'insufficient_scope',
        error_description: `Scope '${requiredScope}' required`
      });
      return;
    }

    next();
  };
}