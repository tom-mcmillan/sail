import express from 'express';
import { universalMcpController } from '../controllers/universalMcpController';
import { validateOAuthToken, requireScope } from '../middleware/oauth';

const router = express.Router();

// Universal MCP endpoint - works with any MCP client
// Supports both POST (Streamable HTTP) and GET (SSE) for maximum compatibility
// Requires OAuth authentication as per MCP specification
router.all('/:slug/mcp', validateOAuthToken, requireScope('mcp:read'), universalMcpController.handleUniversalMCPRequest.bind(universalMcpController));

// Administrative endpoints
router.get('/admin/adapters', universalMcpController.getAvailableAdapters.bind(universalMcpController));
router.get('/admin/status', universalMcpController.getServerStatus.bind(universalMcpController));

export default router;