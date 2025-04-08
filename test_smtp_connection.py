#!/usr/bin/env python
"""
Script para probar la conexión SMTP y envío de correo
"""
import os
import sys
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import time
import socket  # Para establecer timeout

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('test_smtp')

# Credenciales y configuración para ambas cuentas
configs = [
    {
        'name': 'Cuenta info - Puerto 587',
        'servidor_entrada': 'imap.dreamhost.com',
        'servidor_salida': 'smtp.dreamhost.com',
        'puerto_salida': 587,
        'usar_tls_salida': True,
        'usuario': 'info@sage.vidahub.ai',
        'password': 'krx32aFF'
    },
    {
        'name': 'Cuenta info - Puerto 465',
        'servidor_entrada': 'imap.dreamhost.com',
        'servidor_salida': 'smtp.dreamhost.com',
        'puerto_salida': 465,
        'usar_tls_salida': False,  # No se usa STARTTLS en el puerto 465
        'usuario': 'info@sage.vidahub.ai',
        'password': 'krx32aFF'
    },
    {
        'name': 'Cuenta casilla45 - Puerto 587',
        'servidor_entrada': 'imap.dreamhost.com',
        'servidor_salida': 'smtp.dreamhost.com',
        'puerto_salida': 587,
        'usar_tls_salida': True,
        'usuario': 'casilla45@sage.vidahub.ai',
        'password': 'krx32aFF'
    },
    {
        'name': 'Cuenta casilla45 - Puerto 465',
        'servidor_entrada': 'imap.dreamhost.com',
        'servidor_salida': 'smtp.dreamhost.com',
        'puerto_salida': 465,
        'usar_tls_salida': False,  # No se usa STARTTLS en el puerto 465
        'usuario': 'casilla45@sage.vidahub.ai',
        'password': 'krx32aFF'
    }
]

# Función para probar envío SMTP
def test_smtp_connection(config):
    logger.info(f"===== Probando SMTP para {config['name']} =====")
    logger.info(f"Configuración: {config['servidor_salida']}:{config['puerto_salida']} (TLS: {config['usar_tls_salida']})")
    
    try:
        # Crear mensaje
        msg = MIMEMultipart()
        msg['From'] = config['usuario']
        msg['To'] = config['usuario']  # Enviar a la misma cuenta para autoverificación
        msg['Subject'] = f"Test SMTP desde {config['name']} - {time.strftime('%H:%M:%S')}"
        
        # Contenido de prueba
        body = f"""
Este es un mensaje de prueba para verificar la conexión SMTP.
Enviado desde: {config['usuario']}
Servidor SMTP: {config['servidor_salida']}
Puerto: {config['puerto_salida']}
Hora: {time.strftime('%Y-%m-%d %H:%M:%S')}
"""
        msg.attach(MIMEText(body, 'plain'))
        
        logger.info(f"Mensaje preparado. Intentando conectar a {config['servidor_salida']}:{config['puerto_salida']}")
        
        # Conexión SMTP
        if config['puerto_salida'] == 465:
            # Usar SSL directo para puerto 465
            logger.info("Usando conexión SMTP_SSL (puerto 465)")
            with smtplib.SMTP_SSL(config['servidor_salida'], config['puerto_salida']) as server:
                logger.info("Servidor conectado, intentando login...")
                server.login(config['usuario'], config['password'])
                logger.info(f"Login exitoso como {config['usuario']}")
                
                # Realizar envío real
                logger.info("Realizando envío de prueba...")
                server.send_message(msg)
                logger.info("Envío de prueba completado exitosamente")
        else:
            # Usar StartTLS para puerto 587
            logger.info("Usando conexión SMTP con STARTTLS")
            
            # Establecer timeout más corto para evitar bloqueos
            socket.setdefaulttimeout(15)
            
            with smtplib.SMTP(config['servidor_salida'], config['puerto_salida']) as server:
                # Aumentar el nivel de debug del servidor
                server.set_debuglevel(2)
                
                logger.info("Enviando EHLO")
                server.ehlo()
                
                if config['usar_tls_salida']:
                    logger.info("Iniciando TLS")
                    try:
                        server.starttls()
                        server.ehlo()
                    except Exception as tls_err:
                        logger.error(f"Error en TLS: {str(tls_err)}")
                        # Si falla TLS, intentar sin él
                        logger.info("Intentando sin TLS...")
                
                logger.info(f"Intentando login con {config['usuario']}")
                server.login(config['usuario'], config['password'])
                logger.info("Login exitoso")
                
                # Realizar envío real
                logger.info("Realizando envío de prueba...")
                server.send_message(msg)
                logger.info("Envío de prueba completado exitosamente")
                
        return True
        
    except Exception as e:
        logger.error(f"Error en conexión SMTP: {str(e)}")
        import traceback
        logger.error(f"Detalles: {traceback.format_exc()}")
        return False

# Probar ambas configuraciones
for config in configs:
    success = test_smtp_connection(config)
    logger.info(f"Resultado para {config['name']}: {'ÉXITO' if success else 'FALLO'}\n")
    # Esperar un poco entre pruebas
    time.sleep(2)