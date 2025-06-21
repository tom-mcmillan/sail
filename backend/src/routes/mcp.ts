import { Router } from 'express';
import { mcpController } from '../controllers/mcpController';
import { authenticateToken } from '../middleware/auth';
import { mcpRateLimit } from '../middleware/rateLimiter';

const router = Router();

router.all('/:slug/*', mcpRateLimit, mcpController.handleMCPRequest);
router.all('/:slug', mcpRateLimit, mcpController.handleMCPRequest);
router.get('/analytics/:exchangeId', authenticateToken, mcpController.getAnalytics);

export default router;