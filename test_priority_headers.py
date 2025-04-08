#!/usr/bin/env python3
"""
Test de encabezados de prioridad en emails de SAGE

Este script envía un correo de prueba con encabezados de prioridad alta
para verificar que se configuran correctamente.
"""

import argparse
import logging
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_priority_headers")

def enviar_email_prioridad_alta(destinatario):
    """Envía un email de prueba con encabezados de prioridad alta"""
    
    try:
        # Configuración SMTP
        smtp_server = "smtp.dreamhost.com"
        smtp_port = 587
        smtp_usuario = "casilla45@sage.vidahub.ai"
        smtp_password = "krx32aFF"  # En producción usar variables de entorno
        
        # Crear mensaje
        msg = MIMEMultipart()
        msg['From'] = smtp_usuario
        msg['To'] = destinatario
        msg['Subject'] = f"Test Prioridad Alta - {datetime.now().strftime('%H:%M:%S')}"
        
        # Encabezados de prioridad alta
        msg['X-Priority'] = '1'
        msg['X-MSMail-Priority'] = 'High'
        msg['Importance'] = 'High'
        
        # Contenido del mensaje
        body = f"""
Este es un correo de prueba enviado con encabezados de prioridad alta.
Se configuraron los siguientes encabezados:
- X-Priority: 1
- X-MSMail-Priority: High
- Importance: High

Fecha y hora: {datetime.now().isoformat()}
De: {smtp_usuario}
Para: {destinatario}
"""
        msg.attach(MIMEText(body, 'plain'))
        
        # Mostrar configuración
        logger.info("==================================================")
        logger.info(f"PRUEBA: Envío prioritario a '{destinatario}'")
        logger.info("==================================================")
        logger.info(f"Configuración: {smtp_server}:{smtp_port} (TLS: True)")
        logger.info(f"Remitente: {smtp_usuario}")
        logger.info(f"Destinatario: {destinatario}")
        logger.info(f"Encabezados de prioridad: X-Priority=1, X-MSMail-Priority=High, Importance=High")
        
        # Timeout para evitar bloqueos
        import socket
        socket.setdefaulttimeout(30)  # 30 segundos de timeout
        
        # Conectar y enviar
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            # Activar debug para ver la conversación SMTP
            server.set_debuglevel(1)
            
            logger.info("Enviando EHLO")
            server.ehlo()
            
            logger.info("Iniciando TLS")
            server.starttls()
            server.ehlo()
            
            logger.info(f"Realizando login con {smtp_usuario}")
            server.login(smtp_usuario, smtp_password)
            
            logger.info(f"Enviando mensaje a {destinatario}...")
            server.send_message(msg)
            logger.info(f"Mensaje enviado exitosamente a {destinatario}")
            
        print("\n--------------------------------------------------")
        print("✅ RESULTADO: Mensaje enviado exitosamente")
        return True
        
    except Exception as e:
        logger.error(f"Error enviando email: {str(e)}")
        print("\n--------------------------------------------------")
        print(f"❌ ERROR: {str(e)}")
        return False

def main():
    """Función principal"""
    
    parser = argparse.ArgumentParser(description='Test de encabezados de prioridad alta en correos')
    parser.add_argument('destinatario', nargs='?', default='info@sage.vidahub.ai',
                      help='Dirección de correo de destino (default: info@sage.vidahub.ai)')
    args = parser.parse_args()
    
    result = enviar_email_prioridad_alta(args.destinatario)
    sys.exit(0 if result else 1)

if __name__ == "__main__":
    main()