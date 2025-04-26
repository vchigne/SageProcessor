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

# Nota: En este modo de instalación, asumimos que las dependencias ya están instaladas
# y solo configuramos el servidor DuckDB
print_info "Omitiendo actualización de repositorios (requiere sudo)..."

# Verificar dependencias
print_info "Verificando dependencias requeridas..."
MISSING_DEPS=0

# Verificar Python 3
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 no está instalado. Es necesario instalarlo manualmente."
    MISSING_DEPS=1
else
    print_info "✓ Python 3 instalado correctamente"
fi

# Verificar pip3
if ! command -v pip3 &> /dev/null; then
    print_error "Pip3 no está instalado. Es necesario instalarlo manualmente."
    MISSING_DEPS=1
else
    print_info "✓ Pip3 instalado correctamente"
fi

# Verificar curl
if ! command -v curl &> /dev/null; then
    print_error "curl no está instalado. Es necesario instalarlo manualmente."
    MISSING_DEPS=1
else
    print_info "✓ curl instalado correctamente"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    print_error "Faltan dependencias. Por favor, instale los paquetes requeridos manualmente con:"
    print_info "sudo apt-get install python3 python3-pip curl unzip"
    print_info "Continuando con la instalación en modo limitado..."
fi

# Verificar que Python está instalado
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 no está instalado correctamente."
    exit 1
fi

# Instalar Python packages
print_info "Instalando paquetes de Python..."
if command -v pip3 &> /dev/null; then
    pip3 install --user duckdb flask flask-cors || {
        print_error "Error al instalar paquetes Python con pip3. Intentando con pip..."
        if command -v pip &> /dev/null; then
            pip install --user duckdb flask flask-cors || {
                print_error "Error al instalar paquetes Python con pip. El servidor podría no funcionar correctamente."
            }
        else
            print_error "No se encontró pip. Instalación de paquetes fallida."
        fi
    }
elif command -v pip &> /dev/null; then
    print_info "pip3 no encontrado, usando pip..."
    pip install --user duckdb flask flask-cors || {
        print_error "Error al instalar paquetes Python con pip. El servidor podría no funcionar correctamente."
    }
else
    print_error "No se encontró pip ni pip3. No se pueden instalar las dependencias de Python."
    print_info "Es necesario instalar manualmente: duckdb, flask, flask-cors"
    print_info "Por ejemplo: python3 -m pip install --user duckdb flask flask-cors"
fi

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

# Usar siempre el método de inicio manual por usuario en lugar de systemd
print_info "Usando método de inicio manual (no requiere sudo)..."

# Crear script de inicio
print_info "Creando script de inicio manual..."
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