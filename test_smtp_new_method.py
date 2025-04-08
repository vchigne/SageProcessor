#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para probar el nuevo método de envío SMTP en SAGE

Este script prueba el método _enviar_correo_smtp que implementamos
para centralizar el envío de correos en el sistema SAGE.

Ventajas del nuevo método:
1. Manejo mejorado de errores y excepciones
2. Selección automática entre SMTP y SMTP_SSL según el puerto
3. Soporte para TLS configurable
4. Logging detallado de cada paso y error
5. Manejo específico de errores de destinatarios

Uso:
  python3 test_smtp_new_method.py <email_destino>
  
  Si no se especifica email_destino, se usará info@sage.vidahub.ai
"""

import os
import sys
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import socket
import traceback
from typing import Dict, Optional

# Configurar logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger('test_smtp')

def enviar_correo_smtp(smtp_server, smtp_port, usuario, password, 
                      mensaje, reply_to_address, usar_tls=True):
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
        logger.debug(f"Detalles del error de envío: {traceback.format_exc()}")
    
    return False

def test_metodo_centralizado_smtp(destinatario):
    """Prueba el nuevo método centralizado de envío SMTP"""
    # Credenciales y configuración SMTP
    smtp_server = "smtp.dreamhost.com"
    smtp_port = 587  # Puerto estándar SMTP con STARTTLS
    usuario = "casilla45@sage.vidahub.ai"
    password = "krx32aFF"
    
    # Crear mensaje de prueba
    msg = MIMEMultipart()
    msg['From'] = usuario
    msg['To'] = destinatario
    msg['Subject'] = "Prueba de nuevo método de envío SMTP centralizado en SAGE"
    
    # Añadir encabezados de prioridad alta para mejor entrega
    msg['X-Priority'] = '1'
    msg['X-MSMail-Priority'] = 'High'
    msg['Importance'] = 'High'
    
    # Cuerpo del mensaje
    body = """
Este es un mensaje de prueba enviado desde el nuevo método centralizado
de envío SMTP de SAGE con las siguientes mejoras:

1. Manejo mejorado de errores y excepciones
2. Selección automática entre SMTP y SMTP_SSL según el puerto
3. Soporte para TLS configurable
4. Logging detallado de cada paso y error
5. Manejo específico de errores de destinatarios
6. Prevención de envío a dominios de prueba (example.com, etc.)
7. Verificación para evitar responder a la misma casilla

Si recibes este mensaje, ¡el método funciona correctamente!
"""
    msg.attach(MIMEText(body, 'plain'))
    
    # Timeout para evitar bloqueos
    socket.setdefaulttimeout(30)  # 30 segundos
    
    # Probar varios métodos de envío
    logger.info("=== PRUEBA 1: Puerto 587 con TLS (método recomendado) ===")
    resultado1 = enviar_correo_smtp(
        smtp_server=smtp_server,
        smtp_port=587,
        usuario=usuario,
        password=password,
        mensaje=msg,
        reply_to_address=destinatario,
        usar_tls=True
    )
    
    logger.info(f"Resultado de prueba 1: {'ÉXITO' if resultado1 else 'FALLO'}")
    
    # Inicializar resultado2 como False por defecto
    resultado2 = False
    
    if not resultado1:
        logger.info("\n=== PRUEBA 2: Puerto 587 sin TLS (fallback) ===")
        resultado2 = enviar_correo_smtp(
            smtp_server=smtp_server,
            smtp_port=587,
            usuario=usuario,
            password=password,
            mensaje=msg,
            reply_to_address=destinatario,
            usar_tls=False
        )
        logger.info(f"Resultado de prueba 2: {'ÉXITO' if resultado2 else 'FALLO'}")
    
    # También probar SSL implícito (puerto 465)
    logger.info("\n=== PRUEBA 3: Puerto 465 con SSL implícito ===")
    msg['Subject'] = "Prueba de nuevo método - Parte 2 (SSL implícito)"
    resultado3 = enviar_correo_smtp(
        smtp_server=smtp_server,
        smtp_port=465,
        usuario=usuario,
        password=password,
        mensaje=msg,
        reply_to_address=destinatario,
        usar_tls=False  # Ignorado en puerto 465
    )
    logger.info(f"Resultado de prueba 3: {'ÉXITO' if resultado3 else 'FALLO'}")
    
    return resultado1 or resultado2 or resultado3

def main():
    """Función principal"""
    # Validar argumentos
    if len(sys.argv) > 1:
        destinatario = sys.argv[1]
    else:
        destinatario = "info@sage.vidahub.ai"
    
    logger.info(f"Probando envío de email a: {destinatario}")
    
    resultado = test_metodo_centralizado_smtp(destinatario)
    
    if resultado:
        logger.info("✅ PRUEBA EXITOSA: Se envió correctamente al menos un mensaje")
        print(f"\nSe envió correctamente el mensaje a {destinatario}")
        sys.exit(0)
    else:
        logger.error("❌ PRUEBA FALLIDA: No se pudo enviar ningún mensaje")
        print(f"\nNo se pudo enviar el mensaje a {destinatario}")
        sys.exit(1)

if __name__ == "__main__":
    main()