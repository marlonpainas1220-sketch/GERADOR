FROM node:20-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Instalar dependências Python para processamento de vídeo
RUN pip3 install --no-cache-dir \
    openai-whisper \
    pyannote.audio \
    librosa \
    opencv-python-headless \
    scenedetect[opencv] \
    pydub \
    torch --index-url https://download.pytorch.org/whl/cpu

# Definir diretório de trabalho
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências Node
RUN npm install

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Criar diretórios necessários
RUN mkdir -p storage/uploads storage/processed storage/exports storage/temp .wwebjs_auth

# Variáveis de ambiente para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

EXPOSE 3001

CMD ["npm", "start"]
