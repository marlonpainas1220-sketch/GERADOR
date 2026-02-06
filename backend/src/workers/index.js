/**
 * Worker Orchestrator
 * Inicializa todos os workers em um único processo
 */

import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { initializeDatabase } from '../utils/database.js';
import { initializeQueues } from '../utils/queue.js';

dotenv.config();

async function startWorkers() {
  try {
    logger.info('🚀 Starting Reality Maker Workers...');

    // Inicializar database
    await initializeDatabase();
    logger.info('✓ Database connected');

    // Inicializar queues
    await initializeQueues();
    logger.info('✓ Queues initialized');

    // Importar workers (isso inicia o processamento)
    logger.info('Loading workers...');

    await import('./analysis-worker.js');
    await import('./showrunner-worker.js');
    // await import('./narrator-worker.js');
    // await import('./editing-worker.js');
    // await import('./export-worker.js');

    logger.info('✅ All workers ready and listening for jobs');
    logger.info(`📊 Worker concurrency: ${process.env.WORKER_CONCURRENCY || 2}`);
    
  } catch (error) {
    logger.error('❌ Failed to start workers:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down workers gracefully...');
  
  // Importar queues
  const { 
    analysisQueue,
    showrunnerQueue,
    narratorQueue,
    editingQueue,
    exportQueue 
  } = await import('../utils/queue.js');

  // Fechar todas as queues
  await Promise.all([
    analysisQueue.close(),
    showrunnerQueue.close(),
    narratorQueue.close(),
    editingQueue.close(),
    exportQueue.close()
  ]);

  logger.info('Workers shut down successfully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down workers...');
  process.exit(0);
});

// Iniciar
startWorkers();
