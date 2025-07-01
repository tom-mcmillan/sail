import express from 'express';
import { universalMcpController } from '../controllers/universalMcpController';
import { authenticateToken } from '../middleware/auth';
import { validateOAuthToken } from '../middleware/oauth';
import { mcpRateLimit } from '../middleware/rateLimiter';

const router = express.Router();

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

// Packet key based MCP endpoint - no authentication required, just the key
router.all('/pk/:packetKey', mcpRateLimit, universalMcpController.handlePacketKeyMCPRequest.bind(universalMcpController));

// Universal MCP endpoint - works with any MCP client
// Supports both POST (Streamable HTTP) and GET (SSE) for maximum compatibility
// Uses optional OAuth for backward compatibility
router.all('/:slug/mcp', mcpRateLimit, optionalOAuth, universalMcpController.handleUniversalMCPRequest.bind(universalMcpController));

// Legacy MCP endpoint routes for backward compatibility
router.all('/mcp/:slug', mcpRateLimit, optionalOAuth, universalMcpController.handleUniversalMCPRequest.bind(universalMcpController));
router.all('/mcp/:slug/*', mcpRateLimit, optionalOAuth, universalMcpController.handleUniversalMCPRequest.bind(universalMcpController));

// Analytics endpoint requires authentication
router.get('/mcp/analytics/:exchangeId', authenticateToken, universalMcpController.getAnalytics.bind(universalMcpController));

// Administrative endpoints
router.get('/admin/adapters', universalMcpController.getAvailableAdapters.bind(universalMcpController));
router.get('/admin/status', universalMcpController.getServerStatus.bind(universalMcpController));

export default router;