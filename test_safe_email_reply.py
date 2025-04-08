#!/usr/bin/env python3
"""
Script para probar envío seguro de correos - versión optimizada

Este script envía un correo de prueba a las direcciones especificadas
usando las mismas credenciales y configuración del sistema SAGE,
pero con las optimizaciones de seguridad implementadas:

1. Validación de direcciones mejorada
2. Lista reducida de dominios bloqueados
3. Encabezados de prioridad alta
4. Manejo mejorado de TLS/SSL

Uso:
  python3 test_safe_email_reply.py <email_destino>
  
  Si no se especifica email_destino, se usará info@sage.vidahub.ai
"""

import sys
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_safe_email")

def enviar_email_seguro(destinatario):
    """Envía un email de prueba con configuración de seguridad optimizada"""
    
    # Configuración SMTP fija para casilla45
    config = {
        'servidor': 'smtp.dreamhost.com',
        'puerto': 587,
        'usuario': 'casilla45@sage.vidahub.ai',
        'password': 'krx32aFF',
        'usar_tls': True
    }
    
    # Validar que el destinatario no sea un dominio bloqueado
    if '@' not in destinatario:
        logger.error(f"Dirección inválida sin @: {destinatario}")
        return False
    
    domain = destinatario.split('@')[-1].lower()
    blocked_domains = ['example.com', 'example.org', 'example.net', 'mailchannels.net']
    
    if domain in blocked_domains:
        logger.error(f"Dominio bloqueado: {domain}")
        return False
    
    # Crear mensaje con prioridad alta
    msg = MIMEMultipart()
    msg['From'] = config['usuario']
    msg['To'] = destinatario
    msg['Subject'] = f"Prueba de Envío Seguro - {datetime.now().strftime('%H:%M:%S')}"
    
    # Encabezados de prioridad alta
    msg['X-Priority'] = '1'
    msg['X-MSMail-Priority'] = 'High'
    msg['Importance'] = 'High'
    
    body = f"""
Esto es una prueba de envío seguro de email.

El sistema SAGE ha sido actualizado para mejorar la entrega de correos.
Esta prueba está usando las nuevas configuraciones de seguridad:

1. Validación mejorada de direcciones
2. Lista reducida de dominios bloqueados
3. Encabezados de prioridad alta
4. Manejo mejorado de TLS/SSL

Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Enviado a: {destinatario}
Desde: {config['usuario']}
"""
    
    msg.attach(MIMEText(body, 'plain'))
    
    logger.warning(f"=== ENVÍO DE PRUEBA CON PRIORIDAD ALTA: {destinatario} ===")
    logger.info(f"Configuración: {config['servidor']}:{config['puerto']} (TLS: {config['usar_tls']})")
    logger.info(f"De: {config['usuario']} - Para: {destinatario}")
    
    try:
        with smtplib.SMTP(config['servidor'], config['puerto']) as server:
            # Habilitar logging detallado
            server.set_debuglevel(1)
            
            # Iniciar sesión
            logger.info("Enviando EHLO")
            server.ehlo()
            
            # Iniciar TLS si es necesario
            if config['usar_tls']:
                logger.info("Iniciando TLS")
                server.starttls()
                server.ehlo()
            
            # Login
            logger.info(f"Realizando login con {config['usuario']}")
            server.login(config['usuario'], config['password'])
            
            # Enviar mensaje
            logger.info("Enviando mensaje...")
            server.send_message(msg)
            
            logger.info(f"Mensaje enviado exitosamente a {destinatario}")
            return True
            
    except Exception as e:
        logger.error(f"Error enviando mensaje: {str(e)}")
        return False

def main():
    """Función principal"""
    if len(sys.argv) > 1:
        destinatario = sys.argv[1]
    else:
        destinatario = "info@sage.vidahub.ai"  # Por defecto, enviar a info
    
    logger.info(f"Enviando prueba a {destinatario}")
    resultado = enviar_email_seguro(destinatario)
    
    if resultado:
        logger.info("PRUEBA EXITOSA ✓")
        sys.exit(0)
    else:
        logger.error("PRUEBA FALLIDA ✗")
        sys.exit(1)

if __name__ == "__main__":
    main()