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

# --- Variables
SERVICES=("duckdb-xvfb" "duckdb-vnc" "duckdb-websockify" "duckdb-api")
PORTS=(5901 6082 1294)
API_HEALTH_URL="http://localhost:1294/health"

# --- Validar servicios systemd
info "Verificando servicios de systemd..."
for service in "${SERVICES[@]}"; do
    if systemctl is-active --quiet "$service"; then
        success "Servicio $service está activo"
    else
        error_exit "Servicio $service NO está activo"
    fi
done

# --- Validar puertos
info "Verificando puertos abiertos..."
for port in "${PORTS[@]}"; do
    if sudo ss -ltnp | grep -q ":$port"; then
        success "Puerto $port escuchando"
    else
        error_exit "Puerto $port NO está escuchando"
    fi
done

# --- Validar proceso Xvfb
info "Verificando proceso Xvfb..."
if pgrep -f "Xvfb :1" > /dev/null; then
    success "Proceso Xvfb encontrado"
else
    error_exit "Proceso Xvfb NO encontrado"
fi

# --- Validar proceso x11vnc
info "Verificando proceso x11vnc..."
if pgrep -f "x11vnc" > /dev/null; then
    success "Proceso x11vnc encontrado"
else
    error_exit "Proceso x11vnc NO encontrado"
fi

# --- Validar proceso websockify
info "Verificando proceso websockify..."
if pgrep -f "websockify" > /dev/null; then
    success "Proceso websockify encontrado"
else
    error_exit "Proceso websockify NO encontrado"
fi

# --- Validar API de DuckDB
info "Validando respuesta de API DuckDB..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_HEALTH_URL")

if [ "$RESPONSE" -eq 200 ]; then
    success "La API de DuckDB respondió correctamente (HTTP 200)"
else
    error_exit "La API de DuckDB no respondió correctamente (código HTTP: $RESPONSE)"
fi

success "¡Validación completa y exitosa! El servidor DuckDB está funcionando correctamente."