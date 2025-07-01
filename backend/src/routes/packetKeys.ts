import { Router } from 'express';
import { packetKeyController } from '../controllers/packetKeyController';
import { apiRateLimit } from '../middleware/rateLimiter';

const router = Router();

// Generate a new packet key for an exchange
router.post('/', apiRateLimit, packetKeyController.generatePacketKey.bind(packetKeyController));

// List all packet keys for the authenticated user
router.get('/', packetKeyController.listPacketKeys.bind(packetKeyController));

// Get specific packet key details and analytics
router.get('/:key', packetKeyController.getPacketKeyDetails.bind(packetKeyController));

// Revoke/deactivate a packet key
router.delete('/:key', packetKeyController.revokePacketKey.bind(packetKeyController));

export default router;