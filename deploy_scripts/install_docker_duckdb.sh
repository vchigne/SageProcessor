#!/bin/bash
# Script para la instalación de DuckDB usando Docker en un servidor remoto

# Mensajes de texto
print_info() {
    echo -e "\e[34m[INFO]\e[0m $1"
}

print_success() {
    echo -e "\e[32m[SUCCESS]\e[0m $1"
}

print_error() {
    echo -e "\e[31m[ERROR]\e[0m $1"
}

print_info "Iniciando instalación de DuckDB Server con Docker..."

# Verificar sistema operativo
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    print_info "Sistema operativo detectado: $OS"
else
    print_info "No se pudo detectar el sistema operativo, asumiendo compatible con apt"
    OS="Unknown"
fi

# Verificar si tenemos permisos de sudo
HAS_SUDO=0
if command -v sudo &> /dev/null; then
    # Verificar si podemos usar sudo sin contraseña
    if sudo -n true 2>/dev/null; then
        print_info "Permisos de sudo disponibles, se utilizarán para instalar Docker si es necesario."
        HAS_SUDO=1
    else
        print_info "Sudo requiere contraseña, se intentará instalar sin privilegios de administrador."
    fi
else
    print_info "Comando sudo no disponible, se intentará instalar sin privilegios de administrador."
fi

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado."
    
    if [ $HAS_SUDO -eq 1 ]; then
        print_info "Intentando instalar Docker automáticamente..."
        
        # Instalar dependencias
        sudo apt-get update
        sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
        
        # Añadir clave GPG de Docker
        curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # Añadir repositorio de Docker
        echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Instalar Docker
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io
        
        # Añadir usuario actual al grupo docker para no requerir sudo
        sudo usermod -aG docker $USER
        
        print_success "Docker instalado correctamente."
        print_info "IMPORTANTE: Es posible que necesite cerrar sesión y volver a iniciarla para usar Docker sin sudo."
        print_info "Por ahora, continuaremos usando sudo para los comandos de Docker."
        USE_SUDO_DOCKER=1
    else
        print_error "No se puede instalar Docker sin privilegios de administrador."
        print_info "Contacte al administrador del sistema para instalar Docker o instálelo manualmente."
        print_info "Instalación usando el script oficial de Docker:"
        print_info "    curl -fsSL https://get.docker.com -o get-docker.sh"
        print_info "    sudo sh get-docker.sh"
        exit 1
    fi
else
    print_info "✓ Docker ya está instalado"
    
    # Verificar si podemos usar Docker sin sudo
    if docker ps &> /dev/null; then
        USE_SUDO_DOCKER=0
        print_info "✓ Puede ejecutar Docker sin sudo"
    else
        if [ $HAS_SUDO -eq 1 ]; then
            USE_SUDO_DOCKER=1
            print_info "Se usará sudo para ejecutar comandos de Docker"
        else
            print_error "No tiene permisos para ejecutar Docker y no puede usar sudo."
            print_info "Contacte al administrador para añadirle al grupo docker:"
            print_info "    sudo usermod -aG docker $USER"
            exit 1
        fi
    fi
fi

# Crear directorios para datos de DuckDB
print_info "Creando directorios para datos..."
mkdir -p ~/duckdb_data

# Obtener puerto y clave de autenticación de los argumentos
DUCKDB_PORT=${1:-1294}
DUCKDB_KEY=${2:-""}

print_info "Puerto configurado: $DUCKDB_PORT"
if [ -n "$DUCKDB_KEY" ]; then
    print_info "Clave de autenticación configurada"
else
    print_info "Sin clave de autenticación"
fi

# Crear un directorio temporal para construir la imagen
print_info "Preparando archivos para Docker..."
TEMP_DIR=$(mktemp -d)
cp ~/duckdb_server/duckdb_server.py $TEMP_DIR/
cp ~/duckdb_server/Dockerfile $TEMP_DIR/

# Ir al directorio temporal
cd $TEMP_DIR

# Construir la imagen de Docker
print_info "Construyendo imagen Docker para DuckDB..."
if [ $USE_SUDO_DOCKER -eq 1 ]; then
    sudo docker build -t duckdb-server .
else
    docker build -t duckdb-server .
fi

# Verificar si la construcción fue exitosa
if [ $? -ne 0 ]; then
    print_error "Error al construir la imagen Docker."
    exit 1
fi

# Detener y eliminar contenedor existente si existe
print_info "Verificando si existe un contenedor previo..."
if [ $USE_SUDO_DOCKER -eq 1 ]; then
    sudo docker stop duckdb-server 2>/dev/null || true
    sudo docker rm duckdb-server 2>/dev/null || true
else
    docker stop duckdb-server 2>/dev/null || true
    docker rm duckdb-server 2>/dev/null || true
fi

# Iniciar el contenedor Docker
print_info "Iniciando contenedor DuckDB..."
if [ $USE_SUDO_DOCKER -eq 1 ]; then
    sudo docker run -d \
        --name duckdb-server \
        -p $DUCKDB_PORT:1294 \
        -v ~/duckdb_data:/data \
        -e DUCKDB_SERVER_KEY="$DUCKDB_KEY" \
        --restart unless-stopped \
        duckdb-server
else
    docker run -d \
        --name duckdb-server \
        -p $DUCKDB_PORT:1294 \
        -v ~/duckdb_data:/data \
        -e DUCKDB_SERVER_KEY="$DUCKDB_KEY" \
        --restart unless-stopped \
        duckdb-server
fi

# Verificar si el contenedor está en ejecución
print_info "Verificando estado del contenedor..."
sleep 3

if [ $USE_SUDO_DOCKER -eq 1 ]; then
    CONTAINER_RUNNING=$(sudo docker ps --filter "name=duckdb-server" --format "{{.Names}}" | grep -c "duckdb-server")
else
    CONTAINER_RUNNING=$(docker ps --filter "name=duckdb-server" --format "{{.Names}}" | grep -c "duckdb-server")
fi

if [ $CONTAINER_RUNNING -eq 1 ]; then
    print_success "¡Contenedor DuckDB iniciado correctamente!"
else
    print_error "Error al iniciar el contenedor DuckDB."
    
    # Mostrar logs para diagnóstico
    print_info "Logs del contenedor:"
    if [ $USE_SUDO_DOCKER -eq 1 ]; then
        sudo docker logs duckdb-server
    else
        docker logs duckdb-server
    fi
    
    exit 1
fi

# Verificar que el servidor está respondiendo
print_info "Verificando que el servidor DuckDB está en ejecución..."
sleep 2

# Usar curl con timeout para evitar esperas largas
HEALTH_RESPONSE=$(curl -s --connect-timeout 5 --max-time 10 http://localhost:$DUCKDB_PORT/health)
CURL_STATUS=$?

if [ $CURL_STATUS -ne 0 ]; then
    print_error "No se pudo conectar al servidor DuckDB (código $CURL_STATUS)"
    print_info "Verificando logs del contenedor:"
    
    if [ $USE_SUDO_DOCKER -eq 1 ]; then
        sudo docker logs duckdb-server
    else
        docker logs duckdb-server
    fi
    
    exit 1
elif [ -z "$HEALTH_RESPONSE" ]; then
    print_error "El servidor DuckDB no devolvió respuesta"
    exit 1
else
    print_success "¡Servidor DuckDB respondió: $HEALTH_RESPONSE!"
fi

# Crear scripts de administración
print_info "Creando scripts de administración..."

# Script para reiniciar el servidor
cat > ~/duckdb_server/restart_duckdb.sh << EOF
#!/bin/bash
echo "Reiniciando servidor DuckDB..."
if command -v sudo &> /dev/null && ! docker ps &> /dev/null; then
    sudo docker restart duckdb-server
else
    docker restart duckdb-server
fi
echo "Servidor reiniciado."
EOF
chmod +x ~/duckdb_server/restart_duckdb.sh

# Script para detener el servidor
cat > ~/duckdb_server/stop_duckdb.sh << EOF
#!/bin/bash
echo "Deteniendo servidor DuckDB..."
if command -v sudo &> /dev/null && ! docker ps &> /dev/null; then
    sudo docker stop duckdb-server
else
    docker stop duckdb-server
fi
echo "Servidor detenido."
EOF
chmod +x ~/duckdb_server/stop_duckdb.sh

# Script para ver logs
cat > ~/duckdb_server/logs_duckdb.sh << EOF
#!/bin/bash
echo "Mostrando logs del servidor DuckDB..."
if command -v sudo &> /dev/null && ! docker ps &> /dev/null; then
    sudo docker logs duckdb-server
else
    docker logs duckdb-server
fi
EOF
chmod +x ~/duckdb_server/logs_duckdb.sh

# Limpiar archivos temporales
rm -rf $TEMP_DIR

print_success "¡Instalación de DuckDB Server con Docker completada exitosamente!"
print_info "El servidor está disponible en http://localhost:$DUCKDB_PORT"
print_info "Datos almacenados en: ~/duckdb_data"
print_info ""
print_info "Scripts de administración:"
print_info "  ~/duckdb_server/restart_duckdb.sh - Reiniciar el servidor"
print_info "  ~/duckdb_server/stop_duckdb.sh    - Detener el servidor"
print_info "  ~/duckdb_server/logs_duckdb.sh    - Ver logs del servidor"
print_info ""
print_info "Para probar la API: curl http://localhost:$DUCKDB_PORT/health"

exit 0