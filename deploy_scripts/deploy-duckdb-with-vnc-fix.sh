#!/bin/bash
# Script para desplegar DuckDB Server con VNC mejorado
# Este script debe ejecutarse en el servidor remoto

# Configuración de colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes con formato
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    log_error "Docker no está instalado. Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    if [ $? -ne 0 ]; then
        log_error "No se pudo instalar Docker. Abortando."
        exit 1
    fi
    log_success "Docker instalado correctamente."
fi

# Crear directorio para DuckDB si no existe
mkdir -p ~/duckdb_data
mkdir -p ~/duckdb_server

# Directorio temporal para la construcción
BUILD_DIR=$(mktemp -d)
log_info "Usando directorio temporal: $BUILD_DIR"

# Copiar archivos al directorio de construcción
cp -r * "$BUILD_DIR/"
cd "$BUILD_DIR"

# Configuración del servidor
SERVER_PORT=1294
VNC_PORT=5901
NOVNC_PORT=6080
SSH_PORT=2222

# Construir la imagen de Docker
log_info "Construyendo imagen Docker de DuckDB Server... (0%)"
docker build -t duckdb-server . > docker_build.log 2>&1 &
build_pid=$!

# Mostrar progreso de la construcción mientras se ejecuta
progress=0
while kill -0 $build_pid 2> /dev/null; do
    if [ $progress -lt 90 ]; then
        progress=$((progress + 10))
        log_info "Construyendo imagen Docker de DuckDB Server... ($progress%)"
        sleep 5
    else
        log_info "Finalizando construcción... (90%)"
        sleep 5
    fi
done

# Verificar si la construcción tuvo éxito
if wait $build_pid; then
    log_info "Imagen Docker construida exitosamente (100%)!"
else
    log_error "Error al construir la imagen Docker. Revisar docker_build.log para más detalles."
    exit 1
fi

# Verificar si existe un contenedor previo
log_info "Verificando si existe un contenedor previo..."
docker ps -a --format "{{.Names}}" | grep duckdb-server

# Detener y eliminar contenedor previo si existe
if docker ps -a --format "{{.Names}}" | grep -q "duckdb-server"; then
    log_info "Deteniendo y eliminando contenedor anterior..."
    docker stop duckdb-server
    docker rm duckdb-server
fi

# Iniciar nuevo contenedor
log_info "Iniciando contenedor DuckDB con soporte para VNC..."
docker run -d \
    --name duckdb-server \
    -p $SERVER_PORT:1294 \
    -p $VNC_PORT:5901 \
    -p $NOVNC_PORT:6080 \
    -p $SSH_PORT:22 \
    -v ~/duckdb_data:/data \
    -e VNC_GEOMETRY=1280x800 \
    -e VNC_DEPTH=24 \
    duckdb-server

# Verificar que el contenedor se inició correctamente
log_info "Verificando estado del contenedor..."
sleep 3
if docker ps | grep -q "duckdb-server"; then
    log_success "¡Contenedor DuckDB iniciado correctamente!"
else
    log_error "Error al iniciar el contenedor. Abortando."
    exit 1
fi

# Copiar script de arreglo VNC al contenedor
log_info "Copiando script de arreglo VNC al contenedor..."
docker cp fix_vnc.sh duckdb-server:/fix_vnc.sh
docker exec duckdb-server chmod +x /fix_vnc.sh

# Ejecutar script de arreglo VNC dentro del contenedor
log_info "Ejecutando script de arreglo VNC en el contenedor..."
docker exec duckdb-server /fix_vnc.sh

# Verificar si el servidor VNC está en ejecución
log_info "Verificando que el servidor VNC está en ejecución..."
if docker exec duckdb-server netstat -tuln | grep -q ":5901"; then
    log_success "¡Servidor VNC está ejecutándose en el puerto 5901!"
else
    log_warn "El servidor VNC no parece estar ejecutándose en el puerto 5901."
fi

# Verificar que el servidor DuckDB está en ejecución
log_info "Verificando que el servidor DuckDB está en ejecución..."
sleep 2
if curl -s "http://localhost:$SERVER_PORT/health" | grep -q "healthy"; then
    log_success "¡Servidor DuckDB respondió: $(curl -s http://localhost:$SERVER_PORT/health)!"
else
    log_warn "El servidor DuckDB no respondió correctamente."
fi

# Crear scripts de administración
log_info "Creando scripts de administración..."
mkdir -p ~/duckdb_server
cat > ~/duckdb_server/restart_duckdb.sh << 'EOF'
#!/bin/bash
docker restart duckdb-server
EOF

cat > ~/duckdb_server/stop_duckdb.sh << 'EOF'
#!/bin/bash
docker stop duckdb-server
EOF

cat > ~/duckdb_server/logs_duckdb.sh << 'EOF'
#!/bin/bash
docker logs duckdb-server
EOF

cat > ~/duckdb_server/fix_vnc.sh << 'EOF'
#!/bin/bash
docker exec duckdb-server /fix_vnc.sh
EOF

chmod +x ~/duckdb_server/*.sh

# Mensaje final de éxito
log_success "¡Instalación de DuckDB Server con Docker y VNC completada exitosamente!"
echo
log_info "Servicios disponibles:"
log_info "  API DuckDB: http://localhost:$SERVER_PORT"
log_info "  VNC Server: localhost:$VNC_PORT (password: la clave del API configurada)"
log_info "  noVNC (Web VNC): http://localhost:$NOVNC_PORT/vnc.html (password: la clave del API configurada)"
log_info "  SSH Server: ssh -p $SSH_PORT admin@localhost (password: la clave del API configurada)"
echo
log_info "Datos almacenados en: ~/duckdb_data"
echo
log_info "Scripts de administración:"
log_info "  ~/duckdb_server/restart_duckdb.sh - Reiniciar el servidor"
log_info "  ~/duckdb_server/stop_duckdb.sh    - Detener el servidor"
log_info "  ~/duckdb_server/logs_duckdb.sh    - Ver logs del servidor"
log_info "  ~/duckdb_server/fix_vnc.sh        - Arreglar VNC si no funciona"
echo
log_info "Para probar la API: curl http://localhost:$SERVER_PORT/health"
echo
log_info "Instrucciones para usar VNC:"
log_info "1. Conéctate con un cliente VNC a localhost:$VNC_PORT usando la clave del API como contraseña"
log_info "2. En el entorno gráfico, ejecuta ~/start-duckdb-ui.sh para iniciar la interfaz DuckDB"
echo
log_info "Para acceder a noVNC (VNC vía web), visita:"
log_info "  http://localhost:$NOVNC_PORT/vnc.html"
log_info "  o con autoconexión: http://localhost:$NOVNC_PORT/vnc.html?autoconnect=true"