FROM node:20-alpine AS next-builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json ./
COPY . .
RUN npm run build

FROM python:3.11-slim AS backend-builder
WORKDIR /app
COPY pyproject.toml *.py ./
COPY sage ./sage
COPY sage_daemon ./sage_daemon
COPY sage_daemon2 ./sage_daemon2
COPY utils ./utils
COPY scripts ./scripts

FROM python:3.11-slim
WORKDIR /app
COPY --from=next-builder /app/.next ./.next
COPY --from=next-builder /app/public ./public
COPY --from=next-builder /app/node_modules ./node_modules
COPY --from=next-builder /app/package.json ./package.json
COPY --from=backend-builder /app /app
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
EXPOSE 5000
CMD ["/usr/bin/supervisord"]
