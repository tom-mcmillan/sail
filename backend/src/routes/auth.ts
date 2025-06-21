import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { createRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Rate limiter for auth endpoints
const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5
});

router.post('/register', authRateLimit, authController.register);
router.post('/login', authRateLimit, authController.login);
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);

export default router;