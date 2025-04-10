"""
Notificador principal para SAGE
Maneja la lógica de envío de notificaciones a través de diferentes canales.
"""

import os
import json
import logging
import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, List, Any, Optional, Union, Sequence
import psycopg2
from psycopg2.extras import RealDictCursor

# Importar adaptador de plantillas si está disponible
try:
    from sage.templates.email.notificador_adapter import NotificadorAdapter
    HAS_TEMPLATE_SYSTEM = True
except ImportError:
    HAS_TEMPLATE_SYSTEM = False

logger = logging.getLogger(__name__)

class Notificador:
    """Clase principal para la gestión de notificaciones en SAGE"""
    
    def __init__(self, db_connection=None):
        """Inicializa el notificador
        
        Args:
            db_connection: Conexión a la base de datos PostgreSQL (opcional)
        """
        self.db_connection = db_connection
        self.smtp_config = self._get_smtp_config()
        
        # Inicializar el adaptador de plantillas si está disponible
        self.template_adapter = None
        if HAS_TEMPLATE_SYSTEM:
            try:
                self.template_adapter = NotificadorAdapter(db_connection)
                logger.info("Sistema de plantillas de email inicializado correctamente")
            except Exception as e:
                logger.error(f"Error al inicializar sistema de plantillas: {e}")
                self.template_adapter = None
        
    def _get_smtp_config(self) -> Dict[str, Union[str, int]]:
        """Obtiene la configuración SMTP desde la base de datos o variables de entorno"""
        # Primero intentamos obtener la configuración desde la base de datos
        config_db = self._get_smtp_config_from_db()
        if config_db:
            return config_db
        
        # Si no se pudo obtener de la BD, usamos las variables de entorno
        return self._get_smtp_config_from_env()
    
    def _get_smtp_config_from_db(self) -> Optional[Dict[str, Union[str, int]]]:
        """Obtiene la configuración SMTP desde la base de datos (cuentas administrativas)"""
        conn = self._get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Primero intentamos obtener una cuenta con propósito 'admin'
            cursor.execute("""
                SELECT servidor_salida, puerto_salida, usar_tls_salida, 
                       usuario, password, direccion, nombre
                FROM email_configuraciones 
                WHERE proposito = 'admin' AND estado != 'error'
                LIMIT 1
            """)
            
            config = cursor.fetchone()
            
            if not config:
                # Si no hay cuentas admin, intentamos con cualquier cuenta activa
                cursor.execute("""
                    SELECT servidor_salida, puerto_salida, usar_tls_salida, 
                           usuario, password, direccion, nombre
                    FROM email_configuraciones 
                    WHERE estado != 'error'
                    LIMIT 1
                """)
                config = cursor.fetchone()
            
            if config:
                logger.info(f"Usando configuración SMTP desde BD: {config['nombre']} ({config['direccion']})")
                return {
                    'server': config['servidor_salida'],
                    'port': int(config['puerto_salida']),
                    'username': config['usuario'],
                    'password': config['password'],
                    'from_email': config['direccion'],
                    'from_name': config['nombre'] or 'SAGE Notificaciones'
                }
            else:
                logger.warning("No se encontró configuración SMTP en la base de datos")
                return None
        except Exception as e:
            logger.error(f"Error al obtener configuración SMTP desde la base de datos: {e}")
            return None
        finally:
            cursor.close()
            
    def _get_smtp_config_from_env(self) -> Dict[str, Union[str, int]]:
        """Obtiene la configuración SMTP desde variables de entorno"""
        logger.info("Usando configuración SMTP desde variables de entorno")
        return {
            'server': os.environ.get('SMTP_SERVER', 'smtp.gmail.com'),
            'port': int(os.environ.get('SMTP_PORT', 587)),
            'username': os.environ.get('SMTP_USERNAME', ''),
            'password': os.environ.get('SMTP_PASSWORD', ''),
            'from_email': os.environ.get('SMTP_FROM_EMAIL', 'notificaciones@sage.com'),
            'from_name': os.environ.get('SMTP_FROM_NAME', 'Sistema SAGE')
        }
    
    def _get_db_connection(self):
        """Obtiene una conexión a la base de datos PostgreSQL"""
        if self.db_connection is None:
            conn_string = os.environ.get('DATABASE_URL')
            if not conn_string:
                logger.error("No se ha configurado DATABASE_URL")
                raise ValueError("No se ha configurado DATABASE_URL")
            
            self.db_connection = psycopg2.connect(conn_string)
        
        return self.db_connection
    
    def obtener_suscripciones(self, filtros: Optional[Dict[str, Any]] = None) -> Sequence[Dict[str, Any]]:
        """Obtiene suscripciones según los filtros especificados
        
        Args:
            filtros: Diccionario con filtros para las suscripciones
                    (casilla_id, frecuencia, etc.)
        
        Returns:
            Lista de suscripciones que cumplen con los filtros
        """
        conn = self._get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                id, nombre, email, telefono, activo, frecuencia, 
                nivel_detalle, hora_envio, dia_envio, tipos_evento, 
                casilla_id, emisores, metodo_envio
            FROM suscripciones 
            WHERE activo = TRUE
        """
        
        params = []
        
        if filtros:
            for key, value in filtros.items():
                if value is not None:
                    # Asegurarse de que el valor sea del tipo correcto
                    if key == 'casilla_id' and isinstance(value, (int, str)):
                        value = str(value)  # Convertir a string para evitar problemas de tipo
                    query += f" AND {key} = %s"
                    params.append(value)
        
        try:
            cursor.execute(query, params)
            return cursor.fetchall()
        except Exception as e:
            logger.error(f"Error al obtener suscripciones: {e}")
            return []
        finally:
            cursor.close()
    
    def enviar_notificacion_email(self, destinatario: str, asunto: str, 
                                 contenido_html: str, contenido_texto: Optional[str] = None) -> bool:
        """Envía un email de notificación
        
        Args:
            destinatario: Dirección de email del destinatario
            asunto: Asunto del email
            contenido_html: Contenido HTML del email
            contenido_texto: Contenido en texto plano (opcional)
            
        Returns:
            True si el envío fue exitoso, False en caso contrario
        """
        if not self.smtp_config.get('username') or not self.smtp_config.get('password'):
            logger.warning("Credenciales SMTP no configuradas, no se puede enviar email")
            return False
        
        mensaje = MIMEMultipart('alternative')
        mensaje['Subject'] = asunto
        mensaje['From'] = f"{str(self.smtp_config['from_name'])} <{str(self.smtp_config['from_email'])}>"
        mensaje['To'] = destinatario
        
        # Añadir versión texto plano si se proporciona, o generar uno simple
        texto_plano = contenido_texto if contenido_texto else "Este mensaje requiere un cliente que soporte HTML."
        mensaje.attach(MIMEText(texto_plano, 'plain'))
        mensaje.attach(MIMEText(contenido_html, 'html'))
        
        try:
            server = smtplib.SMTP(str(self.smtp_config['server']), int(self.smtp_config['port']))
            server.ehlo()
            server.starttls()
            server.login(str(self.smtp_config['username']), str(self.smtp_config['password']))
            server.sendmail(str(self.smtp_config['from_email']), destinatario, mensaje.as_string())
            server.close()
            logger.info(f"Email enviado correctamente a {destinatario}")
            return True
        except Exception as e:
            logger.error(f"Error al enviar email a {destinatario}: {e}")
            return False
    
    def procesar_eventos(self, eventos: List[Dict[str, Any]], 
                        portal_id: Optional[int] = None, casilla_id: Optional[int] = None) -> Dict[str, int]:
        """Procesa una lista de eventos y envía notificaciones según corresponda
        
        Args:
            eventos: Lista de eventos a procesar
            portal_id: (Obsoleto) Se mantiene por compatibilidad pero ya no se utiliza
            casilla_id: ID de la casilla (opcional)
            
        Returns:
            Diccionario con estadísticas del procesamiento
        """
        if not eventos:
            logger.info("No hay eventos para procesar")
            return {'total': 0, 'enviados': 0, 'error': 0}
        
        # Agrupar eventos por tipo
        eventos_por_tipo = {}
        for evento in eventos:
            tipo = evento.get('tipo', 'error')  # Default a 'error' si no se especifica
            if tipo not in eventos_por_tipo:
                eventos_por_tipo[tipo] = []
            eventos_por_tipo[tipo].append(evento)
        
        # Obtener suscripciones inmediatas para notificar
        filtros = {
            'frecuencia': 'inmediata'
        }
        # Si se especifica un ID de casilla, filtrar por ese valor
        if casilla_id:
            filtros['casilla_id'] = str(casilla_id)
            
        suscripciones = self.obtener_suscripciones(filtros)
        
        # Estadísticas de procesamiento
        stats = {'total': len(eventos), 'enviados': 0, 'error': 0}
        
        # Procesar cada suscripción
        for suscripcion in suscripciones:
            try:
                # Verificar si la suscripción está interesada en alguno de los tipos de eventos
                tipos_evento = suscripcion['tipos_evento']
                if isinstance(tipos_evento, str):
                    tipos_evento = json.loads(tipos_evento)
                
                # Filtrar eventos que interesan a esta suscripción
                eventos_relevantes = []
                for tipo, eventos_de_tipo in eventos_por_tipo.items():
                    if tipo in tipos_evento:
                        eventos_relevantes.extend(eventos_de_tipo)
                
                if not eventos_relevantes:
                    continue  # Esta suscripción no está interesada en ninguno de los eventos
                
                # Verificar filtros de emisor si existen
                emisores = suscripcion['emisores']
                if isinstance(emisores, str):
                    emisores = json.loads(emisores)
                
                if emisores and len(emisores) > 0:
                    # Filtrar eventos por emisor
                    eventos_filtrados = []
                    for evento in eventos_relevantes:
                        if evento.get('emisor') in emisores:
                            eventos_filtrados.append(evento)
                    eventos_relevantes = eventos_filtrados
                
                if not eventos_relevantes:
                    continue  # No quedan eventos después de filtrar por emisores
                
                # Generar contenido de la notificación según el nivel de detalle
                asunto, contenido_html = self._generar_contenido_notificacion(
                    eventos_relevantes, 
                    suscripcion['nivel_detalle'],
                    None,  # portal_id ya no se utiliza
                    casilla_id,
                    suscripcion['id']  # Pasar el ID del suscriptor para personalización
                )
                
                # Enviar email
                if self.enviar_notificacion_email(
                    suscripcion['email'], 
                    asunto, 
                    contenido_html
                ):
                    stats['enviados'] += 1
                    
                    # Actualizar fecha de último envío
                    self._actualizar_ultima_notificacion(suscripcion['id'])
                else:
                    stats['error'] += 1
                    
            except Exception as e:
                logger.error(f"Error al procesar notificación para suscripción {suscripcion['id']}: {e}")
                stats['error'] += 1
        
        return stats
    
    def _generar_contenido_notificacion(self, eventos: List[Dict[str, Any]], 
                                       nivel_detalle: str, 
                                       portal_id: Optional[int] = None,
                                       casilla_id: Optional[int] = None,
                                       suscriptor_id: Optional[int] = None) -> tuple:
        """Genera el contenido de la notificación según el nivel de detalle
        
        Args:
            eventos: Lista de eventos para incluir en la notificación
            nivel_detalle: Nivel de detalle ('detallado', 'resumido_emisor', 'resumido_casilla')
            portal_id: (Obsoleto) Se mantiene por compatibilidad
            casilla_id: ID de la casilla (opcional)
            suscriptor_id: ID del suscriptor (opcional, para personalización)
            
        Returns:
            Tupla con (asunto, contenido_html)
        """
        # Si el sistema de plantillas está disponible y funcionando, intentamos usarlo
        if HAS_TEMPLATE_SYSTEM and self.template_adapter:
            try:
                # Intentar generar el contenido con el sistema de plantillas
                asunto, contenido_html = self.template_adapter.generar_contenido_notificacion(
                    eventos, 
                    nivel_detalle,
                    portal_id,
                    casilla_id,
                    suscriptor_id
                )
                
                # Si se generó contenido correcto, lo devolvemos
                if asunto and contenido_html:
                    logger.info(f"Contenido generado con sistema de plantillas para nivel_detalle={nivel_detalle}")
                    return asunto, contenido_html
                
                # Si no se generó contenido, continuamos con el método tradicional
                # (esto asegura compatibilidad hacia atrás)
                logger.info("No se pudo generar contenido con sistema de plantillas, usando método tradicional")
            except Exception as e:
                logger.error(f"Error al generar contenido con sistema de plantillas: {e}")
                # Continuamos con el método tradicional
        
        # Método tradicional (asegura compatibilidad hacia atrás)
        fecha = datetime.datetime.now().strftime('%d/%m/%Y %H:%M')
        
        # Obtener información de la casilla
        conn = self._get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        portal_nombre = "SAGE"
        casilla_nombre = ""
        
        try:
            # Obtener información del portal si está disponible
            if portal_id:
                try:
                    cursor.execute("SELECT nombre FROM portales WHERE id = %s", (portal_id,))
                    portal = cursor.fetchone()
                    if portal:
                        portal_nombre = portal['nombre']
                except Exception:
                    # Si hay error, simplemente usamos el valor por defecto
                    pass
            
            # Obtener información de la casilla
            if casilla_id:
                cursor.execute("SELECT nombre FROM casillas WHERE id = %s", (casilla_id,))
                casilla = cursor.fetchone()
                if casilla:
                    casilla_nombre = casilla['nombre']
        except Exception as e:
            logger.error(f"Error al obtener información del portal/casilla: {e}")
        finally:
            cursor.close()
        
        # Contar eventos por tipo
        conteo_tipos = {}
        for evento in eventos:
            tipo = evento.get('tipo', 'error')
            conteo_tipos[tipo] = conteo_tipos.get(tipo, 0) + 1
        
        # Generar el asunto del email
        if casilla_id and casilla_nombre:
            asunto = f"SAGE - {portal_nombre} - {casilla_nombre} - "
        else:
            asunto = f"SAGE - {portal_nombre} - "
        
        tipos_texto = []
        for tipo, cantidad in conteo_tipos.items():
            if tipo == 'error':
                tipos_texto.append(f"{cantidad} errores")
            elif tipo == 'warning':
                tipos_texto.append(f"{cantidad} advertencias")
            elif tipo == 'info':
                tipos_texto.append(f"{cantidad} informaciones")
            elif tipo == 'success':
                tipos_texto.append(f"{cantidad} exitosos")
        
        asunto += ", ".join(tipos_texto)
        
        # Generar el contenido HTML según el nivel de detalle
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
                .header {{ background-color: #f4f4f4; padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 20px; }}
                .footer {{ background-color: #f4f4f4; padding: 10px; border-top: 1px solid #ddd; margin-top: 20px; font-size: 12px; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #f2f2f2; }}
                .error {{ color: #e53e3e; }}
                .warning {{ color: #dd6b20; }}
                .info {{ color: #3182ce; }}
                .success {{ color: #38a169; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Notificación de eventos SAGE</h2>
                <p>Portal: <strong>{portal_nombre}</strong></p>
                {f'<p>Casilla: <strong>{casilla_nombre}</strong></p>' if casilla_nombre else ''}
                <p>Fecha: {fecha}</p>
            </div>
        """
        
        # Contenido según nivel de detalle
        if nivel_detalle == 'detallado':
            html += self._generar_contenido_detallado(eventos)
        elif nivel_detalle == 'resumido_emisor':
            html += self._generar_contenido_resumido_emisor(eventos)
        elif nivel_detalle == 'resumido_casilla':
            html += self._generar_contenido_resumido_casilla(eventos)
        else:
            # Default a detallado
            html += self._generar_contenido_detallado(eventos)
        
        html += """
            <div class="footer">
                <p>Este es un mensaje automático generado por el sistema SAGE. Por favor no responda a este correo.</p>
            </div>
        </body>
        </html>
        """
        
        return asunto, html
    
    def _generar_contenido_detallado(self, eventos: List[Dict[str, Any]]) -> str:
        """Genera contenido detallado para cada evento"""
        html = """
        <h3>Detalle de eventos</h3>
        <table>
            <tr>
                <th>Tipo</th>
                <th>Emisor</th>
                <th>Mensaje</th>
                <th>Fecha</th>
            </tr>
        """
        
        for evento in eventos:
            tipo = evento.get('tipo', 'info')
            clase_css = tipo if tipo in ['error', 'warning', 'info', 'success'] else 'info'
            
            html += f"""
            <tr>
                <td class="{clase_css}">{tipo.upper()}</td>
                <td>{evento.get('emisor', 'N/A')}</td>
                <td>{evento.get('mensaje', 'Sin mensaje')}</td>
                <td>{evento.get('fecha', 'N/A')}</td>
            </tr>
            """
        
        html += "</table>"
        return html
    
    def _generar_contenido_resumido_emisor(self, eventos: List[Dict[str, Any]]) -> str:
        """Genera contenido resumido agrupado por emisor"""
        # Agrupar eventos por emisor
        por_emisor = {}
        for evento in eventos:
            emisor = evento.get('emisor', 'Desconocido')
            if emisor not in por_emisor:
                por_emisor[emisor] = {'error': 0, 'warning': 0, 'info': 0, 'success': 0}
            
            tipo = evento.get('tipo', 'info')
            if tipo in por_emisor[emisor]:
                por_emisor[emisor][tipo] += 1
        
        html = """
        <h3>Resumen por emisor</h3>
        <table>
            <tr>
                <th>Emisor</th>
                <th>Errores</th>
                <th>Advertencias</th>
                <th>Información</th>
                <th>Exitosos</th>
            </tr>
        """
        
        for emisor, conteo in por_emisor.items():
            html += f"""
            <tr>
                <td><strong>{emisor}</strong></td>
                <td class="error">{conteo['error']}</td>
                <td class="warning">{conteo['warning']}</td>
                <td class="info">{conteo['info']}</td>
                <td class="success">{conteo['success']}</td>
            </tr>
            """
        
        html += "</table>"
        return html
    
    def _generar_contenido_resumido_casilla(self, eventos: List[Dict[str, Any]]) -> str:
        """Genera contenido resumido solo para la casilla"""
        # Contar tipos de eventos
        conteo = {'error': 0, 'warning': 0, 'info': 0, 'success': 0}
        
        for evento in eventos:
            tipo = evento.get('tipo', 'info')
            if tipo in conteo:
                conteo[tipo] += 1
        
        html = """
        <h3>Resumen de eventos</h3>
        <table>
            <tr>
                <th>Tipo</th>
                <th>Cantidad</th>
            </tr>
        """
        
        for tipo, cantidad in conteo.items():
            clase_css = tipo
            tipo_texto = tipo.capitalize()
            if tipo == 'error':
                tipo_texto = 'Errores'
            elif tipo == 'warning':
                tipo_texto = 'Advertencias'
            elif tipo == 'info':
                tipo_texto = 'Información'
            elif tipo == 'success':
                tipo_texto = 'Exitosos'
            
            html += f"""
            <tr>
                <td class="{clase_css}"><strong>{tipo_texto}</strong></td>
                <td>{cantidad}</td>
            </tr>
            """
        
        html += "</table>"
        return html
    
    def _actualizar_ultima_notificacion(self, suscripcion_id: int) -> bool:
        """Actualiza la fecha de última notificación para una suscripción
        
        Args:
            suscripcion_id: ID de la suscripción
            
        Returns:
            True si la actualización fue exitosa, False en caso contrario
        """
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "UPDATE suscripciones SET last_notification_at = NOW() WHERE id = %s",
                (suscripcion_id,)
            )
            conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error al actualizar fecha de última notificación: {e}")
            conn.rollback()
            return False
        finally:
            cursor.close()
    
    def procesar_notificaciones_programadas(self) -> Dict[str, int]:
        """Procesa las notificaciones programadas según su frecuencia
        
        Returns:
            Diccionario con estadísticas del procesamiento
        """
        # Obtener fecha y hora actual
        ahora = datetime.datetime.now()
        hora_actual = ahora.hour
        dia_semana_actual = ahora.weekday() + 1  # 1-7 (lunes-domingo)
        dia_mes_actual = ahora.day  # 1-31
        
        # Determinar qué frecuencias procesar
        filtros_frecuencia = []
        
        # Diarias a la hora actual
        filtros_frecuencia.append({
            'frecuencia': 'diaria',
            'hora_envio': str(hora_actual)
        })
        
        # Semanales en el día y hora actuales
        filtros_frecuencia.append({
            'frecuencia': 'semanal',
            'dia_envio': str(dia_semana_actual),
            'hora_envio': str(hora_actual)
        })
        
        # Mensuales en el día y hora actuales
        filtros_frecuencia.append({
            'frecuencia': 'mensual',
            'dia_envio': str(dia_mes_actual),
            'hora_envio': str(hora_actual)
        })
        
        # Estadísticas
        stats = {'total': 0, 'procesadas': 0, 'error': 0}
        
        # Procesar cada tipo de frecuencia
        for filtro in filtros_frecuencia:
            suscripciones = self.obtener_suscripciones(filtro)
            stats['total'] += len(suscripciones)
            
            for suscripcion in suscripciones:
                try:
                    # TODO: Implementar la obtención de eventos según cada suscripción
                    # y generar las notificaciones correspondientes
                    
                    # De momento, actualizamos la fecha de última notificación
                    self._actualizar_ultima_notificacion(suscripcion['id'])
                    stats['procesadas'] += 1
                except Exception as e:
                    logger.error(f"Error al procesar notificación programada para {suscripcion['id']}: {e}")
                    stats['error'] += 1
        
        return stats