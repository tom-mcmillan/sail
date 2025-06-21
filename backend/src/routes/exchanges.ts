import { Router } from 'express';
import { exchangeController } from '../controllers/exchangeController';
import { authenticateToken } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimiter';

const router = Router();

router.post('/', authenticateToken, apiRateLimit, exchangeController.createExchange);
router.get('/', authenticateToken, exchangeController.getExchanges);
router.get('/public', exchangeController.getPublicExchanges);
router.get('/:id', authenticateToken, exchangeController.getExchange);
router.put('/:id', authenticateToken, exchangeController.updateExchange);
router.delete('/:id', authenticateToken, exchangeController.deleteExchange);

export default router;