#!/bin/bash

# cleanup_duckdb_server.sh
# Script para desinstalar completamente DuckDB Server, entorno gráfico y demo
set -e

# Colores para salidas
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Funciones de salida
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
error_exit() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Comprobar ejecución como root
if [ "$EUID" -ne 0 ]; then
  error_exit "Este script requiere permisos de root. Por favor ejecútalo con sudo."
fi

# Detectar home real del invocador
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
  REAL_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
else
  REAL_HOME="$HOME"
fi

SERVICES=(duckdb-server duckdb-vnc duckdb-xvfb duckdb-x11vnc duckdb-websockify nginx)

# 1. Detener servicios
info "Deteniendo servicios antiguos si existen..."
for svc in "${SERVICES[@]}"; do
  systemctl --no-ask-password stop "$svc".service >/dev/null 2>&1 || true
done

# 2. Deshabilitar servicios en arranque
info "Deshabilitando servicios de arranque..."
for svc in "${SERVICES[@]}"; do
  systemctl --no-ask-password disable "$svc".service >/dev/null 2>&1 || true
done

# 3. Eliminar archivos de servicios systemd
info "Eliminando archivos de servicios systemd..."
for svc in duckdb-server duckdb-vnc duckdb-xvfb duckdb-x11vnc duckdb-websockify; do
  rm -f /etc/systemd/system/${svc}.service
done
systemctl --no-ask-password daemon-reload >/dev/null 2>&1 || true

# 4. Eliminar directorios de la aplicación y datos
info "Eliminando directorios de instalación y datos..."
rm -rf /opt/duckdb_server /opt/ventas-demo /opt/novnc /opt/duckdb_data || true

# 5. Eliminar carpetas personales de prueba
info "Eliminando carpetas personales de usuario (prueba)..."
rm -rf "${REAL_HOME}/duckdb_server" "${REAL_HOME}/duckdb_data" || true

# 6. Eliminar DuckDB CLI instalado
info "Eliminando DuckDB CLI de ${REAL_HOME} y /root..."
rm -rf "${REAL_HOME}/.duckdb" /root/.duckdb || true

# 7. Desinstalar librerías Python
info "Desinstalando librerías Python..."
pip3 uninstall -y duckdb flask flask-cors waitress yato-lib >/dev/null 2>&1 || true

# 8. Limpiar configuración nginx
info "Limpiando configuración de nginx para ventas-demo..."
rm -f /etc/nginx/sites-enabled/ventas-demo /etc/nginx/sites-available/ventas-demo
if [ -f /etc/nginx/sites-available/default ]; then
  ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi
systemctl --no-ask-password restart nginx >/dev/null 2>&1 || true

# 9. Eliminar locks temporales de X11
info "Eliminando locks temporales de X11 si existen..."
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1 || true

# 10. Liberar puertos potencialmente ocupados
info "Liberando puertos potencialmente ocupados (5901, 6080, 6081, 6082)..."
for port in 5901 6080 6081 6082; do
  PID=$(ss -ltnp 2>/dev/null | grep ":${port}" | awk '{print $7}' | cut -d',' -f1 | cut -d'=' -f2)
  if [ -n "$PID" ]; then
    kill -9 "$PID" >/dev/null 2>&1 || true
    success "Liberado puerto $port (PID: $PID)"
  fi
done

success "Limpieza completa. El sistema queda listo para una nueva instalación."
