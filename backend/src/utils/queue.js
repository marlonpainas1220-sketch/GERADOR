import Queue from 'bull';
import Redis from 'ioredis';
import logger from './logger.js';

const redisConfig = {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
};

// Filas de processamento
export const analysisQueue = new Queue('analysis', redisConfig);
export const showrunnerQueue = new Queue('showrunner', redisConfig);
export const narratorQueue = new Queue('narrator', redisConfig);
export const editingQueue = new Queue('editing', redisConfig);
export const exportQueue = new Queue('export', redisConfig);

// Redis client para pub/sub
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function initializeQueues() {
  try {
    // Testar conexão
    await redis.ping();
    
    logger.info('✓ Analysis queue ready');
    logger.info('✓ Showrunner queue ready');
    logger.info('✓ Narrator queue ready');
    logger.info('✓ Editing queue ready');
    logger.info('✓ Export queue ready');
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize queues:', error);
    throw error;
  }
}

// Helper para adicionar job
export async function addJob(queueName, data, options = {}) {
  const queues = {
    analysis: analysisQueue,
    showrunner: showrunnerQueue,
    narrator: narratorQueue,
    editing: editingQueue,
    export: exportQueue
  };

  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  const job = await queue.add(data, {
    ...options,
    timestamp: Date.now()
  });

  logger.info(`Job ${job.id} added to ${queueName} queue`);
  return job;
}

// Helper para obter status de um job
export async function getJobStatus(queueName, jobId) {
  const queues = {
    analysis: analysisQueue,
    showrunner: showrunnerQueue,
    narrator: narratorQueue,
    editing: editingQueue,
    export: exportQueue
  };

  const queue = queues[queueName];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  const job = await queue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress();

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason
  };
}

export default {
  analysisQueue,
  showrunnerQueue,
  narratorQueue,
  editingQueue,
  exportQueue,
  redis,
  addJob,
  getJobStatus
};
