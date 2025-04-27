#!/bin/bash

# install_duckdb_server.sh
# Instalación de DuckDB Server, demo Evidence y entorno gráfico XFCE4 con noVNC
set -e

# 1. Verificar ejecución como root
if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] Este script requiere permisos de root. Ejecuta con sudo." >&2
  exit 1
fi

# 2. Obtener API_KEY
test -n "$1" || { echo "Uso: sudo bash install_duckdb_server.sh <API_KEY>" >&2; exit 1; }
API_KEY="$1"

# 3. Rutas de usuario y script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REAL_HOME="$HOME"
if [[ -n "$SUDO_USER" && "$SUDO_USER" != "root" ]]; then
  REAL_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
fi

# Función de log
info() { printf "[INFO] %s\n" "$1"; }

# 4. Instalar paquetes base, entorno gráfico y noVNC
info "Instalando paquetes base y entorno gráfico..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -yq \
  curl wget gnupg2 software-properties-common \
  supervisor xvfb x11vnc firefox-esr xfce4 xfce4-goodies \
  novnc websockify python3-websockify \
  nginx python3 python3-pip nodejs npm unzip \
  dbus-x11 dbus-user-session

# 5. Instalar DuckDB CLI
define_duckdb(){
  info "Instalando DuckDB CLI..."
  curl -fsSL https://install.duckdb.org | bash
  if [[ -d /root/.duckdb ]]; then
    mv /root/.duckdb "${REAL_HOME}/.duckdb"
    chown -R "$SUDO_USER":"$SUDO_USER" "${REAL_HOME}/.duckdb"
  fi
  if [[ -d "${REAL_HOME}/.duckdb/cli/latest" ]]; then
    CLI_DIR="${REAL_HOME}/.duckdb/cli/latest"
  else
    CLI_DIR=$(find "${REAL_HOME}/.duckdb/cli" -mindepth 1 -maxdepth 1 -type d | tail -n1)
  fi
  chmod +x "${CLI_DIR}/duckdb"
  ln -sf "${CLI_DIR}/duckdb" /usr/local/bin/duckdb
  ln -sf "${CLI_DIR}/duckdb" /usr/bin/duckdb
  if ! grep -qxF "export PATH=\"${CLI_DIR}:\$PATH\"" "${REAL_HOME}/.bashrc"; then
    echo "export PATH=\"${CLI_DIR}:\$PATH\"" >> "${REAL_HOME}/.bashrc"
  fi
}
info "Comprobando DuckDB CLI..."
if ! command -v duckdb >/dev/null 2>&1; then
  define_duckdb
else
  info "DuckDB CLI ya instalado."
fi

# 6. Dependencias Python
define_pip(){ python3 -m pip "$@"; }
info "Instalando librerías Python..."
define_pip install --break-system-packages --no-input duckdb flask flask-cors waitress yato-lib

# 7. Crear directorios de aplicación y demo
info "Creando directorios..."
install -d \
  /opt/duckdb_server \
  /opt/ventas-demo/src/pages \
  /opt/novnc \
  /opt/duckdb_data

# 8. Copiar fuentes de la aplicación
info "Copiando duckdb_server.py y ventas_demo.md..."
SRC="$SCRIPT_DIR"
if [[ ! -f "$SRC/duckdb_server.py" ]]; then
  info "duckdb_server.py no encontrado en \$SCRIPT_DIR, usando \$REAL_HOME"
  SRC="$REAL_HOME"
fi
cp "$SRC/duckdb_server.py" /opt/duckdb_server/duckdb_server.py
if [[ -f "$SRC/ventas_demo.md" ]]; then
  cp "$SRC/ventas_demo.md" /opt/ventas-demo/src/pages/ventas_demo.md
else
  info "ventas_demo.md no encontrado, omitiendo"
fi

# 9. Inicializar demo Evidence sin interacción
info "Inicializando demo Evidence..."
cd /opt/ventas-demo
npx --yes degit evidence-dev/template . --force < /dev/null
npm install --silent --no-progress
npm run sources --silent
npm run build --silent

# 9.1 Si 'dist' existe, enlazar a 'build'
if [[ -d dist && ! -d build ]]; then
  ln -s dist build
  info "Enlace simbólico: build -> dist"
fi

# 10. Configurar servicios systemd
info "Configurando servicios systemd..."

# 10.1 XFCE4 headless con Xvfb y D-Bus
cat << 'EOF' > /etc/systemd/system/xfce4-xvfb.service
[Unit]
Description=XVFB + XFCE4 headless session
After=network.target dbus.service
Requires=dbus.service

[Service]
Type=simple
User=overlord
Environment=DISPLAY=:0
ExecStartPre=/usr/bin/Xvfb :0 -screen 0 1280x800x24
ExecStart=/usr/bin/dbus-launch --exit-with-session startxfce4
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 10.2 x11vnc para display :0
cat << 'EOF' > /etc/systemd/system/x11vnc.service
[Unit]
Description=x11vnc on display :0
After=xfce4-xvfb.service

[Service]
Type=simple
User=overlord
Environment=DISPLAY=:0
ExecStart=/usr/bin/x11vnc -forever -nopw -shared -display :0 -rfbport 5900
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 10.3 noVNC WebSocket proxy
cat << 'EOF' > /etc/systemd/system/novnc.service
[Unit]
Description=noVNC WebSocket proxy
After=network.target x11vnc.service

[Service]
Type=simple
User=overlord
ExecStart=/usr/bin/websockify --web=/usr/share/novnc 6080 localhost:5900
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 10.4 DuckDB API service
cat << EOF > /etc/systemd/system/duckdb-server.service
[Unit]
Description=DuckDB Server
After=network.target

[Service]
Environment="DUCKDB_PORT=1294"
Environment="DUCKDB_SERVER_KEY=${API_KEY}"
Environment="DUCKDB_DATA_DIR=/opt/duckdb_data"
ExecStart=/usr/bin/python3 /opt/duckdb_server/duckdb_server.py
WorkingDirectory=/opt/duckdb_server
Restart=always
User=overlord

[Install]
WantedBy=multi-user.target
EOF

# 11. Configurar nginx para demo
info "Configurando nginx..."
rm -f /etc/nginx/sites-enabled/default
cat << 'EOF' > /etc/nginx/sites-available/ventas-demo
server {
    listen 80 default_server;
    server_name _;
    location = /ventas-demo { return 301 /ventas-demo/; }
    location /ventas-demo/ {
      alias /opt/ventas-demo/build/;
      index index.html;
      try_files $uri $uri/ /ventas-demo/index.html;
    }
}
EOF
ln -sf /etc/nginx/sites-available/ventas-demo /etc/nginx/sites-enabled/ventas-demo
systemctl restart nginx

# 12. Habilitar y arrancar servicios
info "Habilitando y arrancando servicios..."
systemctl daemon-reload
for svc in xfce4-xvfb x11vnc novnc duckdb-server nginx; do
  systemctl enable "$svc"
  systemctl start ""$svc""
done

# 13. Configurar directorio de datos y permisos
mkdir -p /opt/duckdb_data
chown overlord:overlord /opt/duckdb_data

# 14. Dar permisos al script y reiniciar servicio API
chmod +x /opt/duckdb_server/duckdb_server.py
systemctl daemon-reload
systemctl restart duckdb-server

# 15. Verificar estado del servicio API sin detener el script
systemctl status duckdb-server -n 20

# 16. Mensaje final
info "Instalación completa."
echo "Demo Evidence: http://<TU_IP>/ventas-demo/"
echo "DuckDB API: http://<TU_IP>:1294 (clave: ${API_KEY})"
echo "noVNC (XFCE4) en puerto 6080: http://<TU_IP>:6080/vnc.html"


