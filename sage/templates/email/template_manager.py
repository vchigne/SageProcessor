"""
Gestor de plantillas de email para SAGE

Este módulo proporciona las funcionalidades necesarias para gestionar
las plantillas de email utilizadas en el sistema SAGE.
"""

import logging
import os
import time
from typing import Optional, Dict, Any, Tuple, List, Union
import psycopg2
from psycopg2.extras import DictCursor

logger = logging.getLogger(__name__)

class TemplateManager:
    """
    Gestor de plantillas de email para el sistema SAGE
    
    Esta clase proporciona métodos para:
    - Obtener plantillas por tipo/subtipo
    - Obtener plantillas asignadas a suscriptores específicos
    - Gestionar la caché de plantillas para optimizar rendimiento
    """
    
    def __init__(self, cache_ttl: int = 300):
        """
        Inicializa el gestor de plantillas
        
        Args:
            cache_ttl (int): Tiempo de vida de la caché en segundos (default: 5 minutos)
        """
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_timestamps: Dict[str, float] = {}
        self._cache_ttl = cache_ttl
        self._db_connection = None
        
    def _get_db_connection(self):
        """
        Obtiene una conexión a la base de datos
        
        Returns:
            connection: Conexión a la base de datos PostgreSQL
        """
        if self._db_connection is None or self._db_connection.closed:
            database_url = os.environ.get('DATABASE_URL')
            if not database_url:
                raise ValueError("No se ha configurado DATABASE_URL en el entorno")
                
            self._db_connection = psycopg2.connect(database_url)
            
        return self._db_connection
    
    def _close_db_connection(self):
        """Cierra la conexión a la base de datos si está abierta"""
        if self._db_connection and not self._db_connection.closed:
            self._db_connection.close()
            self._db_connection = None
    
    def _generate_cache_key(self, template_type: str, subtype: str, 
                          variant: str = 'standard', language: str = 'es',
                          channel: str = 'email') -> str:
        """
        Genera una clave única para la caché de plantillas
        
        Args:
            template_type: Tipo de plantilla (ej. 'notificacion', 'respuesta_daemon')
            subtype: Subtipo de plantilla (ej. 'detallado', 'resumido_emisor')
            variant: Variante de plantilla (ej. 'standard', 'marketing')
            language: Idioma de la plantilla (ej. 'es', 'en')
            channel: Canal de comunicación (ej. 'email', 'whatsapp')
            
        Returns:
            str: Clave única para la caché
        """
        return f"{template_type}:{subtype}:{variant}:{language}:{channel}"
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """
        Verifica si la caché para una clave es válida
        
        Args:
            cache_key: Clave de caché a verificar
            
        Returns:
            bool: True si la caché es válida, False en caso contrario
        """
        if cache_key not in self._cache_timestamps:
            return False
            
        timestamp = self._cache_timestamps.get(cache_key, 0)
        current_time = time.time()
        
        return (current_time - timestamp) < self._cache_ttl
    
    def clear_cache(self):
        """Limpia toda la caché de plantillas"""
        self._cache.clear()
        self._cache_timestamps.clear()
        logger.debug("Caché de plantillas limpiada")
    
    def get_template(self, template_type: str, subtype: str, 
                    variant: str = 'standard', language: str = 'es',
                    channel: str = 'email') -> Optional[Dict[str, Any]]:
        """
        Obtiene una plantilla con los parámetros especificados
        
        Args:
            template_type: Tipo de plantilla (ej. 'notificacion', 'respuesta_daemon')
            subtype: Subtipo de plantilla (ej. 'detallado', 'resumido_emisor')
            variant: Variante de plantilla (ej. 'standard', 'marketing')
            language: Idioma de la plantilla (ej. 'es', 'en')
            channel: Canal de comunicación (ej. 'email', 'whatsapp')
            
        Returns:
            Optional[Dict[str, Any]]: Datos de la plantilla, o None si no se encuentra
        """
        cache_key = self._generate_cache_key(template_type, subtype, variant, language, channel)
        
        # Verificar si existe en caché y es válida
        if cache_key in self._cache and self._is_cache_valid(cache_key):
            logger.debug(f"Usando plantilla desde caché: {cache_key}")
            return self._cache[cache_key]
        
        logger.debug(f"Buscando plantilla en base de datos: {cache_key}")
        
        try:
            conn = self._get_db_connection()
            with conn.cursor(cursor_factory=DictCursor) as cursor:
                # Primero intentar obtener la plantilla predeterminada para los criterios especificados
                cursor.execute("""
                    SELECT * FROM plantillas_email
                    WHERE tipo = %s AND subtipo = %s AND variante = %s 
                          AND idioma = %s AND canal = %s AND es_predeterminada = TRUE
                """, (template_type, subtype, variant, language, channel))
                
                row = cursor.fetchone()
                
                # Si no se encuentra una predeterminada, intentar obtener cualquier plantilla que coincida
                if not row:
                    cursor.execute("""
                        SELECT * FROM plantillas_email
                        WHERE tipo = %s AND subtipo = %s AND variante = %s 
                              AND idioma = %s AND canal = %s
                        LIMIT 1
                    """, (template_type, subtype, variant, language, channel))
                    
                    row = cursor.fetchone()
                
                if row:
                    # Convertir a diccionario para caché y retorno
                    template_data = dict(row)
                    self._cache[cache_key] = template_data
                    self._cache_timestamps[cache_key] = time.time()
                    return template_data
                    
                logger.warning(f"No se encontró plantilla para: {cache_key}")
                return None
                
        except Exception as e:
            logger.error(f"Error al obtener plantilla: {e}")
            return None
            
        finally:
            # Mantener la conexión abierta para futuras consultas
            pass
    
    def get_template_for_subscriber(self, subscriber_id: int, template_type: str, 
                                   subtype: str, variant: str = 'standard',
                                   language: str = 'es', channel: str = 'email') -> Optional[Dict[str, Any]]:
        """
        Obtiene la plantilla asignada a un suscriptor específico,
        o la plantilla predeterminada si no tiene una asignada
        
        Args:
            subscriber_id: ID del suscriptor
            template_type: Tipo de plantilla
            subtype: Subtipo de plantilla
            variant: Variante de plantilla (default: 'standard')
            language: Idioma de la plantilla (default: 'es')
            channel: Canal de comunicación (default: 'email')
            
        Returns:
            Optional[Dict[str, Any]]: Datos de la plantilla, o None si no se encuentra
        """
        cache_key = f"subscriber:{subscriber_id}:{template_type}:{subtype}:{variant}:{language}:{channel}"
        
        # Verificar si existe en caché y es válida
        if cache_key in self._cache and self._is_cache_valid(cache_key):
            logger.debug(f"Usando plantilla de suscriptor desde caché: {cache_key}")
            return self._cache[cache_key]
        
        logger.debug(f"Buscando plantilla para suscriptor {subscriber_id}")
        
        try:
            conn = self._get_db_connection()
            with conn.cursor(cursor_factory=DictCursor) as cursor:
                # Buscar si el suscriptor tiene una plantilla asignada
                cursor.execute("""
                    SELECT p.*
                    FROM plantillas_email p
                    JOIN suscripciones s ON p.id = s.plantilla_id
                    WHERE s.id = %s AND p.tipo = %s AND p.subtipo = %s
                """, (subscriber_id, template_type, subtype))
                
                row = cursor.fetchone()
                
                # Si el suscriptor tiene una plantilla asignada, usarla
                if row:
                    template_data = dict(row)
                    self._cache[cache_key] = template_data
                    self._cache_timestamps[cache_key] = time.time()
                    return template_data
                
                # Si no tiene plantilla asignada, usar la predeterminada
                logger.debug(f"No se encontró plantilla asignada para suscriptor {subscriber_id}, "
                            f"usando plantilla predeterminada")
                
                return self.get_template(template_type, subtype, variant, language, channel)
                
        except Exception as e:
            logger.error(f"Error al obtener plantilla para suscriptor: {e}")
            return None
            
        finally:
            # Mantener la conexión abierta para futuras consultas
            pass
    
    def assign_template_to_subscriber(self, subscriber_id: int, template_id: int) -> bool:
        """
        Asigna una plantilla a un suscriptor específico
        
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
                # Verificar que la plantilla existe
                cursor.execute("SELECT id FROM plantillas_email WHERE id = %s", (template_id,))
                if cursor.fetchone() is None:
                    logger.error(f"No se encontró la plantilla con ID {template_id}")
                    return False
                
                # Verificar que el suscriptor existe
                cursor.execute("SELECT id FROM suscripciones WHERE id = %s", (subscriber_id,))
                if cursor.fetchone() is None:
                    logger.error(f"No se encontró el suscriptor con ID {subscriber_id}")
                    return False
                
                # Actualizar la asignación de plantilla
                cursor.execute("""
                    UPDATE suscripciones
                    SET plantilla_id = %s
                    WHERE id = %s
                """, (template_id, subscriber_id))
                
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
    
    def __del__(self):
        """Destructor: cierra la conexión a la base de datos"""
        self._close_db_connection()