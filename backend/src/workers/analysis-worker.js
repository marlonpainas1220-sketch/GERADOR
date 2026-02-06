import { analysisQueue } from '../utils/queue.js';
import prisma from '../utils/database.js';
import logger from '../utils/logger.js';
import { extractAudio } from '../services/video/metadata.js';
import { transcribeAudio } from '../services/audio/transcription.js';
import { detectScenes } from '../services/video/scene-detection.js';
import { addJob } from '../utils/queue.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Worker responsável por analisar vídeos:
 * - Detectar cenas
 * - Transcrever áudio
 * - Identificar speakers
 * - Detectar emoções
 */

analysisQueue.process(async (job) => {
  const { projectId, videoIds } = job.data;

  logger.info(`[Analysis] Starting analysis for project ${projectId}`);

  try {
    // Atualizar status do projeto
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'ANALYZING' }
    });

    job.progress(10);

    // Buscar vídeos
    const videos = await prisma.video.findMany({
      where: { id: { in: videoIds } },
      orderBy: { uploadedAt: 'asc' }
    });

    logger.info(`[Analysis] Found ${videos.length} videos to analyze`);

    const allScenes = [];
    const allTranscriptions = [];

    // Processar cada vídeo
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const progress = 10 + (i / videos.length) * 70;

      logger.info(`[Analysis] Processing video ${i + 1}/${videos.length}: ${video.id}`);
      job.progress(progress);

      // 1. Detectar cenas
      logger.info(`[Analysis] Detecting scenes...`);
      const scenes = await detectScenes(video.path, video.id, projectId);
      allScenes.push(...scenes);

      logger.info(`[Analysis] Found ${scenes.length} scenes`);

      // 2. Extrair áudio
      logger.info(`[Analysis] Extracting audio...`);
      const audioPath = path.join(
        process.env.STORAGE_PATH || './storage',
        'temp',
        `${video.id}_audio.wav`
      );

      await extractAudio(video.path, audioPath);

      // 3. Transcrever áudio
      logger.info(`[Analysis] Transcribing audio...`);
      const transcription = await transcribeAudio(audioPath, video.id);
      allTranscriptions.push(...transcription);

      // Limpar arquivo de áudio temporário
      await fs.unlink(audioPath).catch(() => {});

      logger.info(`[Analysis] Video ${video.id} processed successfully`);
    }

    job.progress(80);

    logger.info(`[Analysis] Total scenes detected: ${allScenes.length}`);
    logger.info(`[Analysis] Total transcriptions: ${allTranscriptions.length}`);

    // Associar transcrições com cenas
    await associateTranscriptionsWithScenes(allScenes, allTranscriptions);

    job.progress(90);

    // Atualizar status e iniciar Showrunner
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'SHOWRUNNING' }
    });

    logger.info(`[Analysis] Starting Showrunner for project ${projectId}`);

    // Adicionar job de Showrunner
    await addJob('showrunner', {
      projectId,
      sceneIds: allScenes.map(s => s.id)
    });

    job.progress(100);

    return {
      projectId,
      scenesDetected: allScenes.length,
      transcriptionsGenerated: allTranscriptions.length
    };

  } catch (error) {
    logger.error(`[Analysis] Error analyzing project ${projectId}:`, error);

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'FAILED' }
    });

    throw error;
  }
});

/**
 * Associa transcrições com as cenas correspondentes
 */
async function associateTranscriptionsWithScenes(scenes, transcriptions) {
  for (const scene of scenes) {
    // Encontrar transcrições que caem dentro desta cena
    const sceneTranscriptions = transcriptions.filter(t => 
      t.start >= scene.startTime && t.end <= scene.endTime
    );

    if (sceneTranscriptions.length > 0) {
      // Concatenar textos
      const fullText = sceneTranscriptions.map(t => `${t.speaker}: ${t.text}`).join('\n');

      // Extrair speakers únicos
      const speakers = [...new Set(sceneTranscriptions.map(t => t.speaker))];

      // Extrair emoções
      const emotions = sceneTranscriptions
        .filter(t => t.emotion)
        .map(t => t.emotion);

      // Atualizar cena
      await prisma.scene.update({
        where: { id: scene.id },
        data: {
          transcription: fullText,
          speakers: speakers,
          emotions: emotions.length > 0 ? emotions : null,
          metadata: {
            transcriptions: sceneTranscriptions
          }
        }
      });
    }
  }

  logger.info(`[Analysis] Transcriptions associated with scenes`);
}

// Event listeners
analysisQueue.on('completed', (job, result) => {
  logger.info(`[Analysis] Job ${job.id} completed:`, result);
});

analysisQueue.on('failed', (job, err) => {
  logger.error(`[Analysis] Job ${job.id} failed:`, err.message);
});

analysisQueue.on('progress', (job, progress) => {
  logger.debug(`[Analysis] Job ${job.id} progress: ${progress}%`);
});

logger.info('✓ Analysis worker ready');

export default analysisQueue;
