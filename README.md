# 🎬 Reality Maker AI

**Transforme vídeos brutos em reality shows editados com IA + Bot WhatsApp**

Reality Maker AI é uma plataforma 100% gratuita e open source que usa inteligência artificial para criar reality shows profissionais a partir de vídeos caseiros. Interaja via WhatsApp, envie vídeos e receba episódios editados com narrativa, narração automática e shorts virais.

---

## ✨ Features

### 🤖 Bot WhatsApp Conversacional
- Interface via WhatsApp (sem necessidade de app)
- Envio de vídeos direto pelo chat
- Atualizações de status em tempo real
- Comandos naturais em português

### 🎭 Showrunner AI
- Analisa vídeos e identifica conflitos
- Cria estrutura narrativa de 3 atos
- Identifica personagens e arcos emocionais
- Maximiza retenção e engajamento

### 🎙️ Narração Automática
- Narrador IA em português
- Múltiplos estilos (dramático, irônico, documental)
- Timing e pausas dramáticas
- TTS 100% gratuito

### ⚡ Geração Automática de Shorts
- Identifica melhores momentos
- Formatos 15s, 30s, 60s
- Vertical (9:16) para TikTok/Reels
- Títulos e hooks virais

### 🎬 Edição Inteligente
- Corta cenas automaticamente
- Monta timeline narrativa
- Ducking de áudio
- Legendas automáticas

---

## 🚀 Quick Start

### Pré-requisitos

- Docker & Docker Compose
- 8GB+ RAM
- 20GB+ espaço em disco
- (Opcional) GPU NVIDIA para processamento mais rápido

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/reality-maker-ai.git
cd reality-maker-ai

# 2. Execute o script de setup
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. Aguarde o setup completar (5-10 minutos)
# O script vai:
#   - Instalar dependências
#   - Criar banco de dados
#   - Baixar modelos de IA
#   - Iniciar todos os serviços
```

### Primeiros Passos

1. **Acesse a interface web**: `http://localhost:3000`

2. **Conecte o WhatsApp**:
   - Vá para `http://localhost:3000/admin/whatsapp`
   - Escaneie o QR Code com seu WhatsApp
   - Aguarde conexão

3. **Crie seu primeiro reality**:
   - Envie `criar reality` para o bot no WhatsApp
   - Envie seus vídeos
   - Digite `pronto` quando terminar
   - Aguarde 5-10 minutos
   - Receba links dos vídeos prontos!

---

## 📖 Como Usar

### Via WhatsApp

```
Você: criar reality

Bot: 🎬 Novo Projeto Iniciado!
     Perfeito! Agora me envie os vídeos...

[Envie seus vídeos]

Você: pronto

Bot: 🎬 Perfeito!
     Vou analisar os vídeos e criar a narrativa.
     Te aviso quando ficar pronto! 🚀

[5-10 minutos depois]

Bot: 🎉 Seu Reality Show está Pronto!
     📺 Episódio Completo: [link]
     ⚡ Shorts: [link]
```

### Comandos WhatsApp

- `criar reality` - Inicia novo projeto
- `status` - Verifica status do processamento
- `pronto` - Finaliza upload e processa
- `cancelar` - Cancela projeto atual
- `ajuda` - Lista comandos

### Via Interface Web

1. **Dashboard**: Visualize todos os seus projetos
2. **Upload**: Envie vídeos via interface
3. **Narrativa**: Veja e edite a estrutura do episódio
4. **Preview**: Assista o resultado antes de exportar
5. **Export**: Baixe episódios e shorts

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     USUÁRIO (WhatsApp)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   BOT WHATSAPP (WPPConnect)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   ANÁLISE    │ │  SHOWRUNNER  │ │   EDIÇÃO     │
│   (Whisper   │ │  (LLM Local) │ │  (FFmpeg)    │
│ SceneDetect) │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Stack Técnica

**Backend**
- Node.js 20+ (Express)
- PostgreSQL 15 (dados)
- Redis (filas)
- BullMQ (job processing)
- Prisma ORM

**IA & ML** (100% Open Source)
- **LLM**: LLaMA 3.2 3B (via Ollama)
- **Transcrição**: Whisper Large V3
- **TTS**: Coqui TTS
- **Detecção de Cenas**: PySceneDetect
- **Diarização**: Pyannote Audio

**Processamento**
- FFmpeg (vídeo/áudio)
- Python 3.11 (ML pipelines)

**WhatsApp**
- WPPConnect (automação WhatsApp Web)

**Frontend** (opcional)
- Next.js 14
- Tailwind CSS
- shadcn/ui

---

## 📁 Estrutura do Projeto

```
reality-maker-ai/
├── backend/
│   ├── src/
│   │   ├── api/           # REST API
│   │   ├── services/      # Serviços (IA, vídeo, áudio)
│   │   ├── workers/       # Processamento assíncrono
│   │   ├── utils/         # Utilitários
│   │   └── index.js       # Entry point
│   ├── prisma/            # Schema do banco
│   ├── storage/           # Arquivos (vídeos, exports)
│   └── package.json
│
├── frontend/
│   ├── app/               # Next.js App Router
│   ├── components/        # React components
│   └── package.json
│
├── scripts/
│   └── setup.sh           # Script de instalação
│
├── docker-compose.yml     # Orquestração de serviços
└── README.md
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Edite `backend/.env`:

```bash
# Database
DATABASE_URL=postgresql://reality:reality123@localhost:5432/realitymaker

# LLM
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Processamento
MAX_VIDEO_DURATION=1800  # 30 minutos
MAX_VIDEO_SIZE_MB=500
MAX_VIDEOS_PER_PROJECT=10

# TTS
TTS_VOICE_ID=default

# Whisper
WHISPER_MODEL=base  # base, small, medium, large
```

### Modelos Alternativos

**LLM**:
- `llama3.2:3b` (padrão, 2GB VRAM)
- `mistral:7b` (mais inteligente, 4GB VRAM)
- `mixtral:8x7b` (melhor qualidade, 26GB VRAM)

**Whisper**:
- `base` (padrão, rápido, ~1GB RAM)
- `small` (melhor qualidade, ~2GB RAM)
- `large` (máxima precisão, ~10GB RAM)

---

## 🎯 Pipeline de Processamento

1. **Upload** → Usuário envia vídeos
2. **Análise** → Detecção de cenas + transcrição
3. **Showrunner** → IA cria estrutura narrativa
4. **Narração** → Geração de texto e voz
5. **Edição** → Montagem automática
6. **Export** → Episódio + shorts + teasers

**Tempo médio**: 5-10 minutos para 10 minutos de vídeo

---

## 🔧 Comandos Úteis

```bash
# Iniciar todos os serviços
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f

# Parar todos os serviços
docker-compose down

# Reiniciar um serviço específico
docker-compose restart backend

# Acessar shell do backend
docker exec -it reality-backend sh

# Executar migrações do banco
cd backend && npx prisma migrate dev

# Ver status dos workers
docker-compose logs -f worker

# Limpar tudo (CUIDADO: apaga dados)
docker-compose down -v
```

---

## 📊 Monitoramento

### Logs

```bash
# Backend
docker-compose logs -f backend

# Workers
docker-compose logs -f worker

# WhatsApp Bot
docker-compose logs -f whatsapp-bot

# Banco de dados
docker-compose logs -f postgres
```

### Status dos Serviços

```bash
docker-compose ps
```

### Métricas

- Projetos processados: `http://localhost:3001/api/projects`
- Status das filas: Redis Commander (porta 8081)
- Banco de dados: Prisma Studio - `npx prisma studio`

---

## 🐛 Troubleshooting

### Bot WhatsApp não conecta

```bash
# Verificar logs
docker-compose logs -f whatsapp-bot

# Limpar sessão antiga
docker-compose down
rm -rf backend/.wwebjs_auth
docker-compose up -d
```

### Processamento travado

```bash
# Verificar filas
docker exec -it reality-redis redis-cli
> KEYS *

# Limpar filas
> FLUSHALL

# Reiniciar workers
docker-compose restart worker
```

### Erro de memória

```bash
# Aumentar limite do Node.js
# Em docker-compose.yml, adicione:
environment:
  NODE_OPTIONS: --max-old-space-size=4096
```

### Modelo LLM não encontrado

```bash
# Baixar modelo manualmente
docker exec -it reality-ollama ollama pull llama3.2:3b

# Listar modelos disponíveis
docker exec -it reality-ollama ollama list
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📝 Roadmap

### V1.0 (MVP) ✅
- [x] Bot WhatsApp funcional
- [x] Análise automática de vídeos
- [x] Showrunner AI
- [x] Narração básica
- [x] Export de episódio

### V2.0 (Interface Web)
- [ ] Dashboard completo
- [ ] Editor visual de narrativa
- [ ] Preview em tempo real
- [ ] Múltiplos estilos de narração

### V3.0 (Edição Avançada)
- [ ] Timeline editável
- [ ] Ajuste manual de cortes
- [ ] Múltiplas vozes TTS
- [ ] Efeitos e transições

### V4.0 (Viralização)
- [ ] Geração automática de thumbnails
- [ ] A/B testing de títulos
- [ ] Integração com YouTube/TikTok
- [ ] Analytics de performance

---

## 📄 Licença

Este projeto é open source e está disponível sob a licença MIT.

---

## 🙏 Agradecimentos

- **OpenAI Whisper** - Transcrição open source
- **Meta LLaMA** - LLM open source
- **Coqui TTS** - Text-to-Speech
- **WPPConnect** - Automação WhatsApp
- **FFmpeg** - Processamento de vídeo

---

## 📧 Contato

- Issues: [GitHub Issues](https://github.com/seu-usuario/reality-maker-ai/issues)
- Discussões: [GitHub Discussions](https://github.com/seu-usuario/reality-maker-ai/discussions)

---

**Feito com ❤️ e IA open source**

🎬 Transforme seus vídeos em reality shows - 100% gratuito, 100% open source!
