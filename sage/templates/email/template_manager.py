"""
Gestor de plantillas de email para SAGE

Este módulo proporciona funcionalidades para cargar, gestionar y
renderizar plantillas de email con diferentes formatos y variantes.
"""

import os
import json
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, Optional, Tuple, List, Union

logger = logging.getLogger(__name__)

class TemplateManager:
    """Gestor centralizado de plantillas de email para SAGE"""
    
    def __init__(self, db_connection=None):
        """Inicializa el gestor de plantillas
        
        Args:
            db_connection: Conexión a base de datos (opcional)
        """
        self.db_connection = db_connection
        self.template_cache = {}
    
    def _get_db_connection(self):
        """Obtiene una conexión a la base de datos PostgreSQL"""
        if self.db_connection is None:
            conn_string = os.environ.get('DATABASE_URL')
            if not conn_string:
                logger.error("No se ha configurado DATABASE_URL")
                raise ValueError("No se ha configurado DATABASE_URL")
            
            self.db_connection = psycopg2.connect(conn_string)
        
        return self.db_connection
    
    def get_template(self, template_type: str, subtype: Optional[str] = None, 
                   variant: str = 'standard', language: str = 'es',
                   channel: str = 'email') -> Dict[str, Any]:
        """Obtiene una plantilla según los parámetros
        
        Args:
            template_type: Tipo de plantilla (notificacion, respuesta_daemon, etc.)
            subtype: Subtipo (detallado, resumido_emisor, etc.)
            variant: Variante (standard, marketing, technical, etc.)
            language: Código de idioma (es, en, etc.)
            channel: Canal (email, whatsapp, telegram, etc.)
            
        Returns:
            Dict: Datos de la plantilla
        """
        # Verificar si la plantilla está en caché
        cache_key = f"{template_type}:{subtype or ''}:{variant}:{language}:{channel}"
        if cache_key in self.template_cache:
            logger.debug(f"Plantilla obtenida desde caché: {cache_key}")
            return self.template_cache[cache_key]
        
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Primero intentar encontrar la plantilla específica
            query = """
                SELECT id, nombre, descripcion, tipo, subtipo, variante, 
                       canal, idioma, asunto, contenido_html, contenido_texto,
                       es_predeterminada
                FROM plantillas_email
                WHERE tipo = %s
                  AND estado = 'activo'
            """
            
            params = [template_type]
            
            if subtype:
                query += " AND subtipo = %s"
                params.append(subtype)
            else:
                query += " AND subtipo IS NULL"
            
            query += " AND variante = %s AND idioma = %s AND canal = %s"
            params.extend([variant, language, channel])
            
            cursor.execute(query, params)
            template = cursor.fetchone()
            
            # Si no se encuentra, buscar plantilla predeterminada para este tipo/subtipo
            if not template:
                logger.info(f"No se encontró plantilla específica, buscando predeterminada para {template_type}/{subtype}")
                query = """
                    SELECT id, nombre, descripcion, tipo, subtipo, variante, 
                           canal, idioma, asunto, contenido_html, contenido_texto,
                           es_predeterminada
                    FROM plantillas_email
                    WHERE tipo = %s
                      AND estado = 'activo'
                      AND es_predeterminada = TRUE
                """
                
                params = [template_type]
                
                if subtype:
                    query += " AND subtipo = %s"
                    params.append(subtype)
                else:
                    query += " AND subtipo IS NULL"
                
                query += " AND canal = %s"
                params.append(channel)
                
                cursor.execute(query, params)
                template = cursor.fetchone()
            
            cursor.close()
            
            # Si aún no se encuentra, generar una plantilla en memoria basada en el sistema actual
            if not template:
                logger.warning(f"No se encontró plantilla para {template_type}/{subtype}, usando plantilla en memoria")
                # Esta función crea una plantilla en memoria compatible con el sistema actual
                template = self._generate_fallback_template(template_type, subtype)
            
            # Guardar en caché para futuras consultas
            if template:
                self.template_cache[cache_key] = template
            
            return template
            
        except Exception as e:
            logger.error(f"Error al obtener plantilla: {e}")
            # En caso de error, generar una plantilla en memoria para no interrumpir el sistema
            fallback = self._generate_fallback_template(template_type, subtype)
            return fallback
    
    def get_template_by_id(self, template_id: int) -> Optional[Dict[str, Any]]:
        """Obtiene una plantilla por su ID
        
        Args:
            template_id: ID de la plantilla
            
        Returns:
            Dict or None: Datos de la plantilla o None si no existe
        """
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT id, nombre, descripcion, tipo, subtipo, variante, 
                       canal, idioma, asunto, contenido_html, contenido_texto,
                       es_predeterminada
                FROM plantillas_email
                WHERE id = %s AND estado = 'activo'
            """
            
            cursor.execute(query, [template_id])
            template = cursor.fetchone()
            cursor.close()
            
            return template
            
        except Exception as e:
            logger.error(f"Error al obtener plantilla por ID: {e}")
            return None
    
    def get_template_for_subscriber(self, subscriber_id: int, template_type: str, 
                                  subtype: Optional[str] = None, 
                                  channel: str = 'email') -> Dict[str, Any]:
        """Obtiene la plantilla preferida para un suscriptor específico
        
        Args:
            subscriber_id: ID del suscriptor
            template_type: Tipo de plantilla
            subtype: Subtipo de plantilla
            channel: Canal de comunicación
            
        Returns:
            Dict: Datos de la plantilla
        """
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Verificar si el suscriptor tiene una plantilla preferida asignada
            query = """
                SELECT plantilla_id
                FROM suscripciones
                WHERE id = %s
            """
            
            cursor.execute(query, [subscriber_id])
            result = cursor.fetchone()
            
            if result and result['plantilla_id']:
                # Obtener la plantilla preferida del suscriptor
                template = self.get_template_by_id(result['plantilla_id'])
                if template:
                    logger.info(f"Usando plantilla preferida del suscriptor {subscriber_id}: {template['nombre']}")
                    return template
            
            cursor.close()
            
            # Si no tiene preferencia o la plantilla no existe, usar la estándar
            return self.get_template(template_type, subtype, channel=channel)
            
        except Exception as e:
            logger.error(f"Error al obtener plantilla para suscriptor: {e}")
            # En caso de error, usar la plantilla estándar
            return self.get_template(template_type, subtype, channel=channel)
    
    def _generate_fallback_template(self, template_type: str, 
                                  subtype: Optional[str] = None) -> Dict[str, Any]:
        """Genera una plantilla en memoria compatible con el sistema actual
        
        Esta función es crítica para mantener la compatibilidad con el sistema existente.
        Cuando no se encuentra una plantilla en la base de datos, se genera una en memoria
        que garantiza que el sistema siga funcionando como lo hacía antes.
        
        Args:
            template_type: Tipo de plantilla
            subtype: Subtipo de plantilla
            
        Returns:
            Dict: Plantilla compatible con el sistema actual
        """
        template = {
            'id': None, 
            'nombre': f"Plantilla predeterminada {template_type}",
            'descripcion': "Plantilla generada automáticamente",
            'tipo': template_type,
            'subtipo': subtype,
            'variante': 'standard',
            'canal': 'email',
            'idioma': 'es',
            'asunto': "",  # El asunto se genera en el sistema actual
            'contenido_html': "",  # El contenido se genera en el sistema actual
            'contenido_texto': "",  # El contenido se genera en el sistema actual
            'es_predeterminada': True
        }
        
        return template
    
    def render_template(self, template: Dict[str, Any], context: Dict[str, Any]) -> Tuple[str, str]:
        """Renderiza una plantilla con el contexto dado
        
        Args:
            template: Plantilla a renderizar
            context: Diccionario con variables para interpolar
            
        Returns:
            Tuple[str, str]: Contenido HTML y contenido de texto plano
        """
        # Si la plantilla tiene contenido, lo renderizamos
        html_content = template.get('contenido_html', '')
        text_content = template.get('contenido_texto', '')
        
        if html_content:
            html_content = self._interpolate_variables(html_content, context)
        
        if text_content:
            text_content = self._interpolate_variables(text_content, context)
        
        return html_content, text_content
    
    def _interpolate_variables(self, content: str, context: Dict[str, Any]) -> str:
        """Reemplaza variables en el contenido con valores del contexto
        
        Args:
            content: Contenido con variables
            context: Diccionario con valores
            
        Returns:
            str: Contenido con variables reemplazadas
        """
        if not content:
            return content
            
        # Reemplazar variables simples {{ variable }}
        for key, value in context.items():
            placeholder = "{{" + key + "}}"
            if placeholder in content:
                content = content.replace(placeholder, str(value))
            
            # También soportar formato con espacios
            placeholder = "{{ " + key + " }}"
            if placeholder in content:
                content = content.replace(placeholder, str(value))
        
        return content
    
    def get_all_templates(self, filter_params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Obtiene todas las plantillas según filtros opcionales
        
        Args:
            filter_params: Parámetros de filtrado (tipo, subtipo, etc.)
            
        Returns:
            List[Dict]: Lista de plantillas
        """
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT id, nombre, descripcion, tipo, subtipo, variante, 
                       canal, idioma, asunto, es_predeterminada, estado,
                       fecha_creacion, fecha_modificacion
                FROM plantillas_email
                WHERE 1=1
            """
            
            params = []
            
            if filter_params:
                for key, value in filter_params.items():
                    if value is not None:
                        query += f" AND {key} = %s"
                        params.append(value)
            
            query += " ORDER BY tipo, subtipo, es_predeterminada DESC, nombre"
            
            cursor.execute(query, params)
            templates = cursor.fetchall()
            cursor.close()
            
            return templates
            
        except Exception as e:
            logger.error(f"Error al obtener plantillas: {e}")
            return []
    
    def create_template(self, template_data: Dict[str, Any]) -> Optional[int]:
        """Crea una nueva plantilla
        
        Args:
            template_data: Datos de la plantilla
            
        Returns:
            int or None: ID de la plantilla creada o None si hay error
        """
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            # Si es una plantilla predeterminada, verificar que no exista otra
            if template_data.get('es_predeterminada'):
                # Verificar que no exista otra plantilla predeterminada del mismo tipo/subtipo
                self._ensure_single_default_template(
                    template_data.get('tipo'),
                    template_data.get('subtipo'),
                    template_data.get('canal', 'email')
                )
            
            query = """
                INSERT INTO plantillas_email (
                    nombre, descripcion, tipo, subtipo, variante, 
                    canal, idioma, asunto, contenido_html, contenido_texto,
                    es_predeterminada, creador_id, estado
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id
            """
            
            params = [
                template_data.get('nombre'),
                template_data.get('descripcion'),
                template_data.get('tipo'),
                template_data.get('subtipo'),
                template_data.get('variante', 'standard'),
                template_data.get('canal', 'email'),
                template_data.get('idioma', 'es'),
                template_data.get('asunto', ''),
                template_data.get('contenido_html', ''),
                template_data.get('contenido_texto', ''),
                template_data.get('es_predeterminada', False),
                template_data.get('creador_id'),
                template_data.get('estado', 'activo')
            ]
            
            cursor.execute(query, params)
            template_id = cursor.fetchone()[0]
            
            conn.commit()
            cursor.close()
            
            # Invalidar caché
            self._invalidate_cache()
            
            return template_id
            
        except Exception as e:
            logger.error(f"Error al crear plantilla: {e}")
            if conn:
                conn.rollback()
            return None
    
    def update_template(self, template_id: int, template_data: Dict[str, Any]) -> bool:
        """Actualiza una plantilla existente
        
        Args:
            template_id: ID de la plantilla
            template_data: Datos actualizados
            
        Returns:
            bool: True si se actualizó correctamente
        """
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            # Obtener datos actuales para comparar
            current_data_query = """
                SELECT tipo, subtipo, canal, es_predeterminada
                FROM plantillas_email
                WHERE id = %s
            """
            cursor.execute(current_data_query, [template_id])
            current_data = cursor.fetchone()
            
            if not current_data:
                logger.error(f"No se encontró plantilla con ID {template_id}")
                return False
            
            # Si cambia a predeterminada, verificar que no exista otra
            if template_data.get('es_predeterminada') and not current_data[3]:
                self._ensure_single_default_template(
                    template_data.get('tipo', current_data[0]),
                    template_data.get('subtipo', current_data[1]),
                    template_data.get('canal', current_data[2])
                )
            
            # Construir la consulta de actualización dinámica
            query = "UPDATE plantillas_email SET "
            params = []
            
            for key, value in template_data.items():
                if key != 'id':  # No actualizar el ID
                    query += f"{key} = %s, "
                    params.append(value)
            
            # Añadir fecha de modificación
            query += "fecha_modificacion = CURRENT_TIMESTAMP "
            
            # Añadir condición WHERE
            query += "WHERE id = %s"
            params.append(template_id)
            
            cursor.execute(query, params)
            
            conn.commit()
            cursor.close()
            
            # Invalidar caché
            self._invalidate_cache()
            
            return cursor.rowcount > 0
            
        except Exception as e:
            logger.error(f"Error al actualizar plantilla: {e}")
            if conn:
                conn.rollback()
            return False
    
    def _ensure_single_default_template(self, tipo: str, subtipo: Optional[str], canal: str) -> None:
        """Asegura que solo exista una plantilla predeterminada por tipo/subtipo/canal
        
        Args:
            tipo: Tipo de plantilla
            subtipo: Subtipo de plantilla
            canal: Canal de comunicación
        """
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        query = """
            UPDATE plantillas_email
            SET es_predeterminada = FALSE
            WHERE tipo = %s
              AND canal = %s
        """
        
        params = [tipo, canal]
        
        if subtipo:
            query += " AND subtipo = %s"
            params.append(subtipo)
        else:
            query += " AND subtipo IS NULL"
        
        cursor.execute(query, params)
        conn.commit()
        cursor.close()
    
    def _invalidate_cache(self) -> None:
        """Invalida la caché de plantillas"""
        self.template_cache = {}
        logger.debug("Caché de plantillas invalidada")
    
    def assign_template_to_subscriber(self, subscriber_id: int, template_id: int) -> bool:
        """Asigna una plantilla a un suscriptor
        
        Args:
            subscriber_id: ID del suscriptor
            template_id: ID de la plantilla
            
        Returns:
            bool: True si se asignó correctamente
        """
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            query = """
                UPDATE suscripciones
                SET plantilla_id = %s
                WHERE id = %s
            """
            
            cursor.execute(query, [template_id, subscriber_id])
            
            conn.commit()
            cursor.close()
            
            return cursor.rowcount > 0
            
        except Exception as e:
            logger.error(f"Error al asignar plantilla a suscriptor: {e}")
            if conn:
                conn.rollback()
            return False
    
    def get_assigned_template_for_subscriber(self, subscriber_id: int) -> Optional[Dict[str, Any]]:
        """Obtiene la plantilla asignada a un suscriptor
        
        Args:
            subscriber_id: ID del suscriptor
            
        Returns:
            Dict or None: Datos de la plantilla asignada o None si no tiene
        """
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT p.*
                FROM suscripciones s
                JOIN plantillas_email p ON s.plantilla_id = p.id
                WHERE s.id = %s
            """
            
            cursor.execute(query, [subscriber_id])
            template = cursor.fetchone()
            cursor.close()
            
            return template
            
        except Exception as e:
            logger.error(f"Error al obtener plantilla asignada: {e}")
            return None