import { Router } from 'express';
import { exchangeController } from '../controllers/exchangeController';
import { apiRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Temporarily disable auth for testing
router.post('/', apiRateLimit, exchangeController.createExchange.bind(exchangeController));
router.post('/bundled', apiRateLimit, exchangeController.createBundledExchange.bind(exchangeController));
router.get('/', exchangeController.getExchanges.bind(exchangeController));
router.get('/public', exchangeController.getPublicExchanges.bind(exchangeController));
router.get('/:id', exchangeController.getExchange.bind(exchangeController));
router.put('/:id', exchangeController.updateExchange.bind(exchangeController));
router.delete('/:id', exchangeController.deleteExchange.bind(exchangeController));

export default router;