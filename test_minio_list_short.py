#!/usr/bin/env python3
"""
Script para listar los contenidos del bucket de MinIO (versión resumida)
"""

import os
import json
import logging
import psycopg2
from minio import Minio

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('test_minio_list')

def get_minio_client():
    """Obtener cliente MinIO configurado"""
    # Parámetros de conexión
    endpoint = "51.79.79.6:9000"
    access_key = "3sNmVVPCnCe8K4vsa66G"
    secret_key = "jPc1VRq9zLKpoYHrumvYPzroXBJDai5jbg47qwwj"
    bucket = "sagebackup"
    secure = False
    
    # Cliente MinIO
    minio_client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=secure
    )
    
    return minio_client, bucket

def list_bucket_summary():
    """Listar un resumen de los contenidos del bucket de MinIO"""
    minio_client, bucket = get_minio_client()
    
    # Verificar si el bucket existe
    try:
        bucket_exists = minio_client.bucket_exists(bucket)
        if not bucket_exists:
            print(f"El bucket {bucket} no existe en MinIO")
            return
        else:
            print(f"Bucket {bucket} existe y es accesible")
    except Exception as e:
        print(f"Error verificando bucket de MinIO: {str(e)}")
        return
    
    # Listar objetos en el bucket
    print(f"Buscando objetos en bucket: {bucket}...")
    
    try:
        # Contar objetos
        objects = list(minio_client.list_objects(bucket, recursive=True))
        total_objects = len(objects)
        print(f"Total de objetos en el bucket: {total_objects}")
        
        # Buscar directorios
        directories = set()
        for obj in objects:
            path = obj.object_name
            parts = path.split('/')
            # Añadir solo directorios de primer nivel
            if len(parts) > 1:
                directories.add(parts[0])
                
        print(f"\nDirectorios de primer nivel: {len(directories)}")
        for directory in sorted(directories):
            print(f"- {directory}/")
        
        # Buscar archivos de prueba ffff.txtx
        test_files = []
        for obj in objects:
            if "ffff.txtx" in obj.object_name:
                test_files.append(obj.object_name)
                
        print(f"\nArchivos de prueba ffff.txtx: {len(test_files)}")
        for test_file in test_files:
            print(f"- {test_file}")
            
        # Contar ejecuciones
        execution_dirs = set()
        for obj in objects:
            if "/input.yaml_" in obj.object_name:
                # Extraer el nombre base del directorio de la ejecución
                parts = obj.object_name.split('/')
                exec_dir = None
                for part in parts:
                    if "input.yaml_" in part:
                        exec_dir = part
                        break
                if exec_dir:
                    execution_dirs.add(exec_dir)
        
        print(f"\nDirectorios de ejecuciones: {len(execution_dirs)}")
        for exec_dir in sorted(execution_dirs):
            print(f"- {exec_dir}")
        
    except Exception as e:
        print(f"Error al listar objetos: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    list_bucket_summary()