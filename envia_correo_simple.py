#!/usr/bin/env python3
"""
Script SIMPLE para enviar un correo de casilla1 a casilla45.
Esto simulará un remitente no autorizado para que podamos ver la respuesta.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import sys

def enviar_correo_simple():
    # Configuración directa - CASILLA1 a CASILLA45 
    origen = "casilla1@sage.vidahub.ai"
    destino = "casilla45@sage.vidahub.ai"
    password = "krx32aFF"  # Ambas casillas tienen la misma contraseña
    
    # Crear mensaje
    msg = MIMEMultipart()
    msg['From'] = origen
    msg['To'] = destino
    msg['Subject'] = "Prueba de remitente no autorizado"
    
    # Contenido simple
    body = """
    Hola, este es un mensaje de prueba enviado desde casilla1 a casilla45.
    
    El sistema debería responder automáticamente indicando que este remitente 
    no está autorizado para enviar archivos a la casilla45.
    
    Saludos,
    Prueba Simple
    """
    
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        # Enviar correo de forma directa
        with smtplib.SMTP('smtp.dreamhost.com', 587) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(origen, password)
            
            # Enviar mensaje
            server.send_message(msg)
            print(f"\n✅ CORREO ENVIADO EXITOSAMENTE:")
            print(f"De: {origen}")
            print(f"Para: {destino}")
            print(f"Asunto: {msg['Subject']}")
            print("\nEl correo ha sido enviado correctamente.")
            print("Ahora ejecuta el siguiente comando para que SAGE lo procese:")
            print("\npython run_sage_daemon_once.py")
            
            return True
    except Exception as e:
        print(f"\n❌ ERROR AL ENVIAR CORREO: {str(e)}")
        return False

if __name__ == "__main__":
    print("\n📧 ENVIANDO CORREO SIMPLE DE PRUEBA (CASILLA1 -> CASILLA45)")
    print("=" * 60)
    enviar_correo_simple()
    print("=" * 60)