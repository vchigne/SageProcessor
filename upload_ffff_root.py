#!/usr/bin/env python3
"""
Script para subir un archivo ffff.txt a la raíz del bucket MinIO
"""

from minio import Minio
from datetime import datetime

def upload_ffff():
    """Subir archivo ffff.txt a la raíz del bucket MinIO"""
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
    
    # Crear archivo temporal de prueba
    temp_file = "ffff.txt"
    with open(temp_file, "w") as f:
        f.write(f"Archivo de prueba de MinIO creado el {datetime.now().isoformat()}\n")
        f.write("Este archivo debe ser visible en la raíz del bucket\n")
        f.write("Prueba para ver si los archivos en la raíz son visibles en la interfaz\n")
    
    # Subir archivo a la raíz del bucket
    print(f"Subiendo archivo a la raíz del bucket como {temp_file}...")
    
    try:
        # Subir el archivo a la raíz
        minio_client.fput_object(
            bucket, 
            temp_file,  # Ruta en el bucket (raíz)
            temp_file,  # Archivo local
            content_type="text/plain"
        )
        print(f"✓ Archivo subido exitosamente a minio://{bucket}/{temp_file}")
    except Exception as e:
        print(f"✗ Error al subir archivo: {e}")
    
    # Verificar que el archivo existe
    print(f"Verificando si el archivo existe...")
    
    try:
        # Verificar si el archivo existe
        obj_info = minio_client.stat_object(bucket, temp_file)
        print(f"✓ Archivo encontrado:")
        print(f"  - Tamaño: {obj_info.size} bytes")
        print(f"  - Tipo: {obj_info.content_type}")
        print(f"  - Última modificación: {obj_info.last_modified}")
    except Exception as e:
        print(f"✗ Error al verificar archivo: {e}")
    
    # Listar archivos en la raíz
    print(f"Listando archivos en la raíz del bucket...")
    
    try:
        # Listar objetos en la raíz (sin prefijo, sin recursión)
        objects = list(minio_client.list_objects(bucket, recursive=False))
        
        print(f"✓ Se encontraron {len(objects)} objetos en la raíz:")
        for i, obj in enumerate(objects, 1):
            print(f"  {i}. {obj.object_name} ({obj.size} bytes)")
    except Exception as e:
        print(f"✗ Error al listar objetos: {e}")

if __name__ == "__main__":
    upload_ffff()