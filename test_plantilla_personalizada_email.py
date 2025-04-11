"""
Script para probar el envío de un correo a SAGE y ver la respuesta con plantilla personalizada

Este script simula un remitente no autorizado enviando un correo a una casilla,
para verificar si SAGE Daemon 2 utiliza la plantilla correcta al responder.
"""
import os
import sys
import logging
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('test_plantillas_email')

def enviar_correo_simulado(destinatario, remitente, asunto="Prueba plantilla personalizada", 
                         contenido="Este es un correo de prueba para verificar las plantillas personalizadas"):
    """
    Envía un correo simulando un remitente externo
    
    Args:
        destinatario: Email de la casilla de SAGE (ej: casilla45@sage.vidahub.ai)
        remitente: Email del remitente no autorizado (simulado)
        asunto: Asunto del correo
        contenido: Contenido del correo
    
    Returns:
        bool: True si el envío fue exitoso, False en caso contrario
    """
    try:
        # Configuración SMTP
        # Nota: Estas credenciales son para pruebas de desarrollo
        smtp_server = os.environ.get('SMTP_SERVER', 'sandbox.smtp.mailtrap.io')
        smtp_port = int(os.environ.get('SMTP_PORT', 2525))
        smtp_user = os.environ.get('SMTP_USER', 'test_user')
        smtp_password = os.environ.get('SMTP_PASSWORD', 'test_password')
        
        # Crear mensaje
        mensaje = MIMEMultipart()
        mensaje['From'] = remitente
        mensaje['To'] = destinatario
        mensaje['Subject'] = asunto
        mensaje['Reply-To'] = remitente  # Importante para que la respuesta vaya al remitente
        
        # Agregar contenido
        mensaje.attach(MIMEText(contenido, 'plain'))
        
        # Conectar y enviar
        logger.info(f"Enviando correo a {destinatario} simulando remitente {remitente}")
        with smtplib.SMTP(smtp_server, smtp_port) as servidor:
            servidor.starttls()
            servidor.login(smtp_user, smtp_password)
            servidor.send_message(mensaje)
            logger.info("Correo enviado correctamente")
            
        return True
    
    except Exception as e:
        logger.error(f"Error al enviar correo: {str(e)}")
        return False

def simular_cliente_especifico():
    """
    Simula un correo de un cliente específico que debería recibir una plantilla personalizada
    """
    # Caso de Unilever (cambiar por el ID real del cliente en la base de datos)
    cliente_id = 1  # Suponiendo que Unilever es el cliente ID 1
    
    # Enviar correo simulando un remitente no autorizado desde el dominio del cliente
    enviar_correo_simulado(
        destinatario="casilla45@sage.vidahub.ai",
        remitente=f"test-remitente@unilever.com",
        asunto=f"Prueba de plantilla personalizada para Unilever",
        contenido=f"""
        Este es un correo de prueba para verificar si SAGE utiliza la plantilla personalizada 
        para Unilever al recibir un remitente no autorizado desde su dominio.
        
        Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        """
    )
    
    # También podemos probar con otro cliente para comparar
    enviar_correo_simulado(
        destinatario="casilla45@sage.vidahub.ai",
        remitente="test-remitente@otra-empresa.com",
        asunto="Prueba de plantilla predeterminada",
        contenido=f"""
        Este es un correo de prueba para verificar que SAGE utiliza la plantilla predeterminada
        para clientes sin personalización.
        
        Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        """
    )

def main():
    """Función principal"""
    print("\033[1m== TEST DE PLANTILLAS PERSONALIZADAS EN EMAIL ==\033[0m\n")
    
    # Verificar que hay credenciales SMTP disponibles
    if not os.environ.get('SMTP_USER') or not os.environ.get('SMTP_PASSWORD'):
        print("ADVERTENCIA: No se encontraron credenciales SMTP en variables de entorno.")
        print("Este script solo realizará una simulación parcial.")
    
    # Simular envío desde un cliente específico
    simular_cliente_especifico()
    
    print("\nCorreos enviados. SAGE Daemon 2 debería procesarlos y responder usando las plantillas adecuadas.")
    print("Verifique los logs de SAGE Daemon 2 para confirmar el procesamiento y las plantillas utilizadas.")

if __name__ == "__main__":
    main()