#!/bin/bash

# Script de arreglo para servicios VNC
# Este script soluciona problemas comunes con el servidor VNC en containers Docker
# Uso: ./fix_vnc.sh [password]

set -e

echo "[+] Iniciando script de reparación VNC..."

# --- Leer contraseña del argumento o usar la predeterminada
if [ -z "$1" ]; then
    PASSWORD="duckdb"
    echo "[*] Usando contraseña predeterminada: duckdb"
else
    PASSWORD="$1"
    echo "[*] Usando contraseña proporcionada"
fi

# --- Variables
VNC_PORT=5901
HTTP_PORT=6080
DISPLAY_NUMBER=":1"
LOG_FILE="/var/log/vnc-startup.log"

echo "[*] Verificando si VNC está en ejecución..."
if pgrep Xvnc > /dev/null; then
    echo "[*] El servidor VNC ya está en ejecución, reiniciando..."
    vncserver -kill ${DISPLAY_NUMBER} > /dev/null 2>&1 || true
fi

# --- Detener servicios si existen
echo "[*] Deteniendo servicios existentes..."
pkill -f "websockify" > /dev/null 2>&1 || true
pkill -f "Xvnc" > /dev/null 2>&1 || true
pkill -f "x11vnc" > /dev/null 2>&1 || true
sleep 2

# --- Crear directorios necesarios
echo "[*] Configurando directorios VNC..."
mkdir -p ~/.vnc > /dev/null 2>&1 || true
mkdir -p /root/.vnc > /dev/null 2>&1 || true

# --- Crear contraseña de VNC
echo "[*] Reconfigurando contraseña VNC..."
echo -e "$PASSWORD\n$PASSWORD\n\n" | vncpasswd > /dev/null 2>&1 || echo "$PASSWORD" | vncpasswd -f > ~/.vnc/passwd

# --- Asegurar permisos
chmod 600 ~/.vnc/passwd > /dev/null 2>&1 || true
chmod 600 /root/.vnc/passwd > /dev/null 2>&1 || true

# --- Configurar xstartup si no existe
if [ ! -f ~/.vnc/xstartup ]; then
    echo "[*] Creando archivo xstartup..."
    cat <<EOF > ~/.vnc/xstartup
#!/bin/bash
xrdb \$HOME/.Xresources
startxfce4 &
EOF
    chmod +x ~/.vnc/xstartup
fi

# --- Intentar arreglar problemas de bloqueo de archivos
echo "[*] Limpiando archivos temporales y de bloqueo..."
rm -f /tmp/.X1-lock > /dev/null 2>&1 || true
rm -f /tmp/.X11-unix/X1 > /dev/null 2>&1 || true
rm -f ~/.vnc/*.pid > /dev/null 2>&1 || true
rm -f ~/.vnc/*.log > /dev/null 2>&1 || true

# --- Reiniciar VNC con opciones más robustas
echo "[*] Iniciando servidor VNC con opciones mejoradas..."
vncserver ${DISPLAY_NUMBER} -geometry 1280x800 -depth 24 -localhost no -fg > ${LOG_FILE} 2>&1 &
VNC_PID=$!

# --- Esperar a que VNC inicie
echo "[*] Esperando a que el servidor VNC inicie..."
sleep 5

# --- Verificar si VNC está escuchando
if ! ss -ltn | awk '{print $4}' | grep -q ":${VNC_PORT}$"; then
    echo "[!] Advertencia: VNC no está escuchando en el puerto ${VNC_PORT}, intentando un método alternativo..."
    
    # --- Intentar con x11vnc como alternativa
    if command -v x11vnc > /dev/null; then
        echo "[*] Intentando iniciar x11vnc..."
        x11vnc -display ${DISPLAY_NUMBER} -forever -shared -rfbport ${VNC_PORT} -passwd ${PASSWORD} > ${LOG_FILE} 2>&1 &
        sleep 3
    fi
fi

# --- Verificar si websockify está en ejecución
if ! pgrep -f "websockify" > /dev/null; then
    echo "[*] Iniciando websockify para noVNC..."
    if [ -d "/opt/novnc" ]; then
        cd /opt/novnc
        websockify --web . ${HTTP_PORT} localhost:${VNC_PORT} > /dev/null 2>&1 &
        sleep 2
    else
        echo "[!] Advertencia: No se encontró directorio noVNC en /opt/novnc"
    fi
fi

# --- Verificación final
echo "[*] Verificando servicios..."
VNC_RUNNING=0
WEBSOCKIFY_RUNNING=0

if ss -ltn | awk '{print $4}' | grep -q ":${VNC_PORT}$"; then
    echo "[✓] VNC está escuchando correctamente en el puerto ${VNC_PORT}"
    VNC_RUNNING=1
else
    echo "[✗] VNC NO está escuchando en el puerto ${VNC_PORT}"
fi

if ss -ltn | awk '{print $4}' | grep -q ":${HTTP_PORT}$"; then
    echo "[✓] Websockify está escuchando correctamente en el puerto ${HTTP_PORT}"
    WEBSOCKIFY_RUNNING=1
else
    echo "[✗] Websockify NO está escuchando en el puerto ${HTTP_PORT}"
fi

if [ ${VNC_RUNNING} -eq 1 ] && [ ${WEBSOCKIFY_RUNNING} -eq 1 ]; then
    echo "[✓] Reparación VNC completada exitosamente"
    exit 0
else
    echo "[!] Reparación parcial - Revisa los logs en ${LOG_FILE}"
    echo "--- Últimas 10 líneas del log VNC ---"
    tail -n 10 ${LOG_FILE}
    exit 1
fi