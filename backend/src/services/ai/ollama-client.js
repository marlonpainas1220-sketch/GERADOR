import axios from 'axios';
import logger from '../../utils/logger.js';

/**
 * Cliente para interagir com Ollama (LLM local)
 */
class OllamaClient {
  constructor() {
    this.baseURL = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama3.2:3b';
  }

  /**
   * Gera resposta usando o LLM
   */
  async generate(prompt, options = {}) {
    try {
      logger.debug(`[Ollama] Generating with model ${this.model}`);

      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
            num_predict: options.max_tokens || 4096,
            ...options
          }
        },
        {
          timeout: 300000 // 5 minutos
        }
      );

      return response.data.response;
    } catch (error) {
      logger.error('[Ollama] Generation error:', error.message);
      throw new Error(`Ollama generation failed: ${error.message}`);
    }
  }

  /**
   * Gera com sistema de mensagens (chat)
   */
  async chat(messages, options = {}) {
    try {
      logger.debug(`[Ollama] Chat with ${messages.length} messages`);

      const response = await axios.post(
        `${this.baseURL}/api/chat`,
        {
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            ...options
          }
        },
        {
          timeout: 300000
        }
      );

      return response.data.message.content;
    } catch (error) {
      logger.error('[Ollama] Chat error:', error.message);
      throw new Error(`Ollama chat failed: ${error.message}`);
    }
  }

  /**
   * Gera JSON estruturado
   */
  async generateJSON(systemPrompt, userPrompt, options = {}) {
    try {
      const fullPrompt = `${systemPrompt}

${userPrompt}

CRITICAL: Return ONLY valid JSON. No markdown, no explanation, no code blocks. Just the raw JSON object.`;

      const response = await this.generate(fullPrompt, {
        ...options,
        temperature: 0.3 // Menor temperatura para mais consistência
      });

      // Tentar extrair JSON da resposta
      let jsonText = response.trim();

      // Remover markdown code blocks se existirem
      jsonText = jsonText.replace(/```json\n?/g, '');
      jsonText = jsonText.replace(/```\n?/g, '');
      jsonText = jsonText.trim();

      // Parse JSON
      const parsed = JSON.parse(jsonText);

      return parsed;
    } catch (error) {
      logger.error('[Ollama] JSON generation error:', error.message);
      logger.error('[Ollama] Raw response:', error.response?.data);
      throw new Error(`Failed to generate valid JSON: ${error.message}`);
    }
  }

  /**
   * Verifica se Ollama está disponível
   */
  async isAvailable() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Lista modelos disponíveis
   */
  async listModels() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      logger.error('[Ollama] Failed to list models:', error.message);
      return [];
    }
  }

  /**
   * Puxa um modelo se não estiver disponível
   */
  async pullModel(modelName) {
    try {
      logger.info(`[Ollama] Pulling model ${modelName}...`);

      const response = await axios.post(
        `${this.baseURL}/api/pull`,
        {
          name: modelName,
          stream: false
        },
        {
          timeout: 600000 // 10 minutos
        }
      );

      logger.info(`[Ollama] Model ${modelName} pulled successfully`);
      return response.data;
    } catch (error) {
      logger.error('[Ollama] Failed to pull model:', error.message);
      throw error;
    }
  }

  /**
   * Garante que o modelo está disponível
   */
  async ensureModel() {
    const models = await this.listModels();
    const modelExists = models.some(m => m.name === this.model);

    if (!modelExists) {
      logger.warn(`[Ollama] Model ${this.model} not found, pulling...`);
      await this.pullModel(this.model);
    }

    return true;
  }
}

// Singleton
const ollamaClient = new OllamaClient();

export default ollamaClient;
export { OllamaClient };
