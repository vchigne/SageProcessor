#!/bin/bash

# Script para iniciar el servidor VNC
# Versión mejorada con mejor manejo de errores y reintentos automáticos
# Uso: ./start_vnc.sh [password]

# --- Función para buscar el siguiente puerto disponible
find_free_port() {
    local port=$1
    while ss -ltn | awk '{print $4}' | grep -q ":$port$"; do
        port=$((port+1))
    done
    echo "$port"
}

# --- Leer contraseña del argumento o usar la predeterminada
if [ -z "$1" ]; then
    PASSWORD="duckdb"
else
    PASSWORD="$1"
fi

# --- Variables de configuración
LOG_FILE="/var/log/vnc-startup.log"
RETRY_COUNT=3
DISPLAY_NUMBER=":1"
VNC_PORT=5901
HTTP_PORT=6080

# --- Crear directorio para logs
mkdir -p /var/log > /dev/null 2>&1 || true
touch ${LOG_FILE}
chown root:root ${LOG_FILE}
chmod 644 ${LOG_FILE}

echo "[$(date)] Iniciando servidor VNC..." | tee -a ${LOG_FILE}

# --- Matar cualquier instancia previa de VNC
echo "[$(date)] Deteniendo cualquier instancia previa de VNC..." | tee -a ${LOG_FILE}
vncserver -kill ${DISPLAY_NUMBER} > /dev/null 2>&1 || true
pkill -f "Xvnc" > /dev/null 2>&1 || true
pkill -f "x11vnc" > /dev/null 2>&1 || true
pkill -f "websockify" > /dev/null 2>&1 || true
sleep 2

# --- Limpiar archivos temporales y de bloqueo
echo "[$(date)] Limpiando archivos temporales..." | tee -a ${LOG_FILE}
rm -f /tmp/.X1-lock > /dev/null 2>&1 || true
rm -f /tmp/.X11-unix/X1 > /dev/null 2>&1 || true
rm -f ~/.vnc/*.pid > /dev/null 2>&1 || true
rm -f ~/.vnc/*.log > /dev/null 2>&1 || true
rm -f /root/.vnc/*.pid > /dev/null 2>&1 || true

# --- Asegurar la existencia de directorios necesarios
mkdir -p ~/.vnc > /dev/null 2>&1 || true
mkdir -p /root/.vnc > /dev/null 2>&1 || true

# --- Configurar la contraseña VNC
echo "[$(date)] Configurando contraseña VNC..." | tee -a ${LOG_FILE}
echo -e "$PASSWORD\n$PASSWORD\n\n" | vncpasswd > /dev/null 2>&1 || echo "$PASSWORD" | vncpasswd -f > ~/.vnc/passwd
cp -f ~/.vnc/passwd /root/.vnc/passwd > /dev/null 2>&1 || true
chmod 600 ~/.vnc/passwd > /dev/null 2>&1 || true
chmod 600 /root/.vnc/passwd > /dev/null 2>&1 || true

# --- Crear xstartup si no existe
if [ ! -f ~/.vnc/xstartup ]; then
    echo "[$(date)] Creando archivo xstartup..." | tee -a ${LOG_FILE}
    cat > ~/.vnc/xstartup << EOF
#!/bin/bash
xrdb \$HOME/.Xresources
startxfce4 &
EOF
    chmod +x ~/.vnc/xstartup
fi

# --- Función para verificar si el servidor VNC está escuchando
check_vnc_running() {
    if ss -ltn | awk '{print $4}' | grep -q ":${VNC_PORT}$"; then
        return 0
    else
        return 1
    fi
}

# --- Función para verificar si websockify está escuchando
check_websockify_running() {
    if ss -ltn | awk '{print $4}' | grep -q ":${HTTP_PORT}$"; then
        return 0
    else
        return 1
    fi
}

# --- Intentar iniciar el servidor VNC varias veces
vnc_started=false
for attempt in $(seq 1 ${RETRY_COUNT}); do
    echo "[$(date)] Intento ${attempt}/${RETRY_COUNT} de iniciar VNC..." | tee -a ${LOG_FILE}
    
    # Usar diferentes opciones según el intento para mayor robustez
    case ${attempt} in
        1)
            echo "[$(date)] Usando TigerVNC con opciones estándar..." | tee -a ${LOG_FILE}
            vncserver ${DISPLAY_NUMBER} -geometry 1280x800 -depth 24 -localhost no >> ${LOG_FILE} 2>&1
            ;;
        2)
            echo "[$(date)] Usando TigerVNC con opciones alternativas..." | tee -a ${LOG_FILE}
            vncserver ${DISPLAY_NUMBER} -geometry 1024x768 -depth 16 -localhost no -fg >> ${LOG_FILE} 2>&1 &
            ;;
        3)
            echo "[$(date)] Intentando con x11vnc como alternativa..." | tee -a ${LOG_FILE}
            if command -v x11vnc > /dev/null; then
                export DISPLAY=${DISPLAY_NUMBER}
                Xvfb ${DISPLAY_NUMBER} -screen 0 1280x800x16 >> ${LOG_FILE} 2>&1 &
                sleep 2
                x11vnc -display ${DISPLAY_NUMBER} -forever -shared -rfbport ${VNC_PORT} -passwd ${PASSWORD} >> ${LOG_FILE} 2>&1 &
            else
                echo "[$(date)] x11vnc no está instalado, usando opción de último recurso..." | tee -a ${LOG_FILE}
                vncserver ${DISPLAY_NUMBER} -geometry 800x600 -depth 8 -localhost no >> ${LOG_FILE} 2>&1
            fi
            ;;
    esac
    
    # Esperar a que el servidor inicie
    sleep 5
    
    # Verificar si VNC está escuchando
    if check_vnc_running; then
        echo "[$(date)] ✓ VNC iniciado correctamente en el intento ${attempt}" | tee -a ${LOG_FILE}
        vnc_started=true
        break
    else
        echo "[$(date)] ✗ VNC no pudo iniciarse en el intento ${attempt}" | tee -a ${LOG_FILE}
        # Limpiar antes del siguiente intento
        vncserver -kill ${DISPLAY_NUMBER} > /dev/null 2>&1 || true
        pkill -f "Xvnc" > /dev/null 2>&1 || true
        pkill -f "x11vnc" > /dev/null 2>&1 || true
        sleep 2
    fi
done

# --- Si VNC no se pudo iniciar después de todos los intentos
if ! ${vnc_started}; then
    echo "[$(date)] ✗ No se pudo iniciar el servidor VNC después de ${RETRY_COUNT} intentos" | tee -a ${LOG_FILE}
    echo "[$(date)] Mostrando las últimas líneas del log:" | tee -a ${LOG_FILE}
    tail -n 20 ${LOG_FILE}
    exit 1
fi

# --- Iniciar websockify para noVNC
echo "[$(date)] Iniciando websockify para noVNC..." | tee -a ${LOG_FILE}
if [ -d "/opt/novnc" ]; then
    cd /opt/novnc
    websockify --web . ${HTTP_PORT} localhost:${VNC_PORT} >> ${LOG_FILE} 2>&1 &
    sleep 2
    
    if check_websockify_running; then
        echo "[$(date)] ✓ Websockify iniciado correctamente" | tee -a ${LOG_FILE}
    else
        echo "[$(date)] ✗ Websockify no pudo iniciarse" | tee -a ${LOG_FILE}
    fi
else
    echo "[$(date)] ✗ No se encontró noVNC en /opt/novnc" | tee -a ${LOG_FILE}
fi

# --- Verificación final
echo "[$(date)] Verificación final de servicios:" | tee -a ${LOG_FILE}

if check_vnc_running; then
    echo "[$(date)] ✓ VNC está escuchando en el puerto ${VNC_PORT}" | tee -a ${LOG_FILE}
else
    echo "[$(date)] ✗ VNC NO está escuchando en el puerto ${VNC_PORT}" | tee -a ${LOG_FILE}
fi

if check_websockify_running; then
    echo "[$(date)] ✓ Websockify está escuchando en el puerto ${HTTP_PORT}" | tee -a ${LOG_FILE}
else
    echo "[$(date)] ✗ Websockify NO está escuchando en el puerto ${HTTP_PORT}" | tee -a ${LOG_FILE}
fi

# --- Resumen final
if check_vnc_running && check_websockify_running; then
    echo "[$(date)] ✓ Todos los servicios iniciados correctamente" | tee -a ${LOG_FILE}
    echo "[$(date)] - VNC disponible en el puerto ${VNC_PORT}" | tee -a ${LOG_FILE}
    echo "[$(date)] - noVNC disponible en http://localhost:${HTTP_PORT}/vnc.html" | tee -a ${LOG_FILE}
    exit 0
else
    echo "[$(date)] ⚠ Algunos servicios no pudieron iniciarse" | tee -a ${LOG_FILE}
    exit 1
fi