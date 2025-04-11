"""
Utilidades para el manejo de plantillas en SAGE

Este módulo proporciona funciones para la gestión y selección
de plantillas, incluyendo personalización por cliente.
"""
import os
import logging
import psycopg2
from psycopg2.extras import DictCursor

# Configurar logging
logger = logging.getLogger(__name__)

def obtener_conexion_db():
    """
    Establece conexión con la base de datos PostgreSQL
    
    Returns:
        connection: Conexión a la base de datos
    """
    try:
        db_url = os.environ.get('DATABASE_URL')
        if not db_url:
            logger.error("No se encontró la variable de entorno DATABASE_URL")
            return None
        
        connection = psycopg2.connect(db_url)
        return connection
    except Exception as e:
        logger.error(f"Error al conectar a la base de datos: {e}")
        return None

def obtener_plantilla(tipo, subtipo, canal='email', idioma='es', cliente_id=None):
    """
    Obtiene la plantilla más adecuada según los criterios.
    
    Args:
        tipo (str): Tipo de notificación
        subtipo (str): Subtipo de notificación
        canal (str): Canal de comunicación (email, telegram, whatsapp)
        idioma (str): Idioma de la plantilla
        cliente_id (int, optional): ID del cliente para personalización
        
    Returns:
        dict: Datos de la plantilla o None si no encuentra
    """
    conn = obtener_conexion_db()
    if not conn:
        logger.error("No se pudo establecer conexión con la base de datos")
        return None
    
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        
        # 1. Si hay cliente_id, intentar buscar una plantilla personalizada
        if cliente_id:
            logger.info(f"Buscando plantilla personalizada para cliente ID {cliente_id}")
            cursor.execute("""
                SELECT p.* FROM plantillas_email p
                JOIN cliente_plantilla cp ON p.id = cp.plantilla_id
                WHERE p.tipo = %s AND p.subtipo = %s 
                AND p.canal = %s AND p.idioma = %s
                AND cp.cliente_id = %s AND cp.activo = true
                ORDER BY p.fecha_modificacion DESC 
                LIMIT 1
            """, (tipo, subtipo, canal, idioma, cliente_id))
            
            plantilla = cursor.fetchone()
            if plantilla:
                logger.info(f"Usando plantilla personalizada ID {plantilla['id']} para cliente {cliente_id}")
                return dict(plantilla)
        
        # 2. Buscar plantilla predeterminada específica
        logger.info(f"Buscando plantilla predeterminada para tipo={tipo}, subtipo={subtipo}")
        cursor.execute("""
            SELECT * FROM plantillas_email 
            WHERE tipo = %s AND subtipo = %s AND canal = %s AND idioma = %s 
            AND es_predeterminada = true
            ORDER BY fecha_modificacion DESC 
            LIMIT 1
        """, (tipo, subtipo, canal, idioma))
        
        plantilla = cursor.fetchone()
        
        # 3. Si no hay predeterminada, buscar cualquiera que cumpla los criterios
        if not plantilla:
            logger.info(f"No se encontró plantilla predeterminada, buscando cualquier plantilla compatible")
            cursor.execute("""
                SELECT * FROM plantillas_email 
                WHERE tipo = %s AND subtipo = %s AND canal = %s AND idioma = %s
                ORDER BY fecha_modificacion DESC 
                LIMIT 1
            """, (tipo, subtipo, canal, idioma))
            plantilla = cursor.fetchone()
        
        if plantilla:
            return dict(plantilla)
        else:
            logger.warning(f"No se encontró ninguna plantilla para tipo={tipo}, subtipo={subtipo}")
            return None
    
    except Exception as e:
        logger.error(f"Error al buscar plantilla: {e}")
        return None
    finally:
        if conn:
            conn.close()

def asignar_plantilla_cliente(cliente_id, plantilla_id, activo=True):
    """
    Asigna una plantilla específica a un cliente
    
    Args:
        cliente_id (int): ID del cliente
        plantilla_id (int): ID de la plantilla
        activo (bool): Estado de la asignación
        
    Returns:
        bool: True si fue exitoso, False en caso contrario
    """
    conn = obtener_conexion_db()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        
        # Verificar si ya existe la asociación
        cursor.execute("""
            SELECT id FROM cliente_plantilla 
            WHERE cliente_id = %s AND plantilla_id = %s
        """, (cliente_id, plantilla_id))
        
        existente = cursor.fetchone()
        
        if existente:
            # Actualizar asociación existente
            cursor.execute("""
                UPDATE cliente_plantilla 
                SET activo = %s, fecha_modificacion = CURRENT_TIMESTAMP
                WHERE cliente_id = %s AND plantilla_id = %s
            """, (activo, cliente_id, plantilla_id))
        else:
            # Crear nueva asociación
            cursor.execute("""
                INSERT INTO cliente_plantilla (cliente_id, plantilla_id, activo)
                VALUES (%s, %s, %s)
            """, (cliente_id, plantilla_id, activo))
        
        conn.commit()
        return True
    
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al asignar plantilla a cliente: {e}")
        return False
    finally:
        if conn:
            conn.close()

def obtener_asignaciones_cliente(cliente_id=None):
    """
    Obtiene las asignaciones de plantillas por cliente
    
    Args:
        cliente_id (int, optional): ID específico del cliente o todos si es None
        
    Returns:
        list: Lista de asignaciones
    """
    conn = obtener_conexion_db()
    if not conn:
        return []
    
    try:
        cursor = conn.cursor(cursor_factory=DictCursor)
        
        if cliente_id:
            cursor.execute("""
                SELECT cp.id, cp.cliente_id, cp.plantilla_id, cp.activo,
                       p.nombre as plantilla_nombre, p.tipo, p.subtipo, p.canal,
                       o.nombre as cliente_nombre
                FROM cliente_plantilla cp
                JOIN plantillas_email p ON cp.plantilla_id = p.id
                JOIN organizaciones o ON cp.cliente_id = o.id
                WHERE cp.cliente_id = %s
                ORDER BY p.tipo, p.subtipo, p.canal
            """, (cliente_id,))
        else:
            cursor.execute("""
                SELECT cp.id, cp.cliente_id, cp.plantilla_id, cp.activo,
                       p.nombre as plantilla_nombre, p.tipo, p.subtipo, p.canal,
                       o.nombre as cliente_nombre
                FROM cliente_plantilla cp
                JOIN plantillas_email p ON cp.plantilla_id = p.id
                JOIN organizaciones o ON cp.cliente_id = o.id
                ORDER BY o.nombre, p.tipo, p.subtipo, p.canal
            """)
        
        return [dict(row) for row in cursor.fetchall()]
    
    except Exception as e:
        logger.error(f"Error al obtener asignaciones de plantillas: {e}")
        return []
    finally:
        if conn:
            conn.close()

def eliminar_asignacion(asignacion_id):
    """
    Elimina una asignación de plantilla a cliente
    
    Args:
        asignacion_id (int): ID de la asignación
        
    Returns:
        bool: True si fue exitoso, False en caso contrario
    """
    conn = obtener_conexion_db()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM cliente_plantilla WHERE id = %s
        """, (asignacion_id,))
        
        conn.commit()
        return cursor.rowcount > 0
    
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al eliminar asignación: {e}")
        return False
    finally:
        if conn:
            conn.close()