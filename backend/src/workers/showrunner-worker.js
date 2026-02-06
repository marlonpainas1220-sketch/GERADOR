import { showrunnerQueue } from '../utils/queue.js';
import prisma from '../utils/database.js';
import logger from '../utils/logger.js';
import ollamaClient from '../services/ai/ollama-client.js';
import { 
  SHOWRUNNER_SYSTEM_PROMPT,
  buildShowrunnerPrompt,
  validateShowrunnerOutput 
} from '../services/ai/prompts/showrunner-prompt.js';
import { addJob } from '../utils/queue.js';

/**
 * Worker responsável por criar a estrutura narrativa usando IA
 */

showrunnerQueue.process(async (job) => {
  const { projectId, sceneIds } = job.data;

  logger.info(`[Showrunner] Starting narrative generation for project ${projectId}`);

  try {
    // Atualizar status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'SHOWRUNNING' }
    });

    job.progress(10);

    // Buscar dados do projeto
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        videos: true,
        scenes: {
          where: { id: { in: sceneIds } },
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    logger.info(`[Showrunner] Loaded ${project.scenes.length} scenes`);

    job.progress(20);

    // Preparar dados para o LLM
    const videoMetadata = project.videos.map(v => ({
      duration: v.duration,
      resolution: v.resolution
    }));

    const scenes = project.scenes.map(s => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      speakers: s.speakers,
      emotions: s.emotions,
      importanceScore: s.importanceScore,
      description: s.description
    }));

    // Extrair transcrições
    const transcriptions = [];
    project.scenes.forEach(scene => {
      if (scene.metadata?.transcriptions) {
        transcriptions.push(...scene.metadata.transcriptions);
      }
    });

    logger.info(`[Showrunner] Loaded ${transcriptions.length} transcription segments`);

    job.progress(30);

    // Construir prompt
    const userPrompt = buildShowrunnerPrompt(scenes, transcriptions, videoMetadata);

    logger.info(`[Showrunner] Generating narrative with LLM...`);
    logger.debug(`[Showrunner] Prompt length: ${userPrompt.length} chars`);

    // Garantir que modelo está disponível
    await ollamaClient.ensureModel();

    job.progress(40);

    // Gerar narrativa com LLM
    let narrative;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        narrative = await ollamaClient.generateJSON(
          SHOWRUNNER_SYSTEM_PROMPT,
          userPrompt,
          {
            temperature: 0.7,
            top_p: 0.9
          }
        );

        // Validar output
        validateShowrunnerOutput(narrative);

        logger.info(`[Showrunner] Valid narrative generated on attempt ${attempts + 1}`);
        break;

      } catch (error) {
        attempts++;
        logger.warn(`[Showrunner] Attempt ${attempts} failed:`, error.message);

        if (attempts >= maxAttempts) {
          throw new Error(`Failed to generate valid narrative after ${maxAttempts} attempts`);
        }

        // Esperar um pouco antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    job.progress(70);

    // Salvar narrativa no banco
    await prisma.narrative.upsert({
      where: { projectId },
      create: {
        projectId,
        structure: narrative
      },
      update: {
        structure: narrative
      }
    });

    logger.info(`[Showrunner] Narrative saved to database`);

    job.progress(80);

    // Log estatísticas
    const stats = {
      characters: narrative.characters?.length || 0,
      keyMoments: narrative.key_moments?.length || 0,
      narrationPoints: narrative.narration_points?.length || 0,
      shortssuggestions: narrative.shorts_suggestions?.length || 0,
      targetDuration: narrative.metadata?.episode_duration_target || 0,
      retentionScore: narrative.metadata?.retention_score || 0
    };

    logger.info(`[Showrunner] Stats:`, stats);

    // Atualizar status e iniciar narração
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'NARRATING' }
    });

    // Adicionar job de narração
    await addJob('narrator', { projectId });

    job.progress(100);

    return {
      projectId,
      narrative: stats
    };

  } catch (error) {
    logger.error(`[Showrunner] Error for project ${projectId}:`, error);

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'FAILED' }
    });

    throw error;
  }
});

// Event listeners
showrunnerQueue.on('completed', (job, result) => {
  logger.info(`[Showrunner] Job ${job.id} completed:`, result);
});

showrunnerQueue.on('failed', (job, err) => {
  logger.error(`[Showrunner] Job ${job.id} failed:`, err.message);
});

showrunnerQueue.on('progress', (job, progress) => {
  logger.debug(`[Showrunner] Job ${job.id} progress: ${progress}%`);
});

logger.info('✓ Showrunner worker ready');

export default showrunnerQueue;
