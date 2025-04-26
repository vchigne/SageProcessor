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

# --- Verificación de parámetros opcionales
VNC_PASSWORD=${1:-"admin"}
DISPLAY_NUMBER=":1"
INSTALL_DIR="/opt/duckdb_server"

# --- Comprobar servicios existentes
info "Verificando servicios instalados..."
if ! systemctl list-unit-files | grep -q "duckdb-xvfb.service"; then
    error_exit "Los servicios systemd no están instalados. Ejecute primero install_duckdb_systemd.sh"
fi

# --- Detener servicios
info "Deteniendo servicios..."
sudo systemctl stop duckdb-api duckdb-websockify duckdb-vnc duckdb-xvfb || true

# --- Verificar y reparar Xvfb
info "Reparando servidor Xvfb..."
# Matar cualquier proceso Xvfb residual
sudo pkill -f "Xvfb $DISPLAY_NUMBER" || true
sleep 1
# Reiniciar servicio Xvfb
sudo systemctl reset-failed duckdb-xvfb || true
sudo systemctl start duckdb-xvfb
sleep 2

# --- Verificar y reparar VNC
info "Reparando servidor VNC..."
# Matar cualquier proceso x11vnc residual
sudo pkill -f "x11vnc -display $DISPLAY_NUMBER" || true
sleep 1
# Configurar contraseña VNC
if [ -d "$HOME/.vnc" ]; then
    sudo mkdir -p "$HOME/.vnc"
fi
echo "$VNC_PASSWORD" | vncpasswd -f > "$HOME/.vnc/passwd"
chmod 600 "$HOME/.vnc/passwd"
# Reiniciar servicio VNC
sudo systemctl reset-failed duckdb-vnc || true
sudo systemctl start duckdb-vnc
sleep 2

# --- Verificar y reparar WebSocket/noVNC
info "Reparando servidor noVNC WebSocket..."
# Matar cualquier proceso websockify residual
sudo pkill -f "websockify --web" || true
sleep 1
# Reiniciar servicio websockify
sudo systemctl reset-failed duckdb-websockify || true
sudo systemctl start duckdb-websockify
sleep 2

# --- Verificar y reparar API de DuckDB
info "Reparando servidor API DuckDB..."
# Matar cualquier proceso DuckDB server API residual
sudo pkill -f "python3 $INSTALL_DIR/duckdb_server.py" || true
sleep 1
# Reiniciar servicio de API
sudo systemctl reset-failed duckdb-api || true
sudo systemctl start duckdb-api
sleep 2

# --- Verificar estado final
info "Verificando estado final de servicios..."
systemctl is-active duckdb-xvfb && success "Servicio Xvfb activo" || error_exit "Error: Servicio Xvfb no está activo"
systemctl is-active duckdb-vnc && success "Servicio VNC activo" || error_exit "Error: Servicio VNC no está activo"
systemctl is-active duckdb-websockify && success "Servicio WebSocket activo" || error_exit "Error: Servicio WebSocket no está activo"
systemctl is-active duckdb-api && success "Servicio DuckDB API activo" || error_exit "Error: Servicio DuckDB API no está activo"

# --- Verificar puertos
info "Verificando puertos..."
ss -ltn | grep -q ":5901" && success "Puerto VNC 5901 abierto" || error_exit "Error: Puerto VNC 5901 no está abierto"
ss -ltn | grep -q ":6082" && success "Puerto noVNC 6082 abierto" || error_exit "Error: Puerto noVNC 6082 no está abierto"
ss -ltn | grep -q ":1294" && success "Puerto DuckDB API 1294 abierto" || error_exit "Error: Puerto DuckDB API 1294 no está abierto"

success "Reparación VNC completada exitosamente!"
success "Puedes acceder a:"
success "- VNC nativo en puerto 5901"
success "- noVNC web en http://este-servidor:6082/vnc.html"
success "- API DuckDB en http://este-servidor:1294"