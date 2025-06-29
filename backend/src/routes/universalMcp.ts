import express from 'express';
import { universalMcpController } from '../controllers/universalMcpController';

const router = express.Router();

// Universal MCP endpoint - works with any MCP client
// Supports both POST (Streamable HTTP) and GET (SSE) for maximum compatibility
router.all('/:slug', universalMcpController.handleUniversalMCPRequest.bind(universalMcpController));

// Administrative endpoints
router.get('/admin/adapters', universalMcpController.getAvailableAdapters.bind(universalMcpController));
router.get('/admin/status', universalMcpController.getServerStatus.bind(universalMcpController));

export default router;