import os

# Contenido actualizado del archivo docker-compose.yml
docker_compose_updated = """version: '3.8'

services:
  sage:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    container_name: sage-app
    restart: unless-stopped
    ports:
      - "5000:5000"
    depends_on:
      - db
    environment:
      - DATABASE_URL=${DATABASE_URL:-postgres://postgres:postgres@db:5432/sage}
      - NODE_ENV=${NODE_ENV:-production}
      # Variables opcionales de correo electrónico
      - SMTP_SERVER=${SMTP_SERVER:-}
      - SMTP_PORT=${SMTP_PORT:-}
      - SMTP_USER=${SMTP_USER:-}
      - SMTP_PASSWORD=${SMTP_PASSWORD:-}
      - SMTP_FROM=${SMTP_FROM:-}
    networks:
      - sage-network
    volumes:
      - sage-logs:/app/logs
      - sage-data:/app/data

  db:
    image: postgres:14-alpine
    container_name: sage-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
      - POSTGRES_DB=${POSTGRES_DB:-sage}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - sage-network

networks:
  sage-network:
    driver: bridge

volumes:
  postgres-data:
    driver: local
  sage-logs:
    driver: local
  sage-data:
    driver: local
"""

# Escribir el contenido actualizado al archivo
with open('docker/docker-compose.yml', 'w') as f:
    f.write(docker_compose_updated)

print("docker-compose.yml actualizado exitosamente")