#!/bin/bash
# Script para la instalación de DuckDB y sus dependencias en un servidor remoto

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

print_info "Iniciando instalación de DuckDB en modo servidor..."

# Verificar sistema operativo
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    print_info "Sistema operativo detectado: $OS"
else
    print_info "No se pudo detectar el sistema operativo, asumiendo compatible con apt"
    OS="Unknown"
fi

# Actualizar repositorios
print_info "Actualizando repositorios..."
if [[ "$OS" == *"Debian"* ]] || [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == "Unknown" ]]; then
    sudo apt-get update -y
elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
    sudo yum update -y
elif [[ "$OS" == *"Fedora"* ]]; then
    sudo dnf update -y
else
    print_info "Intentando actualizar con apt-get..."
    sudo apt-get update -y || true
fi

# Instalar dependencias
print_info "Instalando dependencias..."
if [[ "$OS" == *"Debian"* ]] || [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == "Unknown" ]]; then
    sudo apt-get install -y python3 python3-pip curl unzip
elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
    sudo yum install -y python3 python3-pip curl unzip
elif [[ "$OS" == *"Fedora"* ]]; then
    sudo dnf install -y python3 python3-pip curl unzip
else
    print_info "Intentando instalar dependencias con apt-get..."
    sudo apt-get install -y python3 python3-pip curl unzip || true
fi

# Verificar que Python está instalado
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 no está instalado correctamente."
    exit 1
fi

# Instalar Python packages
print_info "Instalando paquetes de Python..."
pip3 install --user duckdb flask flask-cors

# Crear directorios
print_info "Creando directorios..."
mkdir -p ~/duckdb_server
mkdir -p ~/duckdb_data

# Descargar y configurar DuckDB Server
print_info "Configurando DuckDB Server..."

# Obtener puerto y clave de autenticación de los argumentos
DUCKDB_PORT=${1:-1294}
DUCKDB_KEY=${2:-""}

print_info "Puerto configurado: $DUCKDB_PORT"
if [ -n "$DUCKDB_KEY" ]; then
    print_info "Clave de autenticación configurada"
else
    print_info "Sin clave de autenticación"
fi

# Crear archivo de servicio systemd si es posible
if [ -d /etc/systemd/system ]; then
    print_info "Configurando servicio systemd..."
    cat <<EOF > ~/duckdb_server/duckdb_server.service
[Unit]
Description=DuckDB Server
After=network.target

[Service]
User=$USER
WorkingDirectory=$HOME/duckdb_server
Environment="DUCKDB_PORT=$DUCKDB_PORT"
Environment="DUCKDB_SERVER_KEY=$DUCKDB_KEY"
Environment="DUCKDB_DATA_DIR=$HOME/duckdb_data"
ExecStart=/usr/bin/python3 $HOME/duckdb_server/duckdb_server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    sudo cp ~/duckdb_server/duckdb_server.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable duckdb_server.service
    
    print_info "Iniciando servicio DuckDB..."
    sudo systemctl start duckdb_server.service
    
    # Verificar estado del servicio
    if sudo systemctl is-active --quiet duckdb_server.service; then
        print_success "Servicio DuckDB iniciado correctamente"
    else
        print_error "Error al iniciar el servicio DuckDB"
        sudo systemctl status duckdb_server.service
    fi
else
    # Alternativa sin systemd: crear script de inicio
    print_info "systemd no detectado, creando script de inicio manual..."
    cat <<EOF > ~/duckdb_server/start_duckdb.sh
#!/bin/bash
export DUCKDB_PORT=$DUCKDB_PORT
export DUCKDB_SERVER_KEY="$DUCKDB_KEY"
export DUCKDB_DATA_DIR=$HOME/duckdb_data
cd $HOME/duckdb_server
nohup python3 duckdb_server.py > duckdb_server.log 2>&1 &
echo \$! > duckdb_server.pid
echo "DuckDB Server iniciado con PID \$(cat duckdb_server.pid)"
EOF

    chmod +x ~/duckdb_server/start_duckdb.sh
    
    # Crear script de detención
    cat <<EOF > ~/duckdb_server/stop_duckdb.sh
#!/bin/bash
if [ -f $HOME/duckdb_server/duckdb_server.pid ]; then
    PID=\$(cat $HOME/duckdb_server/duckdb_server.pid)
    echo "Deteniendo DuckDB Server (PID \$PID)..."
    kill \$PID
    rm $HOME/duckdb_server/duckdb_server.pid
else
    echo "No se encontró archivo PID. Intentando detener por nombre de proceso..."
    pkill -f "python3 .*duckdb_server.py"
fi
EOF

    chmod +x ~/duckdb_server/stop_duckdb.sh
    
    # Iniciar el servidor
    print_info "Iniciando DuckDB Server manualmente..."
    ~/duckdb_server/start_duckdb.sh
    
    # Verificar que está en ejecución
    sleep 2
    if pgrep -f "python3 .*duckdb_server.py" > /dev/null; then
        print_success "DuckDB Server iniciado correctamente"
    else
        print_error "Error al iniciar DuckDB Server"
        cat ~/duckdb_server/duckdb_server.log
    fi
fi

print_info "Verificando que el servidor esté respondiendo..."
sleep 5
curl -s http://localhost:$DUCKDB_PORT/health || echo "Error: No se pudo conectar al servidor"

print_success "¡Instalación de DuckDB Server completada!"
echo ""
echo "Para verificar el estado del servidor:"
if [ -d /etc/systemd/system ]; then
    echo "  sudo systemctl status duckdb_server.service"
else
    echo "  ps aux | grep duckdb_server.py"
    echo "  cat ~/duckdb_server/duckdb_server.log"
fi

echo ""
echo "Para probar la API:"
echo "  curl http://localhost:$DUCKDB_PORT/health"
echo ""
echo "¡Disfruta tu DuckDB Server!"
exit 0