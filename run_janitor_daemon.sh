#!/bin/bash
# Script para ejecutar el Janitor Daemon

# Configurar el entorno
export PYTHONPATH=$(pwd)

# Crear directorio de logs si no existe
mkdir -p logs

# Registrar inicio en el log
echo "[$(date)] Iniciando Janitor Daemon" >> logs/janitor.log

# Ejecutar el daemon
python janitor_daemon.py >> logs/janitor.log 2>&1

# Registrar finalización en el log
echo "[$(date)] Janitor Daemon finalizado" >> logs/janitor.log