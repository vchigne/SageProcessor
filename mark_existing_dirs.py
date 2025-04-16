#!/usr/bin/env python3
"""
Script para marcar las ejecuciones con directorios existentes como migradas a la nube.
"""

import os
import sys
import json
import logging
import psycopg2
from datetime import datetime, timedelta
import shutil

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger('mark_existing_dirs')

# Directorio base de ejecuciones
EXECUTIONS_DIR = 'executions'

def get_database_connection():
    """Obtener conexión a la base de datos"""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        logger.error("No se encontró la variable de entorno DATABASE_URL")
        sys.exit(1)
        
    try:
        conn = psycopg2.connect(db_url)
        logger.info("Conexión a la base de datos establecida correctamente")
        return conn
    except Exception as e:
        logger.error(f"Error conectando a la base de datos: {e}")
        sys.exit(1)

def get_cloud_provider_info(conn):
    """Obtener información de los proveedores de nube"""
    cloud_providers = {}
    
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM cloud_providers")
            providers = cursor.fetchall()
            
            for provider in providers:
                cloud_providers[provider[0]] = {
                    'id': provider[0],
                    'nombre': provider[1],
                    'tipo': provider[2],
                    'config': provider[3],
                    'credentials': provider[4]
                }
                
        logger.info(f"Se cargaron {len(cloud_providers)} proveedores de nube")
        return cloud_providers
    except Exception as e:
        logger.error(f"Error obteniendo proveedores de nube: {e}")
        return {}

def get_execution_config(conn):
    """Obtener la configuración de ejecuciones"""
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM ejecuciones_config LIMIT 1")
            config = cursor.fetchone()
            
            if not config:
                logger.error("No se encontró configuración de ejecuciones")
                return None
                
            config_dict = {
                'id': config[0],
                'nube_primaria_id': config[1],
                'nubes_alternativas': config[2],
                'tiempo_retencion_local': config[3],
                'prefijo_ruta_nube': config[4],
                'migrar_automaticamente': config[5],
                'fecha_creacion': config[6],
                'fecha_actualizacion': config[7]
            }
            
            logger.info(f"Configuración cargada: {config_dict}")
            return config_dict
    except Exception as e:
        logger.error(f"Error obteniendo configuración de ejecuciones: {e}")
        return None

def mark_existing_executions(conn, cloud_providers, config):
    """Marcar las ejecuciones con directorios existentes como migradas"""
    if not os.path.exists(EXECUTIONS_DIR):
        logger.error(f"No se encontró el directorio {EXECUTIONS_DIR}")
        return
        
    dirs = [d for d in os.listdir(EXECUTIONS_DIR) if os.path.isdir(os.path.join(EXECUTIONS_DIR, d))]
    logger.info(f"Se encontraron {len(dirs)} directorios en {EXECUTIONS_DIR}")
    
    # Proveedor primario
    nube_primaria_id = config['nube_primaria_id']
    proveedor_primario = cloud_providers.get(nube_primaria_id)
    
    if not proveedor_primario:
        logger.error(f"No se encontró el proveedor primario con ID {nube_primaria_id}")
        return
        
    # Nubes alternativas
    nubes_alternativas = config['nubes_alternativas']
    
    # Prefijo de ruta
    prefijo = config['prefijo_ruta_nube'] or ''
    if prefijo and not prefijo.endswith('/'):
        prefijo += '/'
    
    processed_dirs = 0
    for dir_name in dirs:
        dir_path = os.path.join(EXECUTIONS_DIR, dir_name)
        
        try:
            # Buscar la ejecución en la base de datos
            with conn.cursor() as cursor:
                # Patrones de búsqueda para la ruta del directorio
                patterns = [
                    f"%{dir_name}%",  # Buscar el UUID en cualquier parte de la ruta
                    f"%{EXECUTIONS_DIR}/{dir_name}%",  # Patrón relativo
                    f"%/home/runner/workspace/{EXECUTIONS_DIR}/{dir_name}%"  # Patrón absoluto
                ]
                
                sql_condition = " OR ".join(["ruta_directorio LIKE %s"] * len(patterns))
                sql_query = f"""
                    SELECT id, nombre_yaml, ruta_directorio, fecha_ejecucion, casilla_id, migrado_a_nube
                    FROM ejecuciones_yaml
                    WHERE ({sql_condition})
                    AND (migrado_a_nube = FALSE OR migrado_a_nube IS NULL)
                """
                
                cursor.execute(sql_query, patterns)
                ejecuciones = cursor.fetchall()
                
                if not ejecuciones:
                    logger.warning(f"No se encontraron ejecuciones para el directorio {dir_name}")
                    continue
                    
                logger.info(f"Se encontraron {len(ejecuciones)} ejecuciones para el directorio {dir_name}")
                
                for ejecucion in ejecuciones:
                    ejecucion_id, nombre_yaml, ruta_directorio, fecha_ejecucion, id_casilla, migrado = ejecucion
                    
                    # Si ya está migrada, continuar
                    if migrado:
                        logger.info(f"La ejecución {ejecucion_id} ya está migrada")
                        continue
                    
                    # Formatear la fecha para la ruta
                    fecha_str = fecha_ejecucion.strftime('%Y/%m/%d')
                    
                    # Manejar el caso donde id_casilla puede ser NULL
                    casilla_path = f"casilla{id_casilla}" if id_casilla else "sin_casilla"
                    
                    # Construir un nombre único para la carpeta en la nube
                    carpeta_nube = f"{prefijo}{casilla_path}/{fecha_str}/{nombre_yaml}_{ejecucion_id}"
                    
                    # Construir la ruta URI para la nube primaria
                    ruta_nube_primaria = f"cloud://{proveedor_primario['nombre']}/{carpeta_nube}"
                    
                    # Lista de rutas alternativas
                    rutas_alternativas = []
                    
                    # Nubes alternativas
                    nubes_alt_formateado = None
                    if nubes_alternativas:
                        nubes_alt_formateado = '{' + ','.join(str(id) for id in nubes_alternativas) + '}'
                        
                        for nube_alt_id in nubes_alternativas:
                            proveedor_alt = cloud_providers.get(nube_alt_id)
                            if proveedor_alt:
                                # Construir la ruta URI para la nube alternativa
                                ruta_alt = f"cloud://{proveedor_alt['nombre']}/{carpeta_nube}"
                                rutas_alternativas.append(ruta_alt)
                    
                    # Rutas alternativas formateadas
                    rutas_alt_formateado = None
                    if rutas_alternativas:
                        rutas_alt_formateado = '{' + ','.join(f'"{ruta}"' for ruta in rutas_alternativas) + '}'
                    
                    # Marcar como migrada
                    cursor.execute("""
                        UPDATE ejecuciones_yaml
                        SET nube_primaria_id = %s,
                            ruta_nube = %s,
                            nubes_alternativas = %s,
                            rutas_alternativas = %s,
                            migrado_a_nube = TRUE
                        WHERE id = %s
                    """, (
                        nube_primaria_id,
                        ruta_nube_primaria,
                        nubes_alt_formateado,
                        rutas_alt_formateado,
                        ejecucion_id
                    ))
                    
                    # Confirmar la transacción
                    conn.commit()
                    
                    logger.info(f"Ejecución {ejecucion_id} marcada como migrada a {ruta_nube_primaria}")
                    
                    # Eliminar el directorio local
                    try:
                        shutil.rmtree(dir_path)
                        logger.info(f"Directorio {dir_path} eliminado correctamente")
                    except Exception as e:
                        logger.error(f"Error eliminando directorio {dir_path}: {e}")
                    
                    processed_dirs += 1
        except Exception as e:
            logger.error(f"Error procesando directorio {dir_name}: {e}")
            # Revertir la transacción en caso de error
            conn.rollback()
    
    logger.info(f"Se procesaron {processed_dirs} directorios correctamente")

def main():
    """Función principal"""
    logger.info("Iniciando proceso de marcado de ejecuciones")
    
    conn = get_database_connection()
    if not conn:
        return
    
    try:
        # Obtener información de los proveedores de nube
        cloud_providers = get_cloud_provider_info(conn)
        if not cloud_providers:
            logger.error("No se encontraron proveedores de nube")
            return
            
        # Obtener configuración de ejecuciones
        config = get_execution_config(conn)
        if not config:
            logger.error("No se encontró configuración de ejecuciones")
            return
            
        # Marcar las ejecuciones con directorios existentes
        mark_existing_executions(conn, cloud_providers, config)
    except Exception as e:
        logger.error(f"Error en el proceso: {e}")
    finally:
        conn.close()
        logger.info("Proceso finalizado")

if __name__ == "__main__":
    main()