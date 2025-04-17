#!/usr/bin/env python3
"""
Script para probar operaciones básicas con el bucket MinIO
"""

from minio import Minio
from datetime import datetime
import os
import time

def test_minio_operations():
    """Probar operaciones con MinIO: creación, lectura, listado y eliminación de archivos"""
    # Parámetros de conexión
    endpoint = "51.79.79.6:9000"
    access_key = "3sNmVVPCnCe8K4vsa66G"
    secret_key = "jPc1VRq9zLKpoYHrumvYPzroXBJDai5jbg47qwwj"
    bucket = "sagebackup"
    secure = False
    
    print(f"Conectando a MinIO: {endpoint} (secure: {secure})")
    
    # Cliente MinIO
    minio_client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=secure
    )
    
    # Verificar el bucket
    bucket_exists = minio_client.bucket_exists(bucket)
    if not bucket_exists:
        print(f"El bucket {bucket} no existe, intentando crearlo...")
        minio_client.make_bucket(bucket)
        print(f"Bucket {bucket} creado exitosamente")
    else:
        print(f"Bucket {bucket} existe")
    
    # Base path para pruebas
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    test_dir = f"test_minio/{timestamp}"
    
    # Crear archivo temporal de prueba
    temp_file = f"test_file_{timestamp}.txt"
    with open(temp_file, "w") as f:
        f.write(f"Archivo de prueba de MinIO creado el {datetime.now().isoformat()}\n")
        f.write("Línea 1: Probando operaciones básicas\n")
        f.write("Línea 2: Subida de archivos\n")
        f.write("Línea 3: Verificación de existencia\n")
        f.write("Línea 4: Descarga de archivos\n")
        f.write("Línea 5: Eliminación de archivos")
    
    # 1. SUBIR ARCHIVO
    print(f"\n1. SUBIR ARCHIVO")
    file_path = f"{test_dir}/{temp_file}"
    print(f"Subiendo archivo a {file_path}...")
    
    try:
        # Subir el archivo
        minio_client.fput_object(
            bucket, 
            file_path, 
            temp_file,
            content_type="text/plain"
        )
        print(f"✓ Archivo subido exitosamente a minio://{bucket}/{file_path}")
    except Exception as e:
        print(f"✗ Error al subir archivo: {e}")
    
    # 2. VERIFICAR EXISTENCIA
    print(f"\n2. VERIFICAR EXISTENCIA")
    print(f"Verificando si el archivo existe...")
    
    try:
        # Verificar si el archivo existe
        obj_info = minio_client.stat_object(bucket, file_path)
        print(f"✓ Archivo encontrado:")
        print(f"  - Tamaño: {obj_info.size} bytes")
        print(f"  - Tipo: {obj_info.content_type}")
        print(f"  - Última modificación: {obj_info.last_modified}")
    except Exception as e:
        print(f"✗ Error al verificar archivo: {e}")
    
    # 3. DESCARGAR ARCHIVO
    print(f"\n3. DESCARGAR ARCHIVO")
    download_file = f"downloaded_{temp_file}"
    print(f"Descargando archivo como {download_file}...")
    
    try:
        # Descargar el archivo
        minio_client.fget_object(bucket, file_path, download_file)
        
        # Verificar contenido
        with open(download_file, "r") as f:
            content = f.read()
        
        print(f"✓ Archivo descargado exitosamente")
        print(f"Contenido del archivo descargado:")
        for i, line in enumerate(content.splitlines(), 1):
            print(f"  {i}: {line}")
    except Exception as e:
        print(f"✗ Error al descargar archivo: {e}")
    
    # 4. LISTAR ARCHIVOS
    print(f"\n4. LISTAR ARCHIVOS")
    prefix = "test_minio/"
    print(f"Listando objetos con prefijo '{prefix}'...")
    
    try:
        # Listar objetos
        objects = list(minio_client.list_objects(bucket, prefix=prefix, recursive=True))
        
        print(f"✓ Se encontraron {len(objects)} objetos:")
        for i, obj in enumerate(objects, 1):
            print(f"  {i}. {obj.object_name} ({obj.size} bytes)")
    except Exception as e:
        print(f"✗ Error al listar objetos: {e}")
    
    # 5. ELIMINAR ARCHIVO
    print(f"\n5. ELIMINAR ARCHIVO")
    print(f"Eliminando archivo {file_path}...")
    
    try:
        # Eliminar el archivo
        minio_client.remove_object(bucket, file_path)
        print(f"✓ Archivo eliminado exitosamente")
        
        # Verificar que fue eliminado
        try:
            minio_client.stat_object(bucket, file_path)
            print(f"✗ Error: El archivo sigue existiendo")
        except:
            print(f"✓ Verificado: El archivo ya no existe")
    except Exception as e:
        print(f"✗ Error al eliminar archivo: {e}")
    
    # Limpiar archivos locales
    try:
        os.remove(temp_file)
        os.remove(download_file)
        print(f"Archivos temporales eliminados")
    except:
        pass

if __name__ == "__main__":
    test_minio_operations()