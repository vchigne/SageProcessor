FROM python:3.11-slim

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Configurar directorio de trabajo
WORKDIR /app

# Copiar los archivos del servidor
COPY duckdb_server.py .

# Instalar dependencias de Python
RUN pip install --no-cache-dir duckdb flask flask-cors

# Variables de entorno
ENV DUCKDB_PORT=1294
ENV DUCKDB_SERVER_KEY=""
ENV DUCKDB_DATA_DIR=/data

# Crear directorio de datos
RUN mkdir -p /data

# Exponer el puerto
EXPOSE 1294

# Comando para iniciar el servidor
CMD ["python", "duckdb_server.py"]