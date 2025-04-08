#!/usr/bin/env python
"""
Script simplificado para probar el EmailMonitor después de las correcciones
"""
import os
import sys
import logging
import imaplib

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('test_email_monitor')

# Importar EmailMonitor después de configurar el logging
from sage_daemon.monitors import EmailMonitor

# Crear instancia del monitor
monitor = EmailMonitor()

# Credenciales y configuración
account = 'casilla45@sage.vidahub.ai'
password = 'krx32aFF'

# Configuración para probar
config = {
    'id': 49,
    'configuracion': {
        'servidor_entrada': 'imap.dreamhost.com',
        'puerto_entrada': 993,
        'protocolo_entrada': 'imap',
        'usar_ssl_entrada': True,
        'servidor_salida': 'smtp.dreamhost.com',
        'puerto_salida': 587,
        'usar_tls_salida': True,
        'usuario': account,
        'password': password
    }
}

logger.info("============= PRUEBA SIMPLE DEL MONITOR =============")
try:
    # Crear copia antes de logging (para evitar modificaciones)
    config_log = {
        'id': config['id'],
        'configuracion': {
            key: '******' if key == 'password' else value 
            for key, value in config['configuracion'].items()
        }
    }
    logger.info(f"Configuración: {config_log}")
    
    # Probar conexión IMAP con el monitor
    logger.info(f"Probando conexión como {account}...")
    result = monitor.check_new_files(config)
    
    logger.info(f"Resultado exitoso: {result}")
    logger.info("La conexión IMAP funciona correctamente con el monitor.")
    
except Exception as e:
    logger.error(f"Error en el monitor: {str(e)}")