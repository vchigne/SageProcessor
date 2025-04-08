#!/usr/bin/env python3
"""
Script para probar respuesta directa al remitente original

Este script prueba específicamente la capacidad de SAGE para responder 
correctamente al remitente original de un correo, usando los encabezados
adecuados para garantizar que la respuesta sea reconocida como un 
REPLY legítimo y no como un nuevo correo.

Incluye:
1. Creación de un correo simulado con un Message-ID real
2. Respuesta apropiada con encabezados In-Reply-To y References
3. Verificación detallada del proceso

Uso:
  python3 test_direct_reply_to_sender.py <email_destino>
  
  Si no se especifica email_destino, se usará info@sage.vidahub.ai
"""

import sys
import logging
import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_direct_reply")

def enviar_respuesta_directa(remitente_original):
    """Simula el envío de una respuesta directa a un remitente original"""
    
    # Configuración SMTP fija para casilla45
    config = {
        'servidor': 'smtp.dreamhost.com',
        'puerto': 587,
        'usuario': 'casilla45@sage.vidahub.ai',
        'password': 'krx32aFF',
        'usar_tls': True
    }
    
    # Validar que la dirección no sea un dominio bloqueado
    if '@' not in remitente_original:
        logger.error(f"Dirección inválida sin @: {remitente_original}")
        return False
    
    domain = remitente_original.split('@')[-1].lower()
    blocked_domains = [
        'example.com', 'example.org', 'example.net', 
        'invalid.com', 'invalid.domain', 
        'mailchannels.net'  # Bloqueamos MailChannels porque causa rebotes
    ]
    
    if domain in blocked_domains:
        logger.error(f"Dominio bloqueado: {domain}")
        return False
    
    if remitente_original.lower() == config['usuario'].lower():
        logger.error(f"No se puede enviar respuesta a la misma casilla: {remitente_original}")
        return False
    
    # Generar un ID de mensaje único para el correo original simulado
    original_message_id = f"<original-{uuid.uuid4().hex}@{domain}>"
    reply_message_id = f"<reply-{uuid.uuid4().hex}@sage.vidahub.ai>"
    
    # DIFERENCIA CLAVE: Simulamos primero un correo original para luego responderlo
    logger.warning("=== SIMULANDO CORREO ORIGINAL ===")
    logger.info(f"From: {remitente_original}")
    logger.info(f"To: {config['usuario']}")
    logger.info(f"Message-ID: {original_message_id}")
    
    # Crear mensaje como si fuera una respuesta a un correo existente
    msg = MIMEMultipart()
    msg['From'] = config['usuario']  # Quien responde (SAGE)
    msg['To'] = remitente_original   # Destinatario (remitente original)
    msg['Subject'] = f"Re: Prueba de respuesta directa - {datetime.now().strftime('%H:%M:%S')}"
    
    # Encabezados de prioridad alta
    msg['X-Priority'] = '1'
    msg['X-MSMail-Priority'] = 'High'
    msg['Importance'] = 'High'
    
    # CLAVE: Estos encabezados son cruciales para que sea reconocido como respuesta
    msg['Message-ID'] = reply_message_id
    msg['In-Reply-To'] = original_message_id
    msg['References'] = original_message_id
    
    # Encabezados para evitar clasificación como spam
    msg['Precedence'] = 'bulk'  # Indica que es un mensaje automático
    msg['Auto-Submitted'] = 'auto-replied'  # Indica que es una respuesta automática
    
    # Contenido del mensaje - similar al de SAGE Daemon pero más detallado para diagnóstico
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    body = f"""
Estimado/a Usuario,

Esta es una respuesta directa a su correo original (simulado).

Mensaje original ID: {original_message_id}
Mensaje respuesta ID: {reply_message_id}

Este mensaje está configurado como un REPLY directo a su correo original,
utilizando los encabezados adecuados (In-Reply-To y References) para que
su cliente de correo lo muestre correctamente en el hilo de conversación.

==========
Este es un mensaje de prueba enviado por test_direct_reply_to_sender.py
Fecha y hora: {timestamp}
==========
"""
    
    msg.attach(MIMEText(body, 'plain', 'utf-8'))
    
    logger.warning(f"=== ENVIANDO RESPUESTA DIRECTA A: {remitente_original} ===")
    logger.info(f"Configuración: {config['servidor']}:{config['puerto']} (TLS: {config['usar_tls']})")
    logger.info(f"De: {config['usuario']} - Para: {remitente_original}")
    logger.info(f"Referencia a mensaje original: {original_message_id}")
    
    # Usar el método mejorado de envío de correos
    return enviar_correo_smtp(
        smtp_server=config['servidor'],
        smtp_port=config['puerto'],
        usuario=config['usuario'],
        password=config['password'],
        mensaje=msg,
        reply_to_address=remitente_original,
        usar_tls=config['usar_tls']
    )

# Implementación del método de envío SMTP con mejor manejo de errores
def enviar_correo_smtp(smtp_server, smtp_port, usuario, password, mensaje, reply_to_address, usar_tls=True):
    """
    Método centralizado para enviar correos SMTP con mejor manejo de errores
    
    Args:
        smtp_server: Servidor SMTP
        smtp_port: Puerto SMTP
        usuario: Usuario para autenticación
        password: Contraseña para autenticación
        mensaje: Objeto MIMEMultipart con el mensaje
        reply_to_address: Dirección del destinatario
        usar_tls: Si debe usar TLS
        
    Returns:
        bool: True si el envío fue exitoso, False en caso contrario
    """
    try:
        # Timeout para evitar bloqueos
        import socket
        socket.setdefaulttimeout(30)  # 30 segundos de timeout
        
        logger.info(f"Intentando enviar correo a {reply_to_address} vía {smtp_server}:{smtp_port}")
        
        # Si el puerto es 465, usamos SMTP_SSL directamente
        if smtp_port == 465:
            logger.debug("Usando conexión SMTP_SSL para puerto 465")
            with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
                # Aumentar nivel de debug para diagnóstico detallado
                server.set_debuglevel(1)
                
                logger.debug(f"Realizando login en {smtp_server}")
                server.login(usuario, password)
                logger.debug("Login exitoso, enviando mensaje")
                
                # Enviar mensaje con mejor manejo de errores
                try:
                    server.send_message(mensaje)
                    logger.warning(f"✅ ÉXITO: Mensaje enviado a {reply_to_address}")
                    return True
                except smtplib.SMTPRecipientsRefused as error:
                    logger.error(f"Destinatario rechazado: {reply_to_address}")
                    for recipient, (code, msg) in error.recipients.items():
                        logger.error(f"Rechazo para {recipient}: Código {code}, Mensaje: {msg}")
                    return False
        else:
            # Para otros puertos (587, etc) usamos STARTTLS si es necesario
            logger.debug(f"Usando conexión SMTP regular para puerto {smtp_port}")
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                # Aumentar nivel de debug para diagnóstico detallado
                server.set_debuglevel(1)
                
                logger.debug("Enviando EHLO")
                server.ehlo()
                
                if usar_tls:
                    logger.debug("Iniciando TLS")
                    try:
                        server.starttls()
                        server.ehlo()
                    except Exception as tls_err:
                        logger.error(f"Error en TLS: {str(tls_err)}")
                        logger.warning("Continuando sin TLS como último recurso")
                
                logger.debug(f"Realizando login en {smtp_server}")
                server.login(usuario, password)
                logger.debug("Login exitoso, enviando mensaje")
                
                # Enviar mensaje con mejor manejo de errores
                try:
                    server.send_message(mensaje)
                    logger.warning(f"✅ ÉXITO: Mensaje enviado a {reply_to_address}")
                    return True
                except smtplib.SMTPRecipientsRefused as error:
                    logger.error(f"Destinatario rechazado: {reply_to_address}")
                    for recipient, (code, msg) in error.recipients.items():
                        logger.error(f"Rechazo para {recipient}: Código {code}, Mensaje: {msg}")
                    return False
    
    except smtplib.SMTPServerDisconnected as sd:
        logger.error(f"Error de conexión SMTP: {str(sd)}")
    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error(f"Error de autenticación SMTP: {str(auth_err)}")
    except smtplib.SMTPException as smtp_err:
        logger.error(f"Error SMTP general: {str(smtp_err)}")
    except Exception as ex:
        logger.error(f"Error no clasificado al enviar email: {str(ex)}")
        import traceback
        logger.debug(f"Detalles del error de envío: {traceback.format_exc()}")
    
    return False

def main():
    """Función principal"""
    if len(sys.argv) > 1:
        remitente_original = sys.argv[1]
    else:
        remitente_original = "info@sage.vidahub.ai"  # Por defecto, enviar a info
    
    print(f"\n📧 PRUEBA DE RESPUESTA DIRECTA AL REMITENTE ORIGINAL")
    print(f"Enviando respuesta a: {remitente_original}")
    print("=" * 60)
    
    # Mostrar explicación del propósito del script
    print("\n📝 PROPÓSITO DE ESTA PRUEBA:")
    print("Esta prueba simula exactamente lo que debe ocurrir cuando el sistema")
    print("SAGE responde a un correo entrante, asegurando que la respuesta tenga")
    print("los encabezados correctos para ser reconocida como una respuesta legítima.")
    print("=" * 60)
    
    resultado = enviar_respuesta_directa(remitente_original)
    
    if resultado:
        print("\n✅ RESPUESTA DIRECTA ENVIADA EXITOSAMENTE")
        print("=" * 60)
        print("\n➡️ SIGUIENTE PASO RECOMENDADO:")
        print("Verificar si el correo llega a la bandeja de entrada del destinatario")
        print("y si aparece correctamente como una respuesta (en el mismo hilo).")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n❌ ERROR AL ENVIAR RESPUESTA DIRECTA")
        print("=" * 60)
        print("\n⚠️ NOTA IMPORTANTE:")
        print("El servidor aceptó el mensaje pero MailChannels podría bloquearlo.")
        print("Revise los registros DNS (DKIM, DMARC) o considere un proveedor")
        print("alternativo como se describe en README_SOLUCION_EMAIL.md")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()