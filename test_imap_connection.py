#!/usr/bin/env python
"""
Script para probar conexión IMAP directamente
"""
import imaplib
import sys
import logging

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('test_imap')

# Datos de conexión
server = 'imap.dreamhost.com'
port = 993
username = 'info@sage.vidahub.ai'
password = 'krx32aFF'

logger.info(f"Intentando conectar a {server}:{port} con usuario {username}")

try:
    # Crear conexión SSL
    mail = imaplib.IMAP4_SSL(server, port)
    logger.info("Conexión establecida, intentando login...")
    
    # Intentar login
    mail.login(username, password)
    logger.info("Login exitoso")
    
    # Seleccionar bandeja de entrada
    mail.select('INBOX')
    logger.info("Bandeja de entrada seleccionada")
    
    # Buscar todos los mensajes
    status, messages = mail.search(None, 'ALL')
    if status == 'OK':
        message_nums = messages[0].split()
        logger.info(f"Mensajes en bandeja: {len(message_nums)}")
    else:
        logger.error(f"Error al buscar mensajes: {status}")
    
    # Cerrar conexión
    mail.close()
    mail.logout()
    logger.info("Conexión cerrada correctamente")
    
except Exception as e:
    logger.error(f"Error en la conexión IMAP: {str(e)}")
    sys.exit(1)