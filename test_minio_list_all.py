#!/usr/bin/env python3
"""
Script para listar todos los archivos del bucket de MinIO
"""

import os
from minio import Minio

def list_all_objects():
    """Listar todos los objetos en el bucket de MinIO sin excepción"""
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
    
    # Verificar si el bucket existe
    try:
        bucket_exists = minio_client.bucket_exists(bucket)
        if not bucket_exists:
            print(f"El bucket {bucket} no existe en MinIO")
            return
        else:
            print(f"==== BUCKET: {bucket} ====")
    except Exception as e:
        print(f"Error verificando bucket de MinIO: {str(e)}")
        return
    
    # Listar todos los objetos en el bucket
    try:
        objects = list(minio_client.list_objects(bucket, recursive=True))
        
        # Ordenar por nombre de archivo para una salida más organizada
        objects.sort(key=lambda obj: obj.object_name)
        
        print(f"===== CONTENIDO DEL BUCKET ({len(objects)} archivos) =====")
        for i, obj in enumerate(objects, 1):
            # Ajustar a formato legible
            size_str = format_size(obj.size)
            print(f"{i:3}. {obj.object_name} ({size_str})")
        
        print(f"\n===== RESÚMENES POR TIPO DE ARCHIVO =====")
        
        # Agrupar y contar por extensión
        extensions = {}
        for obj in objects:
            _, ext = os.path.splitext(obj.object_name)
            ext = ext.lower() if ext else '(sin extensión)'
            if ext in extensions:
                extensions[ext] += 1
            else:
                extensions[ext] = 1
        
        print("Archivos por extensión:")
        for ext, count in sorted(extensions.items(), key=lambda x: x[1], reverse=True):
            print(f"- {ext}: {count} archivos")
            
        # Agrupar y contar por directorio
        directories = {}
        for obj in objects:
            parts = obj.object_name.split('/')
            if len(parts) > 1:
                directory = parts[0]
                if directory in directories:
                    directories[directory] += 1
                else:
                    directories[directory] = 1
        
        print("\nArchivos por directorio principal:")
        for directory, count in sorted(directories.items(), key=lambda x: x[1], reverse=True):
            print(f"- {directory}/: {count} archivos")
        
    except Exception as e:
        print(f"Error al listar objetos: {str(e)}")
        import traceback
        traceback.print_exc()

def format_size(size_bytes):
    """Formatea el tamaño en bytes a un formato legible"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes/1024:.2f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes/(1024*1024):.2f} MB"
    else:
        return f"{size_bytes/(1024*1024*1024):.2f} GB"

if __name__ == "__main__":
    list_all_objects()