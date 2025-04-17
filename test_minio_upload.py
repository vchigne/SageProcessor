#!/usr/bin/env python3
"""
Script para probar la subida de un archivo a MinIO
"""

import os
import json
import logging
from datetime import datetime
import psycopg2
from minio import Minio
from minio.error import S3Error

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test_minio')

def get_database_connection():
    """Obtener conexión a la base de datos"""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise ValueError("No se encontró la variable de entorno DATABASE_URL")
    
    connection = psycopg2.connect(db_url)
    return connection

def get_minio_config():
    """Obtener la configuración de MinIO desde la base de datos"""
    connection = get_database_connection()
    with connection.cursor() as cursor:
        cursor.execute("SELECT * FROM cloud_providers WHERE id = 5")  # ID 5 es MinIO OVH
        provider = cursor.fetchone()
        
        if not provider:
            raise ValueError("No se encontró el proveedor MinIO OVH")
        
        # Convertir a diccionario
        columns = [desc[0] for desc in cursor.description]
        provider_dict = dict(zip(columns, provider))
        
        # Si credenciales o configuración son strings JSON, convertirlos a dict
        if 'credenciales' in provider_dict and isinstance(provider_dict['credenciales'], str):
            try:
                provider_dict['credenciales'] = json.loads(provider_dict['credenciales'])
            except:
                logger.warning(f"No se pudo parsear las credenciales del proveedor {provider_dict.get('nombre')}")
                
        if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], str):
            try:
                provider_dict['configuracion'] = json.loads(provider_dict['configuracion'])
            except:
                logger.warning(f"No se pudo parsear la configuración del proveedor {provider_dict.get('nombre')}")
        
        return provider_dict

def upload_test_file():
    """Subir un archivo de prueba a MinIO"""
    # Obtener configuración de MinIO
    provider = get_minio_config()
    
    # Parsear credenciales y configuración
    config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else {}
    credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else {}
    
    # Logs para depuración
    logger.info(f"Nombre del proveedor: {provider.get('nombre')}")
    logger.info(f"Credenciales MinIO: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
    logger.info(f"Configuración MinIO: {list(config.keys()) if config else 'No hay configuración'}")
    
    # Obtener endpoint, access_key y secret_key
    endpoint = credentials.get('endpoint') or config.get('endpoint')
    if not endpoint:
        raise ValueError("No se configuró correctamente el endpoint para MinIO")
        
    # Determinar si es secure (HTTPS) o no (HTTP)
    secure = True
    
    # Quitar protocolo del endpoint si lo tiene
    if endpoint.startswith('http://'):
        endpoint = endpoint[7:]  # Quitar 'http://'
        secure = False
    elif endpoint.startswith('https://'):
        endpoint = endpoint[8:]  # Quitar 'https://'
        secure = True
    else:
        # Si no tiene protocolo, verificar en configuración
        # Primero verificar en credenciales, luego en config
        if 'secure' in credentials:
            # Convertir a booleano ya que puede venir como string "false"
            secure_val = credentials['secure']
            if isinstance(secure_val, str):
                secure = secure_val.lower() != 'false'
            else:
                secure = bool(secure_val)
        elif 'secure' in config:
            # Convertir a booleano ya que puede venir como string "false"
            secure_val = config['secure']
            if isinstance(secure_val, str):
                secure = secure_val.lower() != 'false'
            else:
                secure = bool(secure_val)
    
    # Logs específicos para MinIO
    logger.info(f"Usando endpoint MinIO: {endpoint} (secure: {secure})")
    
    # Obtener access_key y secret_key
    access_key = credentials.get('access_key')
    secret_key = credentials.get('secret_key')
    
    if not access_key or not secret_key:
        raise ValueError("No se configuraron correctamente las credenciales de acceso para MinIO")
    
    # Cliente MinIO usando la librería nativa
    logger.info(f"Creando cliente MinIO con endpoint={endpoint}, secure={secure}")
    minio_client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=secure
    )
    
    # Bucket debe estar en credenciales
    bucket = credentials.get('bucket')
    if not bucket:
        raise ValueError("No se configuró correctamente el bucket para MinIO")
    
    # Verificar si el bucket existe
    try:
        bucket_exists = minio_client.bucket_exists(bucket)
        if not bucket_exists:
            logger.warning(f"El bucket {bucket} no existe en MinIO, intentando crearlo...")
            minio_client.make_bucket(bucket)
            logger.info(f"Bucket {bucket} creado exitosamente")
        else:
            logger.info(f"Bucket {bucket} existe y es accesible")
    except Exception as e:
        raise ValueError(f"Error verificando bucket de MinIO: {str(e)}")
    
    # Crear archivo de prueba
    test_file = 'ffff.txtx'
    with open(test_file, 'w') as f:
        f.write(f"Archivo de prueba para MinIO creado el {datetime.now().isoformat()}\n")
        f.write(f"Esta es una prueba de integración con el servidor MinIO OVH.\n")
        f.write(f"Si puedes leer esto, ¡la integración fue exitosa!")
    
    # Ruta destino en MinIO
    # Usar prefijo de configuración si existe
    prefix = config.get('prefix', '')
    if prefix and not prefix.endswith('/'):
        prefix += '/'
    
    minio_key = f"{prefix}test_upload/{datetime.now().strftime('%Y/%m/%d')}/{test_file}"
    
    # Determinar el tipo de contenido
    content_type = 'text/plain'
    
    # Subir el archivo usando la API nativa de MinIO
    try:
        logger.info(f"Subiendo archivo {test_file} a minio://{bucket}/{minio_key}")
        minio_client.fput_object(
            bucket, 
            minio_key, 
            test_file,
            content_type=content_type
        )
        logger.info(f"✓ Archivo {test_file} subido exitosamente a minio://{bucket}/{minio_key}")
        
        # Verificar listando objetos
        logger.info(f"Listando objetos en el directorio: {minio_key}")
        objects = minio_client.list_objects(bucket, prefix=minio_key)
        for obj in objects:
            logger.info(f"Objeto encontrado: {obj.object_name}")
            
        return f"minio://{bucket}/{minio_key}"
    except Exception as e:
        logger.error(f"Error subiendo archivo a MinIO: {str(e)}")
        raise ValueError(f"Error subiendo archivo a MinIO: {str(e)}")

if __name__ == "__main__":
    try:
        minio_path = upload_test_file()
        print(f"Archivo subido exitosamente a: {minio_path}")
    except Exception as e:
        logger.error(f"Error en la prueba: {str(e)}")
        import traceback
        traceback.print_exc()