"""Monitor classes for different file reception methods"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from datetime import datetime
import os
import glob
import imaplib
import email
import paramiko
import logging
import psycopg2
import smtplib
import socket
from email.header import decode_header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

class BaseMonitor(ABC):
    """Clase base para monitores de archivos"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def check_new_files(self, config: Dict) -> List[Dict]:
        """
        Verifica si hay nuevos archivos para procesar

        Args:
            config: Configuración de la casilla

        Returns:
            Lista de diccionarios con información de los archivos encontrados
            Cada diccionario debe contener:
            - path: Ruta al archivo
            - nombre: Nombre del archivo
            - emisor_id: ID del emisor
            - metadata: Dict con metadata adicional
        """
        pass

    def _validate_config(self, config: Dict, required_keys: List[str]) -> bool:
        """Valida que la configuración tenga las claves requeridas"""
        if not config or 'configuracion' not in config:
            self.logger.error("Configuración inválida: falta diccionario de configuración")
            return False

        conf = config['configuracion']
        for key in required_keys:
            if key not in conf or not conf[key]:
                self.logger.error(f"Configuración inválida: falta {key}")
                return False
        return True

class EmailMonitor(BaseMonitor):
    """Monitor para archivos recibidos por email"""
    
    def _enviar_correo_smtp(self, smtp_server, smtp_port, usuario, password, mensaje, reply_to_address, usar_tls=True):
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
            self.logger.info(f"Intentando enviar correo a {reply_to_address} vía {smtp_server}:{smtp_port}")
            
            # Si el puerto es 465, usamos SMTP_SSL directamente
            if smtp_port == 465:
                self.logger.debug("Usando conexión SMTP_SSL para puerto 465")
                with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
                    # Aumentar nivel de debug para diagnóstico detallado
                    server.set_debuglevel(1)
                    
                    self.logger.debug(f"Realizando login en {smtp_server}")
                    server.login(usuario, password)
                    self.logger.debug("Login exitoso, enviando mensaje")
                    
                    # Enviar mensaje con mejor manejo de errores
                    try:
                        server.send_message(mensaje)
                        self.logger.warning(f"✅ ÉXITO: Mensaje enviado a {reply_to_address}")
                        return True
                    except smtplib.SMTPRecipientsRefused as error:
                        self.logger.error(f"Destinatario rechazado: {reply_to_address}")
                        for recipient, (code, msg) in error.recipients.items():
                            self.logger.error(f"Rechazo para {recipient}: Código {code}, Mensaje: {msg}")
                        return False
            else:
                # Para otros puertos (587, etc) usamos STARTTLS si es necesario
                self.logger.debug(f"Usando conexión SMTP regular para puerto {smtp_port}")
                with smtplib.SMTP(smtp_server, smtp_port) as server:
                    # Aumentar nivel de debug para diagnóstico detallado
                    server.set_debuglevel(1)
                    
                    self.logger.debug("Enviando EHLO")
                    server.ehlo()
                    
                    if usar_tls:
                        self.logger.debug("Iniciando TLS")
                        try:
                            server.starttls()
                            server.ehlo()
                        except Exception as tls_err:
                            self.logger.error(f"Error en TLS: {str(tls_err)}")
                            self.logger.warning("Continuando sin TLS como último recurso")
                    
                    self.logger.debug(f"Realizando login en {smtp_server}")
                    server.login(usuario, password)
                    self.logger.debug("Login exitoso, enviando mensaje")
                    
                    # Enviar mensaje con mejor manejo de errores
                    try:
                        server.send_message(mensaje)
                        self.logger.warning(f"✅ ÉXITO: Mensaje enviado a {reply_to_address}")
                        return True
                    except smtplib.SMTPRecipientsRefused as error:
                        self.logger.error(f"Destinatario rechazado: {reply_to_address}")
                        for recipient, (code, msg) in error.recipients.items():
                            self.logger.error(f"Rechazo para {recipient}: Código {code}, Mensaje: {msg}")
                        return False
        
        except smtplib.SMTPServerDisconnected as sd:
            self.logger.error(f"Error de conexión SMTP: {str(sd)}")
        except smtplib.SMTPAuthenticationError as auth_err:
            self.logger.error(f"Error de autenticación SMTP: {str(auth_err)}")
        except smtplib.SMTPException as smtp_err:
            self.logger.error(f"Error SMTP general: {str(smtp_err)}")
        except Exception as ex:
            self.logger.error(f"Error no clasificado al enviar email: {str(ex)}")
            import traceback
            self.logger.debug(f"Detalles del error de envío: {traceback.format_exc()}")
        
        return False

    def _get_emisor_id_by_email(self, email_address: str, casilla_id: int) -> Optional[int]:
        """
        Busca el ID del emisor por dirección de correo electrónico

        Args:
            email_address: Dirección de correo electrónico
            casilla_id: ID de la casilla

        Returns:
            int: ID del emisor, o None si no se encuentra
        """
        if not email_address or not casilla_id:
            return None

        try:
            # Conexión a la base de datos
            # Nota: Hay que usar el objeto de conexión configurado en el daemon
            # idealmente, pero por ahora usamos una conexión directa
            db_url = os.environ.get("DATABASE_URL")
            if not db_url:
                self.logger.error("DATABASE_URL no está configurado en el entorno")
                return None

            with psycopg2.connect(db_url) as conn:
                with conn.cursor() as cur:
                    # Buscar emisor por email y validar que esté autorizado para la casilla
                    cur.execute("""
                        SELECT e.id 
                        FROM emisores e
                        JOIN emisores_por_casilla epc ON e.id = epc.emisor_id
                        WHERE 
                            e.email_corporativo = %s 
                            AND epc.casilla_id = %s
                            AND epc.responsable_activo = true
                    """, (email_address, casilla_id))

                    result = cur.fetchone()
                    if result:
                        return result[0]
                    else:
                        # Si no se encuentra, intentamos buscar solo por email
                        cur.execute("""
                            SELECT id FROM emisores WHERE email_corporativo = %s
                        """, (email_address,))

                        result = cur.fetchone()
                        # Registramos que encontramos el emisor pero no está autorizado
                        if result:
                            self.logger.warning(
                                f"Emisor encontrado con ID {result[0]} pero no está autorizado para casilla {casilla_id}"
                            )
                        return None

        except Exception as e:
            self.logger.error(f"Error buscando emisor por email {email_address}: {str(e)}")
            return None

    def check_new_files(self, config: Dict) -> List[Dict]:
        """Verifica nuevos archivos en la casilla de email"""
        files = []

        # Validar configuración
        # No mostramos toda la configuración para mantener el log limpio
        # Creamos una copia para no mostrar el contenido YAML completo ni credenciales
        config_log = config.copy() if isinstance(config, dict) else {}
        if isinstance(config_log, dict):
            if 'yaml_contenido' in config_log:
                config_log['yaml_contenido'] = f"[YAML contenido - {len(str(config_log.get('yaml_contenido', '')))} caracteres]"
            if 'sage_config' in config_log:
                config_log['sage_config'] = str(config_log.get('sage_config', ''))
            # Guardamos la contraseña real para depuración
            password_real = None
            if 'configuracion' in config_log and isinstance(config_log['configuracion'], dict):
                # Crear una copia de configuracion para no modificar el original
                config_log['configuracion'] = config_log['configuracion'].copy()
                if 'password' in config_log['configuracion']:
                    password_real = config_log['configuracion']['password']
                    config_log['configuracion']['password'] = "********"

            self.logger.debug(f"Configuración recibida: {config_log}")

            # Depuración: Mostrar contraseña real
            if password_real:
                self.logger.debug(f"DEBUG - Contraseña real: '{password_real}'")

        # Verificar si configuracion está presente
        if 'configuracion' not in config:
            self.logger.error("La clave 'configuracion' no está presente en el diccionario de configuración")
            return files

        # Solo imprimir los datos de conexión esenciales para diagnóstico
        conf = config['configuracion']
        servidor = conf.get('servidor_entrada', '')
        puerto = conf.get('puerto_entrada', '')
        usuario = conf.get('usuario', '')
        self.logger.info(f"Conexión: servidor={servidor}, puerto={puerto}, usuario={usuario}")

        # Validar que las claves requeridas estén presentes en config['configuracion']
        if not self._validate_config(config, ['servidor_entrada', 'usuario', 'password']):
            return files

        try:
            # Obtener datos de configuración
            conf_dict = config['configuracion']
            host = conf_dict['servidor_entrada']
            puerto = conf_dict.get('puerto_entrada')
            usuario = conf_dict['usuario']
            password = conf_dict['password']
            usar_ssl = conf_dict.get('usar_ssl_entrada', True)

            # Log de conexión
            self.logger.info(f"Conectando a servidor {host} con usuario {usuario}")

            # Inicializar el objeto mail
            mail = None

            # Conectar al servidor IMAP
            if usar_ssl:
                if puerto:
                    if isinstance(puerto, int):
                        mail = imaplib.IMAP4_SSL(host, port=puerto)
                    elif isinstance(puerto, str) and puerto.isdigit():
                        mail = imaplib.IMAP4_SSL(host, port=int(puerto))
                    else:
                        mail = imaplib.IMAP4_SSL(host)
                else:
                    mail = imaplib.IMAP4_SSL(host)
            else:
                if puerto:
                    if isinstance(puerto, int):
                        mail = imaplib.IMAP4(host, port=puerto)
                    elif isinstance(puerto, str) and puerto.isdigit():
                        mail = imaplib.IMAP4(host, port=int(puerto))
                    else:
                        mail = imaplib.IMAP4(host)
                else:
                    mail = imaplib.IMAP4(host)
            try:
                # Autenticación con las credenciales de la base de datos
                self.logger.info(f"Intentando autenticación IMAP...")

                # RECUPERAR LA CONTRASEÑA REAL del objeto original en caso de que haya sido reemplazada
                password_real = config['configuracion']['password']

                # SOLO PARA DEPURACIÓN: Mostrar credenciales reales que se están usando
                self.logger.debug(f"DEBUG CREDENCIALES - Usuario: '{usuario}', Password: '********'")
                self.logger.debug(f"USANDO password real para autenticación (longitud: {len(password_real)})")

                # Usar la contraseña real para el login
                mail.login(usuario, password_real)

                # Si llegamos aquí es que la autenticación fue exitosa
                mail.select('INBOX')
                self.logger.info(f"Autenticación exitosa en servidor IMAP {host}")

            except Exception as e:
                self.logger.error(f"Error en autenticación IMAP: {str(e)}")
                self.logger.error("No se pudo autenticar con el servidor IMAP, no se procesarán correos")
                return files

            # Buscar emails no procesados
            self.logger.info(f"Buscando correos no leídos en {host} para {usuario}")

            # Primero intentar buscar todos los mensajes para diagnosticar
            status, all_messages = mail.search(None, 'ALL')
            if status == 'OK' and all_messages and all_messages[0]:
                all_msg_nums = all_messages[0].split()
                self.logger.info(f"Total de mensajes en bandeja: {len(all_msg_nums)}")
            else:
                self.logger.warning(f"No se pudo obtener el total de mensajes en la bandeja")

            # Buscar emails no leídos
            self.logger.debug("Ejecutando búsqueda IMAP con criterio: (UNSEEN)")
            status, messages = mail.search(None, '(UNSEEN)')
            self.logger.debug(f"Resultado búsqueda IMAP - Status: {status}, Messages: {messages}")
            
            if status != 'OK':
                self.logger.error(f"Error en búsqueda IMAP: {status}")
                return files
                
            if not messages:
                self.logger.info("No se encontraron mensajes sin leer")
                return files
                
            message_nums = messages[0].split()
            if not message_nums:
                self.logger.info("No se encontraron mensajes sin leer")
                return files
                
            self.logger.info(f"Encontrados {len(message_nums)} mensajes sin leer")

            for num in message_nums:
                try:
                    status, msg_data = mail.fetch(num, '(RFC822)')
                    if status != 'OK' or not msg_data or not msg_data[0]:
                        continue

                    email_body = msg_data[0][1]
                    if not isinstance(email_body, bytes):
                        self.logger.error(f"Tipo de dato inesperado para email_body: {type(email_body)}")
                        continue

                    email_message = email.message_from_bytes(email_body)

                    # Procesar adjuntos
                    for part in email_message.walk():
                        if part.get_content_maintype() == 'multipart':
                            continue
                        if part.get('Content-Disposition') is None:
                            continue

                        filename = part.get_filename()
                        if filename:
                            # Decodificar nombre del archivo si es necesario
                            filename_parts = decode_header(filename)
                            filename = ''.join([
                                str(part_str.decode(encoding) if encoding else part_str)
                                for part_str, encoding in filename_parts
                            ])

                            # Crear directorio temporal si no existe
                            temp_dir = "/tmp/sage_daemon/email"
                            os.makedirs(temp_dir, exist_ok=True)

                            temp_path = os.path.join(
                                temp_dir,
                                f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
                            )

                            payload = part.get_payload(decode=True)
                            if not isinstance(payload, bytes):
                                self.logger.error(f"Tipo de dato inesperado para payload: {type(payload)}")
                                continue

                            with open(temp_path, 'wb') as f:
                                f.write(payload)

                            # Extraer ID del emisor del From
                            from_header = email_message.get('From', '')

                            # MEJORA: Extraer dirección de correo electrónico del encabezado From
                            # de manera más robusta considerando más formatos posibles
                            email_address = None
                            
                            # Registrar el encabezado From original para diagnóstico
                            self.logger.info(f"Encabezado From original: '{from_header}'")
                            
                            if '<' in from_header and '>' in from_header:
                                # Formato: "Nombre <email@ejemplo.com>"
                                try:
                                    email_address = from_header.split('<')[1].split('>')[0].strip()
                                    self.logger.debug(f"Extraída dirección entre <>: '{email_address}'")
                                except (IndexError, AttributeError) as e:
                                    self.logger.error(f"Error extrayendo email entre <>: {str(e)}")
                                    email_address = from_header.strip()
                            else:
                                # Formato: "email@ejemplo.com" o cualquier otro
                                email_address = from_header.strip()
                                
                            # Verificar si la dirección tiene @ para validarla como email
                            if '@' not in email_address:
                                self.logger.warning(f"Dirección extraída sin @: '{email_address}'")
                                # Buscar cualquier texto que parezca una dirección de email en el From
                                import re
                                email_regex = r'[\w\.-]+@[\w\.-]+'
                                matches = re.findall(email_regex, from_header)
                                if matches:
                                    email_address = matches[0]
                                    self.logger.info(f"Encontrada posible dirección email mediante regex: '{email_address}'")
                            
                            self.logger.warning(f"Procesando email de: {email_address} para casilla {config['id']}")    

                            # Intentar encontrar el emisor en la base de datos
                            emisor_id = self._get_emisor_id_by_email(email_address, config['id'])

                            # Si no se encontró el emisor, registramos el error y enviamos respuesta automática
                            if emisor_id is None:
                                self.logger.warning(f"No se encontró emisor para el email: {email_address}")

                                # Enviar respuesta automática al remitente no autorizado
                                try:
                                    # Obtener la configuración del correo
                                    conf = config['configuracion']

                                    # Determinar la dirección correcta para responder
                                    # Orden de prioridad:
                                    # 1. Reply-To (si existe)
                                    # 2. Return-Path (si existe)
                                    # 3. From
                                    
                                    # Inicializar con la dirección From
                                    reply_to_address = email_address
                                    reply_source = "From"
                                    
                                    # Verificar si hay Reply-To en el mensaje (prioridad más alta)
                                    if 'Reply-To' in email_message:
                                        reply_to_address = email_message['Reply-To'].strip()
                                        reply_source = "Reply-To"
                                        
                                    # Verificar si hay Return-Path como alternativa
                                    elif 'Return-Path' in email_message:
                                        return_path = email_message['Return-Path'].strip()
                                        # Eliminar los <> si existen
                                        if return_path.startswith('<') and return_path.endswith('>'):
                                            return_path = return_path[1:-1]
                                        if return_path and '@' in return_path:
                                            reply_to_address = return_path
                                            reply_source = "Return-Path"
                                    
                                    # Limpiar la dirección si tiene formato "Nombre <email@example.com>"
                                    if '<' in reply_to_address and '>' in reply_to_address:
                                        reply_to_address = reply_to_address.split('<')[1].split('>')[0].strip()
                                    
                                    self.logger.info(f"Dirección de respuesta ({reply_source}): {reply_to_address}")
                                    
                                    # MODIFICACIÓN: No descartar direcciones sin @
                                    # En su lugar, intentar con la dirección original si es necesario
                                    if '@' not in reply_to_address:
                                        self.logger.warning(f"Dirección de respuesta inválida sin @: {reply_to_address}")
                                        # En este caso, usar la dirección original si es posible
                                        if '@' in email_address:
                                            reply_to_address = email_address
                                            self.logger.info(f"Cambiando a dirección original: {reply_to_address}")
                                        else:
                                            self.logger.error(f"No se puede enviar respuesta: ni original ni reply tienen @")
                                            continue
                                    
                                    domain = reply_to_address.split('@')[-1].lower()
                                    
                                    # PROBLEMA: Dreamhost está usando MailChannels que puede bloquear dominios
                                    # NO BLOQUEAMOS NINGÚN DOMINIO - permitimos todos los dominios reales
                                    # Solo bloqueamos dominios de prueba que sabemos que causarán rebotes
                                    blocked_domains = []  # Ya no bloqueamos ningún dominio específico
                                    
                                    # Si el dominio está en la lista, no enviamos
                                    is_blocked = domain in blocked_domains
                                    
                                    # IMPORTANTE: También verificamos si el destinatario es el mismo que el remitente
                                    # para evitar errores donde una casilla intenta enviarse un mensaje a sí misma
                                    if reply_to_address.lower() == conf['usuario'].lower():
                                        self.logger.warning(f"No se envía respuesta a la misma casilla: {reply_to_address}")
                                        is_blocked = True
                                    
                                    # Loguear la dirección final que se usará para respuesta
                                    self.logger.info(f"DIRECCIÓN FINAL DE RESPUESTA: {reply_to_address} (Domain: {domain}, Blocked: {is_blocked})")
                                    
                                    if is_blocked:
                                        self.logger.warning(f"No se envía respuesta a dominio bloqueado: {domain}")
                                        # Marcar mensaje como procesado pero no enviar respuesta
                                        continue

                                    # Crear mensaje de respuesta
                                    msg = MIMEMultipart()
                                    msg['From'] = conf['usuario']
                                    msg['To'] = reply_to_address
                                    # No enviamos copias para evitar problemas de bloqueo
                                    # msg['Bcc'] = 'bounce@sage.vidahub.ai'
                                    
                                    # MEJORA CRÍTICA: Añadir encabezados de prioridad alta para garantizar entrega
                                    msg['X-Priority'] = '1'
                                    msg['X-MSMail-Priority'] = 'High'
                                    msg['Importance'] = 'High'

                                    # Asegurarse que sea un REPLY correcto
                                    original_subject = email_message.get('Subject', 'Remitente no autorizado en SAGE')
                                    if not original_subject.lower().startswith('re:'):
                                        subject = f"Re: {original_subject}" 
                                    else:
                                        subject = original_subject
                                    msg['Subject'] = subject

                                    # Añadir encabezados de referencia para que sea un reply correcto
                                    if 'Message-ID' in email_message:
                                        msg['In-Reply-To'] = email_message['Message-ID']
                                        msg['References'] = email_message['Message-ID']

                                    # Contenido del mensaje
                                    body = f"""
Estimado/a Usuario,

Gracias por su mensaje enviado a {conf['usuario']}.

Lamentamos informarle que el sistema SAGE ha detectado que su dirección de correo electrónico ({email_address}) no está registrada como remitente autorizado para esta casilla.

Si necesita enviar archivos para procesamiento, por favor contacte al administrador del sistema para solicitar su autorización en la plataforma.

Este es un mensaje automático. Por favor no responda a este correo.

Saludos cordiales,
Sistema SAGE
"""
                                    msg.attach(MIMEText(body, 'plain'))

                                    # MEJORA: Usar nuestro método centralizado de envío SMTP
                                    # Obtener datos del servidor SMTP
                                    smtp_server = conf.get('servidor_salida', '')
                                    if not smtp_server:
                                        self.logger.warning("No se encontró servidor_salida, usando servidor_entrada como fallback")
                                        smtp_server = conf.get('servidor_entrada', '')

                                    # Obtener puerto de salida
                                    smtp_port = 587  # Puerto SMTP estándar por defecto
                                    puerto_salida = conf.get('puerto_salida')
                                    if puerto_salida:
                                        if isinstance(puerto_salida, int):
                                            smtp_port = puerto_salida
                                        else:
                                            try:
                                                smtp_port = int(puerto_salida)
                                            except (ValueError, TypeError):
                                                self.logger.warning(f"Puerto de salida inválido: {puerto_salida}, usando puerto SMTP estándar {smtp_port}")
                                    else:
                                        self.logger.warning(f"No se encontró puerto_salida, usando puerto SMTP estándar {smtp_port}")

                                    # Configurar TLS
                                    usar_tls = conf.get('usar_tls_salida', True)
                                    
                                    # Forzar TLS para puertos estándar (587) por seguridad
                                    if smtp_port == 587:
                                        usar_tls = True
                                    # Para puerto 465, SSL ya está integrado, no se necesita TLS explícito
                                    elif smtp_port == 465:
                                        usar_tls = False
                                    
                                    # MODIFICACIÓN: Añadir log especial para seguimiento
                                    self.logger.warning(f"=== RESPUESTA DE PRIORIDAD ALTA: {reply_to_address} (Casilla: {conf['usuario']}) ===")
                                    
                                    # Log detallado de la configuración SMTP
                                    self.logger.info(f"Configuración SMTP: Servidor={smtp_server}, Puerto={smtp_port}")
                                    self.logger.info(f"Usuario SMTP: {conf['usuario']}")
                                    self.logger.info(f"Modo seguro: {'SSL (implícito)' if smtp_port == 465 else 'TLS' if usar_tls else 'Ninguno'}")
                                    self.logger.info(f"Enviando respuesta automática vía {smtp_server}:{smtp_port} (TLS: {usar_tls})")
                                    self.logger.info(f"Mensaje: De: {msg['From']} - Para: {msg['To']} - Asunto: {msg['Subject']}")
                                    self.logger.debug(f"Contenido del mensaje: {body}")

                                    # Obtener contraseña real del objeto original
                                    password_real = config['configuracion']['password']
                                    
                                    # Configurar timeout para evitar bloqueos
                                    import socket
                                    socket.setdefaulttimeout(30)  # 30 segundos de timeout
                                    
                                    # NUEVA IMPLEMENTACIÓN: Usar el método centralizado para envío SMTP
                                    envio_exitoso = self._enviar_correo_smtp(
                                        smtp_server=smtp_server,
                                        smtp_port=smtp_port,
                                        usuario=conf['usuario'],
                                        password=password_real,
                                        mensaje=msg,
                                        reply_to_address=reply_to_address,
                                        usar_tls=usar_tls
                                    )
                                    
                                    # Verificar resultado del envío
                                    if not envio_exitoso:
                                        self.logger.error(f"No se pudo enviar la respuesta automática a {reply_to_address}")
                                        # No lanzamos una excepción para permitir que el procesamiento continúe
                                        # pero registramos claramente el error
                                    else:
                                        self.logger.info(f"Respuesta automática enviada exitosamente a {reply_to_address}")
                                        self.logger.warning(f"✅✅✅ CONFIRMADO: Respuesta enviada correctamente a {reply_to_address}")
                                except Exception as e:
                                    # Asegurarnos que server_info esté definido para evitar errores al reportar
                                    server_info = f"{conf.get('servidor_salida', 'unknown')}:{conf.get('puerto_salida', '?')}"
                                    self.logger.error(f"Error enviando respuesta automática a {email_address} vía {server_info}: {str(e)}")
                                    
                                    # Clasificar el error para mejor diagnóstico
                                    # Usando bloques try/except independientes para evitar errores de binding
                                    if isinstance(e, smtplib.SMTPResponseException):
                                        self.logger.error(f"Código de error SMTP: {e.smtp_code}, Mensaje: {e.smtp_error}")
                                    
                                    # Manejar timeout de manera más segura
                                    try:
                                        import socket as socket_check
                                        if isinstance(e, socket_check.timeout):
                                            self.logger.error("Timeout en la conexión SMTP")
                                    except (ImportError, AttributeError):
                                        # Si hay algún problema con el módulo socket, simplemente continuamos
                                        pass
                                        
                                    # Otros tipos de errores
                                    if isinstance(e, ConnectionRefusedError):
                                        self.logger.error(f"Conexión rechazada en {server_info}")
                                    
                                    # Mostrar más detalles para depuración
                                    import traceback
                                    self.logger.debug(f"Detalles de error de envío: {traceback.format_exc()}")

                                continue

                            files.append({
                                'path': temp_path,
                                'nombre': filename,
                                'emisor_id': emisor_id,
                                'metadata': {
                                    'from': from_header,
                                    'subject': email_message.get('Subject', ''),
                                    'date': email_message.get('Date', '')
                                }
                            })

                    # Marcar email como leído
                    mail.store(num, '+FLAGS', '\\Seen')

                except Exception as e:
                    self.logger.error(f"Error procesando mensaje {num}: {str(e)}")
                    continue

            mail.close()
            mail.logout()

        except Exception as e:
            self.logger.error(f"Error en monitor de email: {str(e)}")

        return files

class SFTPMonitor(BaseMonitor):
    """Monitor para archivos recibidos por SFTP"""
    def check_new_files(self, config: Dict) -> List[Dict]:
        """Verifica nuevos archivos en el directorio SFTP"""
        files = []

        # Validar configuración
        if not self._validate_config(config, ['servidor_entrada', 'puerto_entrada', 'usuario', 'password', 'path']):
            return files

        try:
            conf = config['configuracion']
            # Obtener contraseña real del objeto original
            password_real = config['configuracion']['password']
            self.logger.debug(f"SFTP: Usando contraseña real (longitud: {len(password_real)})")

            transport = paramiko.Transport((conf['servidor_entrada'], int(conf['puerto_entrada'])))
            transport.connect(username=conf['usuario'], password=password_real)

            sftp = paramiko.SFTPClient.from_transport(transport)
            if not sftp:
                self.logger.error("No se pudo crear cliente SFTP")
                return files

            # Listar archivos en el directorio remoto
            remote_path = conf['path']
            try:
                remote_files = sftp.listdir(remote_path)
            except Exception as e:
                self.logger.error(f"Error listando directorio SFTP {remote_path}: {str(e)}")
                return files

            # Crear directorio temporal si no existe
            temp_dir = "/tmp/sage_daemon/sftp"
            os.makedirs(temp_dir, exist_ok=True)

            for filename in remote_files:
                if self._is_processed(filename):
                    continue

                try:
                    temp_path = os.path.join(
                        temp_dir,
                        f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}"
                    )

                    remote_file = os.path.join(remote_path, filename)
                    sftp.get(remote_file, temp_path)

                    # TODO: Implementar lógica para obtener emisor_id
                    emisor_id = 1  # Placeholder

                    files.append({
                        'path': temp_path,
                        'nombre': filename,
                        'emisor_id': emisor_id,
                        'metadata': {
                            'sftp_path': remote_path,
                            'timestamp': datetime.now().isoformat()
                        }
                    })

                except Exception as e:
                    self.logger.error(f"Error descargando archivo {filename}: {str(e)}")
                    continue

            sftp.close()
            transport.close()

        except Exception as e:
            self.logger.error(f"Error en monitor SFTP: {str(e)}")

        return files

    def _is_processed(self, filename: str) -> bool:
        """Verifica si un archivo ya fue procesado"""
        # TODO: Implementar verificación en base de datos
        return False

class FilesystemMonitor(BaseMonitor):
    """Monitor para archivos en el sistema de archivos"""
    def check_new_files(self, config: Dict) -> List[Dict]:
        """Verifica nuevos archivos en el directorio configurado"""
        files = []

        # Validar configuración
        if not self._validate_config(config, ['path']):
            return files

        try:
            conf = config['configuracion']
            path = conf['path']
            pattern = conf.get('pattern', '*.*')

            if not os.path.isdir(path):
                self.logger.error(f"El directorio {path} no existe")
                return files

            # Buscar archivos que coincidan con el patrón
            for filepath in glob.glob(os.path.join(path, pattern)):
                if not os.path.isfile(filepath):
                    continue

                if self._is_processed(filepath):
                    continue

                filename = os.path.basename(filepath)

                # TODO: Implementar lógica para obtener emisor_id
                emisor_id = 1  # Placeholder

                files.append({
                    'path': filepath,
                    'nombre': filename,
                    'emisor_id': emisor_id,
                    'metadata': {
                        'created': datetime.fromtimestamp(os.path.getctime(filepath)).isoformat(),
                        'modified': datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat(),
                        'size': os.path.getsize(filepath)
                    }
                })

        except Exception as e:
            self.logger.error(f"Error en monitor filesystem: {str(e)}")

        return files

    def _is_processed(self, filepath: str) -> bool:
        """Verifica si un archivo ya fue procesado"""
        # TODO: Implementar verificación en base de datos
        return False