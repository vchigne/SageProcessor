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
# Verificar si tenemos permisos de sudo
HAS_SUDO=0
if command -v sudo &> /dev/null; then
    # Verificar si podemos usar sudo sin contraseña
    if sudo -n true 2>/dev/null; then
        print_info "Permisos de sudo disponibles, se intentarán instalar las dependencias automáticamente."
        HAS_SUDO=1
    else
        print_info "Sudo requiere contraseña, omitiendo actualización automática de dependencias."
    fi
else
    print_info "Comando sudo no disponible, omitiendo actualización automática de dependencias."
fi

# Verificar dependencias
print_info "Verificando dependencias requeridas..."
MISSING_DEPS=0

# Verificar Python 3
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 no está instalado."
    MISSING_DEPS=1
    
    if [ $HAS_SUDO -eq 1 ]; then
        print_info "Intentando instalar Python 3 automáticamente..."
        if sudo apt-get update -y && sudo apt-get install -y python3; then
            print_success "Python 3 instalado correctamente"
            MISSING_DEPS=0
        else
            print_error "No se pudo instalar Python 3 automáticamente."
        fi
    else
        print_info "Es necesario instalar Python 3 manualmente: sudo apt-get install python3"
    fi
else
    print_info "✓ Python 3 instalado correctamente"
fi

# Verificar pip3
if ! command -v pip3 &> /dev/null; then
    print_error "Pip3 no está instalado."
    MISSING_DEPS=1
    
    if [ $HAS_SUDO -eq 1 ]; then
        print_info "Intentando instalar pip3 automáticamente..."
        if sudo apt-get update -y && sudo apt-get install -y python3-pip; then
            print_success "pip3 instalado correctamente"
            MISSING_DEPS=0
        else
            print_error "No se pudo instalar pip3 automáticamente."
        fi
    else
        print_info "Es necesario instalar pip3 manualmente: sudo apt-get install python3-pip"
        
        # Intentar usar python3 para instalar pip (método alternativo)
        print_info "Intentando instalar pip con ensurepip..."
        if python3 -m ensurepip --user &>/dev/null; then
            print_success "pip instalado con ensurepip"
            export PATH="$HOME/.local/bin:$PATH"
        fi
    fi
else
    print_info "✓ Pip3 instalado correctamente"
fi

# Verificar curl
if ! command -v curl &> /dev/null; then
    print_error "curl no está instalado."
    MISSING_DEPS=1
    
    if [ $HAS_SUDO -eq 1 ]; then
        print_info "Intentando instalar curl automáticamente..."
        if sudo apt-get update -y && sudo apt-get install -y curl; then
            print_success "curl instalado correctamente"
            MISSING_DEPS=0
        else
            print_error "No se pudo instalar curl automáticamente."
        fi
    else
        print_info "Es necesario instalar curl manualmente: sudo apt-get install curl"
    fi
else
    print_info "✓ curl instalado correctamente"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    print_error "Faltan algunas dependencias. Para instalarlas manualmente, use:"
    print_info "sudo apt-get update && sudo apt-get install -y python3 python3-pip curl unzip"
    print_info "Continuando con la instalación en modo limitado..."
fi

# Verificar que Python está instalado
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 no está instalado correctamente."
    exit 1
fi

# Instalar Python packages
print_info "Instalando paquetes de Python..."

# Primero verificar si python3 -m pip funciona (más confiable que pip/pip3 directamente)
PYTHON_PIP_WORKS=0
if python3 -m pip --version &>/dev/null; then
    print_info "Usando python3 -m pip para instalar dependencias..."
    python3 -m pip install --user --upgrade pip &>/dev/null
    
    # Agregar ruta de usuario a PATH para encontrar las herramientas instaladas
    export PATH="$HOME/.local/bin:$PATH"
    
    if python3 -m pip install --user duckdb flask flask-cors; then
        print_success "Paquetes instalados correctamente con python3 -m pip"
        PYTHON_PIP_WORKS=1
    else
        print_error "Error al instalar con python3 -m pip"
    fi
fi

# Si python3 -m pip no funcionó, intentar con pip3 o pip
if [ $PYTHON_PIP_WORKS -eq 0 ]; then
    if command -v pip3 &> /dev/null; then
        print_info "Usando pip3 para instalar dependencias..."
        if pip3 install --user duckdb flask flask-cors; then
            print_success "Paquetes instalados correctamente con pip3"
        else
            print_error "Error al instalar con pip3, intentando con pip..."
            if command -v pip &> /dev/null; then
                if pip install --user duckdb flask flask-cors; then
                    print_success "Paquetes instalados correctamente con pip"
                else
                    print_error "Error al instalar paquetes Python. El servidor podría no funcionar correctamente."
                fi
            else
                print_error "No se encontró pip. Instalación de paquetes fallida."
            fi
        fi
    elif command -v pip &> /dev/null; then
        print_info "pip3 no encontrado, usando pip..."
        if pip install --user duckdb flask flask-cors; then
            print_success "Paquetes instalados correctamente con pip"
        else
            print_error "Error al instalar paquetes Python. El servidor podría no funcionar correctamente."
        fi
    else
        # Último recurso: intentar instalar pip con ensurepip si no se ha intentado antes
        if ! python3 -m ensurepip --user &>/dev/null; then
            print_error "No se pudo instalar pip con ensurepip."
        else
            print_success "pip instalado con ensurepip, intentando instalar dependencias..."
            export PATH="$HOME/.local/bin:$PATH"
            python3 -m pip install --user duckdb flask flask-cors || print_error "La instalación de dependencias ha fallado"
        fi
    fi
fi

# Verificar si duckdb se instaló correctamente
if ! python3 -c "import duckdb" &>/dev/null; then
    print_error "El módulo 'duckdb' no se instaló correctamente."
    print_info "Es necesario instalar manualmente: duckdb, flask, flask-cors"
    print_info "Por ejemplo: python3 -m pip install --user duckdb flask flask-cors"
    
    # Mensaje de instalación manual para el usuario
    MANUAL_INSTALL_NEEDED=1
    print_info "=== INSTRUCCIONES PARA INSTALACIÓN MANUAL ==="
    print_info "1. Conéctese al servidor con SSH"
    print_info "2. Ejecute estos comandos:"
    print_info "   sudo apt-get update"
    print_info "   sudo apt-get install -y python3-pip"
    print_info "   pip3 install --user duckdb flask flask-cors"
    print_info "3. Vuelva a intentar el despliegue desde la plataforma SAGE"
    print_info "==========================================="
else
    print_success "Módulo 'duckdb' instalado correctamente"
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

# Usar curl con timeout para evitar esperas largas
HEALTH_RESPONSE=$(curl -s --connect-timeout 5 --max-time 10 http://localhost:$DUCKDB_PORT/health)
CURL_STATUS=$?

if [ $CURL_STATUS -ne 0 ]; then
    print_error "No se pudo conectar al servidor (código $CURL_STATUS)"
elif [ -z "$HEALTH_RESPONSE" ]; then
    print_error "El servidor no devolvió respuesta"
else
    print_success "Servidor respondió: $HEALTH_RESPONSE"
fi

# Verificar proceso en ejecución
PID_RUNNING=0
if [ -f ~/duckdb_server/duckdb_server.pid ]; then
    PID=$(cat ~/duckdb_server/duckdb_server.pid)
    if ps -p $PID > /dev/null; then
        print_info "Proceso DuckDB en ejecución con PID $PID"
        PID_RUNNING=1
    else
        print_error "El proceso con PID $PID no está en ejecución"
    fi
fi

# Verificar por nombre de proceso si el PID no se encontró
if [ $PID_RUNNING -eq 0 ]; then
    if pgrep -f "python3 .*duckdb_server.py" > /dev/null; then
        PID=$(pgrep -f "python3 .*duckdb_server.py")
        print_info "Proceso DuckDB en ejecución con PID $PID (sin archivo PID)"
        PID_RUNNING=1
    else
        print_error "No se encontró ningún proceso DuckDB en ejecución"
    fi
fi

# Verificar logs en busca de errores específicos
SERVER_LOG=~/duckdb_server/duckdb_server.log
if [ -f "$SERVER_LOG" ]; then
    print_info "Analizando logs en busca de errores..."
    
    # Verificar error de módulo duckdb
    if grep -q "No module named 'duckdb'" "$SERVER_LOG"; then
        print_error "El servidor falló porque falta el módulo 'duckdb'."
        MODULE_ERROR="duckdb"
    elif grep -q "No module named 'flask'" "$SERVER_LOG"; then
        print_error "El servidor falló porque falta el módulo 'flask'."
        MODULE_ERROR="flask"
    elif grep -q "No module named 'flask_cors'" "$SERVER_LOG"; then
        print_error "El servidor falló porque falta el módulo 'flask_cors'."
        MODULE_ERROR="flask-cors"
    fi
    
    # Mostrar las últimas 5 líneas del log para diagnóstico
    print_info "Últimas líneas del log:"
    tail -n 5 "$SERVER_LOG" | while read -r line; do
        echo "    $line"
    done
else
    print_error "No se encontró archivo de log en $SERVER_LOG"
fi

# Determinar si la instalación fue exitosa
if [ $PID_RUNNING -eq 1 ] && [ $CURL_STATUS -eq 0 ] && [ -n "$HEALTH_RESPONSE" ]; then
    print_success "¡Instalación de DuckDB Server completada exitosamente!"
    INSTALL_SUCCESS=1
else
    print_error "La instalación no fue completada correctamente."
    INSTALL_SUCCESS=0
    
    # Proporcionar instrucciones específicas según el error encontrado
    print_info "=== INSTRUCCIONES PARA SOLUCIONAR PROBLEMAS ==="
    if [ -n "$MODULE_ERROR" ]; then
        print_info "Problema: Falta el módulo '$MODULE_ERROR'. Ejecute estos comandos:"
        print_info "    sudo apt-get update"
        print_info "    sudo apt-get install -y python3-pip"
        print_info "    python3 -m pip install --user duckdb flask flask-cors"
    elif [ $PID_RUNNING -eq 0 ]; then
        print_info "Problema: El servidor no pudo iniciarse. Verifique los logs para más detalles."
        print_info "    cat ~/duckdb_server/duckdb_server.log"
    elif [ $CURL_STATUS -ne 0 ]; then
        print_info "Problema: No se pudo establecer conexión con el servidor. Verifique:"
        print_info "    1. Si hay un firewall bloqueando el puerto $DUCKDB_PORT"
        print_info "    2. Si otra aplicación está usando el puerto $DUCKDB_PORT"
        print_info "    3. Si el servidor tiene errores (cat ~/duckdb_server/duckdb_server.log)"
    fi
    print_info "============================================="
fi
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