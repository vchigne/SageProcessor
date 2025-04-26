#!/bin/bash

set -e

# --- Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- Funciones
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
error_exit() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# --- Verificación de parámetros
if [ -z "$1" ]; then
    error_exit "Uso: $0 <VNC_PASSWORD>"
fi
VNC_PASSWORD="$1"

# --- Variables
INSTALL_DIR="/opt/duckdb_server"
NOVNC_DIR="$INSTALL_DIR/novnc"
SYSTEMD_DIR="$INSTALL_DIR/systemd"
DUCKDB_API_PORT=1294
DISPLAY_NUMBER=":1"

# --- Actualizar e instalar paquetes
info "Actualizando sistema y paquetes necesarios..."
sudo apt update
sudo apt install -y python3 python3-pip xvfb x11vnc xfce4 xfce4-terminal git curl lsof net-tools

# --- Crear estructura de directorios
info "Creando directorios de instalación..."
sudo mkdir -p "$INSTALL_DIR"
sudo mkdir -p "$SYSTEMD_DIR"
sudo chown -R $USER:$USER "$INSTALL_DIR"

# --- Clonar noVNC
info "Clonando noVNC..."
git clone https://github.com/novnc/noVNC.git "$NOVNC_DIR"
cd "$NOVNC_DIR"
ln -sf vnc.html index.html

# --- Instalar websockify
info "Instalando websockify..."
sudo pip3 install websockify

# --- Instalar librerías Python para DuckDB
info "Instalando librerías de Python para DuckDB..."
sudo pip3 install duckdb flask flask-cors

# --- Crear servidor DuckDB básico
info "Creando servidor DuckDB API..."
cat > "$INSTALL_DIR/duckdb_server.py" <<EOF
from flask import Flask, request, jsonify
from flask_cors import CORS
import duckdb

app = Flask(__name__)
CORS(app)

DATABASE_FILE = '/opt/duckdb_server/data.db'
conn = duckdb.connect(database=DATABASE_FILE, read_only=False)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "version": duckdb.__version__})

@app.route('/query', methods=['POST'])
def query():
    sql = request.json.get('query', '')
    if not sql:
        return jsonify({"error": "No query provided"}), 400
    try:
        result = conn.execute(sql).fetchall()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=$DUCKDB_API_PORT)
EOF

# --- Crear scripts de control manual
info "Creando scripts manuales de control..."
cat > "$INSTALL_DIR/start_all.sh" <<EOF
#!/bin/bash
export DISPLAY=$DISPLAY_NUMBER
sudo systemctl start duckdb-xvfb duckdb-vnc duckdb-websockify duckdb-api
EOF

cat > "$INSTALL_DIR/stop_all.sh" <<EOF
#!/bin/bash
sudo systemctl stop duckdb-api duckdb-websockify duckdb-vnc duckdb-xvfb
EOF

chmod +x "$INSTALL_DIR/start_all.sh" "$INSTALL_DIR/stop_all.sh"

# --- Crear servicios systemd
info "Creando servicios systemd..."

# Servicio Xvfb
cat > "$SYSTEMD_DIR/duckdb-xvfb.service" <<EOF
[Unit]
Description=DuckDB Virtual Framebuffer X Server (Xvfb)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb $DISPLAY_NUMBER -screen 0 1280x800x24
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Servicio VNC
cat > "$SYSTEMD_DIR/duckdb-vnc.service" <<EOF
[Unit]
Description=DuckDB VNC Server
After=network.target duckdb-xvfb.service
Requires=duckdb-xvfb.service

[Service]
Type=simple
ExecStart=/usr/bin/x11vnc -display $DISPLAY_NUMBER -forever -shared -rfbport 5901 -passwd $VNC_PASSWORD
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Servicio Websockify (noVNC)
cat > "$SYSTEMD_DIR/duckdb-websockify.service" <<EOF
[Unit]
Description=DuckDB noVNC WebSocket Server
After=network.target duckdb-vnc.service
Requires=duckdb-vnc.service

[Service]
Type=simple
ExecStart=/usr/local/bin/websockify --web $NOVNC_DIR 0.0.0.0:6082 localhost:5901
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Servicio API DuckDB
cat > "$SYSTEMD_DIR/duckdb-api.service" <<EOF
[Unit]
Description=DuckDB API Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 $INSTALL_DIR/duckdb_server.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# --- Copiar servicios a systemd
info "Instalando servicios en systemd..."
sudo cp "$SYSTEMD_DIR/"*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable duckdb-xvfb duckdb-vnc duckdb-websockify duckdb-api

# --- Finalizar
success "¡Instalación completa!"
success "Reinicia el servidor o ejecuta: sudo systemctl start duckdb-xvfb duckdb-vnc duckdb-websockify duckdb-api"