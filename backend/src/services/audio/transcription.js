import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import logger from '../../utils/logger.js';

/**
 * Transcreve áudio usando Whisper (open source)
 */
export async function transcribeAudio(audioPath, videoId) {
  logger.info(`[Whisper] Starting transcription for ${videoId}`);

  try {
    const scriptPath = await createWhisperScript();
    const outputPath = path.join(
      process.env.STORAGE_PATH || './storage',
      'temp',
      `${videoId}_transcription.json`
    );

    // Executar Whisper
    const transcription = await runWhisperScript(scriptPath, audioPath, outputPath);

    // Limpar arquivos temporários
    await fs.unlink(scriptPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    logger.info(`[Whisper] Transcription complete: ${transcription.length} segments`);

    return transcription;

  } catch (error) {
    logger.error('[Whisper] Transcription error:', error);
    throw error;
  }
}

/**
 * Cria script Python para Whisper
 */
async function createWhisperScript() {
  const whisperModel = process.env.WHISPER_MODEL || 'base';
  
  const script = `#!/usr/bin/env python3
import sys
import json
import whisper
import warnings

warnings.filterwarnings("ignore")

def transcribe_audio(audio_path, output_path, model_size="base"):
    """Transcreve áudio usando Whisper"""
    
    print(f"Loading Whisper model: {model_size}...")
    model = whisper.load_model(model_size)
    
    print("Transcribing audio...")
    result = model.transcribe(
        audio_path,
        language="pt",
        task="transcribe",
        verbose=False,
        word_timestamps=True
    )
    
    # Formatar resultado
    segments = []
    
    for segment in result['segments']:
        # Tentar identificar speaker (simplificado)
        speaker = f"person_{(len(segments) % 3) + 1}"  # Rotação simples
        
        segments.append({
            'start': round(segment['start'], 2),
            'end': round(segment['end'], 2),
            'text': segment['text'].strip(),
            'speaker': speaker,
            'confidence': round(segment.get('confidence', 0.8), 2)
        })
    
    # Salvar resultado
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    
    return len(segments)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: script.py <audio_path> <output_path>")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    model_size = "${whisperModel}"
    
    try:
        num_segments = transcribe_audio(audio_path, output_path, model_size)
        print(f"SUCCESS: {num_segments} segments transcribed")
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
`;

  const scriptPath = path.join(
    process.env.STORAGE_PATH || './storage',
    'temp',
    `whisper_${Date.now()}.py`
  );

  await fs.mkdir(path.dirname(scriptPath), { recursive: true });
  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, 0o755);

  return scriptPath;
}

/**
 * Executa script Whisper
 */
async function runWhisperScript(scriptPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath, audioPath, outputPath]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      logger.debug(`[Whisper] ${text.trim()}`);
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', async (code) => {
      if (code !== 0) {
        logger.error('[Whisper] Script failed:', stderr);
        reject(new Error(`Whisper failed: ${stderr}`));
        return;
      }

      try {
        // Ler resultado
        const result = await fs.readFile(outputPath, 'utf-8');
        const transcription = JSON.parse(result);

        resolve(transcription);
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Diarização de speakers (identificar quem falou)
 * Versão simplificada - pode ser melhorada com pyannote.audio
 */
export async function diarizeSpeakers(transcription) {
  // Por enquanto, usa rotação simples de speakers
  // TODO: Implementar pyannote.audio para diarização real
  
  const speakers = ['person_1', 'person_2', 'person_3'];
  let currentSpeaker = 0;
  let lastEndTime = 0;

  return transcription.map((segment) => {
    // Se há pausa grande (>2s), provavelmente mudou de speaker
    if (segment.start - lastEndTime > 2) {
      currentSpeaker = (currentSpeaker + 1) % speakers.length;
    }

    lastEndTime = segment.end;

    return {
      ...segment,
      speaker: speakers[currentSpeaker]
    };
  });
}

export default {
  transcribeAudio,
  diarizeSpeakers
};
