import express from 'express';
import prisma from '../../utils/database.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// GET /api/narratives/:projectId - Obter narrativa de um projeto
router.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const narrative = await prisma.narrative.findUnique({
      where: { projectId },
      include: {
        project: {
          include: {
            videos: true,
            scenes: true
          }
        }
      }
    });

    if (!narrative) {
      return res.status(404).json({ error: 'Narrative not found' });
    }

    res.json(narrative);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/narratives/:projectId - Atualizar narrativa
router.patch('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { structure, narrations } = req.body;

    const data = {};
    if (structure) data.structure = structure;
    if (narrations) data.narrations = narrations;

    const narrative = await prisma.narrative.update({
      where: { projectId },
      data
    });

    logger.info(`Narrative updated for project ${projectId}`);

    res.json(narrative);
  } catch (error) {
    next(error);
  }
});

export default router;
