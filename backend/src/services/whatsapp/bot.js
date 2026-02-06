import wppconnect from '@wppconnect-team/wppconnect';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import FormData from 'form-data';
import logger from '../../utils/logger.js';
import { redis } from '../../utils/queue.js';

class RealityMakerBot {
  constructor() {
    this.client = null;
    this.sessions = new Map();
    this.apiUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  }

  async initialize() {
    logger.info('Initializing WhatsApp Bot...');

    this.client = await wppconnect.create({
      session: process.env.WHATSAPP_SESSION_NAME || 'reality-maker',
      catchQR: (base64Qr, asciiQR) => {
        logger.info('QR Code gerado!');
        console.log(asciiQR);
        
        // Salvar QR code para exibir no dashboard
        redis.set('whatsapp:qr', base64Qr, 'EX', 60);
      },
      statusFind: (statusSession, session) => {
        logger.info(`Status da sessão: ${statusSession}`);
        redis.set('whatsapp:status', statusSession);
      },
      headless: true,
      devtools: false,
      useChrome: true,
      debug: false,
      logQR: true,
      browserArgs: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      autoClose: 60000,
      disableWelcome: true
    });

    this.setupHandlers();
    logger.info('✓ WhatsApp Bot initialized');
  }

  setupHandlers() {
    // Mensagens de texto
    this.client.onMessage(async (message) => {
      try {
        if (message.isGroupMsg) return; // Ignorar grupos por enquanto
        if (message.from === 'status@broadcast') return;

        await this.handleTextMessage(message);
      } catch (error) {
        logger.error('Error handling text message:', error);
      }
    });

    // Qualquer mensagem (incluindo mídia)
    this.client.onAnyMessage(async (message) => {
      try {
        if (message.isGroupMsg) return;
        if (message.from === 'status@broadcast') return;

        if (message.type === 'video' || message.mimetype?.startsWith('video/')) {
          await this.handleVideoMessage(message);
        } else if (message.type === 'audio' || message.type === 'ptt') {
          await this.handleAudioMessage(message);
        }
      } catch (error) {
        logger.error('Error handling media message:', error);
      }
    });

    // Estado de conexão
    this.client.onStateChange((state) => {
      logger.info(`WhatsApp state changed: ${state}`);
      redis.set('whatsapp:state', state);
    });
  }

  async handleTextMessage(message) {
    const phone = this.normalizePhone(message.from);
    const text = message.body.toLowerCase().trim();

    logger.info(`Message from ${phone}: ${text}`);

    // Comandos principais
    if (this.isStartCommand(text)) {
      await this.startNewProject(phone);
      return;
    }

    if (text === 'status' || text === 'status?') {
      await this.sendStatus(phone);
      return;
    }

    if (text === 'ajuda' || text === 'help' || text === '?') {
      await this.sendHelp(phone);
      return;
    }

    if (text === 'pronto' || text === 'finalizar' || text === 'processar') {
      await this.finishUpload(phone);
      return;
    }

    if (text === 'cancelar') {
      await this.cancelProject(phone);
      return;
    }

    // Se está em uma sessão ativa, processar contextualmente
    const session = await this.getSession(phone);
    if (session && session.stage === 'uploading') {
      await this.client.sendText(
        message.from,
        'Pode enviar os vídeos! Quando terminar, manda "pronto".'
      );
      return;
    }

    // Conversa natural com IA
    await this.handleNaturalConversation(phone, text, message.from);
  }

  async handleVideoMessage(message) {
    const phone = this.normalizePhone(message.from);
    
    logger.info(`Video received from ${phone}`);

    await this.client.sendText(
      message.from,
      '✓ Vídeo recebido! Baixando...'
    );

    try {
      // Download do vídeo
      const buffer = await this.client.decryptFile(message);
      const filename = `${Date.now()}.mp4`;
      const tempPath = path.join('/tmp', filename);

      await fs.writeFile(tempPath, buffer);

      // Enviar para o backend
      const session = await this.getSession(phone);
      
      if (!session || !session.projectId) {
        // Criar projeto automaticamente
        const project = await this.createProject(phone);
        await this.updateSession(phone, { 
          projectId: project.id, 
          stage: 'uploading' 
        });
      }

      const projectId = (await this.getSession(phone)).projectId;
      
      await this.client.sendText(
        message.from,
        '⏳ Processando vídeo...'
      );

      await this.uploadVideoToBackend(projectId, tempPath, filename);

      // Limpar arquivo temporário
      await fs.unlink(tempPath);

      await this.client.sendText(
        message.from,
        '✅ Vídeo adicionado!\n\n' +
        'Pode enviar mais vídeos ou digite "pronto" para criar o reality show.'
      );

    } catch (error) {
      logger.error('Error processing video:', error);
      await this.client.sendText(
        message.from,
        '❌ Erro ao processar vídeo. Tente novamente ou use vídeos menores.'
      );
    }
  }

  async handleAudioMessage(message) {
    const phone = this.normalizePhone(message.from);
    logger.info(`Audio received from ${phone}`);
    
    // Pode ser usado para comandos por voz no futuro
    await this.client.sendText(
      message.from,
      'Áudios ainda não são suportados. Use comandos de texto ou envie vídeos!'
    );
  }

  async startNewProject(phone) {
    try {
      const project = await this.createProject(phone);
      
      await this.updateSession(phone, {
        projectId: project.id,
        stage: 'uploading',
        startedAt: new Date()
      });

      await this.client.sendText(
        phone,
        '🎬 *Novo Projeto Iniciado!*\n\n' +
        'Perfeito! Agora me envie os vídeos que você quer transformar em reality show.\n\n' +
        '📹 Podem ser vários vídeos\n' +
        '⏱️ Até 30 minutos cada\n' +
        '💾 Máximo 500MB por vídeo\n\n' +
        'Quando terminar de enviar, digite *"pronto"*'
      );

      logger.info(`New project started for ${phone}: ${project.id}`);
    } catch (error) {
      logger.error('Error starting project:', error);
      await this.client.sendText(
        phone,
        'Erro ao criar projeto. Tente novamente!'
      );
    }
  }

  async finishUpload(phone) {
    try {
      const session = await this.getSession(phone);

      if (!session || !session.projectId) {
        await this.client.sendText(
          phone,
          'Você ainda não iniciou um projeto.\n\n' +
          'Digite "criar reality" para começar!'
        );
        return;
      }

      await this.updateSession(phone, { stage: 'processing' });

      await this.client.sendText(
        phone,
        '🎬 Perfeito!\n\n' +
        'Vou analisar os vídeos e criar a narrativa do reality show.\n\n' +
        '⏱️ Isso leva uns 5-10 minutos dependendo da quantidade de vídeos.\n\n' +
        'Te aviso quando ficar pronto! 🚀'
      );

      // Iniciar processamento
      await axios.post(`${this.apiUrl}/api/projects/${session.projectId}/process`);

      logger.info(`Processing started for project ${session.projectId}`);

      // Monitorar progresso
      this.monitorProgress(phone, session.projectId);

    } catch (error) {
      logger.error('Error finishing upload:', error);
      await this.client.sendText(
        phone,
        'Erro ao iniciar processamento. Tente novamente!'
      );
    }
  }

  async sendStatus(phone) {
    try {
      const session = await this.getSession(phone);

      if (!session || !session.projectId) {
        await this.client.sendText(
          phone,
          '❌ Você não tem projetos ativos.\n\n' +
          'Digite *"criar reality"* para começar!'
        );
        return;
      }

      const response = await axios.get(
        `${this.apiUrl}/api/projects/${session.projectId}/status`
      );

      const { project, progress, estimatedTimeRemaining } = response.data;

      const statusEmojis = {
        CREATED: '📝',
        UPLOADING: '📤',
        ANALYZING: '🔍',
        SHOWRUNNING: '🎭',
        NARRATING: '🎙️',
        EDITING: '✂️',
        EXPORTING: '📦',
        COMPLETED: '✅',
        FAILED: '❌'
      };

      const statusMessages = {
        CREATED: 'Projeto criado, aguardando vídeos',
        UPLOADING: 'Recebendo vídeos',
        ANALYZING: 'Analisando cenas e falas',
        SHOWRUNNING: 'Criando narrativa do reality',
        NARRATING: 'Gerando narração',
        EDITING: 'Editando episódio',
        EXPORTING: 'Preparando vídeos finais',
        COMPLETED: 'Pronto!',
        FAILED: 'Erro no processamento'
      };

      const emoji = statusEmojis[project.status] || '⏳';
      const statusText = statusMessages[project.status] || project.status;
      const timeText = estimatedTimeRemaining > 0 
        ? `\n⏱️ Tempo estimado: ${Math.ceil(estimatedTimeRemaining / 60)} min`
        : '';

      await this.client.sendText(
        phone,
        `${emoji} *Status do Projeto*\n\n` +
        `📊 ${statusText}\n` +
        `📈 Progresso: ${progress}%${timeText}\n\n` +
        `📹 Vídeos: ${project._count.videos}\n` +
        `🎬 Cenas: ${project._count.scenes}\n` +
        `📺 Exports: ${project._count.exports}`
      );

    } catch (error) {
      logger.error('Error sending status:', error);
      await this.client.sendText(
        phone,
        'Erro ao buscar status. Tente novamente!'
      );
    }
  }

  async sendHelp(phone) {
    await this.client.sendText(
      phone,
      '🤖 *Reality Maker AI - Comandos*\n\n' +
      '*criar reality* - Iniciar novo projeto\n' +
      '*status* - Ver status do projeto\n' +
      '*pronto* - Finalizar upload e processar\n' +
      '*cancelar* - Cancelar projeto atual\n' +
      '*ajuda* - Ver esta mensagem\n\n' +
      '📹 *Como usar:*\n' +
      '1. Digite "criar reality"\n' +
      '2. Envie seus vídeos\n' +
      '3. Digite "pronto"\n' +
      '4. Aguarde o processamento\n' +
      '5. Receba seu reality show!'
    );
  }

  async cancelProject(phone) {
    const session = await this.getSession(phone);
    
    if (session && session.projectId) {
      await this.deleteSession(phone);
      await this.client.sendText(
        phone,
        '❌ Projeto cancelado.\n\n' +
        'Digite "criar reality" para começar um novo!'
      );
    } else {
      await this.client.sendText(
        phone,
        'Você não tem projetos ativos para cancelar.'
      );
    }
  }

  async handleNaturalConversation(phone, text, chatId) {
    // Aqui pode integrar com LLM para respostas contextuais
    // Por enquanto, respostas simples
    
    if (text.includes('oi') || text.includes('olá') || text.includes('ola')) {
      await this.client.sendText(
        chatId,
        'Oi! 👋\n\n' +
        'Eu transformo vídeos em reality shows editados!\n\n' +
        'Digite *"criar reality"* para começar.'
      );
      return;
    }

    await this.client.sendText(
      chatId,
      'Não entendi 🤔\n\n' +
      'Digite *"ajuda"* para ver os comandos disponíveis.'
    );
  }

  async monitorProgress(phone, projectId) {
    const checkInterval = setInterval(async () => {
      try {
        const response = await axios.get(
          `${this.apiUrl}/api/projects/${projectId}`
        );

        const project = response.data;

        if (project.status === 'COMPLETED') {
          clearInterval(checkInterval);
          await this.notifyCompletion(phone, project);
        } else if (project.status === 'FAILED') {
          clearInterval(checkInterval);
          await this.notifyFailure(phone, project);
        }
      } catch (error) {
        logger.error('Error monitoring progress:', error);
      }
    }, 30000); // Check a cada 30 segundos

    // Limpar após 30 minutos
    setTimeout(() => clearInterval(checkInterval), 1800000);
  }

  async notifyCompletion(phone, project) {
    try {
      const exports = project.exports || [];
      const episode = exports.find(e => e.type === 'EPISODE');
      const shorts = exports.filter(e => e.type.startsWith('SHORT_'));

      let message = '🎉 *Seu Reality Show está Pronto!*\n\n';

      if (episode) {
        message += `📺 *Episódio Completo*\n`;
        message += `${this.apiUrl}/exports/${episode.filename}\n\n`;
      }

      if (shorts.length > 0) {
        message += `⚡ *Shorts*\n`;
        shorts.forEach(short => {
          message += `• ${short.type}: ${this.apiUrl}/exports/${short.filename}\n`;
        });
      }

      message += '\n💡 Quer fazer outro? Digite "criar reality"!';

      await this.client.sendText(phone, message);

      // Limpar sessão
      await this.deleteSession(phone);

    } catch (error) {
      logger.error('Error notifying completion:', error);
    }
  }

  async notifyFailure(phone, project) {
    await this.client.sendText(
      phone,
      '❌ *Erro no Processamento*\n\n' +
      'Algo deu errado ao criar seu reality show.\n\n' +
      'Possíveis causas:\n' +
      '• Vídeos muito grandes\n' +
      '• Formato incompatível\n' +
      '• Erro no servidor\n\n' +
      'Tente novamente com vídeos menores!'
    );

    await this.deleteSession(phone);
  }

  // Helper methods

  normalizePhone(phone) {
    return phone.replace(/\D/g, '');
  }

  isStartCommand(text) {
    const commands = [
      'criar reality',
      'novo projeto',
      'começar',
      'iniciar',
      'start',
      'novo'
    ];
    return commands.some(cmd => text.includes(cmd));
  }

  async createProject(phone) {
    const response = await axios.post(`${this.apiUrl}/api/projects`, {
      phone,
      title: `Reality ${new Date().toLocaleDateString('pt-BR')}`
    });
    return response.data;
  }

  async uploadVideoToBackend(projectId, filePath, filename) {
    const form = new FormData();
    form.append('video', await fs.readFile(filePath), filename);
    form.append('projectId', projectId);

    await axios.post(`${this.apiUrl}/api/videos/upload`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
  }

  async getSession(phone) {
    const data = await redis.get(`session:${phone}`);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(phone, data) {
    const current = await this.getSession(phone) || {};
    const updated = { ...current, ...data };
    await redis.set(`session:${phone}`, JSON.stringify(updated), 'EX', 86400);
  }

  async deleteSession(phone) {
    await redis.del(`session:${phone}`);
  }
}

// Inicializar bot
const bot = new RealityMakerBot();

bot.initialize().catch(error => {
  logger.error('Failed to initialize bot:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down bot...');
  if (bot.client) {
    await bot.client.close();
  }
  process.exit(0);
});

export default bot;
