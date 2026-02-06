import express from 'express';
import prisma from '../../utils/database.js';

const router = express.Router();

// GET /api/exports/:projectId - Listar exports de um projeto
router.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const exports = await prisma.export.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(exports);
  } catch (error) {
    next(error);
  }
});

// GET /api/exports/file/:id - Obter export específico
router.get('/file/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const exportFile = await prisma.export.findUnique({
      where: { id },
      include: {
        project: true
      }
    });

    if (!exportFile) {
      return res.status(404).json({ error: 'Export not found' });
    }

    res.json(exportFile);
  } catch (error) {
    next(error);
  }
});

export default router;
