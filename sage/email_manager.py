"""
Módulo para gestión centralizada de configuraciones de email
"""

import os
import json
import logging
import smtplib
import imaplib
import poplib
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, List, Optional, Any, Union
from datetime import datetime

logger = logging.getLogger(__name__)

class EmailManager:
    """Gestor centralizado de configuraciones de email"""
    
    def __init__(self, db_connection=None):
        """Inicializa el gestor de email
        
        Args:
            db_connection: Conexión a la base de datos (opcional)
        """
        self.db_connection = db_connection
    
    def _get_db_connection(self):
        """Obtiene conexión a la base de datos"""
        if self.db_connection is None:
            conn_string = os.environ.get('DATABASE_URL')
            if not conn_string:
                logger.error("No se ha configurado DATABASE_URL")
                raise ValueError("No se ha configurado DATABASE_URL")
            
            self.db_connection = psycopg2.connect(conn_string)
        
        return self.db_connection
    
    def obtener_configuraciones(self, filtros: Optional[Dict] = None) -> List[Dict]:
        """Obtiene configuraciones de email según filtros
        
        Args:
            filtros: Diccionario con filtros (proposito, estado, casilla_id, etc.)
            
        Returns:
            Lista de configuraciones
        """
        conn = self._get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                ec.id, ec.nombre, ec.direccion, ec.proposito, 
                ec.servidor_entrada, ec.puerto_entrada, ec.protocolo_entrada, ec.usar_ssl_entrada,
                ec.servidor_salida, ec.puerto_salida, ec.usar_tls_salida,
                ec.usuario, ec.casilla_id, ec.estado, ec.ultimo_chequeo, ec.mensaje_error,
                ec.fecha_creacion, ec.fecha_modificacion,
                cr.nombre_yaml as casilla_nombre
            FROM email_configuraciones ec
            LEFT JOIN casillas cr ON ec.casilla_id = cr.id
            WHERE 1=1
        """
        
        params = []
        
        if filtros:
            for key, value in filtros.items():
                if value is not None:
                    query += f" AND ec.{key} = %s"
                    params.append(value)
        
        query += " ORDER BY ec.nombre ASC"
        
        try:
            cursor.execute(query, params)
            return cursor.fetchall()
        except Exception as e:
            logger.error(f"Error al obtener configuraciones: {e}")
            return []
        finally:
            cursor.close()
    
    def obtener_configuracion(self, config_id: int) -> Optional[Dict]:
        """Obtiene una configuración específica por ID
        
        Args:
            config_id: ID de la configuración
            
        Returns:
            Configuración o None si no se encuentra
        """
        conn = self._get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT 
                    ec.id, ec.nombre, ec.direccion, ec.proposito, 
                    ec.servidor_entrada, ec.puerto_entrada, ec.protocolo_entrada, ec.usar_ssl_entrada,
                    ec.servidor_salida, ec.puerto_salida, ec.usar_tls_salida,
                    ec.usuario, ec.casilla_id, ec.estado, ec.ultimo_chequeo, ec.mensaje_error,
                    ec.fecha_creacion, ec.fecha_modificacion,
                    cr.nombre_yaml as casilla_nombre
                FROM email_configuraciones ec
                LEFT JOIN casillas cr ON ec.casilla_id = cr.id
                WHERE ec.id = %s
            """, (config_id,))
            
            return cursor.fetchone()
        except Exception as e:
            logger.error(f"Error al obtener configuración {config_id}: {e}")
            return None
        finally:
            cursor.close()
    
    def obtener_por_direccion(self, direccion: str) -> Optional[Dict]:
        """Obtiene una configuración por dirección de email
        
        Args:
            direccion: Dirección de email
            
        Returns:
            Configuración o None si no se encuentra
        """
        configs = self.obtener_configuraciones({'direccion': direccion})
        return configs[0] if configs else None
    
    def obtener_por_casilla(self, casilla_id: int) -> Optional[Dict]:
        """Obtiene una configuración por ID de casilla
        
        Args:
            casilla_id: ID de la casilla
            
        Returns:
            Configuración o None si no se encuentra
        """
        configs = self.obtener_configuraciones({'casilla_id': casilla_id})
        return configs[0] if configs else None
    
    def crear_configuracion(self, datos: Dict) -> Optional[int]:
        """Crea una nueva configuración de email
        
        Args:
            datos: Datos de la configuración
            
        Returns:
            ID de la configuración creada o None si hubo error
        """
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO email_configuraciones (
                    nombre, direccion, proposito, 
                    servidor_entrada, puerto_entrada, protocolo_entrada, usar_ssl_entrada,
                    servidor_salida, puerto_salida, usar_tls_salida,
                    usuario, password, casilla_id, estado
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                datos.get('nombre'),
                datos.get('direccion'),
                datos.get('proposito'),
                datos.get('servidor_entrada'),
                datos.get('puerto_entrada'),
                datos.get('protocolo_entrada'),
                datos.get('usar_ssl_entrada', True),
                datos.get('servidor_salida'),
                datos.get('puerto_salida'),
                datos.get('usar_tls_salida', True),
                datos.get('usuario'),
                datos.get('password'),
                datos.get('casilla_id'),
                datos.get('estado', 'pendiente')
            ))
            
            result = cursor.fetchone()
            conn.commit()
            
            config_id = result[0] if result else None
            logger.info(f"Configuración de email creada: {config_id}")
            return config_id
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error al crear configuración: {e}")
            return None
        finally:
            cursor.close()
    
    def actualizar_configuracion(self, config_id: int, datos: Dict) -> bool:
        """Actualiza una configuración existente
        
        Args:
            config_id: ID de la configuración
            datos: Datos a actualizar
            
        Returns:
            True si se actualizó correctamente, False en caso contrario
        """
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        # Construir query dinámicamente según los campos a actualizar
        set_clauses = []
        params = []
        
        for key, value in datos.items():
            if key != 'id' and key != 'casilla_nombre':  # No actualizar el ID ni campos calculados
                set_clauses.append(f"{key} = %s")
                params.append(value)
        
        if not set_clauses:
            return True  # Nada que actualizar
        
        # Añadir fecha de modificación
        set_clauses.append("fecha_modificacion = %s")
        params.append(datetime.now())
        
        # Añadir ID para WHERE
        params.append(config_id)
        
        query = f"""
            UPDATE email_configuraciones
            SET {', '.join(set_clauses)}
            WHERE id = %s
        """
        
        try:
            cursor.execute(query, params)
            conn.commit()
            logger.info(f"Configuración de email actualizada: {config_id}")
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            logger.error(f"Error al actualizar configuración {config_id}: {e}")
            return False
        finally:
            cursor.close()
    
    def eliminar_configuracion(self, config_id: int) -> bool:
        """Elimina una configuración
        
        Args:
            config_id: ID de la configuración
            
        Returns:
            True si se eliminó correctamente, False en caso contrario
        """
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("DELETE FROM email_configuraciones WHERE id = %s", (config_id,))
            conn.commit()
            logger.info(f"Configuración de email eliminada: {config_id}")
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            logger.error(f"Error al eliminar configuración {config_id}: {e}")
            return False
        finally:
            cursor.close()
    
    def verificar_configuracion(self, config_id: int) -> bool:
        """Verifica la conectividad de una configuración
        
        Args:
            config_id: ID de la configuración
            
        Returns:
            True si la configuración es válida, False en caso contrario
        """
        config = self.obtener_configuracion(config_id)
        if not config:
            return False
        
        try:
            # Verificar según el propósito
            if config['proposito'] in ['recepcion', 'admin', 'multiple']:
                # Verificar servidor de entrada
                if config['protocolo_entrada'] == 'imap':
                    self._verificar_imap(config)
                elif config['protocolo_entrada'] == 'pop3':
                    self._verificar_pop3(config)
            
            if config['proposito'] in ['envio', 'admin', 'multiple']:
                # Verificar servidor de salida
                self._verificar_smtp(config)
            
            # Actualizar estado a activo
            self.actualizar_configuracion(config_id, {
                'estado': 'activo',
                'ultimo_chequeo': datetime.now(),
                'mensaje_error': None
            })
            
            return True
            
        except Exception as e:
            # Actualizar estado a error
            self.actualizar_configuracion(config_id, {
                'estado': 'error',
                'ultimo_chequeo': datetime.now(),
                'mensaje_error': str(e)
            })
            
            return False
    
    def _verificar_imap(self, config: Dict) -> None:
        """Verifica conexión IMAP"""
        try:
            if config['usar_ssl_entrada']:
                mail = imaplib.IMAP4_SSL(config['servidor_entrada'], config['puerto_entrada'])
            else:
                mail = imaplib.IMAP4(config['servidor_entrada'], config['puerto_entrada'])
            
            mail.login(config['usuario'], config['password'])
            mail.select('INBOX')
            mail.close()
            mail.logout()
            
        except Exception as e:
            raise Exception(f"Error de conexión IMAP: {str(e)}")
    
    def _verificar_pop3(self, config: Dict) -> None:
        """Verifica conexión POP3"""
        try:
            if config['usar_ssl_entrada']:
                pop = poplib.POP3_SSL(config['servidor_entrada'], config['puerto_entrada'])
            else:
                pop = poplib.POP3(config['servidor_entrada'], config['puerto_entrada'])
            
            pop.user(config['usuario'])
            pop.pass_(config['password'])
            pop.quit()
            
        except Exception as e:
            raise Exception(f"Error de conexión POP3: {str(e)}")
    
    def _verificar_smtp(self, config: Dict) -> None:
        """Verifica conexión SMTP"""
        try:
            if config.get('usar_tls_salida'):
                server = smtplib.SMTP(config['servidor_salida'], config['puerto_salida'])
                server.starttls()
            else:
                server = smtplib.SMTP(config['servidor_salida'], config['puerto_salida'])
                
            server.login(config['usuario'], config['password'])
            server.quit()
            
        except Exception as e:
            raise Exception(f"Error de conexión SMTP: {str(e)}")
    
    def obtener_configuraciones_pendientes(self) -> List[Dict]:
        """Obtiene configuraciones pendientes de verificación
        
        Returns:
            Lista de configuraciones pendientes
        """
        return self.obtener_configuraciones({'estado': 'pendiente'})
    
    def obtener_configuraciones_con_error(self) -> List[Dict]:
        """Obtiene configuraciones con error
        
        Returns:
            Lista de configuraciones con error
        """
        return self.obtener_configuraciones({'estado': 'error'})
    
    def obtener_configuraciones_sin_uso(self) -> List[Dict]:
        """Obtiene configuraciones sin uso
        
        Returns:
            Lista de configuraciones sin uso
        """
        return self.obtener_configuraciones({'estado': 'sin_uso'})
    
    def obtener_configuracion_admin(self) -> Optional[Dict]:
        """Obtiene una configuración administrativa activa para envío
        
        Returns:
            Configuración administrativa o None si no se encuentra
        """
        conn = self._get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT *
                FROM email_configuraciones
                WHERE proposito IN ('admin', 'envio', 'multiple')
                AND estado = 'activo'
                AND servidor_salida IS NOT NULL
                ORDER BY 
                    proposito = 'admin' DESC,
                    fecha_modificacion DESC
                LIMIT 1
            """)
            
            return cursor.fetchone()
        except Exception as e:
            logger.error(f"Error al obtener configuración administrativa: {e}")
            return None
        finally:
            cursor.close()
    
    def obtener_smtp_config(self) -> Dict[str, Union[str, int]]:
        """Obtiene la configuración SMTP para envío de correos
        
        Returns:
            Diccionario con configuración SMTP
        """
        # Intentar obtener configuración de la base de datos
        config = self.obtener_configuracion_admin()
        
        if config:
            return {
                'server': config['servidor_salida'],
                'port': config['puerto_salida'],
                'username': config['usuario'],
                'password': config['password'],
                'use_tls': config['usar_tls_salida'],
                'from_email': config['direccion'],
                'from_name': 'Sistema SAGE'
            }
        
        # Fallback a configuración por variables de entorno
        return {
            'server': os.environ.get('SMTP_SERVER', 'smtp.gmail.com'),
            'port': int(os.environ.get('SMTP_PORT', 587)),
            'username': os.environ.get('SMTP_USERNAME', ''),
            'password': os.environ.get('SMTP_PASSWORD', ''),
            'use_tls': os.environ.get('SMTP_USE_TLS', 'true').lower() == 'true',
            'from_email': os.environ.get('SMTP_FROM_EMAIL', 'notificaciones@sage.com'),
            'from_name': os.environ.get('SMTP_FROM_NAME', 'Sistema SAGE')
        }
    
    def contar_configuraciones_por_estado(self) -> Dict[str, int]:
        """Cuenta las configuraciones agrupadas por estado
        
        Returns:
            Diccionario con contadores por estado
        """
        conn = self._get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT 
                    estado, 
                    COUNT(*) as total
                FROM email_configuraciones
                GROUP BY estado
            """)
            
            result = cursor.fetchall()
            
            # Crear objeto con contadores
            contadores = {
                'total': 0,
                'pendientes': 0,
                'activas': 0,
                'error': 0,
                'sin_uso': 0
            }
            
            # Rellenar contadores con resultados
            for row in result:
                contadores['total'] += row['total']
                
                if row['estado'] == 'pendiente':
                    contadores['pendientes'] = row['total']
                elif row['estado'] == 'activo':
                    contadores['activas'] = row['total']
                elif row['estado'] == 'error':
                    contadores['error'] = row['total']
                elif row['estado'] == 'sin_uso':
                    contadores['sin_uso'] = row['total']
            
            return contadores
            
        except Exception as e:
            logger.error(f"Error al contar configuraciones: {e}")
            return {'total': 0, 'pendientes': 0, 'activas': 0, 'error': 0, 'sin_uso': 0}
        finally:
            cursor.close()
    
    def sincronizar_casillas(self) -> Dict[str, int]:
        """Sincroniza las configuraciones con las casillas existentes
        
        Returns:
            Diccionario con estadísticas de sincronización
        """
        stats = {'creadas': 0, 'actualizadas': 0, 'sin_uso': 0}
        conn = self._get_db_connection()
        
        try:
            with conn.cursor() as cursor:
                # 1. Insertar configuraciones para casillas que no las tengan
                cursor.execute("""
                    INSERT INTO email_configuraciones (
                        nombre, 
                        direccion, 
                        proposito,
                        casilla_id,
                        estado,
                        fecha_creacion,
                        fecha_modificacion
                    )
                    SELECT
                        'Casilla: ' || cr.nombre_yaml,
                        cr.email_casilla,
                        'recepcion',
                        cr.id,
                        'pendiente',
                        NOW(),
                        NOW()
                    FROM 
                        casillas cr
                    WHERE 
                        cr.email_casilla IS NOT NULL 
                        AND cr.email_casilla != ''
                        AND NOT EXISTS (
                            SELECT 1 
                            FROM email_configuraciones 
                            WHERE direccion = cr.email_casilla
                        )
                    RETURNING id
                """)
                
                stats['creadas'] = len(cursor.fetchall())
                
                # 2. Actualizar configuraciones huérfanas (sin casilla asociada)
                cursor.execute("""
                    UPDATE email_configuraciones
                    SET 
                        estado = 'sin_uso',
                        fecha_modificacion = NOW()
                    WHERE 
                        proposito = 'recepcion'
                        AND casilla_id IS NOT NULL
                        AND NOT EXISTS (
                            SELECT 1 
                            FROM casillas 
                            WHERE id = email_configuraciones.casilla_id
                        )
                    RETURNING id
                """)
                
                stats['sin_uso'] = len(cursor.fetchall())
                
            conn.commit()
            return stats
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error al sincronizar casillas: {e}")
            return {'creadas': 0, 'actualizadas': 0, 'sin_uso': 0}