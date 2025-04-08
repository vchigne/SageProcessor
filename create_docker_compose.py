import os

# Asegurarse de que el directorio docker existe
os.makedirs('docker', exist_ok=True)

# Contenido del archivo docker-compose.yml
docker_compose_content = """version: '3.8'

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
      - NODE_ENV=production
    networks:
      - sage-network

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
    ports:
      - "5432:5432"
    networks:
      - sage-network

networks:
  sage-network:
    driver: bridge

volumes:
  postgres-data:
"""

# Escribir el contenido al archivo
with open('docker/docker-compose.yml', 'w') as f:
    f.write(docker_compose_content)

print("docker-compose.yml creado exitosamente en docker/docker-compose.yml")