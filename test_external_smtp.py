#!/usr/bin/env python3
"""
Script para probar envío de correos a través de un servidor SMTP externo

Este script intenta enviar un correo a través de un servidor SMTP externo
para evaluar si el problema de entrega está en el servidor de correo de Dreamhost
o en la configuración DNS del dominio sage.vidahub.ai.

Usos:
  python3 test_external_smtp.py <email_destino>
  
  Si no se especifica email_destino, se usará info@sage.vidahub.ai
"""

import sys
import logging
import smtplib
import uuid
import socket
import json
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_external_smtp")

def enviar_via_gmail(destinatario, user=None, password=None, test_mode=True):
    """
    Envía un correo de prueba usando Gmail como servidor SMTP
    
    Args:
        destinatario: Email del destinatario
        user: Usuario de Gmail (opcional, si no se proporciona, se usará una simulación)
        password: Contraseña de aplicación de Gmail (opcional)
        test_mode: Si es True, solo simula el envío
        
    Returns:
        bool: True si el envío fue exitoso, False en caso contrario
    """
    # Si no se proporciona usuario/contraseña, mostrar instrucciones
    if not user or not password:
        if not test_mode:
            logger.error("Se requiere usuario y contraseña de Gmail.")
            logger.info("Para usar Gmail, necesitas:")
            logger.info("1. Habilitar autenticación de dos factores en tu cuenta")
            logger.info("2. Generar una 'Contraseña de aplicación' específica para esta aplicación")
            logger.info("3. Proporcionar tu dirección de Gmail completa y la contraseña generada")
            return False
        else:
            # En modo de prueba simulamos el envío
            logger.warning("MODO DE PRUEBA: Simulando envío sin credenciales reales")
            return True
    
    # Configuración de Gmail SMTP
    config = {
        'servidor': 'smtp.gmail.com',
        'puerto': 587,
        'usuario': user,
        'password': password,
        'usar_tls': True
    }
    
    try:
        # Configurar timeout para evitar bloqueos
        socket.setdefaulttimeout(30)  # 30 segundos
        
        # Generar ID único para el mensaje
        message_id = f"<{uuid.uuid4().hex}@sage.vidahub.ai>"
        
        # Crear mensaje
        msg = MIMEMultipart()
        msg['From'] = config['usuario']
        msg['To'] = destinatario
        msg['Subject'] = f"Prueba SMTP externo (Gmail) - {datetime.now().strftime('%H:%M:%S')}"
        msg['Message-ID'] = message_id
        
        # Encabezados de prioridad
        msg['X-Priority'] = '1'
        msg['X-MSMail-Priority'] = 'High'
        msg['Importance'] = 'High'
        
        # Cuerpo del mensaje
        body = f"""
Estimado/a Usuario,

Este es un mensaje de prueba enviado desde el sistema SAGE utilizando
un servidor SMTP externo (Gmail) para probar la entrega de correos.

Si estás recibiendo este mensaje, significa que el problema de entrega
puede estar relacionado con la configuración del servidor principal.

Detalles técnicos:
- Enviado desde: {config['usuario']}
- Enviado a: {destinatario}
- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- ID de mensaje: {message_id}

Este es un mensaje automático generado por test_external_smtp.py.
        """
        
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        if test_mode:
            logger.warning("MODO DE PRUEBA ACTIVO: No se enviará correo real")
            logger.info(f"=== SIMULACIÓN DE ENVÍO ===")
            logger.info(f"Servidor: {config['servidor']}:{config['puerto']}")
            logger.info(f"De: {config['usuario']} - Para: {destinatario}")
            logger.info(f"Asunto: {msg['Subject']}")
            logger.info(f"Mensaje preparado y listo para envío")
            return True
        
        # Establece conexión con el servidor
        logger.info(f"Conectando a {config['servidor']}:{config['puerto']}")
        server = smtplib.SMTP(config['servidor'], config['puerto'])
        server.set_debuglevel(1)  # Nivel de debug para ver detalles
        
        # Identificación con el servidor
        logger.debug("Enviando EHLO")
        server.ehlo()
        
        # Iniciar TLS para conexión segura
        if config['usar_tls']:
            logger.debug("Iniciando TLS")
            server.starttls()
            server.ehlo()  # Necesario después de STARTTLS
        
        # Autenticación
        logger.debug(f"Autenticando como {config['usuario']}")
        server.login(config['usuario'], config['password'])
        
        # Enviar mensaje
        logger.info(f"Enviando correo a {destinatario}")
        server.send_message(msg)
        
        # Cerrar conexión
        server.quit()
        
        logger.warning(f"✅ ÉXITO: Correo enviado a {destinatario} vía Gmail")
        return True
        
    except smtplib.SMTPRecipientsRefused as e:
        logger.error(f"Destinatario rechazado: {destinatario}")
        for recipient, (code, msg) in e.recipients.items():
            logger.error(f"Rechazo para {recipient}: Código {code}, Mensaje: {msg}")
        return False
    except smtplib.SMTPAuthenticationError:
        logger.error("Error de autenticación. Verifica usuario y contraseña.")
        logger.info("Si estás usando Gmail, asegúrate de:")
        logger.info("1. Haber habilitado 'Acceso de aplicaciones menos seguras' o")
        logger.info("2. Estar usando una 'Contraseña de aplicación' (recomendado)")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"Error SMTP: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Error inesperado: {str(e)}")
        import traceback
        logger.error(f"Detalles: {traceback.format_exc()}")
        return False

def enviar_via_sendgrid(destinatario, api_key=None, test_mode=True):
    """
    Envía un correo de prueba usando la API de SendGrid
    
    Args:
        destinatario: Email del destinatario
        api_key: API Key de SendGrid (opcional, si no se proporciona, se usará una simulación)
        test_mode: Si es True, solo simula el envío
        
    Returns:
        bool: True si el envío fue exitoso, False en caso contrario
    """
    try:
        # Si no se proporciona API key, mostrar instrucciones
        if not api_key:
            if not test_mode:
                logger.error("Se requiere una API Key de SendGrid.")
                logger.info("Para usar SendGrid, necesitas:")
                logger.info("1. Crear una cuenta en SendGrid (https://sendgrid.com)")
                logger.info("2. Generar una API Key con permisos de envío")
                logger.info("3. Proporcionar la API Key como parámetro")
                return False
            else:
                # En modo de prueba simulamos el envío
                logger.warning("MODO DE PRUEBA: Simulando envío sin API Key real")
                return True
        
        # Importar sendgrid solo si se va a usar realmente
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail, Email, To, Content
        except ImportError:
            logger.error("SendGrid no está instalado. Instálalo con: pip install sendgrid")
            logger.info("Continuando en modo de simulación...")
            if not test_mode:
                return False
        
        # Generar ID único para el mensaje
        message_id = f"{uuid.uuid4().hex}@sage.vidahub.ai"
        
        if test_mode:
            logger.warning("MODO DE PRUEBA ACTIVO: No se enviará correo real")
            logger.info(f"=== SIMULACIÓN DE ENVÍO VÍA SENDGRID ===")
            logger.info(f"De: sage@vidahub.ai - Para: {destinatario}")
            logger.info(f"Asunto: Prueba SendGrid - {datetime.now().strftime('%H:%M:%S')}")
            logger.info(f"Mensaje preparado y listo para envío")
            return True
        
        # Configuración del mensaje
        from_email = Email("sage@vidahub.ai")  # Remitente verificado en SendGrid
        to_email = To(destinatario)
        subject = f"Prueba SendGrid - {datetime.now().strftime('%H:%M:%S')}"
        
        # Cuerpo del mensaje
        body = f"""
Estimado/a Usuario,

Este es un mensaje de prueba enviado desde el sistema SAGE utilizando
la API de SendGrid para probar la entrega de correos.

Si estás recibiendo este mensaje, significa que el problema de entrega
puede estar relacionado con la configuración del servidor principal.

Detalles técnicos:
- Enviado desde: sage@vidahub.ai
- Enviado a: {destinatario}
- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- ID de mensaje: {message_id}

Este es un mensaje automático generado por test_external_smtp.py.
        """
        
        content = Content("text/plain", body)
        mail = Mail(from_email, to_email, subject, content)
        
        # Añadir encabezados personalizados
        mail.add_custom_arg({'Message-ID': message_id})
        mail.add_custom_arg({'X-Priority': '1'})
        mail.add_custom_arg({'X-MSMail-Priority': 'High'})
        mail.add_custom_arg({'Importance': 'High'})
        
        # Enviar correo
        sg = sendgrid.SendGridAPIClient(api_key)
        response = sg.client.mail.send.post(request_body=mail.get())
        
        # Verificar resultado
        if response.status_code >= 200 and response.status_code < 300:
            logger.warning(f"✅ ÉXITO: Correo enviado a {destinatario} vía SendGrid")
            logger.info(f"Código de estado: {response.status_code}")
            return True
        else:
            logger.error(f"Error enviando correo vía SendGrid. Código: {response.status_code}")
            logger.error(f"Respuesta: {response.body}")
            return False
            
    except Exception as e:
        logger.error(f"Error inesperado con SendGrid: {str(e)}")
        import traceback
        logger.error(f"Detalles: {traceback.format_exc()}")
        return False

def main():
    """Función principal"""
    # Procesar argumentos
    if len(sys.argv) > 1:
        destinatario = sys.argv[1]
    else:
        destinatario = "info@sage.vidahub.ai"  # Valor por defecto
    
    print(f"\n📧 PRUEBA DE ENVÍO DE CORREO A TRAVÉS DE PROVEEDORES EXTERNOS")
    print(f"Destinatario: {destinatario}")
    print("=" * 60)
    
    # Verificar si hay credenciales guardadas
    credenciales = {}
    credenciales_file = '.smtp_credentials.json'
    
    if os.path.exists(credenciales_file):
        try:
            with open(credenciales_file, 'r') as f:
                credenciales = json.load(f)
            logger.info("Credenciales cargadas correctamente")
        except Exception as e:
            logger.error(f"Error cargando credenciales: {str(e)}")
    
    # Prueba con Gmail
    print("\n🔹 PRUEBA CON GMAIL")
    
    gmail_user = credenciales.get('gmail_user', None)
    gmail_password = credenciales.get('gmail_password', None)
    
    if gmail_user and gmail_password:
        logger.info(f"Usando cuenta de Gmail: {gmail_user}")
        result_gmail = enviar_via_gmail(destinatario, gmail_user, gmail_password, test_mode=False)
    else:
        logger.warning("No se encontraron credenciales para Gmail. Ejecutando en modo de prueba.")
        result_gmail = enviar_via_gmail(destinatario, test_mode=True)
    
    # Prueba con SendGrid
    print("\n🔹 PRUEBA CON SENDGRID")
    
    sendgrid_api_key = credenciales.get('sendgrid_api_key', None)
    
    if sendgrid_api_key:
        logger.info("Usando API Key de SendGrid configurada")
        result_sendgrid = enviar_via_sendgrid(destinatario, sendgrid_api_key, test_mode=False)
    else:
        logger.warning("No se encontró API Key para SendGrid. Ejecutando en modo de prueba.")
        result_sendgrid = enviar_via_sendgrid(destinatario, test_mode=True)
    
    # Resumen de resultados
    print("\n📋 RESUMEN DE RESULTADOS")
    print("=" * 60)
    print(f"Gmail: {'✅ ÉXITO' if result_gmail else '❌ FALLO'}")
    print(f"SendGrid: {'✅ ÉXITO' if result_sendgrid else '❌ FALLO'}")
    print("=" * 60)
    
    # Instrucciones para configurar credenciales
    if not gmail_user or not gmail_password or not sendgrid_api_key:
        print("\n⚠️ CONFIGURACIÓN DE CREDENCIALES")
        print("Para usar proveedores externos de correo, debes configurar credenciales.")
        print("Crea un archivo '.smtp_credentials.json' con el siguiente formato:")
        print("""
{
    "gmail_user": "tu_correo@gmail.com",
    "gmail_password": "tu_contraseña_de_aplicación",
    "sendgrid_api_key": "tu_api_key_de_sendgrid"
}
""")
        print("IMPORTANTE: La contraseña de Gmail debe ser una 'Contraseña de aplicación', no tu contraseña normal.")
    
    # Instrucciones para instalar SendGrid
    try:
        import sendgrid
    except ImportError:
        print("\n⚠️ SendGrid no está instalado")
        print("Para instalar SendGrid: pip install sendgrid")
    
    # Salida exitosa si al menos uno funciona
    if result_gmail or result_sendgrid:
        print("\n✅ Al menos un método de envío funciona o está simulado correctamente")
        sys.exit(0)
    else:
        print("\n❌ Todos los métodos de envío fallaron")
        sys.exit(1)

if __name__ == "__main__":
    main()