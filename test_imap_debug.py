#!/usr/bin/env python
"""
Script para probar conexión IMAP con depuración detallada
"""
import imaplib
import sys
import logging

# Mejor manera de habilitar depuración en imaplib
# Configuramos la depuración global para IMAP4
imaplib.IMAP4.debug = 4  # Nivel más alto de depuración

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('test_imap_debug')

# Primera cuenta
logger.info("------------ PRUEBA CUENTA 1 ------------")
server = 'imap.dreamhost.com'
port = 993
username = 'info@sage.vidahub.ai'
password = 'krx32aFF'

logger.info(f"Intentando conectar a {server}:{port} con usuario {username}")

try:
    # Crear conexión SSL
    mail = imaplib.IMAP4_SSL(server, port)
    logger.info("Conexión establecida, intentando login...")
    
    # Intentar login con captura de la excepción completa
    try:
        mail.login(username, password)
        logger.info("Login exitoso")
    except Exception as login_error:
        logger.error(f"Error en login: {str(login_error)}")
        logger.error(f"Tipo de error: {type(login_error)}")
        logger.error(f"Error completo: {repr(login_error)}")
    
    try:
        mail.logout()
        logger.info("Logout realizado")
    except:
        pass
        
except Exception as e:
    logger.error(f"Error en la conexión IMAP: {str(e)}")

# Segunda cuenta
logger.info("\n\n------------ PRUEBA CUENTA 2 ------------")
username = 'casilla45@sage.vidahub.ai'
password = 'krx32aFF'

logger.info(f"Intentando conectar a {server}:{port} con usuario {username}")

try:
    # Crear conexión SSL
    mail = imaplib.IMAP4_SSL(server, port)
    logger.info("Conexión establecida, intentando login...")
    
    # Intentar login con captura de la excepción completa
    try:
        mail.login(username, password)
        logger.info("Login exitoso")
    except Exception as login_error:
        logger.error(f"Error en login: {str(login_error)}")
        logger.error(f"Tipo de error: {type(login_error)}")
        logger.error(f"Error completo: {repr(login_error)}")
    
    try:
        mail.logout()
        logger.info("Logout realizado")
    except:
        pass
        
except Exception as e:
    logger.error(f"Error en la conexión IMAP: {str(e)}")