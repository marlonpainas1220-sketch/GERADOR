# 🚀 Guia de Instalação Rápida - Reality Maker AI

## Pré-requisitos

✅ Docker instalado
✅ Docker Compose instalado
✅ 8GB+ RAM disponível
✅ 20GB+ espaço em disco

## Instalação em 3 Passos

### 1️⃣ Clone o Repositório

```bash
git clone https://github.com/seu-usuario/reality-maker-ai.git
cd reality-maker-ai
```

### 2️⃣ Execute o Setup

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

O script vai:
- ✅ Criar arquivos de configuração
- ✅ Construir imagens Docker
- ✅ Iniciar banco de dados
- ✅ Executar migrações
- ✅ Baixar modelo de IA (LLaMA 3.2 3B)
- ✅ Iniciar todos os serviços

**Tempo estimado**: 10-15 minutos (depende da velocidade da internet)

### 3️⃣ Conecte o WhatsApp

1. Abra http://localhost:3000/admin/whatsapp
2. Escaneie o QR Code com seu WhatsApp
3. Aguarde a confirmação de conexão

## Primeiro Uso

### Via WhatsApp

1. Envie uma mensagem para o número que você conectou
2. Digite: `criar reality`
3. Envie seus vídeos
4. Digite: `pronto`
5. Aguarde 5-10 minutos
6. Receba os links dos vídeos editados!

### Via Interface Web

1. Acesse http://localhost:3000
2. Clique em "Novo Projeto"
3. Faça upload dos vídeos
4. Aguarde o processamento
5. Baixe os resultados!

## Comandos Úteis

```bash
# Ver status dos serviços
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Reiniciar tudo
docker-compose restart

# Parar tudo
docker-compose down

# Limpar tudo (CUIDADO: apaga dados)
docker-compose down -v
```

## Troubleshooting Rápido

### ❌ Bot WhatsApp não conecta

```bash
docker-compose restart whatsapp-bot
docker-compose logs -f whatsapp-bot
```

### ❌ Processamento não inicia

```bash
docker-compose restart worker
docker-compose logs -f worker
```

### ❌ Erro de memória

Edite `docker-compose.yml` e aumente a memória:

```yaml
services:
  backend:
    environment:
      NODE_OPTIONS: --max-old-space-size=4096
```

## Estrutura de Portas

- **3000**: Frontend (Interface Web)
- **3001**: Backend API
- **3002**: WhatsApp Bot Status
- **5432**: PostgreSQL
- **6379**: Redis
- **6333**: Qdrant (Vector DB)
- **11434**: Ollama (LLM)

## Próximos Passos

1. ✅ Teste com vídeos curtos primeiro (2-5 minutos)
2. ✅ Experimente diferentes estilos de narração
3. ✅ Explore a interface web
4. ✅ Compartilhe seus resultados!

## Ajuda

- 📖 Documentação completa: `README.md`
- 🐛 Problemas: [GitHub Issues]
- 💬 Discussões: [GitHub Discussions]

---

**Bom uso! 🎬**
