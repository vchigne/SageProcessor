#!/usr/bin/env python3
"""
Script sencillo para verificar si hay correos sin leer en casilla45
"""

import imaplib
import email
from email.header import decode_header

# Configuración
email_user = "casilla45@sage.vidahub.ai"
email_pass = "krx32aFF"
imap_server = "imap.dreamhost.com"
imap_port = 993

print(f"Conectando a {imap_server} con usuario {email_user}...")

# Conectar al servidor
mail = imaplib.IMAP4_SSL(imap_server, imap_port)
print("Conexión establecida, intentando login...")
mail.login(email_user, email_pass)
print("Login exitoso")

# Seleccionar bandeja de entrada
mail.select('INBOX')
print("Bandeja INBOX seleccionada")

# Buscar todos los correos
status, messages = mail.search(None, 'ALL')
print(f"Total de mensajes: {len(messages[0].split())}")

# Buscar correos sin leer
status, unread = mail.search(None, 'UNSEEN')
unread_msgs = unread[0].split()
print(f"Total de mensajes sin leer: {len(unread_msgs)}")

# Si hay mensajes sin leer, mostrar información
if unread_msgs:
    print("\nMensajes sin leer:")
    for num in unread_msgs:
        status, data = mail.fetch(num, '(RFC822)')
        raw_email = data[0][1]
        msg = email.message_from_bytes(raw_email)
        
        # Decodificar asunto
        subject = msg.get("Subject", "")
        if subject:
            subject_parts = decode_header(subject)
            subject = " ".join([part.decode(encoding or "utf-8") if isinstance(part, bytes) else part for part, encoding in subject_parts])
        
        # Obtener remitente
        from_addr = msg.get("From", "")
        
        print(f"  - ID: {num.decode()}, De: {from_addr}, Asunto: {subject}")
else:
    print("\nNo hay mensajes sin leer")

# Cerrar conexión
mail.close()
mail.logout()
print("Conexión cerrada")