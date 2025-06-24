import { Router } from 'express';
import { mcpController } from '../controllers/mcpController';
import { authenticateToken } from '../middleware/auth';
import { validateOAuthToken, requireScope } from '../middleware/oauth';
import { mcpRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Optional OAuth middleware - allows both authenticated and unauthenticated access
const optionalOAuth = (req: any, res: any, next: any) => {
  if (req.headers.authorization) {
    // If authorization header present, validate it
    validateOAuthToken(req, res, next);
  } else {
    // If no authorization, continue without OAuth info
    next();
  }
};

// MCP endpoints with optional OAuth
router.all('/:slug/*', mcpRateLimit, optionalOAuth, mcpController.handleMCPRequest.bind(mcpController));
router.all('/:slug', mcpRateLimit, optionalOAuth, mcpController.handleMCPRequest.bind(mcpController));

// Analytics endpoint requires authentication
router.get('/analytics/:exchangeId', authenticateToken, mcpController.getAnalytics.bind(mcpController));

export default router;