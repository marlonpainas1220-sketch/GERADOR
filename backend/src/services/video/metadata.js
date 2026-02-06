import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';

const ffprobeAsync = promisify(ffmpeg.ffprobe);

/**
 * Extrai metadata de um vídeo usando FFmpeg
 */
export async function getVideoMetadata(videoPath) {
  try {
    const metadata = await ffprobeAsync(videoPath);
    
    const videoStream = metadata.streams.find(s => s.codec_type === 'video');
    const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

    if (!videoStream) {
      throw new Error('No video stream found');
    }

    // Calcular FPS de forma segura sem usar eval
    let fps = 30;
    if (videoStream.r_frame_rate) {
      const fpsMatch = videoStream.r_frame_rate.match(/^(\d+)\/(\d+)$/);
      if (fpsMatch) {
        fps = parseInt(fpsMatch[1], 10) / parseInt(fpsMatch[2], 10);
      } else if (!isNaN(parseFloat(videoStream.r_frame_rate))) {
        fps = parseFloat(videoStream.r_frame_rate);
      }
    }

    return {
      duration: parseFloat(metadata.format.duration) || 0,
      size: parseInt(metadata.format.size) || 0,
      bitrate: parseInt(metadata.format.bit_rate) || 0,
      resolution: `${videoStream.width}x${videoStream.height}`,
      width: videoStream.width,
      height: videoStream.height,
      fps: fps,
      codec: videoStream.codec_name,
      hasAudio: !!audioStream,
      audioCodec: audioStream?.codec_name,
      audioChannels: audioStream?.channels,
      audioSampleRate: audioStream?.sample_rate
    };
  } catch (error) {
    throw new Error(`Failed to extract video metadata: ${error.message}`);
  }
}

/**
 * Extrai frame de um vídeo em um timestamp específico
 */
export async function extractFrame(videoPath, timestamp, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestamp)
      .frames(1)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Extrai áudio de um vídeo
 */
export async function extractAudio(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .on('progress', (progress) => {
        // Callback de progresso pode ser usado
      })
      .run();
  });
}

/**
 * Converte vídeo para formato padronizado
 */
export async function convertVideo(inputPath, outputPath, options = {}) {
  const {
    resolution = '1920x1080',
    fps = 30,
    videoBitrate = '5000k',
    audioBitrate = '192k'
  } = options;

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .size(resolution)
      .fps(fps)
      .videoBitrate(videoBitrate)
      .audioBitrate(audioBitrate)
      .videoCodec('libx264')
      .audioCodec('aac')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .on('progress', (progress) => {
        // Callback de progresso
      })
      .run();
  });
}

/**
 * Corta um segmento de vídeo
 */
export async function cutVideo(inputPath, outputPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .videoCodec('copy')
      .audioCodec('copy')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Concatena múltiplos vídeos
 */
export async function concatenateVideos(videoPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    videoPaths.forEach(path => {
      command.input(path);
    });

    command
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .mergeToFile(outputPath);
  });
}

/**
 * Adiciona áudio sobre vídeo com ducking
 */
export async function mixAudioWithVideo(videoPath, audioPath, outputPath, options = {}) {
  const {
    videoVolume = 0.3,
    audioVolume = 1.0,
    fadeIn = 1.0,
    fadeOut = 1.0
  } = options;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .complexFilter([
        `[0:a]volume=${videoVolume}[a0]`,
        `[1:a]volume=${audioVolume},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOut}:d=${fadeOut}[a1]`,
        `[a0][a1]amix=inputs=2:duration=first[aout]`
      ])
      .outputOptions('-map', '0:v')
      .outputOptions('-map', '[aout]')
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

export default {
  getVideoMetadata,
  extractFrame,
  extractAudio,
  convertVideo,
  cutVideo,
  concatenateVideos,
  mixAudioWithVideo
};
