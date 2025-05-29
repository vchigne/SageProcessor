# Multi-stage build para optimizar el tamaño de la imagen
FROM node:18-alpine AS base

# Instalar dependencias necesarias
RUN apk add --no-cache libc6-compat python3 py3-pip make g++

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Stage para dependencias
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Stage para build
FROM base AS builder
COPY . .
RUN npm ci
RUN npm run build

# Stage para producción
FROM node:18-alpine AS runner
WORKDIR /app

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Instalar dependencias de sistema para Python
RUN apk add --no-cache python3 py3-pip postgresql-client curl

# Copiar dependencias de Python
COPY pyproject.toml ./
RUN pip3 install --no-cache-dir -e .

# Copiar archivos necesarios desde builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copiar scripts de Python
COPY --chown=nextjs:nodejs sage/ ./sage/
COPY --chown=nextjs:nodejs *.py ./
COPY --chown=nextjs:nodejs deploy_scripts/ ./deploy_scripts/

# Copiar script de inicio
COPY --chown=nextjs:nodejs start.sh ./
RUN chmod +x start.sh

# Crear directorios necesarios
RUN mkdir -p executions logs uploads backups tmp
RUN chown -R nextjs:nodejs executions logs uploads backups tmp

USER nextjs

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Usar el script de inicio personalizado
CMD ["./start.sh"]