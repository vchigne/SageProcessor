#!/usr/bin/env python3
"""
Script para corregir directamente las URIs cloud:// en la base de datos

Este script corrige las URIs cloud:// que usan nombres descriptivos en lugar
de nombres reales de buckets. Ejecuta directamente las actualizaciones SQL
para evitar problemas con el procesamiento por lotes.
"""

import os
import argparse
import logging
import psycopg2
import sys
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger('fix_cloud_uris_direct')

def get_database_connection():
    """Establece conexión con la base de datos"""
    logger.info("Conectando a la base de datos...")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("No se encontró la variable de entorno DATABASE_URL")
    
    conn = psycopg2.connect(database_url)
    logger.info("Conexión establecida")
    return conn

def get_cloud_providers(conn):
    """Obtiene información de todos los proveedores de nube"""
    logger.info("Obteniendo información de proveedores de nube...")
    
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT id, nombre, tipo, credenciales, configuracion
            FROM cloud_providers
            WHERE activo = true
        """)
        
        providers = {}
        for row in cursor.fetchall():
            id, nombre, tipo, credenciales, configuracion = row
            
            # Determinar el nombre real del bucket según el tipo de proveedor
            bucket_real = None
            if tipo == 's3':
                bucket_real = credenciales.get('bucket', '')
            elif tipo == 'azure':
                bucket_real = credenciales.get('container_name', '')
            elif tipo == 'gcp':
                bucket_real = credenciales.get('bucket_name', '')
            elif tipo == 'minio':
                bucket_real = credenciales.get('bucket', '')
            elif tipo == 'sftp':
                # Para SFTP usamos "storage" como nombre genérico de bucket
                bucket_real = 'storage'
            else:
                logger.warning(f"Tipo de proveedor desconocido: {tipo}")
                bucket_real = 'unknown'
            
            # Registrar la información del proveedor
            providers[id] = {
                'id': id,
                'nombre': nombre,
                'tipo': tipo,
                'bucket_real': bucket_real or 'unknown'
            }
            
            logger.info(f"Proveedor {nombre} (ID: {id}) - Bucket real: {bucket_real or 'unknown'}")
    
    logger.info(f"Se obtuvieron {len(providers)} proveedores de nube")
    return providers

def fix_cloud_uris_direct(conn, providers, dry_run=True):
    """
    Corrige directamente las URIs cloud:// en la base de datos utilizando SQL
    
    Args:
        conn: Conexión a la base de datos
        providers: Diccionario de proveedores de nube {id: {...}}
        dry_run: Si es True, solo muestra los cambios sin aplicarlos
    """
    # Crear un mapeo de nombres descriptivos a nombres reales de buckets
    provider_map = {}
    for provider in providers.values():
        provider_map[provider['nombre']] = provider['bucket_real']
    
    # Mostrar el mapeo para debugging
    logger.info(f"Mapeo de nombres descriptivos a buckets reales: {provider_map}")
    
    # Contar cuántas rutas hay que corregir
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) 
            FROM ejecuciones_yaml
            WHERE 
                ruta_nube LIKE 'cloud://%' OR 
                ruta_directorio LIKE 'cloud://%' OR 
                rutas_alternativas::text LIKE '%cloud://%'
        """)
        total = cursor.fetchone()[0]
        logger.info(f"Se encontraron {total} ejecuciones con rutas cloud:// para procesar")
    
    # Procesar cada proveedor
    corrected_count = 0
    for desc_name, real_bucket in provider_map.items():
        # No procesar si el nombre descriptivo está vacío
        if not desc_name:
            continue
            
        # Corregir ruta_nube
        with conn.cursor() as cursor:
            # Contar cuántas rutas hay que corregir para este proveedor
            cursor.execute("""
                SELECT COUNT(*) 
                FROM ejecuciones_yaml
                WHERE ruta_nube LIKE %s
            """, (f"cloud://{desc_name}/%",))
            
            count = cursor.fetchone()[0]
            if count > 0:
                logger.info(f"Se encontraron {count} ejecuciones con ruta_nube que contienen '{desc_name}'")
                
                if not dry_run:
                    # Actualizar ruta_nube
                    cursor.execute("""
                        UPDATE ejecuciones_yaml
                        SET ruta_nube = REPLACE(ruta_nube, %s, %s)
                        WHERE ruta_nube LIKE %s
                    """, (f"cloud://{desc_name}/", f"cloud://{real_bucket}/", f"cloud://{desc_name}/%"))
                    corrected_count += count
                    logger.info(f"Se corrigieron {count} rutas en campo ruta_nube para '{desc_name}' -> '{real_bucket}'")
                else:
                    # En modo simulación, también contamos las correcciones para el reporte final
                    corrected_count += count
        
        # Corregir ruta_directorio
        with conn.cursor() as cursor:
            # Contar cuántas rutas hay que corregir para este proveedor
            cursor.execute("""
                SELECT COUNT(*) 
                FROM ejecuciones_yaml
                WHERE ruta_directorio LIKE %s
            """, (f"cloud://{desc_name}/%",))
            
            count = cursor.fetchone()[0]
            if count > 0:
                logger.info(f"Se encontraron {count} ejecuciones con ruta_directorio que contienen '{desc_name}'")
                
                if not dry_run:
                    # Actualizar ruta_directorio
                    cursor.execute("""
                        UPDATE ejecuciones_yaml
                        SET ruta_directorio = REPLACE(ruta_directorio, %s, %s)
                        WHERE ruta_directorio LIKE %s
                    """, (f"cloud://{desc_name}/", f"cloud://{real_bucket}/", f"cloud://{desc_name}/%"))
                    corrected_count += count
                    logger.info(f"Se corrigieron {count} rutas en campo ruta_directorio para '{desc_name}' -> '{real_bucket}'")
                else:
                    # En modo simulación, también contamos las correcciones para el reporte final
                    corrected_count += count
        
        # Corregir rutas_alternativas (esto es más complejo porque es un array de texto)
        # Usamos un enfoque diferente con unnest para recorrer los elementos del array
        with conn.cursor() as cursor:
            # En PostgreSQL podemos usar unnest para trabajar con arrays
            cursor.execute("""
                SELECT COUNT(DISTINCT id)
                FROM ejecuciones_yaml e,
                unnest(rutas_alternativas) as ruta
                WHERE ruta LIKE %s
            """, (f"cloud://{desc_name}/%",))
            
            count = cursor.fetchone()[0]
            if count > 0:
                logger.info(f"Se encontraron {count} ejecuciones con rutas_alternativas que contienen '{desc_name}'")
                
                if not dry_run:
                    # Obtenemos todas las ejecuciones que necesitan actualización
                    cursor.execute("""
                        SELECT id, rutas_alternativas
                        FROM ejecuciones_yaml
                        WHERE id IN (
                            SELECT DISTINCT id
                            FROM ejecuciones_yaml,
                            unnest(rutas_alternativas) as ruta
                            WHERE ruta LIKE %s
                        )
                    """, (f"cloud://{desc_name}/%",))
                    
                    rows = cursor.fetchall()
                    updated_rows = 0
                    
                    for row_id, rutas in rows:
                        # Crear un nuevo array con las rutas corregidas
                        new_rutas = []
                        for ruta in rutas:
                            if ruta.startswith(f"cloud://{desc_name}/"):
                                # Reemplazar el nombre del bucket
                                new_ruta = ruta.replace(f"cloud://{desc_name}/", f"cloud://{real_bucket}/")
                                new_rutas.append(new_ruta)
                            else:
                                new_rutas.append(ruta)
                        
                        # Actualizar el registro si hubo cambios
                        if new_rutas != rutas:
                            cursor.execute("""
                                UPDATE ejecuciones_yaml
                                SET rutas_alternativas = %s
                                WHERE id = %s
                            """, (new_rutas, row_id))
                            updated_rows += 1
                    
                    corrected_count += updated_rows
                    logger.info(f"Se corrigieron rutas en el campo rutas_alternativas para {updated_rows} ejecuciones, reemplazando '{desc_name}' por '{real_bucket}'")
                else:
                    # En modo simulación, también contamos las correcciones para el reporte final
                    corrected_count += count
    
    # Confirmar las transacciones si no es modo simulación
    if not dry_run:
        conn.commit()
        logger.info(f"Cambios confirmados. Se corrigieron un total de {corrected_count} rutas")
    else:
        logger.info(f"Modo simulación completado. Se corregirían {corrected_count} rutas")
    
    return corrected_count

def parse_args():
    """Configurar el parser de argumentos"""
    parser = argparse.ArgumentParser(description='Corregir las URIs cloud:// en la base de datos')
    parser.add_argument('--apply', action='store_true', help='Aplicar los cambios (por defecto es modo simulación)')
    return parser.parse_args()

def main():
    """Función principal"""
    args = parse_args()
    dry_run = not args.apply
    
    if dry_run:
        logger.info("MODO SIMULACIÓN: Los cambios no se aplicarán en la base de datos")
        logger.info("Para aplicar los cambios, ejecute con --apply")
    else:
        logger.info("MODO EJECUCIÓN: Los cambios se aplicarán en la base de datos")
        logger.info("¡ATENCIÓN! Esto modificará directamente la base de datos")
        response = input("¿Desea continuar? (s/n): ")
        if response.lower() != 's':
            logger.info("Operación cancelada por el usuario")
            return
    
    try:
        # Establecer conexión con la base de datos
        conn = get_database_connection()
        
        # Obtener información de proveedores de nube
        providers = get_cloud_providers(conn)
        
        # Corregir las URIs cloud://
        fix_cloud_uris_direct(conn, providers, dry_run=dry_run)
        
        logger.info("Operación completada con éxito")
    except Exception as e:
        logger.error(f"Error: {e}")
        if 'conn' in locals() and not dry_run:
            conn.rollback()
            logger.info("Se ha revertido la transacción debido al error")
    finally:
        if 'conn' in locals():
            conn.close()
            logger.info("Conexión a la base de datos cerrada")

if __name__ == "__main__":
    main()