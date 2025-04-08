import os

# Contenido actualizado del Dockerfile
dockerfile_updated = """FROM node:18-alpine AS base

# Instalar dependencias necesarias para Python y compilación
RUN apk add --no-cache python3 py3-pip postgresql-client supervisor bash curl

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY pyproject.toml ./

# Instalar dependencias de Node.js
RUN npm ci

# Copiar todos los archivos de código fuente
COPY . .

# Compilar la aplicación Next.js
RUN npm run build

# Instalar dependencias de Python
RUN pip3 install --no-cache-dir -e .

# Copiar archivo de configuración de supervisord
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Crear directorios necesarios
RUN mkdir -p /app/logs /app/data

# Exponer puerto para la aplicación Next.js
EXPOSE 5000

# Definir la entrada del contenedor como supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
"""

# Escribir el contenido actualizado al archivo
with open('docker/Dockerfile', 'w') as f:
    f.write(dockerfile_updated)

print("Dockerfile actualizado exitosamente")