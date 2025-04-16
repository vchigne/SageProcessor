#!/usr/bin/env python3
"""
Script para migrar las ejecuciones con directorios existentes a la nube.

Este script:
1. Busca las ejecuciones almacenadas localmente no migradas a la nube
2. Sube los archivos asociados a las nubes configuradas
3. Actualiza los registros en la base de datos
4. Elimina los archivos locales después de una migración exitosa
"""

import os
import sys
import json
import logging
import psycopg2
from datetime import datetime, timedelta
import shutil
import tempfile
import traceback

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("mark_existing_dirs.log"),
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
                    'tipo': provider[3],  # Corregido: tipo está en la posición 3, no 2
                    'configuracion': provider[5],  # Corregido: configuracion está en la posición 5, no 3
                    'credenciales': provider[4]  # Correcto: credenciales está en la posición 4
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

def upload_directory_to_cloud(local_path, cloud_path, provider):
    """Subir un directorio a la nube usando el proveedor adecuado"""
    logger.info(f"Subiendo {local_path} a {provider['nombre']}/{cloud_path}")
    
    # La lógica de subida dependerá del tipo de proveedor
    provider_type = provider['tipo'].lower()
    
    if provider_type == 's3' or provider_type == 'minio':
        upload_to_s3(local_path, cloud_path, provider)
    elif provider_type == 'azure':
        upload_to_azure(local_path, cloud_path, provider)
    elif provider_type == 'gcp':
        upload_to_gcp(local_path, cloud_path, provider)
    elif provider_type == 'sftp':
        upload_to_sftp(local_path, cloud_path, provider)
    else:
        raise ValueError(f"Tipo de proveedor no soportado: {provider_type}")

def upload_to_s3(local_path, cloud_path, provider):
    """Subir archivos a S3 o MinIO"""
    import boto3
    from botocore.exceptions import ClientError
    
    # Parsear credenciales y configuración
    config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion'])
    credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales'])
    
    logger.info(f"Credenciales S3: {credentials}")
    
    # Crear cliente S3
    s3_client = boto3.client(
        's3',
        endpoint_url=credentials.get('endpoint'),
        aws_access_key_id=credentials.get('access_key'),
        aws_secret_access_key=credentials.get('secret_key'),
        region_name=credentials.get('region')
    )
    
    bucket = credentials.get('bucket')
    
    # Subir todos los archivos en el directorio
    for root, dirs, files in os.walk(local_path):
        for file in files:
            local_file_path = os.path.join(root, file)
            
            # Calcular la ruta relativa para el objeto S3
            rel_path = os.path.relpath(local_file_path, local_path)
            s3_key = f"{cloud_path}/{rel_path}"
            
            # Subir el archivo
            try:
                with open(local_file_path, 'rb') as data:
                    s3_client.put_object(Bucket=bucket, Key=s3_key, Body=data)
                logger.debug(f"Archivo {local_file_path} subido a s3://{bucket}/{s3_key}")
            except Exception as e:
                logger.error(f"Error subiendo archivo a S3: {e}")
                raise

def upload_to_azure(local_path, cloud_path, provider):
    """Subir archivos a Azure Blob Storage"""
    from azure.storage.blob import BlobServiceClient
    
    # Parsear credenciales y configuración
    config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion'])
    credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales'])
    
    logger.info(f"Credenciales Azure: {credentials}")
    
    # Obtener string de conexión o SAS token
    connection_string = credentials.get('connection_string')
    container_name = credentials.get('container_name')
    
    # Crear cliente de servicio
    if connection_string:
        # Usar connection string completo
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        # Obtener cliente de contenedor
        container_client = blob_service_client.get_container_client(container_name)
    else:
        raise ValueError("No se configuraron credenciales válidas para Azure")
    
    # Subir todos los archivos en el directorio
    for root, dirs, files in os.walk(local_path):
        for file in files:
            local_file_path = os.path.join(root, file)
            
            # Calcular la ruta relativa para el blob
            rel_path = os.path.relpath(local_file_path, local_path)
            blob_name = f"{cloud_path}/{rel_path}"
            
            # Subir el archivo
            try:
                with open(local_file_path, "rb") as data:
                    container_client.upload_blob(name=blob_name, data=data, overwrite=True)
                logger.debug(f"Archivo {local_file_path} subido a azure://{container_name}/{blob_name}")
            except Exception as e:
                logger.error(f"Error subiendo archivo a Azure: {e}")
                raise

def upload_to_gcp(local_path, cloud_path, provider):
    """Subir archivos a Google Cloud Storage"""
    from google.cloud import storage
    import tempfile
    
    # Parsear credenciales y configuración
    config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion'])
    credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales'])
    
    logger.info(f"Credenciales GCP: {credentials.keys()}")
    
    # Obtener el archivo de clave y el nombre del bucket
    key_data = credentials.get('key_file')
    bucket_name = credentials.get('bucket_name')
    
    if not key_data or not bucket_name:
        raise ValueError("Faltan credenciales necesarias para GCP (key_file o bucket_name)")
    
    # Crear archivo temporal para las credenciales
    fd, path = tempfile.mkstemp()
    try:
        with os.fdopen(fd, 'w') as tmp:
            # Guardar credenciales en archivo JSON
            tmp.write(key_data)
        
        # Crear cliente de almacenamiento
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = path
        storage_client = storage.Client()
        
        bucket = storage_client.bucket(bucket_name)
        
        # Subir todos los archivos en el directorio
        for root, dirs, files in os.walk(local_path):
            for file in files:
                local_file_path = os.path.join(root, file)
                
                # Calcular la ruta relativa para el objeto GCS
                rel_path = os.path.relpath(local_file_path, local_path)
                blob_name = f"{cloud_path}/{rel_path}"
                
                # Subir el archivo
                try:
                    blob = bucket.blob(blob_name)
                    blob.upload_from_filename(local_file_path)
                    logger.debug(f"Archivo {local_file_path} subido a gs://{bucket_name}/{blob_name}")
                except Exception as e:
                    logger.error(f"Error subiendo archivo a GCS: {e}")
                    raise
                    
    finally:
        # Eliminar archivo temporal de credenciales
        os.unlink(path)

def upload_to_sftp(local_path, cloud_path, provider):
    """Subir archivos a servidor SFTP"""
    import paramiko
    
    # Parsear credenciales y configuración
    config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion'])
    credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales'])
    
    logger.info(f"Credenciales SFTP: {credentials}")
    
    # Crear cliente SFTP
    host = credentials.get('host')
    port = int(credentials.get('port', 22))
    user = credentials.get('user')
    password = credentials.get('password')
    key_path = credentials.get('key_path')
    
    # Inicializar cliente SSH
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Conectar con contraseña o clave privada
        if key_path and os.path.exists(key_path):
            # Conectar con clave privada
            private_key = paramiko.RSAKey.from_private_key_file(key_path)
            ssh.connect(host, port=port, username=user, pkey=private_key)
        else:
            # Conectar con contraseña
            ssh.connect(host, port=port, username=user, password=password)
        
        # Abrir cliente SFTP
        sftp = ssh.open_sftp()
        
        # Crear directorio remoto si no existe
        sftp_mkdir_p(sftp, cloud_path)
        
        # Subir todos los archivos en el directorio
        for root, dirs, files in os.walk(local_path):
            for file in files:
                local_file_path = os.path.join(root, file)
                
                # Calcular la ruta relativa para el archivo SFTP
                rel_path = os.path.relpath(local_file_path, local_path)
                remote_path = f"{cloud_path}/{rel_path}"
                
                # Crear directorio remoto si es necesario
                remote_dir = os.path.dirname(remote_path)
                sftp_mkdir_p(sftp, remote_dir)
                
                # Subir el archivo
                try:
                    sftp.put(local_file_path, remote_path)
                    logger.debug(f"Archivo {local_file_path} subido a sftp://{host}:{port}/{remote_path}")
                except Exception as e:
                    logger.error(f"Error subiendo archivo a SFTP: {e}")
                    raise
        
        # Cerrar conexiones
        sftp.close()
        ssh.close()
    except Exception as e:
        logger.error(f"Error en conexión SFTP a {host}:{port}: {e}")
        raise

def sftp_mkdir_p(sftp, remote_directory):
    """Crear directorio remoto recursivamente (mkdir -p)"""
    if remote_directory == '/':
        # La raíz siempre existe
        return
    if remote_directory == '':
        # Directorio vacío, no hacer nada
        return
    if remote_directory == '.':
        # Directorio actual, no hacer nada
        return
    
    try:
        sftp.stat(remote_directory)
    except IOError:
        dirname = os.path.dirname(remote_directory)
        if dirname != remote_directory:
            sftp_mkdir_p(sftp, dirname)
        sftp.mkdir(remote_directory)

def migrate_existing_executions(conn, cloud_providers, config):
    """Migrar las ejecuciones con directorios existentes a la nube"""
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
                    
                    # PASO 1: Subir los archivos a la nube primaria
                    try:
                        logger.info(f"Subiendo ejecución {ejecucion_id} a nube primaria {proveedor_primario['nombre']}")
                        upload_directory_to_cloud(dir_path, carpeta_nube, proveedor_primario)
                        logger.info(f"Archivos subidos correctamente a {proveedor_primario['nombre']}")
                    except Exception as e:
                        logger.error(f"Error subiendo a nube primaria {proveedor_primario['nombre']}: {e}")
                        logger.error(traceback.format_exc())
                        # En caso de error, no continuar con esta ejecución
                        continue
                    
                    # PASO 2: Subir a nubes alternativas si están configuradas
                    nubes_alt_formateado = None
                    if nubes_alternativas:
                        nubes_alt_formateado = '{' + ','.join(str(id) for id in nubes_alternativas) + '}'
                        
                        for nube_alt_id in nubes_alternativas:
                            proveedor_alt = cloud_providers.get(nube_alt_id)
                            if proveedor_alt:
                                try:
                                    logger.info(f"Subiendo ejecución {ejecucion_id} a nube alternativa {proveedor_alt['nombre']}")
                                    upload_directory_to_cloud(dir_path, carpeta_nube, proveedor_alt)
                                    
                                    # Construir la ruta URI para la nube alternativa
                                    ruta_alt = f"cloud://{proveedor_alt['nombre']}/{carpeta_nube}"
                                    rutas_alternativas.append(ruta_alt)
                                    logger.info(f"Archivos subidos correctamente a {proveedor_alt['nombre']}")
                                except Exception as e:
                                    logger.error(f"Error subiendo a nube alternativa {proveedor_alt['nombre']}: {e}")
                                    logger.error(traceback.format_exc())
                                    # Continuar con las otras nubes alternativas
                    
                    # Rutas alternativas formateadas
                    rutas_alt_formateado = None
                    if rutas_alternativas:
                        rutas_alt_formateado = '{' + ','.join(f'"{ruta}"' for ruta in rutas_alternativas) + '}'
                    
                    # PASO 3: Marcar como migrada en la base de datos
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
                    
                    logger.info(f"Ejecución {ejecucion_id} migrada correctamente a {ruta_nube_primaria}")
                    
                    # PASO 4: Eliminar el directorio local si todo fue exitoso
                    try:
                        shutil.rmtree(dir_path)
                        logger.info(f"Directorio {dir_path} eliminado correctamente")
                    except Exception as e:
                        logger.error(f"Error eliminando directorio {dir_path}: {e}")
                    
                    processed_dirs += 1
        except Exception as e:
            logger.error(f"Error procesando directorio {dir_name}: {e}")
            logger.error(traceback.format_exc())
            # Revertir la transacción en caso de error
            conn.rollback()
    
    logger.info(f"Se procesaron {processed_dirs} directorios correctamente")

def main():
    """Función principal"""
    logger.info("Iniciando proceso de migración de ejecuciones a la nube")
    
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
            
        # Migrar las ejecuciones con directorios existentes
        migrate_existing_executions(conn, cloud_providers, config)
    except Exception as e:
        logger.error(f"Error en el proceso: {e}")
        logger.error(traceback.format_exc())
    finally:
        conn.close()
        logger.info("Proceso finalizado")

if __name__ == "__main__":
    main()