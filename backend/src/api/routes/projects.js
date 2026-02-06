import express from 'express';
import prisma from '../../utils/database.js';
import { addJob } from '../../utils/queue.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// GET /api/projects - Listar todos os projetos
router.get('/', async (req, res, next) => {
  try {
    const { userId, phone } = req.query;
    
    const where = {};
    if (userId) where.userId = userId;
    if (phone) where.user = { phone };

    const projects = await prisma.project.findMany({
      where,
      include: {
        user: true,
        videos: true,
        narrative: true,
        exports: true,
        _count: {
          select: {
            videos: true,
            scenes: true,
            exports: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id - Obter projeto específico
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: true,
        videos: {
          include: {
            scenes: {
              orderBy: { startTime: 'asc' }
            }
          }
        },
        narrative: true,
        exports: {
          orderBy: { createdAt: 'desc' }
        },
        scenes: {
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects - Criar novo projeto
router.post('/', async (req, res, next) => {
  try {
    const { phone, title, style = 'DRAMATIC' } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Buscar ou criar usuário
    let user = await prisma.user.findUnique({ where: { phone } });
    
    if (!user) {
      user = await prisma.user.create({
        data: { phone }
      });
    }

    // Criar projeto
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        title: title || `Projeto ${new Date().toLocaleDateString('pt-BR')}`,
        style,
        status: 'CREATED'
      },
      include: {
        user: true
      }
    });

    logger.info(`Project created: ${project.id} for user ${phone}`);

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/projects/:id - Atualizar projeto
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, style, status } = req.body;

    const data = {};
    if (title !== undefined) data.title = title;
    if (style !== undefined) data.style = style;
    if (status !== undefined) data.status = status;

    const project = await prisma.project.update({
      where: { id },
      data,
      include: {
        user: true,
        videos: true
      }
    });

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:id/process - Iniciar processamento completo
router.post('/:id/process', async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        videos: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.videos.length === 0) {
      return res.status(400).json({ error: 'No videos uploaded' });
    }

    // Atualizar status
    await prisma.project.update({
      where: { id },
      data: { status: 'ANALYZING' }
    });

    // Adicionar job de análise
    const job = await addJob('analysis', {
      projectId: id,
      videoIds: project.videos.map(v => v.id)
    });

    logger.info(`Processing started for project ${id}, job ${job.id}`);

    res.json({
      message: 'Processing started',
      jobId: job.id,
      status: 'ANALYZING'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id - Deletar projeto
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.project.delete({
      where: { id }
    });

    logger.info(`Project deleted: ${id}`);

    res.json({ message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id/status - Obter status detalhado do processamento
router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        title: true,
        _count: {
          select: {
            videos: true,
            scenes: true,
            exports: true
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const statusInfo = {
      project,
      progress: calculateProgress(project.status),
      estimatedTimeRemaining: estimateTimeRemaining(project.status)
    };

    res.json(statusInfo);
  } catch (error) {
    next(error);
  }
});

// Helper functions
function calculateProgress(status) {
  const progressMap = {
    CREATED: 0,
    UPLOADING: 10,
    ANALYZING: 30,
    SHOWRUNNING: 50,
    NARRATING: 65,
    EDITING: 80,
    EXPORTING: 90,
    COMPLETED: 100,
    FAILED: 0
  };
  return progressMap[status] || 0;
}

function estimateTimeRemaining(status) {
  const timeMap = {
    CREATED: 600,
    UPLOADING: 300,
    ANALYZING: 180,
    SHOWRUNNING: 120,
    NARRATING: 60,
    EDITING: 180,
    EXPORTING: 120,
    COMPLETED: 0,
    FAILED: 0
  };
  return timeMap[status] || 0;
}

export default router;
