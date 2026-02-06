import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../utils/database.js';
import logger from '../../utils/logger.js';

/**
 * Detecta cenas em um vídeo usando PySceneDetect
 */
export async function detectScenes(videoPath, videoId, projectId) {
  logger.info(`[SceneDetect] Starting scene detection for video ${videoId}`);

  try {
    // Criar script Python temporário
    const scriptPath = await createPythonScript();
    const outputPath = path.join(
      process.env.STORAGE_PATH || './storage',
      'temp',
      `${videoId}_scenes.json`
    );

    // Executar Python script
    const scenes = await runPythonScript(scriptPath, videoPath, outputPath);

    // Limpar arquivos temporários
    await fs.unlink(scriptPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    // Salvar cenas no banco de dados
    const savedScenes = [];

    for (const scene of scenes) {
      const saved = await prisma.scene.create({
        data: {
          id: uuidv4(),
          videoId,
          projectId,
          startTime: scene.start_time,
          endTime: scene.end_time,
          importanceScore: scene.importance_score || 0.5
        }
      });

      savedScenes.push(saved);
    }

    logger.info(`[SceneDetect] Detected ${savedScenes.length} scenes`);

    return savedScenes;

  } catch (error) {
    logger.error('[SceneDetect] Error detecting scenes:', error);
    throw error;
  }
}

/**
 * Cria script Python para detecção de cenas
 */
async function createPythonScript() {
  const script = `#!/usr/bin/env python3
import sys
import json
from scenedetect import detect, ContentDetector, AdaptiveDetector

def detect_scenes(video_path, output_path):
    """Detecta cenas usando SceneDetect"""
    
    # Usar Content Detector (detecta mudanças de conteúdo)
    scene_list = detect(
        video_path, 
        ContentDetector(threshold=27.0),
        show_progress=False
    )
    
    scenes = []
    
    for i, scene in enumerate(scene_list):
        start_time = scene[0].get_seconds()
        end_time = scene[1].get_seconds()
        duration = end_time - start_time
        
        # Calcular score de importância baseado na duração
        # Cenas muito curtas (<2s) ou muito longas (>60s) têm score menor
        if duration < 2:
            importance = 0.3
        elif duration > 60:
            importance = 0.5
        elif duration > 5 and duration < 30:
            importance = 0.8
        else:
            importance = 0.6
        
        scenes.append({
            'scene_number': i + 1,
            'start_time': round(start_time, 2),
            'end_time': round(end_time, 2),
            'duration': round(duration, 2),
            'importance_score': importance
        })
    
    # Salvar em JSON
    with open(output_path, 'w') as f:
        json.dump(scenes, f, indent=2)
    
    return len(scenes)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: script.py <video_path> <output_path>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_path = sys.argv[2]
    
    try:
        num_scenes = detect_scenes(video_path, output_path)
        print(f"SUCCESS: {num_scenes} scenes detected")
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)
`;

  const scriptPath = path.join(
    process.env.STORAGE_PATH || './storage',
    'temp',
    `scene_detect_${Date.now()}.py`
  );

  await fs.mkdir(path.dirname(scriptPath), { recursive: true });
  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, 0o755);

  return scriptPath;
}

/**
 * Executa script Python
 */
async function runPythonScript(scriptPath, videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath, videoPath, outputPath]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', async (code) => {
      if (code !== 0) {
        logger.error('[SceneDetect] Python script failed:', stderr);
        reject(new Error(`Python script failed: ${stderr}`));
        return;
      }

      try {
        // Ler resultado
        const result = await fs.readFile(outputPath, 'utf-8');
        const scenes = JSON.parse(result);

        logger.info(`[SceneDetect] ${stdout.trim()}`);
        resolve(scenes);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export default {
  detectScenes
};
