# Multi-stage build para Render
# Stage 1: Build (frontend Vite + backend bundle)
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar todas as dependências (dev + prod)
RUN npm ci

# Copiar source
COPY . .

# Build frontend (Vite)
RUN npm run build

# Stage 2: Production runtime (apenas dependências de produção)
FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar build gerado do stage anterior
COPY --from=builder /app/dist ./dist

# Copiar configuração de ambiente padrão
COPY .env.example .env.local

# Expor porta
EXPOSE 3000

# Variáveis de ambiente críticas
ENV NODE_ENV=production

# Rodar aplicação
CMD ["npm", "start"]
