#!/usr/bin/env python
"""
Script para corregir las URIs cloud:// en la base de datos

Este script:
1. Busca todas las ejecuciones con URIs cloud:// mal formadas (usando nombre descriptivo en lugar de bucket real)
2. Extrae el nombre real del bucket de las credenciales del proveedor
3. Actualiza las rutas en ejecuciones_yaml para usar el nombre del bucket real

IMPORTANTE: Este script modifica directamente la base de datos - hacer backup previo
"""

import os
import sys
import json
import logging
import psycopg2
from datetime import datetime
import argparse

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger('fix_cloud_uris')

def get_database_connection():
    """Establece conexión con la base de datos"""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise ValueError("La variable de entorno DATABASE_URL no está definida")
    
    logger.info(f"Conectando a la base de datos...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = False  # Es importante que sea False para poder hacer rollback
    
    logger.info(f"Conexión establecida")
    return conn

def get_cloud_providers(conn):
    """Obtiene información de todos los proveedores de nube"""
    logger.info("Obteniendo información de proveedores de nube...")
    
    providers = {}
    
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT id, nombre, tipo, credenciales, configuracion  
            FROM cloud_providers
            WHERE activo = TRUE
        """)
        
        for row in cursor.fetchall():
            provider_id, nombre, tipo, credenciales, configuracion = row
            
            # Intentar parsear credenciales y configuración como JSON
            creds = {}
            config = {}
            
            if credenciales:
                try:
                    creds = json.loads(credenciales) if isinstance(credenciales, str) else credenciales
                except:
                    logger.warning(f"No se pudo parsear las credenciales del proveedor {nombre}")
            
            if configuracion:
                try:
                    config = json.loads(configuracion) if isinstance(configuracion, str) else configuracion
                except:
                    logger.warning(f"No se pudo parsear la configuración del proveedor {nombre}")
            
            # Determinar el bucket real según el tipo de proveedor
            bucket_real = None
            
            if tipo.lower() in ['s3', 'minio']:
                bucket_real = creds.get('bucket')
            elif tipo.lower() == 'azure':
                bucket_real = creds.get('container_name')
            elif tipo.lower() == 'gcp':
                bucket_real = creds.get('bucket_name')
            elif tipo.lower() == 'sftp':
                bucket_real = creds.get('directory', 'storage')
                
            # Si no se pudo determinar el bucket, usar un identificador único
            if not bucket_real:
                logger.warning(f"No se pudo determinar el nombre real del bucket para el proveedor {nombre}. Usando ID como fallback.")
                bucket_real = f"storage-{provider_id}"
                
            logger.info(f"Proveedor {nombre} (ID: {provider_id}) - Bucket real: {bucket_real}")
            
            providers[provider_id] = {
                'id': provider_id,
                'nombre': nombre, 
                'tipo': tipo,
                'bucket_real': bucket_real,
                'credenciales': creds,
                'configuracion': config
            }
    
    logger.info(f"Se obtuvieron {len(providers)} proveedores de nube")
    return providers

def process_batch(conn, ejecuciones, providers, dry_run=True):
    """
    Procesa un lote de ejecuciones para corregir URIs cloud://
    
    Args:
        conn: Conexión a la base de datos
        ejecuciones: Lista de ejecuciones a procesar
        providers: Diccionario de proveedores de nube {id: {...}}
        dry_run: Si es True, solo muestra los cambios sin aplicarlos
        
    Returns:
        int: Número de ejecuciones corregidas
    """
    corrected_count = 0
    
    # Procesar cada ejecución
    with conn.cursor() as cursor:
        for ejecucion in ejecuciones:
            ejecucion_id, uuid, nombre_yaml, ruta_nube, ruta_directorio, rutas_alternativas, nube_primaria_id, nubes_alternativas = ejecucion
            
            # Verificar si hay proveedor primario
            if not nube_primaria_id or nube_primaria_id not in providers:
                logger.warning(f"Ejecución {ejecucion_id} no tiene proveedor primario válido, omitiendo...")
                continue
                
            provider_info = providers[nube_primaria_id]
            bucket_real = provider_info['bucket_real']
            
            # Preparar un diccionario de proveedores alternativas por ID
            alt_providers_by_id = {}
            if nubes_alternativas:
                if isinstance(nubes_alternativas, str) and nubes_alternativas.startswith('{') and nubes_alternativas.endswith('}'):
                    # Convertir de formato {1,2,3} a lista [1,2,3]
                    try:
                        alt_ids = [int(id_str) for id_str in nubes_alternativas[1:-1].split(',') if id_str.strip()]
                        for alt_id in alt_ids:
                            if alt_id in providers:
                                alt_providers_by_id[alt_id] = providers[alt_id]
                    except:
                        logger.warning(f"No se pudo parsear nubes_alternativas: {nubes_alternativas}")
                elif isinstance(nubes_alternativas, list):
                    for alt_id in nubes_alternativas:
                        if alt_id in providers:
                            alt_providers_by_id[alt_id] = providers[alt_id]
            
            # 1. Corregir ruta_nube si existe y comienza con cloud://
            if ruta_nube and isinstance(ruta_nube, str) and ruta_nube.startswith('cloud://'):
                ruta_nube_corregida = corregir_uri_cloud(
                    ruta_nube, 
                    provider_info, 
                    providers, 
                    logger,
                    f"Ejecución {ejecucion_id}: Cambiar ruta_nube"
                )
                
                # Si se corrigió la ruta y no es dry_run, actualizar en la base de datos
                if ruta_nube_corregida and ruta_nube_corregida != ruta_nube and not dry_run:
                    cursor.execute("""
                        UPDATE ejecuciones_yaml
                        SET ruta_nube = %s
                        WHERE id = %s
                    """, (ruta_nube_corregida, ejecucion_id))
                    corrected_count += 1
            
            # 2. Corregir ruta_directorio si existe y comienza con cloud://
            if ruta_directorio and isinstance(ruta_directorio, str) and ruta_directorio.startswith('cloud://'):
                ruta_directorio_corregida = corregir_uri_cloud(
                    ruta_directorio, 
                    provider_info, 
                    providers, 
                    logger,
                    f"Ejecución {ejecucion_id}: Cambiar ruta_directorio"
                )
                
                # Si se corrigió la ruta y no es dry_run, actualizar en la base de datos
                if ruta_directorio_corregida and ruta_directorio_corregida != ruta_directorio and not dry_run:
                    cursor.execute("""
                        UPDATE ejecuciones_yaml
                        SET ruta_directorio = %s
                        WHERE id = %s
                    """, (ruta_directorio_corregida, ejecucion_id))
                    corrected_count += 1
            
            # 3. Corregir rutas_alternativas si existen
            if rutas_alternativas:
                # Convertir rutas_alternativas a lista si es string en formato PostgreSQL
                alt_rutas_lista = rutas_alternativas
                
                if isinstance(rutas_alternativas, str) and rutas_alternativas.startswith('{') and rutas_alternativas.endswith('}'):
                    # Convertir de formato {"uri1","uri2"} a lista ["uri1", "uri2"]
                    try:
                        # Eliminar los corchetes {} y dividir por comas
                        alt_rutas_str = rutas_alternativas[1:-1]
                        if alt_rutas_str:
                            # Parsear las URIs teniendo en cuenta que pueden tener comas dentro de comillas
                            import re
                            alt_rutas_lista = re.findall(r'"([^"]*)"', alt_rutas_str)
                            if not alt_rutas_lista:  # Si no hay comillas, dividir por comas
                                alt_rutas_lista = [s.strip() for s in alt_rutas_str.split(',')]
                    except Exception as e:
                        logger.warning(f"No se pudo parsear rutas_alternativas: {rutas_alternativas} - Error: {e}")
                        alt_rutas_lista = []
                
                # Procesar cada ruta alternativa
                if alt_rutas_lista and isinstance(alt_rutas_lista, list):
                    new_alt_rutas = []
                    changed = False
                    
                    for alt_ruta in alt_rutas_lista:
                        if isinstance(alt_ruta, str) and alt_ruta.startswith('cloud://'):
                            # Buscar el proveedor alternativo
                            alt_ruta_corregida = corregir_uri_cloud(
                                alt_ruta, 
                                None,  # No hay un proveedor predeterminado
                                providers, 
                                logger,
                                f"Ejecución {ejecucion_id}: Cambiar ruta alternativa"
                            )
                            
                            if alt_ruta_corregida and alt_ruta_corregida != alt_ruta:
                                new_alt_rutas.append(alt_ruta_corregida)
                                changed = True
                            else:
                                new_alt_rutas.append(alt_ruta)
                        else:
                            new_alt_rutas.append(alt_ruta)
                    
                    # Si hubo cambios y no es dry_run, actualizar en la base de datos
                    if changed and not dry_run:
                        # Convertir la lista a formato PostgreSQL array
                        pg_array = '{' + ','.join(f'"{ruta}"' for ruta in new_alt_rutas) + '}'
                        
                        cursor.execute("""
                            UPDATE ejecuciones_yaml
                            SET rutas_alternativas = %s
                            WHERE id = %s
                        """, (pg_array, ejecucion_id))
                        
                        corrected_count += 1
    
    # Aplicar los cambios si no es dry_run
    if not dry_run and corrected_count > 0:
        conn.commit()
        logger.info(f"Se corrigieron {corrected_count} ejecuciones")
    elif dry_run and corrected_count > 0:
        logger.info(f"Modo simulación completado. Se corregirían {corrected_count} ejecuciones")
        
    return corrected_count

def fix_cloud_uris(conn, providers, dry_run=True, ejecuciones=None):
    """
    Corrige las URIs cloud:// en ejecuciones_yaml
    
    Args:
        conn: Conexión a la base de datos
        providers: Diccionario de proveedores de nube {id: {...}}
        dry_run: Si es True, solo muestra los cambios sin aplicarlos
        ejecuciones: Lista de ejecuciones a procesar (opcional)
        
    Returns:
        int: Número de ejecuciones corregidas
    """
    if ejecuciones is None:
        logger.info(f"Buscando URIs cloud:// mal formadas...")
        
        with conn.cursor() as cursor:
            # Obtener todas las ejecuciones con rutas cloud://
            cursor.execute("""
                SELECT id, uuid, nombre_yaml, ruta_nube, ruta_directorio, rutas_alternativas, 
                       nube_primaria_id, nubes_alternativas
                FROM ejecuciones_yaml
                WHERE (
                    ruta_nube LIKE 'cloud://%' OR 
                    ruta_directorio LIKE 'cloud://%' OR 
                    rutas_alternativas::text LIKE '%cloud://%'
                )
                ORDER BY id DESC
                LIMIT 20  -- Procesamos por lotes para evitar timeouts
            """)
            
            ejecuciones = cursor.fetchall()
            
        logger.info(f"Se encontraron {len(ejecuciones)} ejecuciones con rutas cloud://")
    
    return process_batch(conn, ejecuciones, providers, dry_run)

def corregir_uri_cloud(uri, default_provider, providers, logger, log_prefix=""):
    """
    Corrige una URI cloud:// sustituyendo el nombre descriptivo por el bucket real
    
    Args:
        uri: URI cloud:// a corregir
        default_provider: Proveedor a usar si no se encuentra coincidencia por nombre
        providers: Diccionario de proveedores {id: {...}}
        logger: Logger para mensajes
        log_prefix: Prefijo para los mensajes de log
        
    Returns:
        str: URI corregida o None si no se pudo corregir
    """
    if not uri or not isinstance(uri, str) or not uri.startswith('cloud://'):
        return uri
        
    # Extraer el nombre descriptivo y la ruta
    parts = uri[8:].split('/', 1)
    if len(parts) != 2:
        logger.warning(f"{log_prefix}: Formato incorrecto - {uri}")
        return uri
        
    nombre_descriptivo, ruta = parts
    
    # Buscar el proveedor que coincida con este nombre descriptivo
    matching_provider = None
    for p in providers.values():
        if p['nombre'] == nombre_descriptivo:
            matching_provider = p
            break
    
    # Si no encontramos coincidencia por nombre pero tenemos un proveedor predeterminado
    if not matching_provider and default_provider:
        matching_provider = default_provider
        logger.warning(f"{log_prefix}: No se encontró proveedor para {nombre_descriptivo}, usando proveedor predeterminado")
    
    # Si tenemos un proveedor, construir la nueva URI
    if matching_provider:
        bucket_real = matching_provider['bucket_real']
        new_uri = f"cloud://{bucket_real}/{ruta}"
        
        if new_uri != uri:
            logger.info(f"{log_prefix}\n  DE: {uri}\n  A : {new_uri}")
            return new_uri
    else:
        logger.warning(f"{log_prefix}: No se encontró proveedor para {nombre_descriptivo}")
    
    return uri

# Esta función ya no es necesaria y puede ser eliminada

def parse_args():
    """Configurar el parser de argumentos"""
    parser = argparse.ArgumentParser(description='Corregir las URIs cloud:// en la base de datos')
    parser.add_argument('--apply', action='store_true', help='Aplicar los cambios (por defecto es modo simulación)')
    return parser.parse_args()

def get_total_records_to_fix(conn):
    """Obtiene el total de registros que necesitan ser corregidos"""
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM ejecuciones_yaml
            WHERE (
                ruta_nube LIKE 'cloud://%' OR 
                ruta_directorio LIKE 'cloud://%' OR 
                rutas_alternativas::text LIKE '%cloud://%'
            )
        """)
        return cursor.fetchone()[0]

def process_in_batches(conn, providers, dry_run=True, batch_size=20, offset=0, limit=500):
    """Procesa registros en lotes para evitar problemas de timeout"""
    total_records = get_total_records_to_fix(conn)
    logger.info(f"Total de registros a procesar: {total_records}")
    
    if limit > 0:
        total_records = min(total_records, limit)
        
    total_corrected = 0
    batches_processed = 0
    
    # Procesar en lotes
    while offset < total_records:
        with conn.cursor() as cursor:
            cursor.execute(f"""
                SELECT id, uuid, nombre_yaml, ruta_nube, ruta_directorio, rutas_alternativas, 
                       nube_primaria_id, nubes_alternativas
                FROM ejecuciones_yaml
                WHERE (
                    ruta_nube LIKE 'cloud://%' OR 
                    ruta_directorio LIKE 'cloud://%' OR 
                    rutas_alternativas::text LIKE '%cloud://%'
                )
                ORDER BY id DESC
                LIMIT {batch_size} OFFSET {offset}
            """)
            
            batch = cursor.fetchall()
            
            if not batch:
                break
                
            logger.info(f"Procesando lote {batches_processed + 1} ({len(batch)} registros)")
            
            # Crear una nueva conexión para cada lote para evitar problemas con transacciones largas
            batch_conn = get_database_connection()
            try:
                batch_corrected = fix_cloud_uris(batch_conn, providers, dry_run, batch)
                total_corrected += batch_corrected
                
                if not dry_run:
                    batch_conn.commit()
            except Exception as e:
                if not dry_run:
                    batch_conn.rollback()
                logger.error(f"Error procesando lote {batches_processed + 1}: {e}")
            finally:
                batch_conn.close()
            
            offset += batch_size
            batches_processed += 1
    
    return total_corrected

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
        
        # Procesar en lotes
        total_corrected = process_in_batches(conn, providers, dry_run, batch_size=20)
        
        logger.info(f"Operación completada con éxito. Total corregido: {total_corrected}")
    except Exception as e:
        logger.error(f"Error general: {e}")
    finally:
        if 'conn' in locals():
            conn.close()
            logger.info("Conexión a la base de datos cerrada")

if __name__ == "__main__":
    main()