import express from 'express';
import { redis } from '../../utils/queue.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// GET /api/whatsapp/status - Status da conexão WhatsApp
router.get('/status', async (req, res, next) => {
  try {
    const status = await redis.get('whatsapp:status');
    const state = await redis.get('whatsapp:state');

    res.json({
      status: status || 'disconnected',
      state: state || 'DISCONNECTED',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/whatsapp/qr - QR Code para conectar
router.get('/qr', async (req, res, next) => {
  try {
    const qr = await redis.get('whatsapp:qr');

    if (!qr) {
      return res.status(404).json({ 
        error: 'QR Code not available',
        message: 'Start the WhatsApp bot first'
      });
    }

    res.json({
      qr,
      expiresIn: 60
    });
  } catch (error) {
    next(error);
  }
});

export default router;
