#!/usr/bin/env python
"""
Script para probar el envío de emails usando el mismo código que el SAGE Daemon
"""
import os
import sys
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import socket
import time

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('test_smtp_sage')

# Configuración para las cuentas de correo
configs = [
    {
        'name': 'Cuenta info@sage.vidahub.ai',
        'email_casilla': None,
        'configuracion': {
            'servidor_entrada': 'imap.dreamhost.com',
            'puerto_entrada': 993,
            'protocolo_entrada': 'imap',
            'usar_ssl_entrada': True,
            'servidor_salida': 'smtp.dreamhost.com',
            'puerto_salida': 587,
            'usar_tls_salida': True,
            'usuario': 'info@sage.vidahub.ai',
            'password': 'krx32aFF'
        }
    },
    {
        'name': 'Cuenta casilla45@sage.vidahub.ai',
        'email_casilla': 'casilla45@sage.vidahub.ai',
        'configuracion': {
            'servidor_entrada': 'imap.dreamhost.com',
            'puerto_entrada': 993,
            'protocolo_entrada': 'imap',
            'usar_ssl_entrada': True,
            'servidor_salida': 'smtp.dreamhost.com',
            'puerto_salida': 587,
            'usar_tls_salida': True,
            'usuario': 'casilla45@sage.vidahub.ai',
            'password': 'krx32aFF'
        }
    }
]

def test_sage_smtp(config):
    """Prueba envío de email usando el código exacto de SAGE Daemon"""
    logger.info(f"===== Probando envío SMTP con {config['name']} =====")
    
    try:
        # Exactamente el mismo código que usa SAGE Daemon para enviar emails
        conf = config['configuracion']
        
        # Crear mensaje de respuesta
        msg = MIMEMultipart()
        msg['From'] = conf['usuario']
        # Para pruebas reales, enviamos a una dirección real
        # En pruebas iniciales, se puede usar la propia cuenta como destino
        to_address = None
        
        # Si existe un argumento en línea de comandos, lo usamos como destinatario de prueba
        import sys
        if len(sys.argv) > 1 and '@' in sys.argv[1]:
            to_address = sys.argv[1]
            logger.info(f"Usando dirección de prueba de línea de comandos: {to_address}")
        else:
            # De lo contrario, usamos la misma cuenta (loopback seguro)
            to_address = conf['usuario']
            logger.info(f"No se especificó dirección de destino. Usando loopback a: {to_address}")
            
        msg['To'] = to_address
        # No enviamos copias a nosotros mismos para evitar bloqueos
        msg['Subject'] = f"Test SAGE Daemon SMTP desde {config['name']} - {time.strftime('%H:%M:%S')}"

        # Contenido del mensaje
        body = f"""
Este es un mensaje de prueba para verificar la conexión SMTP de SAGE Daemon.

Enviado desde: {conf['usuario']}
Servidor SMTP: {conf.get('servidor_salida', 'N/A')}
Puerto: {conf.get('puerto_salida', 'N/A')}
Usar TLS: {conf.get('usar_tls_salida', 'N/A')}
Hora: {time.strftime('%Y-%m-%d %H:%M:%S')}

Este mensaje simula exactamente el código que usa SAGE Daemon para enviar correos.
"""
        msg.attach(MIMEText(body, 'plain'))

        # Enviar el correo - siempre inicializar variables
        smtp_server = conf.get('servidor_salida', '')
        if not smtp_server:
            logger.warning("No se encontró servidor_salida, usando servidor_entrada como fallback")
            smtp_server = conf.get('servidor_entrada', '')

        # Obtener puerto de salida - inicializar con valor por defecto
        smtp_port = 587  # Puerto SMTP estándar por defecto
        puerto_salida = conf.get('puerto_salida')
        if puerto_salida:
            if isinstance(puerto_salida, int):
                smtp_port = puerto_salida
            else:
                try:
                    smtp_port = int(puerto_salida)
                except (ValueError, TypeError):
                    logger.warning(f"Puerto de salida inválido: {puerto_salida}, usando puerto SMTP estándar {smtp_port}")
        else:
            logger.warning(f"No se encontró puerto_salida, usando puerto SMTP estándar {smtp_port}")

        # Verificar si se debe usar TLS
        usar_tls = conf.get('usar_tls_salida', True)
        logger.info(f"Enviando mensaje vía {smtp_server}:{smtp_port} (TLS: {usar_tls})")
        logger.info(f"Mensaje: De: {msg['From']} - Para: {msg['To']} - Asunto: {msg['Subject']}")
        logger.info(f"Contenido del mensaje: {body}")

        # Obtener contraseña real
        password_real = conf['password']
        logger.debug(f"SMTP: Usando contraseña real (longitud: {len(password_real)})")
        
        # Establecer timeout más corto para diagnósticos
        socket.setdefaulttimeout(20)
        
        # Si el puerto es 465, usamos SMTP_SSL directamente
        if smtp_port == 465:
            logger.info("Usando conexión SMTP_SSL para puerto 465")
            with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
                server.set_debuglevel(2)  # Aumentar nivel de debug
                logger.info(f"Intentando login con {conf['usuario']}")
                server.login(conf['usuario'], password_real)
                logger.info("Login exitoso, enviando mensaje")
                server.send_message(msg)
                logger.info("Mensaje enviado exitosamente")
        else:
            # Para otros puertos (587, etc) usamos STARTTLS si es necesario
            logger.info(f"Usando conexión SMTP regular para puerto {smtp_port}")
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.set_debuglevel(2)  # Aumentar nivel de debug
                
                logger.info("Enviando EHLO")
                server.ehlo()
                
                if usar_tls:
                    logger.info("Iniciando TLS")
                    try:
                        server.starttls()
                        server.ehlo()
                    except Exception as tls_err:
                        logger.error(f"Error en TLS: {str(tls_err)}")
                        logger.error("Intentando sin TLS como último recurso...")
                
                logger.info(f"Intentando login con {conf['usuario']}")
                server.login(conf['usuario'], password_real)
                logger.info("Login exitoso, enviando mensaje")
                server.send_message(msg)
                logger.info("Mensaje enviado exitosamente")

        logger.info(f"Mensaje de prueba enviado desde {conf['usuario']}")
        return True
        
    except Exception as e:
        # Asegurarnos que tengamos información para diagnosticar
        conf = config.get('configuracion', {})
        server_info = f"{conf.get('servidor_salida', 'unknown')}:{conf.get('puerto_salida', '?')}"
        logger.error(f"Error enviando mensaje vía {server_info}: {str(e)}")
        
        # Mostrar más detalles para depuración
        import traceback
        logger.error(f"Detalles de error de envío: {traceback.format_exc()}")
        return False

# Probar envío solo con la casilla45
success = test_sage_smtp(configs[1])  # Usamos la segunda configuración (casilla45)
logger.info(f"Resultado para {configs[1]['name']}: {'ÉXITO' if success else 'FALLO'}\n")