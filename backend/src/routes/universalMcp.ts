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

// Smart routing: Check if this is a packet access vs legacy slug
router.all('/:identifier/mcp', mcpRateLimit, (req: any, res: any, next: any) => {
  const { identifier } = req.params;
  
  // Check if this looks like a packet ID (contains packet- prefix or has access key in request)
  const hasAccessKey = req.headers.authorization?.startsWith('Bearer ') || 
                      req.query.key || 
                      req.body?.accessKey;
  
  if (identifier.startsWith('packet-') || hasAccessKey) {
    // Route to packet handler
    req.params.packetId = identifier;
    universalMcpController.handlePacketMCPRequest(req, res);
  } else {
    // Route to legacy slug handler
    req.params.slug = identifier;
    optionalOAuth(req, res, () => {
      universalMcpController.handleUniversalMCPRequest(req, res);
    });
  }
});

// Legacy MCP endpoint routes for backward compatibility
router.all('/mcp/:slug', mcpRateLimit, optionalOAuth, universalMcpController.handleUniversalMCPRequest.bind(universalMcpController));
router.all('/mcp/:slug/*', mcpRateLimit, optionalOAuth, universalMcpController.handleUniversalMCPRequest.bind(universalMcpController));

// Analytics endpoint requires authentication
router.get('/mcp/analytics/:exchangeId', authenticateToken, universalMcpController.getAnalytics.bind(universalMcpController));

// Administrative endpoints
router.get('/admin/adapters', universalMcpController.getAvailableAdapters.bind(universalMcpController));
router.get('/admin/status', universalMcpController.getServerStatus.bind(universalMcpController));

export default router;