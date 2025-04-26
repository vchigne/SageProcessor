#!/bin/bash

# Script de despliegue mejorado para DuckDB con arreglos VNC
# Este script instala Docker, configura y despliega un servidor DuckDB con acceso VNC
# Uso: ./deploy-duckdb-with-vnc-fix.sh [puerto] [api_key]

set -e

# --- Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sin color

# --- Función para buscar el siguiente puerto disponible
find_free_port() {
    local port=$1
    while ss -ltn | awk '{print $4}' | grep -q ":$port$"; do
        port=$((port+1))
    done
    echo "$port"
}

# --- Función para mensaje de error y salida
error_exit() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
    exit 1
}

# --- Función para mensaje de información
info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# --- Función para mensaje de éxito
success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

# --- Función para mensaje de advertencia
warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# --- Verificar que el script se ejecuta como usuario con permisos sudo
if [ "$(id -u)" -eq 0 ]; then
    error_exit "Este script no debe ejecutarse como root directamente. Use un usuario con permisos sudo."
fi

# --- Configurar puerto y clave API
if [ -z "$1" ]; then
    # Si no se especifica puerto, buscar uno disponible
    DDB_PORT=$(find_free_port 8000)
    info "Usando puerto disponible: $DDB_PORT"
else
    DDB_PORT=$1
    info "Usando puerto especificado: $DDB_PORT"
fi

if [ -z "$2" ]; then
    API_KEY="duckdb"
    warning "No se especificó clave API, usando valor predeterminado: 'duckdb'"
else
    API_KEY="$2"
    info "Usando clave API configurada"
fi

# --- Verificar si Docker ya está instalado
if ! command -v docker &> /dev/null; then
    info "Docker no está instalado. Instalando..."
    
    # Instalar dependencias
    sudo apt-get update
    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common

    # Agregar clave GPG de Docker
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

    # Agregar repositorio Docker
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

    # Instalar Docker
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io

    # Agregar usuario actual al grupo docker
    sudo usermod -aG docker $USER
    
    success "Docker instalado correctamente"
else
    info "Docker ya está instalado"
fi

# --- Crear directorios necesarios
info "Creando directorios para datos y configuración..."
mkdir -p ~/duckdb_data
chmod 755 ~/duckdb_data

# --- Verificar si existe un contenedor previo
info "Verificando si existe un contenedor previo..."
CONTAINER_ID=$(docker ps -a -q -f name=duckdb-server)
if [ ! -z "$CONTAINER_ID" ]; then
    warning "Se encontró un contenedor existente. Deteniéndolo y eliminándolo..."
    docker stop $CONTAINER_ID || true
    docker rm $CONTAINER_ID || true
fi

# --- Crear imagen Docker
info "Construyendo imagen Docker para DuckDB Server..."
cat > Dockerfile << 'EOL'
# Imagen base
FROM ubuntu:20.04 as base
ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    openssh-server \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Instalar DuckDB y dependencias
FROM base as duckdb
RUN pip install --no-cache-dir duckdb flask flask-cors requests pymysql sqlalchemy pymssql pyodbc psycopg2-binary pandas tabulate

# Instalar entorno gráfico
FROM duckdb as desktop
RUN apt-get update && apt-get install -y \
    xfce4 \
    xfce4-goodies \
    tightvncserver \
    x11vnc \
    xvfb \
    supervisor \
    net-tools \
    wget \
    iptables \
    git \
    && rm -rf /var/lib/apt/lists/*

# Construir imagen final
FROM desktop as stage-3
# Abrir puertos
RUN iptables -A INPUT -p tcp --dport 5901 -j ACCEPT && \
    iptables -A INPUT -p tcp --dport 6080 -j ACCEPT && \
    iptables -A INPUT -p tcp --dport 2222 -j ACCEPT

WORKDIR /app
COPY duckdb_server.py .
COPY start_vnc.sh .
COPY fix_vnc.sh /fix_vnc.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Instalar noVNC
RUN mkdir -p /opt && \
    cd /opt && \
    curl -L -o novnc.tar.gz https://github.com/novnc/noVNC/archive/v1.3.0.tar.gz && \
    tar xzvf novnc.tar.gz && \
    mv noVNC-1.3.0 novnc && \
    rm novnc.tar.gz && \
    cd novnc && \
    ln -s vnc.html index.html

# Configurar VNC
RUN mkdir -p /root/.vnc
RUN echo "duckdb" | vncpasswd -f > /root/.vnc/passwd && \
    chmod 600 /root/.vnc/passwd

# Configurar SSH
RUN echo 'root:duckdb' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/^#ListenAddress 0.0.0.0/ListenAddress 0.0.0.0/' /etc/ssh/sshd_config && \
    sed -i 's/^#Port 22/Port 2222/' /etc/ssh/sshd_config && \
    mkdir -p /var/run/sshd

# Usar nuestros scripts mejorados para VNC
COPY start_vnc.sh /app/start_vnc.sh
RUN chmod +x /app/start_vnc.sh

# Exponer puertos
EXPOSE 5901 6080 2222

# Comando para iniciar todos los servicios
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
EOL

# Crear archivo de configuración de supervisor
cat > supervisord.conf << 'EOL'
[supervisord]
nodaemon=true
user=root
logfile=/var/log/supervisor/supervisord.log
logfile_maxbytes=50MB
logfile_backups=10

[program:sshd]
command=/usr/sbin/sshd -D
autorestart=true
stderr_logfile=/var/log/sshd.err.log
stdout_logfile=/var/log/sshd.out.log

[program:duckdb-server]
command=python3 /app/duckdb_server.py --port %(ENV_DDB_PORT)s --api-key %(ENV_API_KEY)s
autorestart=true
stderr_logfile=/var/log/duckdb-server.err.log
stdout_logfile=/var/log/duckdb-server.out.log

[program:vnc]
command=/app/start_vnc.sh %(ENV_API_KEY)s
autorestart=true
startretries=3
autostart=true
startsecs=10
stderr_logfile=/var/log/vnc.err.log
stdout_logfile=/var/log/vnc.out.log
EOL

info "Construyendo imagen Docker..."
docker build -t duckdb-server . || error_exit "Error al construir imagen Docker"
success "Imagen Docker construida exitosamente (100%)!"

# --- Iniciar contenedor
info "Iniciando contenedor DuckDB con soporte para VNC..."
docker run -d \
    --name duckdb-server \
    -p $DDB_PORT:5000 \
    -p 5901:5901 \
    -p 6080:6080 \
    -p 2222:2222 \
    -v ~/duckdb_data:/data \
    -v $(pwd)/fix_vnc.sh:/fix_vnc.sh \
    -e DDB_PORT=5000 \
    -e API_KEY="$API_KEY" \
    duckdb-server || error_exit "Error al iniciar contenedor"

# --- Verificar estado del contenedor
info "Verificando estado del contenedor..."
sleep 3
CONTAINER_RUNNING=$(docker ps -q -f name=duckdb-server)
if [ -z "$CONTAINER_RUNNING" ]; then
    error_exit "El contenedor se detuvo inmediatamente. Revise los logs con: docker logs duckdb-server"
fi
success "¡Contenedor DuckDB iniciado correctamente!"

# --- Ya no es necesario ejecutar script de arreglo VNC, ya que start_vnc.sh usa la implementación mejorada
info "VNC configurado correctamente durante el inicio - no es necesario repararlo"

# --- Verificar que el servidor está en ejecución
info "Verificando que el servidor DuckDB está en ejecución..."
sleep 2
HEALTH_CHECK=$(curl -s http://localhost:$DDB_PORT/health)
if [ -z "$HEALTH_CHECK" ]; then
    error_exit "El servidor DuckDB no responde. Revise los logs con: docker logs duckdb-server"
fi
success "¡Servidor DuckDB respondió: $HEALTH_CHECK!"

# --- Crear scripts de administración
info "Creando scripts de administración..."
cat > restart_duckdb.sh << EOL
#!/bin/bash
docker restart duckdb-server
echo "Servidor DuckDB reiniciado"
EOL

cat > stop_duckdb.sh << EOL
#!/bin/bash
docker stop duckdb-server
echo "Servidor DuckDB detenido"
EOL

cat > logs_duckdb.sh << EOL
#!/bin/bash
docker logs duckdb-server
EOL

cat > fix_vnc_again.sh << EOL
#!/bin/bash
docker exec duckdb-server /bin/bash -c "chmod +x /fix_vnc.sh && /fix_vnc.sh $API_KEY"
echo "Script de arreglo VNC ejecutado"
EOL

chmod +x restart_duckdb.sh stop_duckdb.sh logs_duckdb.sh fix_vnc_again.sh

# --- Mostrar información de conexión
success "¡Instalación de DuckDB Server con Docker y VNC completada exitosamente!"
info "Servicios disponibles:"
info "  API DuckDB: http://localhost:$DDB_PORT"
info "  VNC Server: localhost:5901 (password: la clave del API configurada)"
info "  noVNC (Web VNC): http://localhost:6080/vnc.html (password: la clave del API configurada)"
info "  SSH Server: ssh -p 2222 admin@localhost (password: la clave del API configurada)"
info ""
info "Datos almacenados en: ~/duckdb_data"
info ""
info "Scripts de administración:"
info "  ~/duckdb_server/restart_duckdb.sh - Reiniciar el servidor"
info "  ~/duckdb_server/stop_duckdb.sh    - Detener el servidor"
info "  ~/duckdb_server/logs_duckdb.sh    - Ver logs del servidor"
info "  ~/duckdb_server/fix_vnc_again.sh  - Ejecutar de nuevo el arreglo VNC"
info ""
info "Para probar la API: curl http://localhost:$DDB_PORT/health"
info ""
info "Instrucciones para usar VNC:"
info "1. Conéctate con un cliente VNC a localhost:5901 usando la clave del API como contraseña"
info "2. Alternativamente, accede al cliente Web en http://localhost:6080/vnc.html"
info "3. En el entorno gráfico, ejecuta ~/start-duckdb-ui.sh para iniciar la interfaz DuckDB"