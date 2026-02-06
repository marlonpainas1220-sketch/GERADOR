import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../utils/database.js';
import logger from '../../utils/logger.js';
import { getVideoMetadata } from '../../services/video/metadata.js';

const router = express.Router();

// Configurar multer para upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.env.STORAGE_PATH || './storage', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: (process.env.MAX_VIDEO_SIZE_MB || 500) * 1024 * 1024 // Default: 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

// POST /api/videos/upload - Upload de vídeo
router.post('/upload', upload.single('video'), async (req, res, next) => {
  try {
    const { projectId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    if (!projectId) {
      // Remover arquivo se não tem projectId
      await fs.unlink(file.path);
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Verificar se projeto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { videos: true }
    });

    if (!project) {
      await fs.unlink(file.path);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verificar limite de vídeos
    const maxVideos = process.env.MAX_VIDEOS_PER_PROJECT || 10;
    if (project.videos.length >= maxVideos) {
      await fs.unlink(file.path);
      return res.status(400).json({ 
        error: `Maximum ${maxVideos} videos per project` 
      });
    }

    // Obter metadata do vídeo
    const metadata = await getVideoMetadata(file.path);

    // Verificar duração máxima
    const maxDuration = process.env.MAX_VIDEO_DURATION || 1800; // 30 min
    if (metadata.duration > maxDuration) {
      await fs.unlink(file.path);
      return res.status(400).json({ 
        error: `Video too long. Maximum duration: ${maxDuration}s` 
      });
    }

    // Salvar no banco
    const video = await prisma.video.create({
      data: {
        projectId,
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: BigInt(file.size),
        duration: metadata.duration,
        resolution: metadata.resolution,
        fps: metadata.fps
      }
    });

    // Atualizar status do projeto
    await prisma.project.update({
      where: { id: projectId },
      data: { 
        status: 'UPLOADING',
        updatedAt: new Date()
      }
    });

    logger.info(`Video uploaded: ${video.id} for project ${projectId}`);

    res.status(201).json(video);
  } catch (error) {
    // Limpar arquivo em caso de erro
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    next(error);
  }
});

// POST /api/videos/upload-multiple - Upload de múltiplos vídeos
router.post('/upload-multiple', upload.array('videos', 10), async (req, res, next) => {
  try {
    const { projectId } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No video files provided' });
    }

    if (!projectId) {
      // Limpar arquivos
      for (const file of files) {
        await fs.unlink(file.path).catch(() => {});
      }
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Verificar se projeto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { videos: true }
    });

    if (!project) {
      for (const file of files) {
        await fs.unlink(file.path).catch(() => {});
      }
      return res.status(404).json({ error: 'Project not found' });
    }

    const videos = [];
    const errors = [];

    for (const file of files) {
      try {
        const metadata = await getVideoMetadata(file.path);

        const video = await prisma.video.create({
          data: {
            projectId,
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: BigInt(file.size),
            duration: metadata.duration,
            resolution: metadata.resolution,
            fps: metadata.fps
          }
        });

        videos.push(video);
        logger.info(`Video uploaded: ${video.id}`);
      } catch (error) {
        logger.error(`Failed to process ${file.originalname}:`, error);
        errors.push({
          filename: file.originalname,
          error: error.message
        });
        await fs.unlink(file.path).catch(() => {});
      }
    }

    // Atualizar projeto
    await prisma.project.update({
      where: { id: projectId },
      data: { 
        status: 'UPLOADING',
        updatedAt: new Date()
      }
    });

    res.status(201).json({
      videos,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    // Limpar arquivos em caso de erro
    if (req.files) {
      for (const file of req.files) {
        await fs.unlink(file.path).catch(() => {});
      }
    }
    next(error);
  }
});

// GET /api/videos/:id - Obter vídeo específico
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        project: true,
        scenes: {
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(video);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/videos/:id - Deletar vídeo
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const video = await prisma.video.findUnique({
      where: { id }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Deletar arquivo físico
    await fs.unlink(video.path).catch(() => {});

    // Deletar do banco
    await prisma.video.delete({
      where: { id }
    });

    logger.info(`Video deleted: ${id}`);

    res.json({ message: 'Video deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/videos/:id/stream - Stream de vídeo
router.get('/:id/stream', async (req, res, next) => {
  try {
    const { id } = req.params;

    const video = await prisma.video.findUnique({
      where: { id }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoPath = video.path;
    const stat = await fs.stat(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4'
      });

      const readStream = (await import('fs')).createReadStream(videoPath, { start, end });
      readStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });

      const readStream = (await import('fs')).createReadStream(videoPath);
      readStream.pipe(res);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
