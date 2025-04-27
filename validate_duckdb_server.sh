#!/bin/bash

# validate_duckdb_server.sh
# Validación completa de DuckDB Server, noVNC y XFCE4
set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Funciones de logging
define_info()    { echo -e "${BLUE}[INFO]${NC}    $1"; }
define_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
define_error()   { echo -e "${RED}[ERROR]${NC}   $1"; exit 1; }

# Requiere root
define_info "Verificando permisos..."
if [[ $EUID -ne 0 ]]; then
  define_error "Este script debe ejecutarse con sudo o root."
fi

# Servicios a validar
SERVICES=(xfce4-xvfb x11vnc novnc duckdb-server nginx)
# Puertos a validar
PORTS=(5900 6080 1294)
# Endpoint salud de DuckDB API
API_HEALTH_URL="http://127.0.0.1:1294/health"

# 1. Servicios systemd
define_info "Verificando servicios systemd..."
for svc in "${SERVICES[@]}"; do
  if systemctl is-active --quiet "$svc"; then
    define_success "Servicio $svc está activo"
  else
    define_error "Servicio $svc NO está activo"
  fi
done

# 2. Puertos abiertos
define_info "Verificando puertos TCP escuchando..."
for port in "${PORTS[@]}"; do
  # Detectar listeners incluso en loopback
  if ss -ltnp | grep -q ":[0-9]*:${port}\b"; then
    define_success "Puerto $port escuchando"
  else
    define_error "Puerto $port NO está escuchando"
  fi
done

# 3. Procesos en ejecución
define_info "Verificando procesos de Xvfb, x11vnc y websockify..."
pgrep -f "Xvfb :0" >/dev/null && define_success "Xvfb activo" || define_error "Xvfb NO encontrado"
pgrep -f "x11vnc" >/dev/null && define_success "x11vnc activo" || define_error "x11vnc NO encontrado"
pgrep -f "websockify" >/dev/null && define_success "websockify activo" || define_error "websockify NO encontrado"

# 4. Proceso DuckDB Server
define_info "Verificando proceso DuckDB Server..."
pgrep -f "duckdb_server.py" >/dev/null && define_success "DuckDB Server activo" || define_error "DuckDB Server NO encontrado"

# 5. CLI de DuckDB
define_info "Verificando CLI de DuckDB..."
if command -v duckdb >/dev/null 2>&1; then
  VERS=$(duckdb --version 2>&1)
  define_success "DuckDB CLI disponible ($VERS)"
else
  define_error "DuckDB CLI no encontrada en PATH"
fi

# 6. Endpoint salud de API
define_info "Validando endpoint de salud de DuckDB API..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_HEALTH_URL")
if [[ "$HTTP_CODE" -eq 200 ]]; then
  define_success "API DuckDB respondió HTTP 200"
else
  define_error "API DuckDB fallo (HTTP $HTTP_CODE)"
fi

define_success "¡Todas las validaciones pasaron correctamente!"
