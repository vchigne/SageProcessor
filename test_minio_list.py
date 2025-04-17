#!/usr/bin/env python3
"""
Script para listar los contenidos del bucket de MinIO
"""

import os
import json
import logging
import psycopg2
from minio import Minio

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test_minio_list')

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

def list_bucket_contents():
    """Listar todos los contenidos del bucket de MinIO"""
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
            logger.warning(f"El bucket {bucket} no existe en MinIO")
            return
        else:
            logger.info(f"Bucket {bucket} existe y es accesible")
    except Exception as e:
        raise ValueError(f"Error verificando bucket de MinIO: {str(e)}")
    
    # Listar objetos en el bucket
    logger.info(f"Listando todos los objetos en bucket: {bucket}")
    objects = minio_client.list_objects(bucket, recursive=True)
    object_list = []
    
    for obj in objects:
        object_list.append(obj.object_name)
        logger.info(f"Objeto: {obj.object_name}, Tamaño: {obj.size} bytes, Última modificación: {obj.last_modified}")
    
    # También listar directorios (prefijos)
    logger.info(f"Listando directorios en el bucket: {bucket}")
    prefixes = set()
    for obj_name in object_list:
        parts = obj_name.split('/')
        for i in range(1, len(parts)):
            prefix = '/'.join(parts[:i]) + '/'
            prefixes.add(prefix)
    
    print(f"===== DIRECTORIOS ENCONTRADOS =====")
    for prefix in sorted(list(prefixes)):
        print(f"Directorio: {prefix}")
        
    print(f"===== ARCHIVOS DE PRUEBA =====")
    test_files = [obj for obj in object_list if "ffff.txtx" in obj]
    if test_files:
        for file in test_files:
            print(f"Archivo de prueba: {file}")
    else:
        print("No se encontraron archivos de prueba ffff.txtx")
    
    print(f"===== EJECUCIONES MIGRADAS =====")
    execution_dirs = set()
    for obj in object_list:
        if "/casilla" in obj:
            parts = obj.split('/')
            # Obtener el directorio de la ejecución (hasta input.yaml_XXX)
            for i in range(len(parts)):
                if "input.yaml_" in parts[i]:
                    execution_dir = '/'.join(parts[:i+1])
                    execution_dirs.add(execution_dir)
                    break
    
    for execution_dir in sorted(list(execution_dirs)):
        print(f"Ejecución migrada: {execution_dir}")
    
    return object_list

if __name__ == "__main__":
    try:
        objects = list_bucket_contents()
        print(f"Se encontraron {len(objects) if objects else 0} objetos en el bucket")
        
        # Imprimir solo información clave para no truncar el output
        print("\n===== DIRECTORIOS PRINCIPALES ENCONTRADOS =====")
        # Obtener solo los directorios principales de nivel 1 y 2
        # Por ejemplo: 'executions/' y 'executions/test_upload/'
        main_dirs = set()
        for obj in objects:
            parts = obj.split('/')
            if len(parts) > 0:
                main_dirs.add(parts[0] + '/')
                if len(parts) > 1:
                    main_dirs.add(parts[0] + '/' + parts[1] + '/')
                    
        for main_dir in sorted(list(main_dirs)):
            print(f"Directorio: {main_dir}")
        
        print("\n===== ARCHIVOS DE PRUEBA =====")
        test_files = [obj for obj in objects if "ffff.txtx" in obj]
        if test_files:
            for file in test_files:
                print(f"Archivo de prueba: {file}")
        else:
            print("No se encontraron archivos de prueba ffff.txtx")
        
        print("\n===== EJECUCIONES MIGRADAS =====")
        exec_dirs = set()
        for obj in objects:
            if "/input.yaml_" in obj:
                # Obtener el directorio hasta el nivel de input.yaml_XXX
                dir_parts = obj.split('/')
                path_prefix = ""
                for part in dir_parts:
                    path_prefix += part + "/"
                    if "input.yaml_" in part:
                        exec_dirs.add(path_prefix)
                        break
                
        for exec_dir in sorted(list(exec_dirs)):
            print(f"Ejecución migrada: {exec_dir}")
            
    except Exception as e:
        logger.error(f"Error al listar el bucket: {str(e)}")
        import traceback
        traceback.print_exc()