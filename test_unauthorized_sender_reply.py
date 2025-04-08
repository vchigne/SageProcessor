#!/usr/bin/env python3
"""
Script para probar respuesta automática a remitentes no autorizados

Este script simula el envío de una respuesta automática a un remitente 
no autorizado, lo cual es el escenario que ocurre cuando un email ingresa 
al sistema SAGE desde una dirección que no está registrada en la base de datos.

Uso:
  python3 test_unauthorized_sender_reply.py <email_destino>
  
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
logger = logging.getLogger("test_unauthorized_reply")

def enviar_respuesta_no_autorizado(direccion_no_autorizada, original_message_id=None, asunto_original=None):
    """
    Simula el envío de una respuesta automática a un remitente no autorizado
    
    Args:
        direccion_no_autorizada: Email del remitente no autorizado
        original_message_id: ID del mensaje original al que responder
        asunto_original: Asunto del mensaje original
    """
    
    # Configuración SMTP fija para casilla45
    config = {
        'servidor': 'smtp.dreamhost.com',
        'puerto': 587,
        'usuario': 'casilla45@sage.vidahub.ai',
        'password': 'krx32aFF',
        'usar_tls': True
    }
    
    # Validar que la dirección no sea un dominio bloqueado
    if '@' not in direccion_no_autorizada:
        logger.error(f"Dirección inválida sin @: {direccion_no_autorizada}")
        return False
    
    domain = direccion_no_autorizada.split('@')[-1].lower()
    blocked_domains = [
        'example.com', 'example.org', 'example.net', 
        'invalid.com', 'invalid.domain', 
        'mailchannels.net'  # Bloqueamos MailChannels porque causa rebotes
    ]
    
    if domain in blocked_domains:
        logger.error(f"Dominio bloqueado: {domain}")
        return False
    
    # Generar IDs únicos para Message-ID
    import uuid
    message_id = f"<{uuid.uuid4().hex}@sage.vidahub.ai>"
    
    # Crear mensaje con prioridad alta - simulando respuesta automática
    msg = MIMEMultipart()
    msg['From'] = config['usuario']
    msg['To'] = direccion_no_autorizada
    
    # Determinar el asunto basado en el original o usar uno genérico
    if asunto_original:
        if not asunto_original.lower().startswith('re:'):
            msg['Subject'] = f"Re: {asunto_original}"
        else:
            msg['Subject'] = asunto_original
    else:
        msg['Subject'] = f"Re: Remitente no autorizado en SAGE - {datetime.now().strftime('%H:%M:%S')}"
    
    # Encabezados de prioridad alta
    msg['X-Priority'] = '1'
    msg['X-MSMail-Priority'] = 'High'
    msg['Importance'] = 'High'
    
    # Añadir Message-ID único para esta respuesta
    msg['Message-ID'] = message_id
    
    # Usar el Message-ID original si se proporcionó, o generar uno simulado
    if original_message_id:
        msg['In-Reply-To'] = original_message_id
        msg['References'] = original_message_id
        logger.info(f"Usando Message-ID original: {original_message_id}")
    else:
        # Generar un Message-ID simulado solo si no se proporciona uno real
        simulated_id = f"<simulated-message-id-{datetime.now().strftime('%Y%m%d%H%M%S')}@{domain}>"
        msg['In-Reply-To'] = simulated_id
        msg['References'] = simulated_id
        logger.warning("Usando Message-ID simulado (no es una respuesta real)")
    
    # Añadir encabezados para evitar clasificación como spam
    msg['Precedence'] = 'bulk'  # Indica que es un mensaje automático
    msg['Auto-Submitted'] = 'auto-replied'  # Indica que es una respuesta automática
    
    # Contenido del mensaje - similar al de SAGE Daemon
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    body = f"""
Estimado/a Usuario,

¡Gracias por comunicarse con nosotros a través de {config['usuario']}!

Queremos informarle que actualmente su dirección de correo electrónico ({direccion_no_autorizada}) no se encuentra en nuestra lista de remitentes autorizados para esta casilla. ¡Pero no se preocupe! Valoramos enormemente su interés en utilizar nuestros servicios de procesamiento de datos.

Para brindarle una experiencia completa y personalizada con el Sistema SAGE, le invitamos a contactar a su administrador de sistema para solicitar su autorización. Una vez autorizado, podrá disfrutar de todas las ventajas y beneficios de nuestra plataforma de procesamiento automatizado.

Si tiene alguna consulta o necesita asistencia adicional, nuestro equipo está siempre disponible para ayudarle. ¡Nos encantaría poder atenderle pronto como usuario autorizado!

Gracias por su comprensión y por elegirnos.

==========
Este es un mensaje de prueba enviado por test_unauthorized_sender_reply.py
Fecha y hora: {timestamp}
ID de Mensaje: {message_id}
==========
"""
    
    msg.attach(MIMEText(body, 'plain', 'utf-8'))
    
    logger.warning(f"=== RESPUESTA DE PRIORIDAD ALTA: {direccion_no_autorizada} (Simulación) ===")
    logger.info(f"Configuración: {config['servidor']}:{config['puerto']} (TLS: {config['usar_tls']})")
    logger.info(f"De: {config['usuario']} - Para: {direccion_no_autorizada}")
    
    # Usar el método mejorado de envío de correos
    return enviar_correo_smtp(
        smtp_server=config['servidor'],
        smtp_port=config['puerto'],
        usuario=config['usuario'],
        password=config['password'],
        mensaje=msg,
        reply_to_address=direccion_no_autorizada,
        usar_tls=config['usar_tls']
    )

# Implementación del método mejorado de envío SMTP (idéntico al de test_email_with_custom_sender.py)
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
    # Analizar argumentos
    import argparse
    parser = argparse.ArgumentParser(description='Simula respuesta a remitente no autorizado')
    parser.add_argument('email', nargs='?', default="info@sage.vidahub.ai", 
                        help='Email del remitente no autorizado (por defecto: info@sage.vidahub.ai)')
    parser.add_argument('--message-id', '-m', dest='message_id',
                        help='Message-ID original al que responder')
    parser.add_argument('--subject', '-s', dest='subject',
                        help='Asunto original del mensaje')
    
    args = parser.parse_args()
    
    direccion_no_autorizada = args.email
    
    print(f"\n📧 SIMULACIÓN DE RESPUESTA A REMITENTE NO AUTORIZADO")
    print(f"Enviando a: {direccion_no_autorizada}")
    if args.message_id:
        print(f"Respondiendo al Message-ID: {args.message_id}")
    if args.subject:
        print(f"Asunto original: {args.subject}")
    print("=" * 60)
    
    resultado = enviar_respuesta_no_autorizado(
        direccion_no_autorizada,
        original_message_id=args.message_id,
        asunto_original=args.subject
    )
    
    if resultado:
        print("\n✅ RESPUESTA ENVIADA EXITOSAMENTE")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n❌ ERROR AL ENVIAR RESPUESTA")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()