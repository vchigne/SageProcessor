#!/usr/bin/env python3
"""
Script para probar envío de email con remitente personalizado

Este script envía un correo de prueba a casilla45@sage.vidahub.ai
pero con un remitente diferente para simular un correo externo.

Uso:
  python3 test_email_with_custom_sender.py <sender_email>
  
  Si no se especifica sender_email, se usará test_sender@gmail.com
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
logger = logging.getLogger("test_external_email")

def enviar_email_remitente_externo(remitente_personalizado):
    """Envía un email simulando un remitente externo"""
    
    # Configuración SMTP fija para casilla45
    config = {
        'servidor': 'smtp.dreamhost.com',
        'puerto': 587,
        'usuario': 'casilla45@sage.vidahub.ai',  # Usamos esta cuenta para autenticar
        'password': 'krx32aFF',
        'usar_tls': True
    }
    
    # Destino fijo: la casilla45
    destinatario = 'casilla45@sage.vidahub.ai'
    
    # Crear mensaje con remitente y Reply-To personalizados
    msg = MIMEMultipart()
    # El From DEBE ser el mismo que el usuario autenticado debido a restricciones de Dreamhost
    msg['From'] = config['usuario']
    # Usamos Reply-To para simular que el mensaje viene de otro remitente
    msg['Reply-To'] = remitente_personalizado
    # Agregamos un header personalizado para identificar el remitente simulado
    msg['X-Simulated-Sender'] = remitente_personalizado
    msg['To'] = destinatario
    msg['Subject'] = f"Prueba de Remitente Externo (via Reply-To) - {datetime.now().strftime('%H:%M:%S')}"
    
    # Encabezados de prioridad alta para asegurar entrega
    msg['X-Priority'] = '1'
    msg['X-MSMail-Priority'] = 'High'
    msg['Importance'] = 'High'
    
    # Mensaje de prueba simulando un correo externo
    body = f"""
Hola,

Este es un mensaje de prueba simulando un remitente externo.
- From: {config['usuario']} (obligatorio para Dreamhost)
- Reply-To: {remitente_personalizado} (simulado)

El sistema SAGE debería verificar la dirección de Reply-To ({remitente_personalizado})
para determinar si es un remitente autorizado.

Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Enviado a: {destinatario}
"""
    
    msg.attach(MIMEText(body, 'plain'))
    
    logger.warning(f"=== ENVÍO SIMULANDO REMITENTE EXTERNO: {remitente_personalizado} ===")
    logger.info(f"Configuración: {config['servidor']}:{config['puerto']} (TLS: {config['usar_tls']})")
    logger.info(f"Destino: {destinatario}")
    
    # Usar el método mejorado de envío de correos
    return enviar_correo_smtp(
        smtp_server=config['servidor'],
        smtp_port=config['puerto'],
        usuario=config['usuario'],
        password=config['password'],
        mensaje=msg,
        reply_to_address=destinatario,
        usar_tls=config['usar_tls']
    )
    
# Implementación del método mejorado de envío SMTP (copia del método de EmailMonitor)
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
        remitente = sys.argv[1]
    else:
        remitente = "test_sender@gmail.com"  # Por defecto
    
    print("\n" + "="*50)
    print(f"PRUEBA: Envío simulando remitente externo '{remitente}'")
    print("="*50)
    resultado = enviar_email_remitente_externo(remitente)
    
    print("\n" + "-"*50)
    if resultado:
        print("✅ RESULTADO: Mensaje enviado exitosamente")
        sys.exit(0)
    else:
        print("❌ RESULTADO: No se pudo enviar el mensaje con remitente externo")
        print("   NOTA: Esto es normal en Dreamhost que impide el envío con remitentes falsos")
        print("   Se recomienda utilizar remitentes reales para pruebas completas")
        sys.exit(1)

if __name__ == "__main__":
    main()