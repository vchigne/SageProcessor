"""
Gestor de plantillas de email para SAGE

Este módulo proporciona la funcionalidad para gestionar plantillas de email,
permitiendo cargar, guardar, actualizar y asignar plantillas a suscriptores.
"""

import logging
import os
import time
import psycopg2
from psycopg2.extras import DictCursor
import json
from typing import Dict, Any, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)

class TemplateManager:
    """
    Gestor de plantillas de email
    
    Esta clase proporciona métodos para:
    - Obtener plantillas predeterminadas por tipo
    - Asignar plantillas personalizadas a suscriptores
    - Guardar y actualizar plantillas
    """
    
    def __init__(self, cache_ttl: int = 3600):
        """
        Inicializa el gestor de plantillas
        
        Args:
            cache_ttl: Tiempo de vida de la caché en segundos
        """
        self.db_connection = None
        self._cache = {}
        self._cache_timestamps = {}
        self.cache_ttl = cache_ttl
    
    def _get_db_connection(self):
        """
        Obtiene una conexión a la base de datos
        
        Returns:
            connection: Conexión a la base de datos PostgreSQL
        """
        if not self.db_connection or self.db_connection.closed:
            database_url = os.environ.get('DATABASE_URL')
            if not database_url:
                raise ValueError("No se ha configurado DATABASE_URL en el entorno")
                
            self.db_connection = psycopg2.connect(database_url)
            
        return self.db_connection
    
    def _close_db_connection(self):
        """Cierra la conexión a la base de datos"""
        if self.db_connection and not self.db_connection.closed:
            self.db_connection.close()
            self.db_connection = None
    
    def _get_from_cache(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene un valor de la caché si existe y no ha expirado
        
        Args:
            key: Clave de la caché
            
        Returns:
            Dict[str, Any] o None: Valor de la caché o None si no existe o ha expirado
        """
        if key not in self._cache:
            return None
            
        timestamp = self._cache_timestamps.get(key, 0)
        if time.time() - timestamp > self.cache_ttl:
            # La caché ha expirado
            self._cache.pop(key, None)
            self._cache_timestamps.pop(key, None)
            return None
            
        return self._cache[key]
    
    def _set_in_cache(self, key: str, value: Dict[str, Any]):
        """
        Almacena un valor en la caché
        
        Args:
            key: Clave de la caché
            value: Valor a almacenar
        """
        self._cache[key] = value
        self._cache_timestamps[key] = time.time()
    
    def get_template(self, template_type: str, subtype: Optional[str] = None, 
                    variant: str = 'standard', channel: str = 'email', 
                    language: str = 'es', is_default: bool = True) -> Optional[Dict[str, Any]]:
        """
        Obtiene una plantilla según los criterios especificados
        
        Args:
            template_type: Tipo de plantilla (notificacion, respuesta_daemon, etc.)
            subtype: Subtipo de plantilla (detallado, resumido_emisor, etc.)
            variant: Variante de la plantilla (standard, marketing, etc.)
            channel: Canal de comunicación (email, whatsapp, telegram)
            language: Idioma de la plantilla (es, en, etc.)
            is_default: Si se debe obtener la plantilla predeterminada
            
        Returns:
            Dict[str, Any] o None: Plantilla encontrada o None si no existe
        """
        # Generar clave para la caché
        cache_key = f"template:{template_type}:{subtype}:{variant}:{channel}:{language}:{is_default}"
        
        # Verificar si está en caché
        cached = self._get_from_cache(cache_key)
        if cached:
            logger.debug(f"Plantilla obtenida de caché: {cache_key}")
            return cached
        
        logger.debug(f"Buscando plantilla: {template_type}, {subtype}, {variant}, {channel}, {language}, {is_default}")
        
        try:
            conn = self._get_db_connection()
            with conn.cursor(cursor_factory=DictCursor) as cursor:
                query = """
                    SELECT *
                    FROM plantillas_email
                    WHERE tipo = %s
                    AND (subtipo = %s OR %s IS NULL)
                    AND variante = %s
                    AND canal = %s
                    AND idioma = %s
                    AND es_predeterminada = %s
                    AND estado = 'activo'
                    LIMIT 1
                """
                
                cursor.execute(query, (
                    template_type, 
                    subtype, 
                    subtype,  # Parámetro repetido para la condición NULL
                    variant, 
                    channel, 
                    language, 
                    is_default
                ))
                
                result = cursor.fetchone()
                
                if result:
                    template = dict(result)
                    # Almacenar en caché
                    self._set_in_cache(cache_key, template)
                    return template
                else:
                    logger.debug(f"No se encontró plantilla para: {template_type}, {subtype}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error al obtener plantilla: {e}")
            return None
            
        finally:
            # Mantenemos la conexión abierta
            pass
    
    def get_template_for_subscriber(self, subscriber_id: int, template_type: str, 
                                  subtype: Optional[str] = None, variant: str = 'standard', 
                                  channel: str = 'email', language: str = 'es') -> Optional[Dict[str, Any]]:
        """
        Obtiene una plantilla asignada a un suscriptor específico
        
        Args:
            subscriber_id: ID del suscriptor
            template_type: Tipo de plantilla
            subtype: Subtipo de plantilla
            variant: Variante de la plantilla
            channel: Canal de comunicación
            language: Idioma de la plantilla
            
        Returns:
            Dict[str, Any] o None: Plantilla asignada al suscriptor o None si no existe
        """
        # Generar clave para la caché
        cache_key = f"subscriber:{subscriber_id}:{template_type}:{subtype}:{variant}:{channel}:{language}"
        
        # Verificar si está en caché
        cached = self._get_from_cache(cache_key)
        if cached:
            logger.debug(f"Plantilla de suscriptor obtenida de caché: {cache_key}")
            return cached
        
        logger.debug(f"Buscando plantilla para suscriptor {subscriber_id}: {template_type}, {subtype}")
        
        try:
            conn = self._get_db_connection()
            with conn.cursor(cursor_factory=DictCursor) as cursor:
                # Primero verificamos si el suscriptor tiene una plantilla asignada
                cursor.execute("""
                    SELECT plantilla_id 
                    FROM suscripciones 
                    WHERE id = %s
                """, (subscriber_id,))
                
                row = cursor.fetchone()
                if not row or not row[0]:
                    # El suscriptor no tiene plantilla asignada
                    logger.debug(f"El suscriptor {subscriber_id} no tiene plantilla asignada")
                    return None
                
                plantilla_id = row[0]
                
                # Obtenemos la plantilla asignada
                cursor.execute("""
                    SELECT *
                    FROM plantillas_email
                    WHERE id = %s
                    AND tipo = %s
                    AND (subtipo = %s OR %s IS NULL)
                    AND variante = %s
                    AND canal = %s
                    AND idioma = %s
                    AND estado = 'activo'
                """, (
                    plantilla_id,
                    template_type, 
                    subtype, 
                    subtype,  # Parámetro repetido para la condición NULL
                    variant, 
                    channel, 
                    language
                ))
                
                result = cursor.fetchone()
                
                if result:
                    template = dict(result)
                    # Almacenar en caché
                    self._set_in_cache(cache_key, template)
                    return template
                else:
                    logger.debug(f"No se encontró plantilla asignada para suscriptor {subscriber_id}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error al obtener plantilla de suscriptor: {e}")
            return None
            
        finally:
            # Mantenemos la conexión abierta
            pass
    
    def save_template(self, template_data: Dict[str, Any]) -> Optional[int]:
        """
        Guarda una nueva plantilla
        
        Args:
            template_data: Datos de la plantilla a guardar
            
        Returns:
            int o None: ID de la plantilla guardada o None en caso de error
        """
        logger.info(f"Guardando nueva plantilla: {template_data.get('nombre')}")
        
        conn = None
        try:
            conn = self._get_db_connection()
            
            # Si es predeterminada, verificar que no haya otra predeterminada con las mismas características
            if template_data.get('es_predeterminada', False):
                with conn.cursor() as cursor:
                    cursor.execute("""
                        UPDATE plantillas_email
                        SET es_predeterminada = FALSE
                        WHERE tipo = %s
                        AND (subtipo = %s OR (%s IS NULL AND subtipo IS NULL))
                        AND variante = %s
                        AND canal = %s
                        AND idioma = %s
                        AND es_predeterminada = TRUE
                    """, (
                        template_data.get('tipo'),
                        template_data.get('subtipo'),
                        template_data.get('subtipo'),
                        template_data.get('variante', 'standard'),
                        template_data.get('canal', 'email'),
                        template_data.get('idioma', 'es')
                    ))
            
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO plantillas_email (
                        nombre, descripcion, tipo, subtipo, variante, 
                        canal, idioma, asunto, contenido_html, contenido_texto, 
                        es_predeterminada, creador_id, estado
                    ) VALUES (
                        %s, %s, %s, %s, %s, 
                        %s, %s, %s, %s, %s, 
                        %s, %s, %s
                    ) RETURNING id
                """, (
                    template_data.get('nombre'),
                    template_data.get('descripcion', ''),
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
                    'activo'
                ))
                
                result = cursor.fetchone()
                template_id = result[0]
                
                conn.commit()
                
                # Limpiar caché relacionada
                self._clear_cache_by_keys(
                    template_data.get('tipo'),
                    template_data.get('subtipo'),
                    template_data.get('variante', 'standard'),
                    template_data.get('canal', 'email'),
                    template_data.get('idioma', 'es')
                )
                
                logger.info(f"Plantilla guardada con ID: {template_id}")
                return template_id
                
        except Exception as e:
            logger.error(f"Error al guardar plantilla: {e}")
            try:
                if conn and not conn.closed:
                    conn.rollback()
            except:
                pass
            return None
            
        finally:
            # Mantenemos la conexión abierta
            pass
    
    def update_template(self, template_id: int, template_data: Dict[str, Any]) -> bool:
        """
        Actualiza una plantilla existente
        
        Args:
            template_id: ID de la plantilla a actualizar
            template_data: Datos actualizados de la plantilla
            
        Returns:
            bool: True si la actualización fue exitosa, False en caso contrario
        """
        logger.info(f"Actualizando plantilla con ID {template_id}: {template_data.get('nombre')}")
        
        try:
            conn = self._get_db_connection()
            
            # Si es predeterminada, verificar que no haya otra predeterminada con las mismas características
            if template_data.get('es_predeterminada', False):
                with conn.cursor() as cursor:
                    cursor.execute("""
                        UPDATE plantillas_email
                        SET es_predeterminada = FALSE
                        WHERE tipo = %s
                        AND (subtipo = %s OR (%s IS NULL AND subtipo IS NULL))
                        AND variante = %s
                        AND canal = %s
                        AND idioma = %s
                        AND es_predeterminada = TRUE
                        AND id != %s
                    """, (
                        template_data.get('tipo'),
                        template_data.get('subtipo'),
                        template_data.get('subtipo'),
                        template_data.get('variante', 'standard'),
                        template_data.get('canal', 'email'),
                        template_data.get('idioma', 'es'),
                        template_id
                    ))
            
            # Actualizar la versión y fecha de modificación
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE plantillas_email
                    SET nombre = %s,
                        descripcion = %s,
                        tipo = %s,
                        subtipo = %s,
                        variante = %s,
                        canal = %s,
                        idioma = %s,
                        asunto = %s,
                        contenido_html = %s,
                        contenido_texto = %s,
                        es_predeterminada = %s,
                        fecha_modificacion = CURRENT_TIMESTAMP,
                        version = version + 1
                    WHERE id = %s
                """, (
                    template_data.get('nombre'),
                    template_data.get('descripcion', ''),
                    template_data.get('tipo'),
                    template_data.get('subtipo'),
                    template_data.get('variante', 'standard'),
                    template_data.get('canal', 'email'),
                    template_data.get('idioma', 'es'),
                    template_data.get('asunto', ''),
                    template_data.get('contenido_html', ''),
                    template_data.get('contenido_texto', ''),
                    template_data.get('es_predeterminada', False),
                    template_id
                ))
                
                affected_rows = cursor.rowcount
                conn.commit()
                
                # Limpiar caché relacionada
                self._clear_cache_by_keys(
                    template_data.get('tipo'),
                    template_data.get('subtipo'),
                    template_data.get('variante', 'standard'),
                    template_data.get('canal', 'email'),
                    template_data.get('idioma', 'es')
                )
                
                # Limpiar caché específica
                self._clear_template_cache(template_id)
                
                logger.info(f"Plantilla actualizada: {affected_rows} filas afectadas")
                return affected_rows > 0
                
        except Exception as e:
            logger.error(f"Error al actualizar plantilla: {e}")
            try:
                if conn and not conn.closed:
                    conn.rollback()
            except:
                pass
            return False
            
        finally:
            # Mantenemos la conexión abierta
            pass
    
    def delete_template(self, template_id: int) -> bool:
        """
        Elimina una plantilla (marca como inactiva)
        
        Args:
            template_id: ID de la plantilla a eliminar
            
        Returns:
            bool: True si la eliminación fue exitosa, False en caso contrario
        """
        logger.info(f"Eliminando plantilla con ID {template_id}")
        
        try:
            conn = self._get_db_connection()
            
            # Primero obtenemos la plantilla para poder limpiar la caché después
            with conn.cursor(cursor_factory=DictCursor) as cursor:
                cursor.execute("SELECT * FROM plantillas_email WHERE id = %s", (template_id,))
                template = cursor.fetchone()
                
                if not template:
                    logger.warning(f"No se encontró plantilla con ID {template_id}")
                    return False
                
                # Marcamos la plantilla como inactiva en lugar de eliminarla
                cursor.execute("""
                    UPDATE plantillas_email
                    SET estado = 'inactivo', fecha_modificacion = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (template_id,))
                
                affected_rows = cursor.rowcount
                conn.commit()
                
                if affected_rows > 0:
                    # Limpiar caché relacionada
                    template_dict = dict(template)
                    self._clear_cache_by_keys(
                        template_dict.get('tipo'),
                        template_dict.get('subtipo'),
                        template_dict.get('variante'),
                        template_dict.get('canal'),
                        template_dict.get('idioma')
                    )
                    
                    # Limpiar caché específica
                    self._clear_template_cache(template_id)
                    
                    logger.info(f"Plantilla eliminada (marcada como inactiva)")
                    return True
                else:
                    return False
                
        except Exception as e:
            logger.error(f"Error al eliminar plantilla: {e}")
            try:
                if conn and not conn.closed:
                    conn.rollback()
            except:
                pass
            return False
            
        finally:
            # Mantenemos la conexión abierta
            pass
    
    def assign_template_to_subscriber(self, subscriber_id: int, template_id: int) -> bool:
        """
        Asigna una plantilla a un suscriptor
        
        Args:
            subscriber_id: ID del suscriptor
            template_id: ID de la plantilla
            
        Returns:
            bool: True si la asignación fue exitosa, False en caso contrario
        """
        logger.debug(f"Asignando plantilla {template_id} a suscriptor {subscriber_id}")
        
        try:
            conn = self._get_db_connection()
            with conn.cursor() as cursor:
                # Actualizar la asignación de plantilla
                cursor.execute("""
                    UPDATE suscripciones
                    SET plantilla_id = %s
                    WHERE id = %s
                """, (template_id, subscriber_id))
                
                affected_rows = cursor.rowcount
                conn.commit()
                
                # Limpiar caché para este suscriptor
                self._clear_subscriber_cache(subscriber_id)
                
                return True
                
        except Exception as e:
            logger.error(f"Error al asignar plantilla: {e}")
            # Asegurar que conn existe antes de intentar rollback
            try:
                if conn and not conn.closed:
                    conn.rollback()
            except:
                pass
            return False
            
        finally:
            # Mantenemos la conexión abierta
            pass
    
    def remove_template_assignment(self, subscriber_id: int) -> bool:
        """
        Elimina la asignación de plantilla para un suscriptor
        
        Args:
            subscriber_id: ID del suscriptor
            
        Returns:
            bool: True si la eliminación fue exitosa, False en caso contrario
        """
        logger.debug(f"Eliminando asignación de plantilla para suscriptor {subscriber_id}")
        
        try:
            conn = self._get_db_connection()
            with conn.cursor() as cursor:
                # Actualizar la asignación de plantilla (establecer a NULL)
                cursor.execute("""
                    UPDATE suscripciones
                    SET plantilla_id = NULL
                    WHERE id = %s
                """, (subscriber_id,))
                
                conn.commit()
                
                # Limpiar caché para este suscriptor
                self._clear_subscriber_cache(subscriber_id)
                
                return True
                
        except Exception as e:
            logger.error(f"Error al eliminar asignación de plantilla: {e}")
            # Asegurar que conn existe antes de intentar rollback
            try:
                if conn and not conn.closed:
                    conn.rollback()
            except:
                pass
            return False
            
        finally:
            # Mantenemos la conexión abierta
            pass
    
    def _clear_subscriber_cache(self, subscriber_id: int):
        """
        Limpia la caché para un suscriptor específico
        
        Args:
            subscriber_id: ID del suscriptor
        """
        prefix = f"subscriber:{subscriber_id}:"
        keys_to_remove = [k for k in self._cache.keys() if k.startswith(prefix)]
        
        for key in keys_to_remove:
            self._cache.pop(key, None)
            self._cache_timestamps.pop(key, None)
            
        logger.debug(f"Limpiada caché para suscriptor {subscriber_id}, {len(keys_to_remove)} entradas")
    
    def get_all_templates(self, template_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Obtiene todas las plantillas, opcionalmente filtradas por tipo
        
        Args:
            template_type: Tipo de plantilla para filtrar (opcional)
            
        Returns:
            List[Dict[str, Any]]: Lista de plantillas
        """
        logger.debug(f"Obteniendo todas las plantillas{' de tipo ' + template_type if template_type else ''}")
        
        try:
            conn = self._get_db_connection()
            with conn.cursor(cursor_factory=DictCursor) as cursor:
                if template_type:
                    cursor.execute("""
                        SELECT * FROM plantillas_email
                        WHERE tipo = %s
                        ORDER BY nombre
                    """, (template_type,))
                else:
                    cursor.execute("""
                        SELECT * FROM plantillas_email
                        ORDER BY nombre
                    """)
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            logger.error(f"Error al obtener todas las plantillas: {e}")
            return []
            
        finally:
            # Mantenemos la conexión abierta
            pass
    
    def get_template_by_id(self, template_id: int) -> Optional[Dict[str, Any]]:
        """
        Obtiene una plantilla por su ID
        
        Args:
            template_id: ID de la plantilla
            
        Returns:
            Dict[str, Any] o None: Plantilla encontrada o None si no existe
        """
        logger.debug(f"Obteniendo plantilla con ID {template_id}")
        
        # Generar clave para la caché
        cache_key = f"template_id:{template_id}"
        
        # Verificar si está en caché
        cached = self._get_from_cache(cache_key)
        if cached:
            logger.debug(f"Plantilla obtenida de caché: {cache_key}")
            return cached
        
        try:
            conn = self._get_db_connection()
            with conn.cursor(cursor_factory=DictCursor) as cursor:
                cursor.execute("""
                    SELECT * FROM plantillas_email WHERE id = %s
                """, (template_id,))
                
                row = cursor.fetchone()
                if row:
                    template = dict(row)
                    # Almacenar en caché
                    self._set_in_cache(cache_key, template)
                    return template
                    
                return None
                
        except Exception as e:
            logger.error(f"Error al obtener plantilla por ID: {e}")
            return None
            
        finally:
            # Mantenemos la conexión abierta
            pass
    
    def _clear_template_cache(self, template_id: int):
        """
        Limpia la caché específica de una plantilla
        
        Args:
            template_id: ID de la plantilla
        """
        # Limpiar caché directa por ID
        cache_key = f"template_id:{template_id}"
        if cache_key in self._cache:
            self._cache.pop(cache_key)
            self._cache_timestamps.pop(cache_key, None)
            
        logger.debug(f"Limpiada caché específica para plantilla {template_id}")
    
    def _clear_cache_by_keys(self, tipo: str, subtipo: Optional[str], 
                           variante: str, canal: str, idioma: str):
        """
        Limpia la caché relacionada con ciertas claves
        
        Args:
            tipo: Tipo de plantilla
            subtipo: Subtipo de plantilla
            variante: Variante de la plantilla
            canal: Canal de comunicación
            idioma: Idioma de la plantilla
        """
        # Patrón para caché de plantillas
        pattern = f"template:{tipo}:"
        
        # Encontrar claves que coincidan con el patrón
        keys_to_remove = [k for k in self._cache.keys() if k.startswith(pattern)]
        
        # Eliminar de la caché
        for key in keys_to_remove:
            self._cache.pop(key, None)
            self._cache_timestamps.pop(key, None)
            
        # También limpiar caché de suscriptores relacionados
        # (esto es más agresivo pero asegura consistencia)
        subscriber_pattern = f"subscriber:"
        subscriber_keys_to_remove = [
            k for k in self._cache.keys() 
            if k.startswith(subscriber_pattern) and f":{tipo}:" in k
        ]
        
        for key in subscriber_keys_to_remove:
            self._cache.pop(key, None)
            self._cache_timestamps.pop(key, None)
            
        logger.debug(f"Limpiadas {len(keys_to_remove) + len(subscriber_keys_to_remove)} entradas de caché relacionadas")
    
    def __del__(self):
        """Destructor: cierra la conexión a la base de datos"""
        self._close_db_connection()