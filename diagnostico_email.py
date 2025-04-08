#!/usr/bin/env python3
"""
Script de diagnóstico para email en SAGE

Este script verifica:
1. Conexión al servidor IMAP
2. Bandeja de entrada (correos sin leer)
3. Capacidad de envío de correos
"""

import sys
import logging
import smtplib
import imaplib
import email
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
import getpass
import argparse

def configurar_parser():
    """Configura el parser de argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description='Diagnóstico de email para SAGE')
    parser.add_argument('-c', '--casilla', type=str, default='casilla45@sage.vidahub.ai',
                        help='Dirección de email de la casilla (default: casilla45@sage.vidahub.ai)')
    parser.add_argument('-p', '--password', type=str, default='krx32aFF',
                        help='Contraseña de la casilla (default: para casilla45)')
    parser.add_argument('-d', '--debug', action='store_true',
                        help='Activar modo debug con logs detallados')
    return parser.parse_args()

def configurar_logging(debug=False):
    """Configura el sistema de logging"""
    nivel = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=nivel,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger("sage_diagnostico")

def probar_conexion_imap(config, logger):
    """Prueba conexión IMAP y cuenta correos"""
    print("\n" + "="*60)
    print(" DIAGNÓSTICO DE CONEXIÓN IMAP (RECEPCIÓN DE CORREOS)")
    print("="*60)
    
    try:
        servidor = config['servidor_entrada']
        puerto = config['puerto_entrada']
        usuario = config['usuario']
        password = config['password']
        usar_ssl = config['usar_ssl_entrada']
        
        print(f"✓ Conectando a {servidor}:{puerto} como {usuario}")
        
        # Conexión al servidor
        if usar_ssl:
            mail = imaplib.IMAP4_SSL(servidor, puerto)
        else:
            mail = imaplib.IMAP4(servidor, puerto)
        
        # Login
        mail.login(usuario, password)
        print(f"✓ Autenticación exitosa en {servidor}")
        
        # Seleccionar bandeja de entrada
        mail.select('INBOX')
        
        # Verificar total de mensajes
        status, total_data = mail.status('INBOX', '(MESSAGES)')
        total_mensajes = int(total_data[0].decode().split()[2].strip(').,]'))
        print(f"✓ Total de mensajes en bandeja: {total_mensajes}")
        
        # Buscar correos no leídos
        status, data = mail.search(None, 'UNSEEN')
        mensajes_sin_leer = data[0].split()
        cantidad_sin_leer = len(mensajes_sin_leer)
        print(f"✓ Correos sin leer: {cantidad_sin_leer}")
        
        # Mostrar información de los correos sin leer más recientes
        if cantidad_sin_leer > 0:
            print("\nÚltimos 3 correos sin leer:")
            print("-"*40)
            
            # Solo procesamos los 3 más recientes para no demorar demasiado
            ultimos = mensajes_sin_leer[-3:] if cantidad_sin_leer > 3 else mensajes_sin_leer
            
            for num in ultimos:
                status, data = mail.fetch(num, '(RFC822)')
                if status != 'OK':
                    logger.warning(f"Error obteniendo mensaje {num.decode()}: {status}")
                    continue
                
                if not data:
                    logger.warning(f"No hay datos para mensaje {num.decode()}")
                    continue
                    
                if not isinstance(data, list) or len(data) == 0 or not data[0]:
                    logger.warning(f"Formato inesperado de datos para mensaje {num.decode()}")
                    continue
                
                # Asegurar que data[0] tiene la estructura esperada (tupla o lista con al menos 2 elementos)
                email_data = data[0]
                if not isinstance(email_data, tuple) and not isinstance(email_data, list):
                    logger.warning(f"Formato inesperado para email_data: {type(email_data)}")
                    continue
                    
                if len(email_data) < 2:
                    logger.warning(f"email_data no tiene suficientes elementos: {len(email_data)}")
                    continue
                
                # Asegurar que tenemos el contenido del email
                raw_email = email_data[1]
                if raw_email is None:
                    logger.warning(f"Contenido vacío para mensaje {num.decode()}")
                    continue
                    
                # Asegurarse que sea bytes para message_from_bytes
                if isinstance(raw_email, bytes):
                    msg = email.message_from_bytes(raw_email)
                else:
                    # Intentar convertir a bytes si es necesario
                    try:
                        msg = email.message_from_bytes(bytes(str(raw_email), 'utf-8'))
                    except:
                        logger.error(f"No se pudo parsear mensaje {num.decode()}")
                        continue
                
                # Extraer información básica
                de = msg.get('From', 'Desconocido')
                asunto = msg.get('Subject', 'Sin asunto')
                fecha = msg.get('Date', 'Sin fecha')
                
                print(f"ID: {num.decode()}")
                print(f"De: {de}")
                print(f"Asunto: {asunto}")
                print(f"Fecha: {fecha}")
                print("-"*40)
        
        mail.close()
        mail.logout()
        
        print(f"\n✅ RESULTADO: Conexión IMAP correcta, {cantidad_sin_leer} correos sin leer")
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: No se pudo conectar al servidor IMAP: {str(e)}")
        return False

def probar_envio_correo(config, logger):
    """Prueba capacidad de envío de correos"""
    print("\n" + "="*60)
    print(" DIAGNÓSTICO DE ENVÍO SMTP")
    print("="*60)
    
    try:
        servidor = config['servidor_salida']
        puerto = config['puerto_salida']
        usuario = config['usuario']
        password = config['password']
        usar_tls = config['usar_tls_salida']
        
        # Dirección para autoenvío
        destinatario = usuario
        
        # Crear mensaje
        msg = MIMEMultipart()
        msg['From'] = usuario
        msg['To'] = destinatario
        msg['Subject'] = f"SAGE Diagnóstico - {datetime.now().strftime('%H:%M:%S')}"
        
        # Encabezados de prioridad alta
        msg['X-Priority'] = '1'
        msg['X-MSMail-Priority'] = 'High'
        msg['Importance'] = 'High'
        
        # Cuerpo del mensaje
        body = f"""
Este es un mensaje de diagnóstico de SAGE.
Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Si está recibiendo este mensaje, la configuración de envío
de correos SMTP está funcionando correctamente.
"""
        msg.attach(MIMEText(body, 'plain'))
        
        print(f"✓ Conectando a {servidor}:{puerto} como {usuario}")
        
        # Conexión al servidor
        server = smtplib.SMTP(servidor, puerto)
        server.set_debuglevel(1 if logger.level == logging.DEBUG else 0)
        
        # Enviar EHLO
        server.ehlo()
        
        # Iniciar TLS si es necesario
        if usar_tls:
            print(f"✓ Iniciando TLS")
            server.starttls()
            server.ehlo()
        
        # Login
        print(f"✓ Autenticando con usuario {usuario}")
        server.login(usuario, password)
        
        # Enviar mensaje
        print(f"✓ Enviando mensaje a {destinatario}")
        server.send_message(msg)
        
        # Cerrar conexión
        server.quit()
        
        print(f"\n✅ RESULTADO: Correo enviado exitosamente a {destinatario}")
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: No se pudo enviar correo: {str(e)}")
        return False

def main():
    """Función principal"""
    args = configurar_parser()
    logger = configurar_logging(args.debug)
    
    # Configuración de la casilla a diagnosticar
    config = {
        'servidor_entrada': 'imap.dreamhost.com',
        'puerto_entrada': 993,
        'usar_ssl_entrada': True,
        'servidor_salida': 'smtp.dreamhost.com',
        'puerto_salida': 587,
        'usar_tls_salida': True,
        'usuario': args.casilla,
        'password': args.password
    }
    
    print("\n" + "="*60)
    print(" DIAGNÓSTICO DEL SISTEMA DE EMAIL SAGE")
    print("="*60)
    print(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Casilla: {config['usuario']}")
    
    # Prueba de conexión IMAP
    resultado_imap = probar_conexion_imap(config, logger)
    
    # Prueba de envío SMTP
    resultado_smtp = probar_envio_correo(config, logger)
    
    # Resumen final
    print("\n" + "="*60)
    print(" RESUMEN DE DIAGNÓSTICO")
    print("="*60)
    print(f"✓ Recepción (IMAP): {'FUNCIONA' if resultado_imap else 'FALLÓ'}")
    print(f"✓ Envío (SMTP): {'FUNCIONA' if resultado_smtp else 'FALLÓ'}")
    
    # Estado general
    if resultado_imap and resultado_smtp:
        print("\n✅ RESULTADO FINAL: El sistema de email está funcionando correctamente")
        return 0
    else:
        print("\n⚠️ RESULTADO FINAL: Hay problemas con el sistema de email")
        return 1

if __name__ == "__main__":
    sys.exit(main())