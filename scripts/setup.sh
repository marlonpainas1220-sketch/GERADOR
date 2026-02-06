#!/bin/bash

set -e

echo "🎬 Reality Maker AI - Setup Script"
echo "=================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para printar com cor
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Verificar Docker
echo "1. Verificando Docker..."
if ! command -v docker &> /dev/null; then
    print_error "Docker não encontrado. Por favor, instale o Docker primeiro."
    exit 1
fi
print_status "Docker encontrado"

# Verificar Docker Compose
echo "2. Verificando Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose não encontrado. Por favor, instale o Docker Compose primeiro."
    exit 1
fi
print_status "Docker Compose encontrado"

# Criar .env se não existir
echo "3. Configurando variáveis de ambiente..."
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    print_status "Arquivo .env criado"
else
    print_warning "Arquivo .env já existe"
fi

# Criar diretórios necessários
echo "4. Criando diretórios..."
mkdir -p backend/storage/uploads
mkdir -p backend/storage/processed
mkdir -p backend/storage/exports
mkdir -p backend/storage/temp
mkdir -p backend/models
print_status "Diretórios criados"

# Build das imagens Docker
echo "5. Construindo imagens Docker..."
docker-compose build
print_status "Imagens construídas"

# Iniciar serviços de infraestrutura
echo "6. Iniciando serviços de infraestrutura..."
docker-compose up -d postgres redis qdrant ollama
print_status "Serviços iniciados"

# Aguardar serviços ficarem prontos
echo "7. Aguardando serviços ficarem prontos..."
sleep 10
print_status "Serviços prontos"

# Executar migrações do banco
echo "8. Executando migrações do banco de dados..."
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
cd ..
print_status "Banco de dados configurado"

# Baixar modelo Ollama
echo "9. Baixando modelo LLM (isso pode demorar)..."
docker exec reality-ollama ollama pull llama3.2:3b
print_status "Modelo LLM baixado"

# Iniciar todos os serviços
echo "10. Iniciando todos os serviços..."
docker-compose up -d
print_status "Todos os serviços iniciados"

echo ""
echo "=================================="
echo "✅ Setup concluído com sucesso!"
echo ""
echo "📝 Próximos passos:"
echo "   1. Acesse http://localhost:3000 para a interface web"
echo "   2. Acesse http://localhost:3000/admin/whatsapp para conectar o WhatsApp"
echo "   3. Escaneie o QR Code com seu WhatsApp"
echo "   4. Envie 'criar reality' para o bot no WhatsApp"
echo ""
echo "📊 Monitoramento:"
echo "   - Logs: docker-compose logs -f"
echo "   - Status: docker-compose ps"
echo ""
echo "🛑 Para parar: docker-compose down"
echo "=================================="
