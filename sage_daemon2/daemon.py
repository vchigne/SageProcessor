#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SAGE Daemon 2 - Monitor de Email y Procesador de Archivos

Este daemon monitorea cuentas de correo configuradas, procesa correos entrantes
y responde automáticamente según las reglas definidas.
"""

import os
import sys
import time
import json
import logging
import imaplib
import email
import smtplib
import tempfile
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.utils import parseaddr
from email.message import EmailMessage
from email import encoders
import yaml
import psycopg2
from psycopg2.extras import RealDictCursor
import paramiko
from datetime import datetime
import shutil

# Importamos los componentes del procesador SAGE
from sage.yaml_validator import YAMLValidator
from sage.file_processor import FileProcessor
from sage.logger import SageLogger 
from sage.utils import create_execution_directory
from sage.exceptions import SAGEError

# Para compatibilidad con las ediciones anteriores del código
# (algunos lugares usan SAGEError y otros SageError)
SageError = SAGEError

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("sage_daemon2_log.txt"),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("SAGE_Daemon2")

class DatabaseManager:
    """Gestiona conexiones y operaciones de base de datos"""
    
    def __init__(self):
        """Inicializa el gestor de base de datos"""
        self.logger = logging.getLogger("SAGE_Daemon2.Database")
        self.connection = None
        self.connect()
    
    def connect(self):
        """Establece conexión con la base de datos"""
        # Cerrar la conexión previa si existe
        if self.connection:
            try:
                self.connection.close()
                self.logger.info("Conexión previa cerrada")
            except Exception as e:
                self.logger.error(f"Error al cerrar conexión previa: {str(e)}")
        
        try:
            # Obtener cadena de conexión desde variable de entorno
            db_url = os.environ.get('DATABASE_URL')
            if not db_url:
                self.logger.error("Variable de entorno DATABASE_URL no encontrada")
                return False
            
            self.connection = psycopg2.connect(db_url)
            self.connection.autocommit = False  # Aseguramos que no esté en modo autocommit
            self.logger.info("Conexión a base de datos establecida")
            return True
        except Exception as e:
            self.logger.error(f"Error al conectar a la base de datos: {str(e)}")
            self.connection = None
            return False
    
    def execute_query(self, query, params=None, fetch=True):
        """
        Ejecuta una consulta SQL
        
        Args:
            query (str): Consulta SQL a ejecutar
            params (tuple, optional): Parámetros para la consulta
            fetch (bool): Si debe devolver resultados o no
            
        Returns:
            list: Resultados de la consulta o None si hay error
        """
        if not self.connection:
            if not self.connect():
                return None
        
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                
                if fetch:
                    result = cursor.fetchall()
                    return result
                else:
                    self.connection.commit()
                    return True
        except Exception as e:
            self.logger.error(f"Error en consulta SQL: {str(e)}")
            self.logger.error(f"Query: {query}")
            self.logger.error(f"Params: {params}")
            
            # Hacer rollback de la transacción en caso de error
            try:
                self.connection.rollback()
                self.logger.info("Rollback realizado en la transacción")
            except Exception as rollback_error:
                self.logger.error(f"Error en rollback: {str(rollback_error)}")
                # Si hay error en el rollback, intentar reconectar
                if self.connect():
                    self.logger.info("Reconexión exitosa después de error en rollback")
                    return self.execute_query(query, params, fetch)
            
            # Intentar reconectar en caso de error de conexión
            if "connection" in str(e).lower():
                self.logger.info("Intentando reconexión...")
                if self.connect():
                    return self.execute_query(query, params, fetch)
            
            return None
    
    def get_email_configurations(self):
        """
        Obtiene las configuraciones de email de la base de datos
        
        Returns:
            list: Configuraciones de email
        """
        query = """
        SELECT ec.id, ec.servidor_entrada, ec.puerto_entrada, ec.usuario, 
               ec.password, ec.usar_ssl_entrada, c.id as casilla_id, 
               c.yaml_contenido, c.nombre, ec.servidor_salida, ec.puerto_salida,
               ec.usar_tls_salida
        FROM email_configuraciones ec
        JOIN casillas c ON ec.casilla_id = c.id
        WHERE ec.estado = 'pendiente'
        """
        
        return self.execute_query(query)
    
    def get_authorized_senders(self, casilla_id):
        """
        Obtiene los remitentes autorizados para una casilla
        
        Args:
            casilla_id (int): ID de la casilla
            
        Returns:
            list: Lista de direcciones de correo autorizadas
        """
        query = """
        SELECT parametros
        FROM emisores_por_casilla
        WHERE casilla_id = %s
        """
        
        result = self.execute_query(query, (casilla_id,))
        
        authorized_emails = []
        if result:
            for row in result:
                params = row.get('parametros', {})
                if isinstance(params, str):
                    try:
                        params = json.loads(params)
                    except:
                        continue
                
                emails = params.get('emails_autorizados', [])
                if isinstance(emails, list):
                    authorized_emails.extend(emails)
                elif isinstance(emails, str):
                    authorized_emails.append(emails)
        
        return authorized_emails
    
    def get_sftp_configurations(self):
        """
        Obtiene las configuraciones SFTP desde la tabla emisores_por_casilla.
        Solo recupera configuraciones que sean específicamente SFTP.
        
        Returns:
            list: Lista de configuraciones SFTP con la casilla asociada
        """
        self.logger.info("Obteniendo configuraciones SFTP")
        query = """
        SELECT epc.emisor_id as emisor_id, epc.parametros, epc.metodo_envio, c.id as casilla_id, 
               c.yaml_contenido, c.nombre_yaml, c.nombre, epc.emisor_sftp_subdirectorio,
               e.directorio as emisor_directorio
        FROM emisores_por_casilla epc
        JOIN casillas c ON epc.casilla_id = c.id
        JOIN emisores e ON epc.emisor_id = e.id
        WHERE epc.metodo_envio = 'sftp' 
          AND epc.parametros IS NOT NULL 
        """
        
        result = self.execute_query(query)
        if not result:
            self.logger.info("No se encontraron configuraciones SFTP")
            return []
            
        sftp_configs = []
        for row in result:
            params = row.get('parametros', {})
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except:
                    self.logger.error(f"Error al procesar JSON de parámetros para emisor ID {row.get('emisor_id')}")
                    continue
            
            metodo_envio = row.get('metodo_envio')
            
            # Verificar que sea una configuración SFTP válida con los campos esperados
            if not params.get('servidor') or not params.get('usuario'):
                self.logger.warning(f"Configuración SFTP incompleta para emisor ID {row.get('emisor_id')}: falta servidor o usuario")
                continue
            
            # Determinar el directorio a usar en SFTP
            # Si hay un subdirectorio específico configurado para esta relación emisor-casilla, usarlo
            # Si no, usar el directorio principal del emisor, o un directorio por defecto basado en la casilla
            sftp_directory = None
            if row.get('emisor_sftp_subdirectorio'):
                sftp_directory = row.get('emisor_sftp_subdirectorio')
                self.logger.info(f"Usando subdirectorio SFTP específico: {sftp_directory}")
            elif row.get('emisor_directorio'):
                sftp_directory = row.get('emisor_directorio')
                self.logger.info(f"Usando directorio principal del emisor: {sftp_directory}")
            else:
                sftp_directory = f"data/{row.get('casilla_id')}"
                self.logger.info(f"Usando directorio predeterminado: {sftp_directory}")
                
            # Construir configuración completa - solo para SFTP real
            config = {
                'emisor_id': row.get('emisor_id'),
                'casilla_id': row.get('casilla_id'),
                'casilla_nombre': row.get('nombre', 'Sin nombre'),
                'nombre_yaml': row.get('nombre_yaml'),
                'yaml_contenido': row.get('yaml_contenido', ''),
                'metodo_envio': 'sftp',  # Siempre forzar a SFTP
                'configuracion': {
                    'servidor': params.get('servidor', ''),
                    'puerto': params.get('puerto', 22),
                    'usuario': params.get('usuario', ''),
                    'password': params.get('clave', ''),
                    'key_path': params.get('ruta_clave', None),
                    'data_dir': sftp_directory,
                    'processed_dir': f"{sftp_directory}/procesado"
                }
            }
            
            self.logger.info(f"Configuración SFTP encontrada para casilla {row.get('casilla_id')}: {params.get('servidor')} - {params.get('usuario')}")
            sftp_configs.append(config)
            
        self.logger.info(f"Se encontraron {len(sftp_configs)} configuraciones SFTP")
        return sftp_configs
    
    def close(self):
        """Cierra la conexión a la base de datos"""
        if self.connection:
            self.connection.close()
            self.logger.info("Conexión a base de datos cerrada")

class EmailProcessor:
    """
    Procesa correos electrónicos entrantes y envía respuestas
    """
    
    def __init__(self, db_manager):
        """
        Inicializa el procesador de emails
        
        Args:
            db_manager (DatabaseManager): Gestor de base de datos
        """
        self.logger = logging.getLogger("SAGE_Daemon2.EmailProcessor")
        self.db_manager = db_manager
        self.casilla_id = None  # Se establecerá cuando se procese una casilla
    
    def get_reply_address(self, email_message):
        """
        Determina la dirección de respuesta adecuada
        
        Args:
            email_message (email.message.Message): Mensaje de correo
            
        Returns:
            tuple: (dirección de respuesta, origen de la dirección)
        """
        # Extraer dirección From
        from_header = email_message.get('From', '')
        _, email_address = parseaddr(from_header)
        
        reply_to_address = email_address
        reply_source = "From"
        
        # Verificar si hay Reply-To (prioridad más alta)
        if 'Reply-To' in email_message:
            reply_to = email_message['Reply-To']
            _, reply_address = parseaddr(reply_to)
            if reply_address:
                reply_to_address = reply_address
                reply_source = "Reply-To"
                
        # Verificar Return-Path como alternativa
        elif 'Return-Path' in email_message:
            return_path = email_message['Return-Path'].strip()
            # Eliminar los <> si existen
            if return_path.startswith('<') and return_path.endswith('>'):
                return_path = return_path[1:-1]
            if return_path and '@' in return_path:
                reply_to_address = return_path
                reply_source = "Return-Path"
        
        self.logger.info(f"Dirección de respuesta determinada: {reply_to_address} (de {reply_source})")
        return reply_to_address, reply_source
    
    def is_sender_authorized(self, email_address, authorized_senders):
        """
        Verifica si un remitente está autorizado
        
        Args:
            email_address (str): Dirección del remitente
            authorized_senders (list): Lista de remitentes autorizados
            
        Returns:
            bool: True si está autorizado, False en caso contrario
        """
        email_address = email_address.lower()
        
        # Considerar como autorizados a todos los correos internos del sistema SAGE
        if email_address.endswith('@sage.vidahub.ai'):
            self.logger.info(f"Remitente {email_address} autorizado automáticamente (correo interno SAGE)")
            return True
        
        for sender in authorized_senders:
            if sender.lower() == email_address:
                return True
        
        return False
    
    def save_attachment(self, part):
        """
        Guarda un adjunto en un archivo temporal
        
        Args:
            part (email.message.Message): Parte del mensaje con el adjunto
            
        Returns:
            tuple: (ruta del archivo, nombre del archivo) o (None, None)
        """
        if part.get_content_disposition() is None:
            return None, None
            
        filename = part.get_filename()
        if not filename:
            return None, None
            
        try:
            # Crear archivo temporal para el adjunto
            fd, path = tempfile.mkstemp(suffix=f'_{filename}')
            os.close(fd)
            
            with open(path, 'wb') as f:
                f.write(part.get_payload(decode=True))
                
            self.logger.info(f"Adjunto guardado: {filename} en {path}")
            return path, filename
        except Exception as e:
            self.logger.error(f"Error al guardar adjunto {filename}: {str(e)}")
            return None, None
    
    def process_email(self, email_config, authorized_senders):
        """
        Procesa los correos electrónicos de una configuración
        
        Args:
            email_config (dict): Configuración de correo
            authorized_senders (list): Lista de remitentes autorizados
            
        Returns:
            int: Número de correos procesados
        """
        servidor = email_config.get('servidor_entrada', '')
        puerto = email_config.get('puerto_entrada', 993)
        usuario = email_config.get('usuario', '')
        password = email_config.get('password', '')
        usar_ssl = email_config.get('usar_ssl_entrada', True)
        casilla_id = email_config.get('casilla_id')
        casilla_nombre = email_config.get('nombre', 'Desconocida')
        yaml_contenido = email_config.get('yaml_contenido', '')
        
        if not servidor or not usuario or not password:
            self.logger.error(f"Configuración incompleta para casilla {casilla_id}")
            return 0
            
        self.logger.info(f"Procesando correos para {usuario} (Casilla: {casilla_nombre})")
        
        # Establecer el casilla_id para esta operación
        self.casilla_id = casilla_id
        
        try:
            # Conexión IMAP
            if usar_ssl:
                mail = imaplib.IMAP4_SSL(servidor, puerto)
            else:
                mail = imaplib.IMAP4(servidor, puerto)
                
            mail.login(usuario, password)
            mail.select('INBOX')
            
            # Buscar mensajes no leídos
            _, data = mail.search(None, 'UNSEEN')
            email_ids = data[0].split()
            
            if not email_ids:
                self.logger.info(f"No hay mensajes sin leer para {usuario}")
                mail.logout()
                return 0
                
            self.logger.info(f"Se encontraron {len(email_ids)} mensajes sin leer para {usuario}")
            
            processed_count = 0
            for email_id in email_ids:
                try:
                    _, msg_data = mail.fetch(email_id, '(RFC822)')
                    raw_email = msg_data[0][1]
                    
                    # Parsear mensaje
                    email_message = email.message_from_bytes(raw_email)
                    
                    # Obtener dirección del remitente
                    from_header = email_message.get('From', '')
                    _, sender_email = parseaddr(from_header)
                    
                    # Determinar dirección de respuesta
                    reply_to_address, _ = self.get_reply_address(email_message)
                    
                    # Enviar acuse de recibo a TODOS los mensajes entrantes
                    self.logger.info(f"Enviando acuse de recibo a: {reply_to_address}")
                    self.send_generic_acknowledgment(
                        email_message,
                        reply_to_address,
                        email_config
                    )
                    
                    # Verificar si el remitente está autorizado
                    is_authorized = self.is_sender_authorized(sender_email, authorized_senders)
                    
                    if is_authorized:
                        self.logger.info(f"Remitente autorizado: {sender_email} - Procesando mensaje")
                        
                        # Buscar adjuntos en el mensaje
                        has_attachments = False
                        attachments_info = []
                        
                        for part in email_message.walk():
                            if part.get_content_maintype() == 'multipart':
                                continue
                                
                            if part.get_content_disposition() is not None and 'attachment' in part.get_content_disposition():
                                # Guardar el adjunto en un archivo temporal
                                attachment_path, attachment_name = self.save_attachment(part)
                                
                                if attachment_path and attachment_name:
                                    has_attachments = True
                                    
                                    # Procesar el adjunto con el yaml_contenido de la casilla
                                    self.logger.info(f"Procesando adjunto: {attachment_name}")
                                    processing_result = self.process_attachment(
                                        attachment_path, 
                                        attachment_name, 
                                        email_config.get('yaml_contenido', ''),
                                        sender_email  # Pasamos el email del remitente
                                    )
                                    
                                    attachments_info.append({
                                        'name': attachment_name,
                                        'path': attachment_path,
                                        'result': processing_result
                                    })
                        
                        if has_attachments:
                            # Enviar resultado del procesamiento al remitente
                            self.logger.info(f"Enviando resultado del procesamiento a {reply_to_address}")
                            self.send_processing_results(
                                email_message,
                                reply_to_address,
                                email_config,
                                attachments_info
                            )
                        else:
                            # No hay adjuntos, enviar respuesta indicando que se necesita un archivo
                            self.logger.info(f"No se encontraron adjuntos, enviando solicitud a {reply_to_address}")
                            self.send_attachment_request(
                                email_message,
                                reply_to_address,
                                email_config
                            )
                    else:
                        self.logger.info(f"Remitente no autorizado: {sender_email} - Enviando notificación")
                        # Enviar respuesta a remitente no autorizado
                        self.send_unauthorized_sender_response(
                            email_message,
                            reply_to_address,
                            email_config
                        )
                    
                    processed_count += 1
                    
                except Exception as e:
                    self.logger.error(f"Error al procesar email {email_id}: {str(e)}")
                    self.logger.error(traceback.format_exc())
            
            mail.logout()
            return processed_count
            
        except Exception as e:
            self.logger.error(f"Error en conexión IMAP: {str(e)}")
            self.logger.error(traceback.format_exc())
            return 0
    
    def get_emisor_id_by_email(self, email_address):
        """
        Obtiene el ID de un emisor a partir de su dirección de correo electrónico
        
        Args:
            email_address (str): Dirección de correo electrónico
            
        Returns:
            int: ID del emisor o None si no se encuentra
        """
        if not email_address:
            return None
            
        query = """
        SELECT id FROM emisores 
        WHERE email_corporativo = %s
        """
        
        result = self.db_manager.execute_query(query, (email_address,))
        
        if result and len(result) > 0:
            emisor_id = result[0].get('id')
            self.logger.info(f"Emisor encontrado con ID {emisor_id} para email {email_address}")
            return emisor_id
        else:
            self.logger.warning(f"No se encontró emisor para el email: {email_address}")
            return None
    
    def process_attachment(self, file_path, file_name, yaml_config, sender_email=None):
        """
        Procesa un archivo adjunto usando sage/main.py
        
        Args:
            file_path (str): Ruta al archivo
            file_name (str): Nombre del archivo
            yaml_config (str): Configuración YAML para procesamiento
            sender_email (str, optional): Email del remitente
            
        Returns:
            dict: Resultados del procesamiento
        """
        self.logger.info(f"Procesando adjunto: {file_name}")
        
        try:
            # Crear un archivo temporal para el YAML
            yaml_fd, yaml_path = tempfile.mkstemp(suffix='.yaml')
            try:
                with os.fdopen(yaml_fd, 'w') as f:
                    f.write(yaml_config)
            except:
                os.close(yaml_fd)
                raise
                
            # Obtener ID de casilla y emisor desde el mensaje de correo
            casilla_id = self.casilla_id
            emisor_id = self.get_emisor_id_by_email(sender_email) if sender_email else None
            metodo_envio = "email"  # Siempre será email en este caso
            
            # Usar el proceso central de SAGE a través de main.py
            from sage.main import process_files
            
            try:
                # Procesar el archivo usando el mismo flujo que el CLI
                execution_uuid, error_count, warning_count = process_files(
                    yaml_path=yaml_path,
                    data_path=file_path,
                    casilla_id=casilla_id,
                    emisor_id=emisor_id,
                    metodo_envio=metodo_envio
                )
                
                # El log HTML, JSON y TXT ya habrá sido generado por process_files
                execution_dir = os.path.join("executions", execution_uuid)
                
                # Verificar si se generó el reporte JSON
                report_json_path = os.path.join(execution_dir, "report.json")
                email_html_path = os.path.join(execution_dir, "email_report.html")
                report_html_path = os.path.join(execution_dir, "report.html")
                output_log_path = os.path.join(execution_dir, "output.log")
                error_log_path = os.path.join(execution_dir, "error.log")
                results_file_path = os.path.join(execution_dir, "results.txt")
                
                if not os.path.exists(report_json_path):
                    self.logger.warning(f"No se generó el archivo report.json para la ejecución {execution_uuid}")
                    
                # Reporte exitoso o con errores/advertencias
                status = "error" if error_count > 0 else "warning" if warning_count > 0 else "success"
                
                # Extraer información del log de texto para estimar filas procesadas
                rows_processed = 0
                if os.path.exists(output_log_path):
                    with open(output_log_path, 'r') as f:
                        log_content = f.read()
                        # Intentar extraer el número de filas procesadas del log
                        import re
                        rows_match = re.search(r"Registros totales: (\d+)", log_content)
                        if rows_match:
                            rows_processed = int(rows_match.group(1))
                
                return {
                    "file_name": file_name,
                    "status": status,
                    "message": f"Archivo {file_name} procesado: {error_count} errores y {warning_count} advertencias",
                    "execution_uuid": execution_uuid,
                    "execution_dir": execution_dir,
                    "details": {
                        "rows_processed": rows_processed,
                        "errors": error_count,
                        "warnings": warning_count,
                        "report_html_path": report_html_path,
                        "email_html_path": email_html_path,
                        "output_log_path": output_log_path,
                        "error_log_path": error_log_path,
                        "results_file_path": results_file_path,
                        "report_json_path": report_json_path
                    }
                }
                
            except Exception as e:
                self.logger.error(f"Error procesando archivo con main.py: {str(e)}")
                return {
                    "file_name": file_name,
                    "status": "error",
                    "message": f"Error en procesamiento: {str(e)}",
                    "details": {
                        "error": str(e)
                    }
                }
                
        except Exception as e:
            self.logger.error(f"Error al procesar adjunto {file_name}: {str(e)}")
            self.logger.error(traceback.format_exc())
            return {
                "file_name": file_name,
                "status": "error",
                "message": f"Error en procesamiento: {str(e)}",
                "details": {
                    "error": str(e)
                }
            }
    
    def send_email(self, email_config, to_address, subject, body, attachments=None):
        """
        Envía un correo electrónico
        
        Args:
            email_config (dict): Configuración de email
            to_address (str): Dirección del destinatario
            subject (str): Asunto del correo
            body (str): Cuerpo del correo
            attachments (list, optional): Lista de adjuntos (path, filename)
            
        Returns:
            bool: True si el envío fue exitoso, False en caso contrario
        """
        if not to_address or '@' not in to_address:
            self.logger.error(f"Dirección de destino inválida: {to_address}")
            return False
            
        # Verificar si la dirección es la misma que la del remitente
        if to_address.lower() == email_config.get('usuario', '').lower():
            self.logger.warning(f"No se envía respuesta a la misma casilla: {to_address}")
            return False
            
        try:
            # Crear mensaje
            msg = MIMEMultipart()
            msg['From'] = email_config.get('usuario', '')
            msg['To'] = to_address
            msg['Subject'] = subject
            
            # Encabezados de prioridad alta
            msg['X-Priority'] = '1'
            msg['X-MSMail-Priority'] = 'High'
            msg['Importance'] = 'High'
            
            # Adjuntar cuerpo del mensaje
            msg.attach(MIMEText(body, 'plain'))
            
            # Adjuntar archivos
            if attachments:
                for attachment_path, attachment_name in attachments:
                    with open(attachment_path, 'rb') as file:
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(file.read())
                        
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f'attachment; filename="{attachment_name}"')
                    msg.attach(part)
            
            # Configuración SMTP
            servidor_salida = email_config.get('servidor_salida', email_config.get('servidor_entrada', ''))
            puerto_salida = email_config.get('puerto_salida', 587)
            usar_tls = email_config.get('usar_tls_salida', True)
            usuario = email_config.get('usuario', '')
            password = email_config.get('password', '')
            
            # Log detallado de la configuración
            self.logger.info(f"Configuración SMTP detallada:")
            self.logger.info(f"  - Servidor: {servidor_salida}")
            self.logger.info(f"  - Puerto: {puerto_salida}")
            self.logger.info(f"  - Usuario: {usuario}")
            self.logger.info(f"  - Password: {password}")
            self.logger.info(f"  - Usar TLS: {usar_tls}")
            self.logger.info(f"  - Destinatario: {to_address}")
            
            # Conexión SMTP con modo debug
            if puerto_salida == 465:
                # Puerto SSL
                smtp = smtplib.SMTP_SSL(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP_SSL establecida con {servidor_salida}:{puerto_salida}")
            else:
                # Puerto normal o TLS
                smtp = smtplib.SMTP(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP establecida con {servidor_salida}:{puerto_salida}")
                
                if usar_tls:
                    self.logger.info("Iniciando STARTTLS...")
                    smtp.starttls()
                    self.logger.info("STARTTLS completado")
            
            self.logger.info(f"Iniciando login con usuario: {usuario}")
            smtp_code, smtp_response = smtp.login(usuario, password)
            self.logger.info(f"Login completado con respuesta: {smtp_code} {smtp_response}")
            
            # Enviar email
            self.logger.info(f"Enviando correo desde {usuario} a {to_address}")
            resultado = smtp.sendmail(usuario, to_address, msg.as_string())
            self.logger.info(f"Resultado sendmail: {resultado}")
            
            smtp.quit()
            self.logger.info("Conexión SMTP cerrada")
            
            self.logger.info(f"Email enviado correctamente a {to_address}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error al enviar email a {to_address}: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False
    
    def send_unauthorized_sender_response(self, original_email, reply_address, email_config):
        """
        Envía respuesta a un remitente no autorizado
        
        Args:
            original_email (email.message.Message): Email original
            reply_address (str): Dirección de respuesta
            email_config (dict): Configuración de email
            
        Returns:
            bool: True si el envío fue exitoso, False en caso contrario
        """
        # Construir asunto como respuesta al original
        original_subject = original_email.get('Subject', 'Remitente no autorizado en SAGE')
        if not original_subject.lower().startswith('re:'):
            subject = f"Re: {original_subject}"
        else:
            subject = original_subject
        
        # Obtener el ID de mensaje original para threading adecuado
        original_message_id = original_email.get('Message-ID', None)
            
        # Construir cuerpo del mensaje con formato más amigable y orientado al marketing
        body = f"""
Estimado/a Usuario,

¡Gracias por comunicarse con nosotros a través de {email_config.get('usuario', '')}!

Queremos informarle que actualmente su dirección de correo electrónico ({reply_address}) no se encuentra en nuestra lista de remitentes autorizados para esta casilla. ¡Pero no se preocupe! Valoramos enormemente su interés en utilizar nuestros servicios de procesamiento de datos.

Para brindarle una experiencia completa y personalizada con el Sistema SAGE, le invitamos a contactar a su administrador de sistema para solicitar su autorización. Una vez autorizado, podrá disfrutar de todas las ventajas y beneficios de nuestra plataforma de procesamiento automatizado:

✓ Validación automática de archivos
✓ Notificaciones en tiempo real
✓ Reportes detallados de procesamiento
✓ Integración con sus sistemas existentes

Si tiene alguna consulta o necesita asistencia adicional, nuestro equipo está siempre disponible para ayudarle. ¡Nos encantaría poder atenderle pronto como usuario autorizado!

Gracias por su comprensión y por elegirnos.

Atentamente,
El Equipo SAGE
"""
        # Usamos siempre EmailMessage sin excepción para mayor consistencia
        from email.message import EmailMessage
        from email.utils import formatdate, make_msgid
        
        # Crear mensaje con API moderna
        msg = EmailMessage()
        msg['From'] = email_config.get('usuario', '')
        msg['To'] = reply_address
        msg['Subject'] = subject
        msg['Date'] = formatdate(localtime=True)
        
        # Generar un Message-ID propio para mejorar el threading
        if not hasattr(self, '_unauthorized_counter'):
                        self._unauthorized_counter = 0
        self._unauthorized_counter += 1
        msg['Message-ID'] = make_msgid(f"unauth{self._unauthorized_counter}", domain='sage.vidahub.ai')
        
        # Encabezados de threading
        if original_message_id:
            msg['In-Reply-To'] = original_message_id
            msg['References'] = original_message_id
            self.logger.info(f"Añadidos encabezados de respuesta In-Reply-To: {original_message_id}")
        
        # Encabezados de prioridad alta
        msg['X-Priority'] = '1'
        msg['X-MSMail-Priority'] = 'High'
        msg['Importance'] = 'High'
        
        # Añadir encabezados para evitar clasificación como spam
        msg['Precedence'] = 'bulk'  # Indica que es un mensaje automático
        msg['Auto-Submitted'] = 'auto-replied'  # Indica que es una respuesta automática
        
        # Contenido del mensaje
        msg.set_content(body)
        self.logger.info("Usando EmailMessage moderno para envío de respuesta a remitente no autorizado")
        
        # Enviar email
        try:
            # Configuración SMTP
            servidor_salida = email_config.get('servidor_salida', email_config.get('servidor_entrada', ''))
            puerto_salida = email_config.get('puerto_salida', 587)
            usar_tls = email_config.get('usar_tls_salida', True)
            usuario = email_config.get('usuario', '')
            password = email_config.get('password', '')
            
            # Log detallado de la configuración
            self.logger.info(f"Configuración SMTP detallada:")
            self.logger.info(f"  - Servidor: {servidor_salida}")
            self.logger.info(f"  - Puerto: {puerto_salida}")
            self.logger.info(f"  - Usuario: {usuario}")
            self.logger.info(f"  - Password: {password}")
            self.logger.info(f"  - Usar TLS: {usar_tls}")
            self.logger.info(f"  - Destinatario: {reply_address}")
            
            # Conexión SMTP con modo debug
            if puerto_salida == 465:
                # Puerto SSL
                smtp = smtplib.SMTP_SSL(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP_SSL establecida con {servidor_salida}:{puerto_salida}")
            else:
                # Puerto normal o TLS
                smtp = smtplib.SMTP(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP establecida con {servidor_salida}:{puerto_salida}")
                
                if usar_tls:
                    self.logger.info("Iniciando STARTTLS...")
                    smtp.starttls()
                    self.logger.info("STARTTLS completado")
            
            self.logger.info(f"Iniciando login con usuario: {usuario}")
            smtp_code, smtp_response = smtp.login(usuario, password)
            self.logger.info(f"Login completado con respuesta: {smtp_code} {smtp_response}")
            
            # Enviar email usando send_message para EmailMessage
            self.logger.info(f"Enviando correo desde {usuario} a {reply_address}")
            resultado = smtp.send_message(msg)
            self.logger.info(f"Resultado sendmail: {resultado}")
            
            smtp.quit()
            self.logger.info("Conexión SMTP cerrada")
            
            self.logger.info(f"Email de respuesta enviado correctamente a {reply_address}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error al enviar email de respuesta a {reply_address}: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False
    
    def send_missing_attachment_response(self, original_email, reply_address, email_config):
        """
        Envía respuesta cuando falta un adjunto
        
        Args:
            original_email (email.message.Message): Email original
            reply_address (str): Dirección de respuesta
            email_config (dict): Configuración de email
            
        Returns:
            bool: True si el envío fue exitoso, False en caso contrario
        """
        # Construir asunto como respuesta al original
        original_subject = original_email.get('Subject', 'Falta adjunto en SAGE')
        if not original_subject.lower().startswith('re:'):
            subject = f"Re: {original_subject}"
        else:
            subject = original_subject
            
        # Obtener el ID de mensaje original para threading adecuado
        original_message_id = original_email.get('Message-ID', None)
        
        # Construir cuerpo del mensaje
        body = f"""
Estimado/a Usuario,

Hemos recibido su mensaje en {email_config.get('usuario', '')}, pero no se encontró ningún archivo adjunto para procesar.

Para que el sistema SAGE pueda procesar su solicitud, por favor reenvíe su mensaje incluyendo el archivo que desea procesar como adjunto.

Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.

Saludos cordiales,
Sistema SAGE
"""
        
        # Usamos siempre EmailMessage sin excepción para mayor consistencia
        from email.message import EmailMessage
        from email.utils import formatdate, make_msgid
        
        # Crear mensaje con API moderna
        msg = EmailMessage()
        msg['From'] = email_config.get('usuario', '')
        msg['To'] = reply_address
        msg['Subject'] = subject
        msg['Date'] = formatdate(localtime=True)
        
        # Generar un Message-ID propio para mejorar el threading
        if not hasattr(self, '_attachment_counter'):
            self._attachment_counter = 0
        self._attachment_counter += 1
        msg['Message-ID'] = make_msgid(f"attach{self._attachment_counter}", domain='sage.vidahub.ai')
        
        # Encabezados de threading
        if original_message_id:
            msg['In-Reply-To'] = original_message_id
            msg['References'] = original_message_id
            self.logger.info(f"Añadidos encabezados de respuesta In-Reply-To: {original_message_id}")
        
        # Encabezados de prioridad alta
        msg['X-Priority'] = '1'
        msg['X-MSMail-Priority'] = 'High'
        msg['Importance'] = 'High'
        
        # Añadir encabezados para evitar clasificación como spam
        msg['Precedence'] = 'bulk'  # Indica que es un mensaje automático
        msg['Auto-Submitted'] = 'auto-replied'  # Indica que es una respuesta automática
        
        # Contenido del mensaje
        msg.set_content(body)
        self.logger.info("Usando EmailMessage moderno para envío de respuesta de solicitud de adjunto")
        
        # Enviar email
        try:
            # Configuración SMTP
            servidor_salida = email_config.get('servidor_salida', email_config.get('servidor_entrada', ''))
            puerto_salida = email_config.get('puerto_salida', 587)
            usar_tls = email_config.get('usar_tls_salida', True)
            usuario = email_config.get('usuario', '')
            password = email_config.get('password', '')
            
            # Log detallado de la configuración
            self.logger.info(f"Configuración SMTP detallada:")
            self.logger.info(f"  - Servidor: {servidor_salida}")
            self.logger.info(f"  - Puerto: {puerto_salida}")
            self.logger.info(f"  - Usuario: {usuario}")
            self.logger.info(f"  - Password: {password}")
            self.logger.info(f"  - Usar TLS: {usar_tls}")
            self.logger.info(f"  - Destinatario: {reply_address}")
            
            # Conexión SMTP con modo debug
            if puerto_salida == 465:
                # Puerto SSL
                smtp = smtplib.SMTP_SSL(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP_SSL establecida con {servidor_salida}:{puerto_salida}")
            else:
                # Puerto normal o TLS
                smtp = smtplib.SMTP(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP establecida con {servidor_salida}:{puerto_salida}")
                
                if usar_tls:
                    self.logger.info("Iniciando STARTTLS...")
                    smtp.starttls()
                    self.logger.info("STARTTLS completado")
            
            self.logger.info(f"Iniciando login con usuario: {usuario}")
            smtp_code, smtp_response = smtp.login(usuario, password)
            self.logger.info(f"Login completado con respuesta: {smtp_code} {smtp_response}")
            
            # Enviar email usando send_message para EmailMessage
            self.logger.info(f"Enviando correo desde {usuario} a {reply_address}")
            resultado = smtp.send_message(msg)
            self.logger.info(f"Resultado sendmail: {resultado}")
            
            smtp.quit()
            self.logger.info("Conexión SMTP cerrada")
            
            self.logger.info(f"Email de respuesta 'falta adjunto' enviado correctamente a {reply_address}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error al enviar email de respuesta a {reply_address}: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False
    
    def send_generic_acknowledgment(self, original_email, reply_address, email_config):
        """
        Envía un acuse de recibo genérico para cualquier mensaje entrante
        
        Args:
            original_email (email.message.Message): Email original
            reply_address (str): Dirección de respuesta
            email_config (dict): Configuración de email
            
        Returns:
            bool: True si el envío fue exitoso, False en caso contrario
        """
        # Construir asunto como respuesta al original
        original_subject = original_email.get('Subject', 'Mensaje recibido en SAGE')
        if not original_subject.lower().startswith('re:'):
            subject = f"Re: {original_subject}"
        else:
            subject = original_subject
        
        # Obtener el ID de mensaje original para threading adecuado
        original_message_id = original_email.get('Message-ID', None)
            
        # Construir cuerpo del mensaje
        body = f"""
Estimado/a Usuario,

Hemos recibido su mensaje en {email_config.get('usuario', '')}.

Estamos procesando su solicitud y le informaremos pronto cuando hayamos completado el análisis.

Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.

Saludos cordiales,
Sistema SAGE
"""
        # Crear mensaje usando EmailMessage si está disponible
        try:
            from email.message import EmailMessage
            from email.utils import formatdate, make_msgid
            
            # Crear mensaje con API moderna
            msg = EmailMessage()
            msg['From'] = email_config.get('usuario', '')
            msg['To'] = reply_address
            msg['Subject'] = subject
            msg['Date'] = formatdate(localtime=True)
            
            # Generar un Message-ID propio para mejorar el threading
            if not hasattr(self, '_message_counter'):
                self._message_counter = 0
            self._message_counter += 1
            msg['Message-ID'] = make_msgid(f"ack{self._message_counter}", domain='sage.vidahub.ai')
            
            # Encabezados de threading
            if original_message_id:
                msg['In-Reply-To'] = original_message_id
                msg['References'] = original_message_id
                self.logger.info(f"Añadidos encabezados de respuesta In-Reply-To: {original_message_id}")
            
            # Encabezados de prioridad alta
            msg['X-Priority'] = '1'
            msg['X-MSMail-Priority'] = 'High'
            msg['Importance'] = 'High'
            
            # Contenido del mensaje
            msg.set_content(body)
            self.logger.info("Usando EmailMessage moderno para envío de correo")
            
        except (ImportError, AttributeError):
            # Fallback a MIMEMultipart en caso de error
            self.logger.info("Fallback a MIMEMultipart para envío de correo")
            
            # Crear mensaje con API tradicional
            msg = MIMEMultipart()
            msg['From'] = email_config.get('usuario', '')
            msg['To'] = reply_address
            msg['Subject'] = subject
            
            # Usar formatdate de forma segura
            try:
                from email.utils import formatdate
                msg['Date'] = formatdate(localtime=True)
            except ImportError:
                import time
                msg['Date'] = time.strftime("%a, %d %b %Y %H:%M:%S %z", time.localtime())
            
            # Encabezados de prioridad alta
            msg['X-Priority'] = '1'
            msg['X-MSMail-Priority'] = 'High'
            msg['Importance'] = 'High'
            
            # Añadir encabezados de referencia para que sea un reply correcto
            if original_message_id:
                msg['In-Reply-To'] = original_message_id
                msg['References'] = original_message_id
                self.logger.info(f"Añadidos encabezados de respuesta In-Reply-To: {original_message_id}")
            
            # Adjuntar cuerpo del mensaje
            msg.attach(MIMEText(body, 'plain'))
        
        # Enviar email
        try:
            # Configuración SMTP
            servidor_salida = email_config.get('servidor_salida', email_config.get('servidor_entrada', ''))
            puerto_salida = email_config.get('puerto_salida', 587)
            usar_tls = email_config.get('usar_tls_salida', True)
            usuario = email_config.get('usuario', '')
            password = email_config.get('password', '')
            
            # Log detallado de la configuración
            self.logger.info(f"Configuración SMTP detallada:")
            self.logger.info(f"  - Servidor: {servidor_salida}")
            self.logger.info(f"  - Puerto: {puerto_salida}")
            self.logger.info(f"  - Usuario: {usuario}")
            self.logger.info(f"  - Password: {password}")
            self.logger.info(f"  - Usar TLS: {usar_tls}")
            self.logger.info(f"  - Destinatario: {reply_address}")
            
            # Conexión SMTP con modo debug
            if puerto_salida == 465:
                # Puerto SSL
                smtp = smtplib.SMTP_SSL(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP_SSL establecida con {servidor_salida}:{puerto_salida}")
            else:
                # Puerto normal o TLS
                smtp = smtplib.SMTP(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP establecida con {servidor_salida}:{puerto_salida}")
                
                if usar_tls:
                    self.logger.info("Iniciando STARTTLS...")
                    smtp.starttls()
                    self.logger.info("STARTTLS completado")
            
            self.logger.info(f"Iniciando login con usuario: {usuario}")
            smtp_code, smtp_response = smtp.login(usuario, password)
            self.logger.info(f"Login completado con respuesta: {smtp_code} {smtp_response}")
            
            # Enviar email usando send_message para EmailMessage
            self.logger.info(f"Enviando correo desde {usuario} a {reply_address}")
            resultado = smtp.send_message(msg)
            self.logger.info(f"Resultado sendmail: {resultado}")
            
            smtp.quit()
            self.logger.info("Conexión SMTP cerrada")
            
            self.logger.info(f"Acuse de recibo enviado correctamente a {reply_address}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error al enviar acuse de recibo a {reply_address}: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False
    
    def send_processing_response(self, original_email, reply_address, email_config, results, yaml_config):
        """
        Envía respuesta con resultados del procesamiento
        
        Args:
            original_email (email.message.Message): Email original
            reply_address (str): Dirección de respuesta
            email_config (dict): Configuración de email
            results (list): Resultados del procesamiento
            yaml_config (str): Configuración YAML utilizada
            
        Returns:
            bool: True si el envío fue exitoso, False en caso contrario
        """
        # Construir asunto como respuesta al original
        original_subject = original_email.get('Subject', 'Resultados procesamiento SAGE')
        if not original_subject.lower().startswith('re:'):
            subject = f"Re: {original_subject}"
        else:
            subject = original_subject
            
        # Construir cuerpo del mensaje con los resultados
        body = f"""
Estimado/a Usuario,

Hemos procesado su archivo enviado a {email_config.get('usuario', '')}.

Resultados del procesamiento:
"""

        # Añadir resultados de cada archivo
        for result in results:
            body += f"""
-----------------------------------------
Archivo: {result.get('file_name', 'Desconocido')}
Estado: {result.get('status', 'Desconocido')}
Mensaje: {result.get('message', 'No hay información adicional')}
"""
            # Añadir detalles si existen
            details = result.get('details', {})
            if details:
                body += "Detalles:\n"
                for key, value in details.items():
                    body += f"- {key}: {value}\n"

        body += """
-----------------------------------------

Este es un mensaje automático generado por el sistema SAGE.

Saludos cordiales,
Sistema SAGE
"""
        
        # Crear mensaje
        msg = MIMEMultipart()
        msg['From'] = email_config.get('usuario', '')
        msg['To'] = reply_address
        msg['Subject'] = subject
        
        # Encabezados de prioridad alta
        msg['X-Priority'] = '1'
        msg['X-MSMail-Priority'] = 'High'
        msg['Importance'] = 'High'
        
        # Añadir encabezados de referencia para que sea un reply correcto
        if 'Message-ID' in original_email:
            msg['In-Reply-To'] = original_email['Message-ID']
            msg['References'] = original_email['Message-ID']
            self.logger.info(f"Añadidos encabezados de respuesta In-Reply-To: {original_email['Message-ID']}")
        
        # Adjuntar cuerpo del mensaje
        msg.attach(MIMEText(body, 'plain'))
        
        # Enviar email
        try:
            # Configuración SMTP
            servidor_salida = email_config.get('servidor_salida', email_config.get('servidor_entrada', ''))
            puerto_salida = email_config.get('puerto_salida', 587)
            usar_tls = email_config.get('usar_tls_salida', True)
            usuario = email_config.get('usuario', '')
            password = email_config.get('password', '')
            
            # Log detallado de la configuración
            self.logger.info(f"Configuración SMTP detallada:")
            self.logger.info(f"  - Servidor: {servidor_salida}")
            self.logger.info(f"  - Puerto: {puerto_salida}")
            self.logger.info(f"  - Usuario: {usuario}")
            self.logger.info(f"  - Password: {password}")
            self.logger.info(f"  - Usar TLS: {usar_tls}")
            self.logger.info(f"  - Destinatario: {reply_address}")
            
            # Conexión SMTP con modo debug
            if puerto_salida == 465:
                # Puerto SSL
                smtp = smtplib.SMTP_SSL(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP_SSL establecida con {servidor_salida}:{puerto_salida}")
            else:
                # Puerto normal o TLS
                smtp = smtplib.SMTP(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP establecida con {servidor_salida}:{puerto_salida}")
                
                if usar_tls:
                    self.logger.info("Iniciando STARTTLS...")
                    smtp.starttls()
                    self.logger.info("STARTTLS completado")
            
            self.logger.info(f"Iniciando login con usuario: {usuario}")
            smtp_code, smtp_response = smtp.login(usuario, password)
            self.logger.info(f"Login completado con respuesta: {smtp_code} {smtp_response}")
            
            # Enviar email usando send_message para EmailMessage cuando corresponda
            self.logger.info(f"Enviando correo desde {usuario} a {reply_address}")
            
            # Verificar si estamos usando la API moderna de EmailMessage
            if isinstance(msg, EmailMessage):
                resultado = smtp.send_message(msg)
            else:
                resultado = smtp.sendmail(usuario, reply_address, msg.as_string())
                
            self.logger.info(f"Resultado sendmail: {resultado}")
            
            smtp.quit()
            self.logger.info("Conexión SMTP cerrada")
            
            self.logger.info(f"Email de respuesta con resultados enviado correctamente a {reply_address}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error al enviar email de respuesta con resultados a {reply_address}: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False
            
    def send_attachment_request(self, original_email, reply_address, email_config):
        """
        Envía una solicitud de archivo adjunto a un remitente autorizado
        
        Args:
            original_email (email.message.Message): Email original
            reply_address (str): Dirección de respuesta
            email_config (dict): Configuración de email
            
        Returns:
            bool: True si el envío fue exitoso, False en caso contrario
        """
        # Obtener el Message-ID original para threading
        original_message_id = original_email.get('Message-ID', None)
        
        # Construir asunto como respuesta al original
        original_subject = original_email.get('Subject', 'Solicitud de archivo adjunto en SAGE')
        if not original_subject.lower().startswith('re:'):
            subject = f"Re: {original_subject}"
        else:
            subject = original_subject
            
        # Construir cuerpo del mensaje
        body = f"""
Estimado/a Usuario,

Hemos recibido su mensaje en {email_config.get('usuario', '')}.

Para poder procesar su solicitud, necesitamos que adjunte el archivo de datos que desea analizar.
Por favor, responda a este correo adjuntando el archivo que desea procesar.

Recuerde que el sistema SAGE está configurado para procesar archivos según las reglas definidas para esta casilla.

Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.

Saludos cordiales,
Sistema SAGE
"""
        # Crear mensaje usando EmailMessage si está disponible
        try:
            from email.message import EmailMessage
            from email.utils import formatdate, make_msgid
            
            # Crear mensaje con API moderna
            msg = EmailMessage()
            msg['From'] = email_config.get('usuario', '')
            msg['To'] = reply_address
            msg['Subject'] = subject
            msg['Date'] = formatdate(localtime=True)
            
            # Generar un Message-ID propio para mejorar el threading
            if not hasattr(self, '_message_counter'):
                self._message_counter = 0
            self._message_counter += 1
            msg['Message-ID'] = make_msgid(f"req{self._message_counter}", domain='sage.vidahub.ai')
            
            # Encabezados de threading
            if original_message_id:
                msg['In-Reply-To'] = original_message_id
                msg['References'] = original_message_id
                self.logger.info(f"Añadidos encabezados de respuesta In-Reply-To: {original_message_id}")
            
            # Encabezados de prioridad alta
            msg['X-Priority'] = '1'
            msg['X-MSMail-Priority'] = 'High'
            msg['Importance'] = 'High'
            
            # Contenido del mensaje
            msg.set_content(body)
            self.logger.info("Usando EmailMessage moderno para envío de solicitud de adjunto")
            
        except (ImportError, AttributeError):
            # Fallback a MIMEMultipart en caso de error
            self.logger.info("Fallback a MIMEMultipart para envío de solicitud de adjunto")
            
            # Crear mensaje con API tradicional
            msg = MIMEMultipart()
            msg['From'] = email_config.get('usuario', '')
            msg['To'] = reply_address
            msg['Subject'] = subject
            
            # Usar formatdate de forma segura
            try:
                from email.utils import formatdate
                msg['Date'] = formatdate(localtime=True)
            except ImportError:
                import time
                msg['Date'] = time.strftime("%a, %d %b %Y %H:%M:%S %z", time.localtime())
            
            # Encabezados de prioridad alta
            msg['X-Priority'] = '1'
            msg['X-MSMail-Priority'] = 'High'
            msg['Importance'] = 'High'
            
            # Añadir encabezados de referencia para que sea un reply correcto
            if original_message_id:
                msg['In-Reply-To'] = original_message_id
                msg['References'] = original_message_id
                self.logger.info(f"Añadidos encabezados de respuesta In-Reply-To: {original_message_id}")
            
            # Adjuntar cuerpo del mensaje
            msg.attach(MIMEText(body, 'plain'))
        
        # Enviar email
        try:
            # Configuración SMTP
            servidor_salida = email_config.get('servidor_salida', email_config.get('servidor_entrada', ''))
            puerto_salida = email_config.get('puerto_salida', 587)
            usar_tls = email_config.get('usar_tls_salida', True)
            usuario = email_config.get('usuario', '')
            password = email_config.get('password', '')
            
            # Log detallado de la configuración
            self.logger.info(f"Configuración SMTP detallada:")
            self.logger.info(f"  - Servidor: {servidor_salida}")
            self.logger.info(f"  - Puerto: {puerto_salida}")
            self.logger.info(f"  - Usuario: {usuario}")
            self.logger.info(f"  - Password: {password}")
            self.logger.info(f"  - Usar TLS: {usar_tls}")
            self.logger.info(f"  - Destinatario: {reply_address}")
            
            # Conexión SMTP con modo debug
            if puerto_salida == 465:
                # Puerto SSL
                smtp = smtplib.SMTP_SSL(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP_SSL establecida con {servidor_salida}:{puerto_salida}")
            else:
                # Puerto normal o TLS
                smtp = smtplib.SMTP(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP establecida con {servidor_salida}:{puerto_salida}")
                
                if usar_tls:
                    self.logger.info("Iniciando STARTTLS...")
                    smtp.starttls()
                    self.logger.info("STARTTLS completado")
            
            self.logger.info(f"Iniciando login con usuario: {usuario}")
            smtp_code, smtp_response = smtp.login(usuario, password)
            self.logger.info(f"Login completado con respuesta: {smtp_code} {smtp_response}")
            
            # Enviar email usando send_message para EmailMessage cuando corresponda
            self.logger.info(f"Enviando correo desde {usuario} a {reply_address}")
            
            # Verificar si estamos usando la API moderna de EmailMessage
            if isinstance(msg, EmailMessage):
                resultado = smtp.send_message(msg)
            else:
                resultado = smtp.sendmail(usuario, reply_address, msg.as_string())
                
            self.logger.info(f"Resultado sendmail: {resultado}")
            
            smtp.quit()
            self.logger.info("Conexión SMTP cerrada")
            
            self.logger.info(f"Solicitud de archivo adjunto enviada correctamente a {reply_address}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error al enviar solicitud de archivo adjunto a {reply_address}: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False
    
    def send_processing_results(self, original_email, reply_address, email_config, attachments_info):
        """
        Envía los resultados del procesamiento de archivos adjuntos
        
        Args:
            original_email (email.message.Message): Email original
            reply_address (str): Dirección de respuesta
            email_config (dict): Configuración de email
            attachments_info (list): Información de los adjuntos procesados
            
        Returns:
            bool: True si el envío fue exitoso, False en caso contrario
        """
        # Obtener el Message-ID original para threading
        original_message_id = original_email.get('Message-ID', None)
        
        # Construir asunto como respuesta al original
        original_subject = original_email.get('Subject', 'Resultados de procesamiento en SAGE')
        if not original_subject.lower().startswith('re:'):
            subject = f"Re: {original_subject} - Resultados de Procesamiento"
        else:
            subject = f"{original_subject} - Resultados de Procesamiento"
        
        # Preparar cuerpo HTML usando el archivo .log si está disponible
        html_body = None
        results_file_path = None
        
        # Inicializar variables de rutas a archivos
        report_json_path = None
        email_html_path = None
        report_html_path = None
        output_log_path = None
        error_log_path = None
        results_file_path = None
        
        # Intentar obtener los archivos de resultados
        try:
            for attachment in attachments_info:
                result = attachment.get('result', {})
                details = result.get('details', {})
                
                # Verificar si hay archivos de log generados por el procesador SAGE
                output_log_path = details.get('output_log_path')
                error_log_path = details.get('error_log_path')
                results_file_path = details.get('results_file_path')
                report_json_path = details.get('report_json_path')
                email_html_path = details.get('email_html_path')
                report_html_path = details.get('report_html_path')
                
                # Verificar primero si tenemos el archivo de resultados directo
                if results_file_path and os.path.exists(results_file_path):
                    self.logger.info(f"Encontrado archivo de resultados para adjuntar: {results_file_path}")
                    
                    # Verificar si tenemos un HTML optimizado para email
                    if email_html_path and os.path.exists(email_html_path):
                        # Usar el HTML optimizado para correo si existe
                        try:
                            with open(email_html_path, 'r', encoding='utf-8') as f:
                                html_body = f.read()
                                self.logger.info(f"Utilizando HTML optimizado para correo electrónico: {email_html_path}")
                        except Exception as e:
                            self.logger.error(f"Error al leer HTML optimizado para correo: {str(e)}")
                            email_html_path = None
                    
                    # Si no encontramos el HTML optimizado, generamos uno básico con el contenido de resultados.txt
                    if not html_body:
                        try:
                            with open(results_file_path, 'r', encoding='utf-8') as f:
                                results_content = f.read()
                                # Convertir a HTML simple para el cuerpo del mensaje
                                simple_html = "<h3>Resultados del Procesamiento</h3>"
                                simple_html += "<pre style='background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace;'>"
                                simple_html += results_content.replace('<', '&lt;').replace('>', '&gt;')
                                simple_html += "</pre>"
                                html_body = simple_html
                                self.logger.info(f"Archivo de resultados convertido a HTML para el cuerpo del mensaje")
                        except Exception as e:
                            self.logger.error(f"Error al leer resultados para HTML: {str(e)}")
                
                # Si también tenemos el log completo, añadimos esa información
                if output_log_path and os.path.exists(output_log_path):
                    self.logger.info(f"Encontrado archivo de log completo: {output_log_path}")
                    
                    # Si no tenemos un results_file_path, usamos el output_log como adjunto principal
                    if not results_file_path:
                        results_file_path = output_log_path
                    
                    # Intentamos leer el contenido para añadir al HTML
                    if html_body:  # Solo si ya tenemos HTML básico
                        try:
                            with open(output_log_path, 'r', encoding='utf-8') as f:
                                log_content = f.read()
                                html_body += "<h3>Log de Procesamiento Detallado</h3>"
                                html_body += "<pre style='background-color: #f8f8f8; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 0.9em;'>"
                                html_body += log_content.replace('<', '&lt;').replace('>', '&gt;')
                                html_body += "</pre>"
                                self.logger.info(f"Log completo añadido al HTML")
                        except Exception as e:
                            self.logger.error(f"Error al leer log completo para HTML: {str(e)}")
                
                # Si encontramos los archivos relevantes, podemos dejar de buscar
                if results_file_path:
                    break
        except Exception as e:
            self.logger.error(f"Error al obtener archivos de resultados: {str(e)}")
            self.logger.error(traceback.format_exc())
        
        # Construir cuerpo del mensaje con resultados (texto plano como fallback)
        text_body = f"""
Estimado/a Usuario,

Hemos procesado su solicitud enviada a {email_config.get('usuario', '')}.

Resultados del procesamiento:
"""
        
        # Añadir los resultados de cada archivo procesado al cuerpo de texto
        for attachment in attachments_info:
            result = attachment.get('result', {})
            status = result.get('status', 'desconocido')
            message = result.get('message', 'Sin información disponible')
            
            text_body += f"""
-----------------------------------------
Archivo: {attachment.get('name', 'Desconocido')}
Estado: {status}
Mensaje: {message}
"""
            
            # Añadir detalles si existen
            details = result.get('details', {})
            if details:
                text_body += "Detalles:\n"
                for key, value in details.items():
                    text_body += f"- {key}: {value}\n"
        
        text_body += """
-----------------------------------------

Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.

Saludos cordiales,
Sistema SAGE
"""
        
        # Si no tenemos cuerpo HTML, usar un formato HTML simple basado en el texto
        if not html_body:
            html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Resultados de Procesamiento SAGE</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; }}
        .container {{ max-width: 800px; margin: 0 auto; padding: 20px; }}
        .header {{ color: #2c3e50; margin-bottom: 20px; }}
        .file-result {{ margin: 15px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #4e73df; }}
        .file-name {{ font-weight: bold; color: #2c3e50; }}
        .status {{ margin: 5px 0; }}
        .status-processed {{ color: #28a745; }}
        .status-error {{ color: #dc3545; }}
        .status-warning {{ color: #ffc107; }}
        .status-unknown {{ color: #6c757d; }}
        .details {{ margin-top: 10px; font-size: 0.9em; }}
        .details-item {{ margin-left: 15px; }}
        .footer {{ margin-top: 30px; color: #6c757d; font-size: 0.9em; border-top: 1px solid #eee; padding-top: 15px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Resultados de Procesamiento SAGE</h2>
            <p>Hemos procesado su solicitud enviada a {email_config.get('usuario', '')}.</p>
        </div>
"""
            
            # Añadir los resultados de cada archivo
            for attachment in attachments_info:
                result = attachment.get('result', {})
                status = result.get('status', 'desconocido')
                message = result.get('message', 'Sin información disponible')
                status_class = "status-unknown"
                
                if status.lower() == "processed":
                    status_class = "status-processed"
                elif status.lower() == "error":
                    status_class = "status-error"
                elif status.lower() == "warning":
                    status_class = "status-warning"
                
                html_body += f"""
        <div class="file-result">
            <div class="file-name">Archivo: {attachment.get('name', 'Desconocido')}</div>
            <div class="status {status_class}">Estado: {status}</div>
            <div class="message">Mensaje: {message}</div>
"""
                
                # Añadir detalles si existen
                details = result.get('details', {})
                if details:
                    html_body += """            <div class="details">Detalles:"""
                    for key, value in details.items():
                        html_body += f"""
                <div class="details-item">- {key}: {value}</div>"""
                    html_body += """
            </div>"""
                
                html_body += """
        </div>"""
            
            html_body += """
        <div class="footer">
            <p>Este es un mensaje automático. Si tiene alguna duda, por favor contacte al administrador del sistema.</p>
            <p>Saludos cordiales,<br>Sistema SAGE</p>
        </div>
    </div>
</body>
</html>
"""
        
        # Crear mensaje usando EmailMessage si está disponible
        try:
            from email.message import EmailMessage
            from email.utils import formatdate, make_msgid
            
            # Crear mensaje con API moderna
            msg = EmailMessage()
            msg['From'] = email_config.get('usuario', '')
            msg['To'] = reply_address
            msg['Subject'] = subject
            msg['Date'] = formatdate(localtime=True)
            
            # Generar un Message-ID propio para mejorar el threading
            if not hasattr(self, '_message_counter'):
                self._message_counter = 0
            self._message_counter += 1
            msg['Message-ID'] = make_msgid(f"res{self._message_counter}", domain='sage.vidahub.ai')
            
            # Encabezados de threading
            if original_message_id:
                msg['In-Reply-To'] = original_message_id
                msg['References'] = original_message_id
                self.logger.info(f"Añadidos encabezados de respuesta In-Reply-To: {original_message_id}")
            
            # Encabezados de prioridad alta
            msg['X-Priority'] = '1'
            msg['X-MSMail-Priority'] = 'High'
            msg['Importance'] = 'High'
            
            # Contenido del mensaje (texto plano)
            msg.set_content(text_body)
            
            # Contenido HTML alternativo si está disponible
            if html_body:
                msg.add_alternative(html_body, subtype='html')
                self.logger.info("Añadido contenido HTML al mensaje")
            
            # Adjuntar múltiples archivos de log si existen
            files_to_attach = []
            
            # Primero adjuntar el archivo de resultados principales
            if results_file_path and os.path.exists(results_file_path):
                files_to_attach.append((results_file_path, 'resultados_procesamiento.log'))
                
                # Adjuntar el reporte JSON si existe - primero usar el que viene en los detalles
                if report_json_path and os.path.exists(report_json_path):
                    files_to_attach.append((report_json_path, 'reporte_detallado.json'))
                    self.logger.info(f"Añadido reporte JSON al mensaje desde {report_json_path}")
                else:
                    # Intentar con la ubicación estándar
                    fallback_json_path = os.path.join(os.path.dirname(results_file_path), "report.json")
                    if os.path.exists(fallback_json_path):
                        files_to_attach.append((fallback_json_path, 'reporte_detallado.json'))
                        self.logger.info(f"Añadido reporte JSON al mensaje desde {fallback_json_path}")
                    else:
                        self.logger.warning(f"El archivo report.json no existe en {os.path.dirname(results_file_path)}")
                
            # También añadir el log de errores si existe (verificar que la variable esté definida)
            error_log_path = None
            for attachment in attachments_info:
                result = attachment.get('result', {})
                details = result.get('details', {})
                if 'error_log_path' in details:
                    error_log_path = details.get('error_log_path')
                    break
                    
            if error_log_path and os.path.exists(error_log_path):
                files_to_attach.append((error_log_path, 'errores_procesamiento.log'))
                
            # Adjuntar los archivos
            for log_path, log_filename in files_to_attach:
                try:
                    with open(log_path, 'rb') as fp:
                        log_data = fp.read()
                        msg.add_attachment(
                            log_data,
                            maintype='text',
                            subtype='plain',
                            filename=log_filename
                        )
                    self.logger.info(f"Adjuntado archivo de log: {log_path} como {log_filename}")
                except Exception as e:
                    self.logger.error(f"Error al adjuntar archivo de log {log_path}: {str(e)}")
            
            self.logger.info("Usando EmailMessage moderno para envío de resultados")
            
        except (ImportError, AttributeError):
            # Fallback a MIMEMultipart en caso de error
            self.logger.info("Fallback a MIMEMultipart para envío de resultados")
            
            # Crear mensaje con API tradicional (multipart/alternative para HTML y texto)
            msg = MIMEMultipart('alternative')
            msg['From'] = email_config.get('usuario', '')
            msg['To'] = reply_address
            msg['Subject'] = subject
            
            # Usar formatdate de forma segura
            try:
                from email.utils import formatdate
                msg['Date'] = formatdate(localtime=True)
            except ImportError:
                import time
                msg['Date'] = time.strftime("%a, %d %b %Y %H:%M:%S %z", time.localtime())
            
            # Encabezados de prioridad alta
            msg['X-Priority'] = '1'
            msg['X-MSMail-Priority'] = 'High'
            msg['Importance'] = 'High'
            
            # Añadir encabezados de referencia para que sea un reply correcto
            if original_message_id:
                msg['In-Reply-To'] = original_message_id
                msg['References'] = original_message_id
                self.logger.info(f"Añadidos encabezados de respuesta In-Reply-To: {original_message_id}")
            
            # Adjuntar parte de texto plano
            msg.attach(MIMEText(text_body, 'plain'))
            
            # Adjuntar parte HTML si está disponible
            if html_body:
                msg.attach(MIMEText(html_body, 'html'))
                self.logger.info("Añadido contenido HTML al mensaje (MIMEMultipart)")
            
            # Preparar múltiples archivos de log para adjuntar
            files_to_attach = []
            
            # Primero adjuntar el archivo de resultados principales
            if results_file_path and os.path.exists(results_file_path):
                files_to_attach.append((results_file_path, 'resultados_procesamiento.log'))
                
                # Adjuntar el reporte JSON si existe - primero usar el que viene en los detalles
                if report_json_path and os.path.exists(report_json_path):
                    files_to_attach.append((report_json_path, 'reporte_detallado.json'))
                    self.logger.info(f"Añadido reporte JSON al mensaje (MIMEMultipart) desde {report_json_path}")
                else:
                    # Intentar con la ubicación estándar
                    fallback_json_path = os.path.join(os.path.dirname(results_file_path), "report.json")
                    if os.path.exists(fallback_json_path):
                        files_to_attach.append((fallback_json_path, 'reporte_detallado.json'))
                        self.logger.info(f"Añadido reporte JSON al mensaje (MIMEMultipart) desde {fallback_json_path}")
                    else:
                        self.logger.warning(f"El archivo report.json no existe en {os.path.dirname(results_file_path)} (MIMEMultipart)")
                
            # También añadir el log de errores si existe (verificar que la variable esté definida)
            error_log_path = None
            for attachment in attachments_info:
                result = attachment.get('result', {})
                details = result.get('details', {})
                if 'error_log_path' in details:
                    error_log_path = details.get('error_log_path')
                    break
                    
            if error_log_path and os.path.exists(error_log_path):
                files_to_attach.append((error_log_path, 'errores_procesamiento.log'))
            
            # Adjuntar archivos a MIMEMultipart
            for log_path, log_filename in files_to_attach:
                try:
                    # Crear mensaje con archivo adjunto
                    with open(log_path, 'rb') as fp:
                        attachment = MIMEText(fp.read().decode('utf-8', errors='replace'), 'plain')
                    
                    # Configurar cabeceras del adjunto
                    attachment.add_header('Content-Disposition', 'attachment', filename=log_filename)
                    msg.attach(attachment)
                    self.logger.info(f"Adjuntado archivo de log (MIMEMultipart): {log_path} como {log_filename}")
                except Exception as e:
                    self.logger.error(f"Error al adjuntar archivo de log {log_path} (MIMEMultipart): {str(e)}")
                    self.logger.error(traceback.format_exc())
        
        # Enviar email
        try:
            # Configuración SMTP
            servidor_salida = email_config.get('servidor_salida', email_config.get('servidor_entrada', ''))
            puerto_salida = email_config.get('puerto_salida', 587)
            usar_tls = email_config.get('usar_tls_salida', True)
            usuario = email_config.get('usuario', '')
            password = email_config.get('password', '')
            
            # Log detallado de la configuración
            self.logger.info(f"Configuración SMTP detallada:")
            self.logger.info(f"  - Servidor: {servidor_salida}")
            self.logger.info(f"  - Puerto: {puerto_salida}")
            self.logger.info(f"  - Usuario: {usuario}")
            self.logger.info(f"  - Password: {password}")
            self.logger.info(f"  - Usar TLS: {usar_tls}")
            self.logger.info(f"  - Destinatario: {reply_address}")
            
            # Conexión SMTP con modo debug
            if puerto_salida == 465:
                # Puerto SSL
                smtp = smtplib.SMTP_SSL(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP_SSL establecida con {servidor_salida}:{puerto_salida}")
            else:
                # Puerto normal o TLS
                smtp = smtplib.SMTP(servidor_salida, puerto_salida, timeout=30)
                smtp.set_debuglevel(1)  # Activar modo debug
                self.logger.info(f"Conexión SMTP establecida con {servidor_salida}:{puerto_salida}")
                
                if usar_tls:
                    self.logger.info("Iniciando STARTTLS...")
                    smtp.starttls()
                    self.logger.info("STARTTLS completado")
            
            self.logger.info(f"Iniciando login con usuario: {usuario}")
            smtp_code, smtp_response = smtp.login(usuario, password)
            self.logger.info(f"Login completado con respuesta: {smtp_code} {smtp_response}")
            
            # Enviar email
            self.logger.info(f"Enviando correo desde {usuario} a {reply_address}")
            resultado = smtp.sendmail(usuario, reply_address, msg.as_string())
            self.logger.info(f"Resultado sendmail: {resultado}")
            
            smtp.quit()
            self.logger.info("Conexión SMTP cerrada")
            
            self.logger.info(f"Resultados de procesamiento enviados correctamente a {reply_address}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error al enviar resultados de procesamiento a {reply_address}: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False

class SFTPProcessor:
    """
    Procesa archivos recibidos por SFTP
    """
    
    def __init__(self, db_manager):
        """
        Inicializa el procesador SFTP
        
        Args:
            db_manager (DatabaseManager): Gestor de base de datos
        """
        self.logger = logging.getLogger("SAGE_Daemon2.SFTPProcessor")
        self.db_manager = db_manager
        self.casilla_id = None
        
    def process_sftp(self, sftp_config):
        """
        Procesa los archivos de una configuración SFTP
        
        Args:
            sftp_config (dict): Configuración SFTP
            
        Returns:
            int: Número de archivos procesados
        """
        self.logger.info(f"Procesando SFTP para casilla {sftp_config.get('casilla_id')} - {sftp_config.get('casilla_nombre')}")
        
        # Procesamiento SFTP real (sin modo de pruebas)
        config = sftp_config.get('configuracion', {})
        servidor = config.get('servidor', '')
        puerto = config.get('puerto', 22)
        usuario = config.get('usuario', '')
        password = config.get('password', '')
        key_path = config.get('key_path')
        data_dir = config.get('data_dir', '')
        processed_dir = config.get('processed_dir', '')
        
        # Logging detallado de la configuración SFTP para depuración
        self.logger.info(f"Configuración SFTP detallada:")
        self.logger.info(f"  - Servidor: {servidor}")
        self.logger.info(f"  - Puerto: {puerto}")
        self.logger.info(f"  - Usuario: {usuario}")
        self.logger.info(f"  - Contraseña: {'*' * len(password) if password else 'No configurada'}")
        self.logger.info(f"  - Ruta de clave: {key_path if key_path else 'No configurada'}")
        self.logger.info(f"  - Directorio de datos: {data_dir}")
        self.logger.info(f"  - Directorio de procesados: {processed_dir}")
        
        # Establecer ID de casilla para esta operación
        self.casilla_id = sftp_config.get('casilla_id')
        emisor_id = sftp_config.get('emisor_id')
        
        # Verificación de parámetros obligatorios
        if not servidor or not usuario or not password:
            self.logger.error(f"Configuración SFTP incompleta para casilla {self.casilla_id}: falta servidor, usuario o contraseña")
            return 0
            
        # Verificar si necesitamos manejar rutas especiales para algunos servidores
        need_special_paths = False
            
        # Verificar si es un servidor de prueba
        is_test_server = servidor.lower() in ['lista.com', 'test', 'localhost']
        connection_timeout = 5 if is_test_server else 30  # Tiempo de espera reducido para servidores de prueba
            
        try:
            # Mensaje especial para servidores de prueba
            if is_test_server:
                self.logger.info(f"Servidor identificado como entorno de pruebas: {servidor}")
                self.logger.info(f"Usando timeout reducido de {connection_timeout} segundos")
            
            # Conectar al servidor SFTP con timeout para evitar bloqueos
            transport = paramiko.Transport((servidor, int(puerto)))
            transport.banner_timeout = connection_timeout
            transport.handshake_timeout = connection_timeout
            
            if key_path and os.path.exists(key_path):
                # Autenticación con clave privada
                key = paramiko.RSAKey.from_private_key_file(key_path)
                transport.connect(username=usuario, pkey=key)
                self.logger.info(f"Conexión SFTP establecida con clave privada para {usuario}@{servidor}")
            else:
                # Autenticación con contraseña
                transport.connect(username=usuario, password=password)
                self.logger.info(f"Conexión SFTP establecida con contraseña para {usuario}@{servidor}")
                
            sftp = paramiko.SFTPClient.from_transport(transport)
            
            # Verificar existencia del directorio data
            try:
                sftp.stat(data_dir)
            except IOError:
                self.logger.warning(f"El directorio {data_dir} no existe en el servidor SFTP")
                try:
                    # Intentar crear el directorio
                    sftp.mkdir(data_dir)
                    self.logger.info(f"Directorio {data_dir} creado en el servidor SFTP")
                except:
                    self.logger.error(f"No se pudo crear el directorio {data_dir} en el servidor SFTP")
                    sftp.close()
                    transport.close()
                    return 0
                    
            # Verificar existencia del directorio procesado
            try:
                sftp.stat(processed_dir)
            except IOError:
                self.logger.warning(f"El directorio {processed_dir} no existe en el servidor SFTP")
                try:
                    # Intentar crear el directorio
                    sftp.mkdir(processed_dir)
                    self.logger.info(f"Directorio {processed_dir} creado en el servidor SFTP")
                except:
                    self.logger.error(f"No se pudo crear el directorio {processed_dir} en el servidor SFTP")
                    sftp.close()
                    transport.close()
                    return 0
            
            # Listar archivos en el directorio data
            files = sftp.listdir(data_dir)
            
            if not files:
                self.logger.info(f"No hay archivos para procesar en {data_dir}")
                sftp.close()
                transport.close()
                return 0
                
            self.logger.info(f"Se encontraron {len(files)} archivos en {data_dir}")
            
            # Si encontramos archivos para procesar, limpiamos el directorio procesado
            if len(files) > 0:
                try:
                    # Listar archivos en el directorio procesado
                    try:
                        # Verificar si existe el directorio
                        try:
                            sftp.stat(processed_dir)
                        except IOError:
                            # Si no existe, lo creamos
                            sftp.mkdir(processed_dir)
                            self.logger.info(f"Directorio procesado creado: {processed_dir}")
                            
                        # Listar todos los archivos y subdirectorios
                        processed_files = sftp.listdir(processed_dir)
                        self.logger.info(f"Encontrados {len(processed_files)} elementos en directorio procesado")
                        
                        # Eliminar cada elemento (archivo o directorio)
                        for item in processed_files:
                            item_path = os.path.join(processed_dir, item)
                            try:
                                # Verificar si es directorio
                                try:
                                    item_stat = sftp.stat(item_path)
                                    is_dir = item_stat.st_mode & 0o40000
                                except:
                                    is_dir = False
                                
                                if is_dir:
                                    # Si es directorio, primero eliminar su contenido
                                    subfiles = sftp.listdir(item_path)
                                    for subfile in subfiles:
                                        try:
                                            sftp.remove(os.path.join(item_path, subfile))
                                        except Exception as e:
                                            self.logger.warning(f"Error eliminando archivo {subfile} en {item_path}: {str(e)}")
                                    # Luego eliminar el directorio
                                    sftp.rmdir(item_path)
                                else:
                                    # Si es archivo, eliminarlo directamente
                                    sftp.remove(item_path)
                                self.logger.debug(f"Eliminado: {item}")
                            except Exception as e:
                                self.logger.error(f"Error eliminando {item}: {str(e)}")
                        
                        self.logger.info("Directorio procesado limpiado exitosamente")
                    except Exception as e:
                        self.logger.error(f"Error al limpiar directorio procesado: {str(e)}")
                except Exception as e:
                    self.logger.error(f"Error general al manejar directorio procesado: {str(e)}")
            
            # Procesar cada archivo
            processed_count = 0
            for filename in files:
                try:
                    # Crear directorio temporal para descargar el archivo
                    temp_dir = tempfile.mkdtemp()
                    local_path = os.path.join(temp_dir, filename)
                    
                    # Descargar el archivo
                    remote_path = os.path.join(data_dir, filename)
                    
                    # Verificar tamaño del archivo antes de descargar
                    try:
                        file_stat = sftp.stat(remote_path)
                        file_size = file_stat.st_size
                        
                        # Mostrar información del tamaño para archivos grandes
                        size_mb = file_size / (1024 * 1024)
                        if size_mb > 10:  # Si es mayor a 10MB
                            self.logger.info(f"Archivo grande detectado: {filename} ({size_mb:.2f} MB)")
                            
                        # Descargar el archivo con manejo de errores mejorado
                        try:
                            sftp.get(remote_path, local_path)
                            self.logger.info(f"Archivo {filename} descargado a {local_path}")
                        except Exception as download_error:
                            self.logger.error(f"Error al descargar archivo {filename}: {str(download_error)}")
                            
                            # Intentar un segundo método de descarga para mayor compatibilidad
                            try:
                                self.logger.info(f"Intentando método alternativo para descargar {filename}")
                                with open(local_path, 'wb') as local_file:
                                    with sftp.open(remote_path, 'rb') as remote_file:
                                        chunk_size = 32768  # 32KB chunks
                                        while True:
                                            data = remote_file.read(chunk_size)
                                            if not data:
                                                break
                                            local_file.write(data)
                                self.logger.info(f"Archivo {filename} descargado con método alternativo a {local_path}")
                            except Exception as alt_error:
                                # Reenviar la excepción después de registrar el error específico
                                self.logger.error(f"Error en método alternativo: {str(alt_error)}")
                                raise Exception(f"No se pudo descargar el archivo {filename} por ningún método")
                    except Exception as stat_error:
                        self.logger.warning(f"No se pudo obtener información del archivo {filename}: {str(stat_error)}")
                        # Intentar descarga directa si no se pudo obtener el tamaño
                        sftp.get(remote_path, local_path)
                        self.logger.info(f"Archivo {filename} descargado a {local_path}")
                    
                    # Procesar el archivo
                    yaml_contenido = sftp_config.get('yaml_contenido', '')
                    processing_result = self.process_file(
                        local_path, 
                        filename, 
                        yaml_contenido,
                        emisor_id
                    )
                    
                    # Mover el archivo al directorio procesado
                    remote_processed_path = os.path.join(processed_dir, filename)
                    try:
                        # Algunos servidores SFTP no soportan rename entre directorios diferentes
                        # Tenemos que hacer una copia y luego borrar el original
                        processed_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                        new_filename = f"{processed_timestamp}_{filename}"
                        remote_processed_path = os.path.join(processed_dir, new_filename)
                        
                        # Copiar el archivo local procesado al directorio remoto procesado
                        sftp.put(local_path, remote_processed_path)
                        
                        # También copiar los archivos de resultado generados por main.py
                        if 'execution_dir' in processing_result and os.path.exists(processing_result['execution_dir']):
                            execution_dir = processing_result['execution_dir']
                            result_files = [
                                "email_report.html", 
                                "report.html", 
                                "report.json", 
                                "output.log", 
                                "results.txt"
                            ]
                            
                            # Copiar todos los archivos del directorio de ejecución al directorio procesado
                            try:
                                # Obtener la lista completa de archivos en el directorio de ejecución
                                all_result_files = os.listdir(execution_dir)
                                
                                # Copiar todos los archivos de resultados directamente al directorio procesado
                                for result_file in all_result_files:
                                    local_result_path = os.path.join(execution_dir, result_file)
                                    if os.path.isfile(local_result_path):  # Solo copiar archivos, no directorios
                                        # Agregar timestamp al nombre del archivo para evitar sobreescrituras
                                        filename_with_timestamp = f"{processed_timestamp}_{result_file}"
                                        remote_result_path = os.path.join(processed_dir, filename_with_timestamp)
                                        sftp.put(local_result_path, remote_result_path)
                                        self.logger.info(f"Archivo de resultados {result_file} copiado a {remote_result_path}")
                                
                                self.logger.info(f"Todos los archivos de resultados copiados a {results_dir}")
                            except Exception as e:
                                self.logger.error(f"Error copiando archivos de resultados: {str(e)}")
                        else:
                            self.logger.warning(f"No se encontró directorio de ejecución para copiar archivos de resultados")
                        
                        # Eliminar el archivo original
                        sftp.remove(remote_path)
                        
                        self.logger.info(f"Archivo {filename} movido a {remote_processed_path}")
                    except Exception as e:
                        self.logger.error(f"Error moviendo archivo {filename}: {str(e)}")
                    
                    # Limpiar directorio temporal
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    
                    processed_count += 1
                    
                except Exception as e:
                    self.logger.error(f"Error procesando archivo {filename}: {str(e)}")
                    self.logger.error(traceback.format_exc())
                    
            sftp.close()
            transport.close()
            
            return processed_count
            
        except Exception as e:
            self.logger.error(f"Error en conexión SFTP: {str(e)}")
            self.logger.error(traceback.format_exc())
            return 0
    
    def _process_local_files(self, data_dir, processed_dir, sftp_config, emisor_id):
        """
        Método obsoleto - no se debe usar en producción.
        Este método ha sido deshabilitado porque sólo se debe usar SFTP real.
        
        Returns:
            int: Siempre retorna 0 (sin archivos procesados)
        """
        self.logger.warning("FUNCIÓN DESHABILITADA: El procesamiento local ha sido desactivado. Use conexiones SFTP reales.")
        return 0
        
        # Verificar existencia de directorios
        if not os.path.exists(data_dir):
            self.logger.warning(f"El directorio {data_dir} no existe localmente")
            try:
                os.makedirs(data_dir, exist_ok=True)
                self.logger.info(f"Directorio {data_dir} creado localmente")
            except Exception as e:
                self.logger.error(f"No se pudo crear el directorio {data_dir}: {str(e)}")
                return 0
                
        if not os.path.exists(processed_dir):
            self.logger.warning(f"El directorio {processed_dir} no existe localmente")
            try:
                os.makedirs(processed_dir, exist_ok=True)
                self.logger.info(f"Directorio {processed_dir} creado localmente")
            except Exception as e:
                self.logger.error(f"No se pudo crear el directorio {processed_dir}: {str(e)}")
                return 0
                
        # Listar archivos en el directorio de datos
        try:
            files = os.listdir(data_dir)
        except Exception as e:
            self.logger.error(f"Error al listar archivos en {data_dir}: {str(e)}")
            return 0
            
        if not files:
            self.logger.info(f"No hay archivos para procesar en {data_dir}")
            return 0
            
        self.logger.info(f"Se encontraron {len(files)} archivos en {data_dir}")
        
        # Si encontramos archivos para procesar, limpiamos el directorio procesado
        if len(files) > 0:
            try:
                # Listar archivos en el directorio procesado
                processed_files = os.listdir(processed_dir)
                # Eliminar archivos antiguos
                for proc_file in processed_files:
                    self.logger.info(f"Eliminando archivo procesado antiguo: {proc_file}")
                    try:
                        os.remove(os.path.join(processed_dir, proc_file))
                    except Exception as e:
                        self.logger.error(f"Error al eliminar archivo procesado antiguo {proc_file}: {str(e)}")
            except Exception as e:
                self.logger.error(f"Error al limpiar directorio procesado: {str(e)}")
        
        # Procesar cada archivo
        processed_count = 0
        for filename in files:
            try:
                # Ruta completa al archivo
                file_path = os.path.join(data_dir, filename)
                
                # Verificar que sea un archivo (no un directorio)
                if not os.path.isfile(file_path):
                    continue
                    
                self.logger.info(f"Procesando archivo: {filename}")
                
                # Registrar inicio de procesamiento de archivo SFTP
                self.logger.info(f"Iniciando procesamiento SFTP de archivo: {filename} para casilla {self.casilla_id}")
                
                # Procesar el archivo
                yaml_contenido = sftp_config.get('yaml_contenido', '')
                processing_result = self.process_file(
                    file_path, 
                    filename, 
                    yaml_contenido,
                    emisor_id
                )
                
                # Registrar resultado del procesamiento
                if processing_result and processing_result.get('status') == 'success':
                    self.logger.info(f"Procesamiento SFTP exitoso: {filename}")
                else:
                    self.logger.warning(f"Procesamiento SFTP con problemas: {filename}, estado: {processing_result.get('status', 'desconocido')}")
                
                # Mover el archivo al directorio procesado
                try:
                    processed_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    new_filename = f"{processed_timestamp}_{filename}"
                    processed_path = os.path.join(processed_dir, new_filename)
                    
                    # Copiar el archivo al directorio de procesados
                    shutil.copy2(file_path, processed_path)
                    
                    # También copiar los archivos de resultado generados por main.py
                    if 'execution_dir' in processing_result and os.path.exists(processing_result['execution_dir']):
                        execution_dir = processing_result['execution_dir']
                        result_files = [
                            "email_report.html", 
                            "report.html", 
                            "report.json", 
                            "output.log", 
                            "results.txt"
                        ]
                        
                        # Copiar todos los archivos del directorio de ejecución al directorio procesado
                        try:
                            # Obtener la lista completa de archivos en el directorio de ejecución
                            all_result_files = os.listdir(execution_dir)
                            
                            # Crear un directorio para los resultados - usar el UUID de ejecución
                            execution_uuid = os.path.basename(execution_dir)
                            results_dir = os.path.join(processed_dir, f"{processed_timestamp}_{execution_uuid}")
                            os.makedirs(results_dir, exist_ok=True)
                            
                            # Copiar todos los archivos de resultados
                            for result_file in all_result_files:
                                local_result_path = os.path.join(execution_dir, result_file)
                                if os.path.isfile(local_result_path):  # Solo copiar archivos, no directorios
                                    result_dest_path = os.path.join(results_dir, result_file)
                                    shutil.copy2(local_result_path, result_dest_path)
                                    self.logger.info(f"Archivo de resultados {result_file} copiado a {result_dest_path}")
                            
                            self.logger.info(f"Todos los archivos de resultados copiados a {results_dir}")
                        except Exception as e:
                            self.logger.error(f"Error copiando archivos de resultados: {str(e)}")
                    else:
                        self.logger.warning(f"No se encontró directorio de ejecución para copiar archivos de resultados")
                    
                    # Eliminar el archivo original
                    os.unlink(file_path)
                    
                    self.logger.info(f"Archivo {filename} movido a {processed_path}")
                except Exception as e:
                    self.logger.error(f"Error moviendo archivo {filename}: {str(e)}")
                
                processed_count += 1
                
            except Exception as e:
                self.logger.error(f"Error procesando archivo {filename}: {str(e)}")
                self.logger.error(traceback.format_exc())
                
        return processed_count
            
    def process_file(self, file_path, file_name, yaml_config, emisor_id=None):
        """
        Procesa un archivo usando sage/main.py
        
        Args:
            file_path (str): Ruta al archivo
            file_name (str): Nombre del archivo
            yaml_config (str): Configuración YAML para procesamiento
            emisor_id (int, optional): ID del emisor
            
        Returns:
            dict: Resultado del procesamiento
        """
        # Esta función es idéntica a process_attachment de EmailProcessor, pero adaptada para SFTP
        self.logger.info(f"Procesando archivo: {file_name}")
        
        try:
            # Crear un archivo temporal para el YAML
            yaml_fd, yaml_path = tempfile.mkstemp(suffix='.yaml')
            try:
                with os.fdopen(yaml_fd, 'w') as f:
                    f.write(yaml_config)
                
                # Variables para almacenar resultados
                result = False
                execution_dir = "unknown"
                error_count = 0
                warning_count = 0
                
                # Obtener ID de casilla y emisor
                casilla_id = self.casilla_id
                metodo_envio = "sftp"  # Siempre será SFTP en este caso
                
                # Usar el proceso central de SAGE a través de main.py
                from sage.main import process_files
                
                try:
                    # Procesar el archivo usando el mismo flujo que el CLI
                    execution_uuid, error_count, warning_count = process_files(
                        yaml_path=yaml_path,
                        data_path=file_path,
                        casilla_id=casilla_id,
                        emisor_id=emisor_id,
                        metodo_envio=metodo_envio
                    )
                    
                    # El log HTML, JSON y TXT ya habrá sido generado por process_files
                    execution_dir = os.path.join("executions", execution_uuid)
                    
                    # Registrar directorio de ejecución para futuras referencias
                    self.logger.info(f"Directorio de ejecución: {execution_dir}")
                    
                    # Verificar si se generó el reporte JSON
                    report_json_path = os.path.join(execution_dir, "report.json")
                    email_html_path = os.path.join(execution_dir, "email_report.html")
                    report_html_path = os.path.join(execution_dir, "report.html")
                    output_log_path = os.path.join(execution_dir, "output.log")
                    error_log_path = os.path.join(execution_dir, "error.log")
                    
                    if not os.path.exists(report_json_path):
                        self.logger.warning(f"No se generó el archivo report.json para la ejecución {execution_uuid}")
                    
                    # Reporte exitoso o con errores/advertencias
                    result = error_count == 0
                    self.logger.info(f"Archivo {file_name} procesado con éxito")
                    
                except Exception as e:
                    self.logger.error(f"Error al invocar process_files: {str(e)}")
                    result = False
                    execution_dir = "unknown"
                
                # Recolectar información de la ejecución
                status = 'success' if result else 'error'
                processing_info = {
                    'execution_dir': execution_dir,
                    'status': status,
                    'message': 'Archivo procesado correctamente' if result else 'Error al procesar archivo',
                    'log_file': os.path.join(execution_dir, 'output.log'),
                    'html_report': os.path.join(execution_dir, 'report.html'),
                    'json_results': os.path.join(execution_dir, 'results.json'),
                    'yaml_file': yaml_path
                }
                
                # Si hay un ID de casilla, registrar ejecución en base de datos
                if self.casilla_id and emisor_id:
                    # Obtener JSON de resultados
                    json_results_path = os.path.join(execution_dir, 'results.json')
                    result_data = {}
                    if os.path.exists(json_results_path):
                        try:
                            with open(json_results_path, 'r', encoding='utf-8') as f:
                                result_data = json.load(f)
                        except:
                            self.logger.error(f"Error al leer archivo JSON de resultados: {json_results_path}")
                    
                    # Registrar ejecución con todos los campos requeridos
                    query = """
                    INSERT INTO ejecuciones_yaml 
                    (casilla_id, fecha_ejecucion, archivo_datos, ruta_directorio, 
                     emisor_id, nombre_yaml, estado, metodo_envio, errores_detectados, warnings_detectados) 
                    VALUES (%s, NOW(), %s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    
                    # Determinar estado según validación de check constraint
                    estado = "Éxito"  # Valores permitidos: 'Éxito', 'Fallido', 'Parcial'
                    if result_data.get('status') == 'error':
                        estado = "Fallido"
                    elif result_data.get('warnings', 0) > 0:
                        estado = "Parcial"
                        
                    # Obtener errores y warnings detectados
                    errores = result_data.get('errors', 0)
                    warnings = result_data.get('warnings', 0)
                    
                    params = (
                        self.casilla_id,          # casilla_id
                        file_name,                # archivo_datos
                        execution_dir,            # ruta_directorio
                        emisor_id,                # emisor_id
                        "configuracion",          # nombre_yaml
                        estado,                   # estado
                        "sftp",                   # metodo_envio
                        errores,                  # errores_detectados
                        warnings                  # warnings_detectados
                    )
                    
                    self.db_manager.execute_query(query, params, fetch=False)
                    self.logger.info(f"Ejecución registrada en base de datos para casilla {self.casilla_id}, emisor {emisor_id}")
                
                return processing_info
            finally:
                # Eliminar el archivo YAML temporal
                try:
                    os.unlink(yaml_path)
                except:
                    pass
            
        except SAGEError as e:
            self.logger.error(f"Error SAGE al procesar archivo {file_name}: {str(e)}")
            # Usar 'unknown' para el directorio de ejecución en caso de error
            return {
                'execution_dir': "unknown",
                'status': 'error',
                'message': str(e),
                'error': str(e)
            }
        except Exception as e:
            self.logger.error(f"Error al procesar archivo {file_name}: {str(e)}")
            self.logger.error(traceback.format_exc())
            # Usar 'unknown' para el directorio de ejecución en caso de error
            return {
                'execution_dir': "unknown",
                'status': 'error',
                'message': f"Error inesperado: {str(e)}",
                'error': str(e)
            }

class SageDaemon2:
    """
    Daemon principal que gestiona el monitoreo de emails y SFTP
    """
    
    def __init__(self):
        """Inicializa el daemon"""
        self.logger = logging.getLogger("SAGE_Daemon2.Main")
        self.db_manager = DatabaseManager()
        self.email_processor = EmailProcessor(self.db_manager)
        self.sftp_processor = SFTPProcessor(self.db_manager)
        
        # Inicializar gestor de notificaciones
        from .notificaciones import NotificacionesManager
        self.notificaciones_manager = NotificacionesManager(self.db_manager)
        self.running = False
    
    def run(self, single_execution=False):
        """
        Ejecuta el daemon
        
        Args:
            single_execution (bool): Si debe ejecutar solo una vez o en bucle
        """
        self.running = True
        self.logger.info("Iniciando SAGE Daemon 2")
        
        try:
            while self.running:
                self.logger.info("Iniciando ciclo de verificación")
                
                # Obtener configuraciones de email
                email_configs = self.db_manager.get_email_configurations()
                
                if not email_configs:
                    self.logger.warning("No se encontraron configuraciones de email activas")
                else:
                    self.logger.info(f"Se encontraron {len(email_configs)} configuraciones de email")
                    
                    # Procesar cada configuración de email
                    for config in email_configs:
                        casilla_id = config.get('casilla_id')
                        
                        # Obtener remitentes autorizados
                        authorized_senders = self.db_manager.get_authorized_senders(casilla_id)
                        
                        # Procesar correos
                        self.email_processor.process_email(config, authorized_senders)
                
                # Obtener configuraciones SFTP
                sftp_configs = self.db_manager.get_sftp_configurations()
                
                if not sftp_configs:
                    self.logger.warning("No se encontraron configuraciones SFTP activas")
                else:
                    self.logger.info(f"Se encontraron {len(sftp_configs)} configuraciones SFTP")
                    
                    # Procesar cada configuración SFTP
                    for config in sftp_configs:
                        # Registrar en log el inicio de procesamiento SFTP
                        casilla_id = config.get('casilla_id')
                        casilla_nombre = config.get('nombre', 'Sin nombre')
                        self.logger.info(f"Procesando SFTP para casilla {casilla_id} - {casilla_nombre}")
                        
                        # Procesar archivos SFTP
                        self.sftp_processor.process_sftp(config)
                
                # Procesar notificaciones
                try:
                    self.logger.info("Iniciando procesamiento de notificaciones...")
                    stats = self.notificaciones_manager.procesar_notificaciones()
                    self.logger.info(f"Procesamiento de notificaciones: {stats}")
                except Exception as e:
                    self.logger.error(f"Error al procesar notificaciones: {str(e)}")
                    self.logger.error(traceback.format_exc())
                
                self.logger.info("Ciclo de verificación completado")
                
                # Si es una sola ejecución, terminar
                if single_execution:
                    self.logger.info("Finalizado por ejecución única")
                    break
                    
                # Esperar para el siguiente ciclo
                time.sleep(60)  # 1 minuto entre verificaciones
                
        except KeyboardInterrupt:
            self.logger.info("Detenido por interrupción de usuario")
        except Exception as e:
            self.logger.error(f"Error en el daemon: {str(e)}")
            self.logger.error(traceback.format_exc())
        finally:
            self.db_manager.close()
            self.logger.info("SAGE Daemon 2 finalizado")
    
    def stop(self):
        """Detiene el daemon"""
        self.running = False
        self.logger.info("Deteniendo SAGE Daemon 2")

def main():
    """Función principal"""
    daemon = SageDaemon2()
    
    # Verificar si se solicita una sola ejecución
    single_execution = len(sys.argv) > 1 and sys.argv[1] == "--once"
    
    daemon.run(single_execution)

if __name__ == "__main__":
    main()