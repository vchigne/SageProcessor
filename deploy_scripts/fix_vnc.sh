#!/bin/bash

set -e

# --- Variables
VNC_DISPLAY=":1"
VNC_PORT="5901"
HTTP_PORT="6080"
PASSWORD="${1:-duckdb}"  # Usa el primer argumento o 'duckdb' por defecto
USER_HOME=$(eval echo ~$USER)
NOVNC_DIR="/opt/novnc"
LOG_FILE="/var/log/vnc-startup.log"
SYSTEMD_DIR="/etc/systemd/system"

echo "[+] Iniciando script de reparación VNC..."

# --- Detener servicios existentes
echo "[*] Deteniendo servicios existentes..."
pkill -f "websockify" > /dev/null 2>&1 || true
pkill -f "Xvnc" > /dev/null 2>&1 || true
pkill -f "tigervnc" > /dev/null 2>&1 || true
pkill -f "x11vnc" > /dev/null 2>&1 || true
vncserver -kill ${VNC_DISPLAY} > /dev/null 2>&1 || true
sleep 2

# --- Asegurar que los directorios existan
echo "[*] Configurando directorios VNC..."
mkdir -p "$USER_HOME/.vnc" > /dev/null 2>&1 || true
mkdir -p "/root/.vnc" > /dev/null 2>&1 || true

# --- Crear password VNC (usando API key)
echo "[*] Reconfigurando contraseña VNC..."
echo "$PASSWORD" | vncpasswd -f > "$USER_HOME/.vnc/passwd"
chmod 600 "$USER_HOME/.vnc/passwd"
# Copiar también para root por si acaso
cp -f "$USER_HOME/.vnc/passwd" "/root/.vnc/passwd" 2>/dev/null || true
chmod 600 "/root/.vnc/passwd" 2>/dev/null || true

# --- Limpiar archivos temporales y de bloqueo
echo "[*] Limpiando archivos temporales y de bloqueo..."
rm -f /tmp/.X*-lock > /dev/null 2>&1 || true
rm -f /tmp/.X11-unix/X* > /dev/null 2>&1 || true
rm -f "$USER_HOME/.vnc/*.pid" > /dev/null 2>&1 || true
rm -f "$USER_HOME/.vnc/*.log" > /dev/null 2>&1 || true
rm -f "/root/.vnc/*.pid" > /dev/null 2>&1 || true

# --- Crear xstartup para XFCE4
echo "[*] Creando archivo xstartup..."
cat > "$USER_HOME/.vnc/xstartup" <<EOF
#!/bin/bash
xrdb \$HOME/.Xresources
startxfce4 &
EOF
chmod +x "$USER_HOME/.vnc/xstartup"

# --- Reiniciar VNC con opciones mejoradas
echo "[*] Iniciando servidor VNC con opciones mejoradas..."
vncserver ${VNC_DISPLAY} -geometry 1280x800 -depth 24 -localhost no > ${LOG_FILE} 2>&1
sleep 3

# --- Verificar si VNC está escuchando
if ! ss -ltn | awk '{print $4}' | grep -q ":${VNC_PORT}$"; then
    echo "[!] Advertencia: VNC no está escuchando en el puerto ${VNC_PORT}, intentando un método alternativo..."
    
    # --- Intentar con método alternativo
    if command -v Xvfb > /dev/null; then
        echo "[*] Iniciando método alternativo con Xvfb + x11vnc..."
        Xvfb ${VNC_DISPLAY} -screen 0 1280x800x16 > /dev/null 2>&1 &
        sleep 2
        
        if command -v x11vnc > /dev/null; then
            DISPLAY=${VNC_DISPLAY} x11vnc -display ${VNC_DISPLAY} -forever -shared -rfbport ${VNC_PORT} -passwd "${PASSWORD}" > /dev/null 2>&1 &
            sleep 2
        else
            echo "[!] x11vnc no encontrado, intento final con tigervnc..."
            vncserver ${VNC_DISPLAY} -geometry 800x600 -depth 16 -localhost no > /dev/null 2>&1
            sleep 2
        fi
    else
        echo "[!] Xvfb no encontrado, intento final con configuración mínima..."
        vncserver ${VNC_DISPLAY} -geometry 800x600 -depth 8 -localhost no > /dev/null 2>&1
        sleep 2
    fi
fi

# --- Verificar si websockify está en ejecución e iniciarlo si es necesario
echo "[*] Configurando websockify para noVNC..."
if ! pgrep -f "websockify" > /dev/null; then
    if [ -d "/opt/novnc" ]; then
        cd /opt/novnc
        websockify --web . ${HTTP_PORT} localhost:${VNC_PORT} > /dev/null 2>&1 &
        sleep 2
    elif [ -d "/usr/share/novnc" ]; then
        cd /usr/share/novnc
        websockify --web . ${HTTP_PORT} localhost:${VNC_PORT} > /dev/null 2>&1 &
        sleep 2
    else
        echo "[!] Advertencia: No se encontró directorio noVNC"
    fi
fi

# --- Verificación final
echo "[*] Verificación final de servicios..."
VNC_RUNNING=0
WEBSOCKIFY_RUNNING=0

if ss -ltn | grep -q ":${VNC_PORT}"; then
    echo "[✓] VNC está escuchando correctamente en el puerto ${VNC_PORT}"
    VNC_RUNNING=1
else
    echo "[✗] VNC NO está escuchando en el puerto ${VNC_PORT}"
    # Mostrar procesos que podrían estar interfiriendo
    echo "Procesos en el puerto ${VNC_PORT}:"
    lsof -i :${VNC_PORT} 2>/dev/null || echo "Ninguno"
fi

if ss -ltn | grep -q ":${HTTP_PORT}"; then
    echo "[✓] Websockify está escuchando correctamente en el puerto ${HTTP_PORT}"
    WEBSOCKIFY_RUNNING=1
else
    echo "[✗] Websockify NO está escuchando en el puerto ${HTTP_PORT}"
    # Mostrar procesos que podrían estar interfiriendo
    echo "Procesos en el puerto ${HTTP_PORT}:"
    lsof -i :${HTTP_PORT} 2>/dev/null || echo "Ninguno"
fi

if [ ${VNC_RUNNING} -eq 1 ] && [ ${WEBSOCKIFY_RUNNING} -eq 1 ]; then
    echo "[✓] Reparación VNC completada exitosamente"
    echo "[✓] VNC nativo disponible en: `hostname -I | awk '{print $1}'`:${VNC_PORT}"
    echo "[✓] VNC web disponible en: http://`hostname -I | awk '{print $1}'`:${HTTP_PORT}/vnc.html"
    exit 0
else
    echo "[!] Reparación parcial - Revisa los logs en ${LOG_FILE}"
    echo "--- Últimas 10 líneas del log VNC ---"
    tail -n 10 ${LOG_FILE}
    exit 1
fi