import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { initializeDatabase } from './utils/database.js';
import { initializeQueues } from './utils/queue.js';

// Routes
import projectRoutes from './api/routes/projects.js';
import videoRoutes from './api/routes/videos.js';
import narrativeRoutes from './api/routes/narratives.js';
import exportRoutes from './api/routes/exports.js';
import whatsappRoutes from './api/routes/whatsapp.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/narratives', narrativeRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Static files (exports)
app.use('/exports', express.static('storage/exports'));

// WebSocket para atualizações em tempo real
wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');
  
  ws.on('message', (message) => {
    logger.debug(`WebSocket message: ${message}`);
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });
});

// Broadcast function para enviar atualizações
export function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Error handler
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Inicialização
async function start() {
  try {
    // Inicializar banco de dados
    await initializeDatabase();
    logger.info('✓ Database connected');

    // Inicializar filas
    await initializeQueues();
    logger.info('✓ Queues initialized');

    // Iniciar servidor
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 WebSocket server ready`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

start();
