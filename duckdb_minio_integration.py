#!/usr/bin/env python3
"""
Script para la integración de DuckDB con MinIO para almacenamiento distribuido

Este script permite:
1. Configurar la conexión con un servidor MinIO
2. Listar buckets disponibles
3. Subir/descargar archivos de DuckDB hacia/desde MinIO
4. Ejecutar consultas en DuckDB utilizando datos alojados en MinIO

Requiere configuración de acceso a MinIO (endpoint, access_key, secret_key)
"""

import os
import argparse
import json
import time
import duckdb
import tempfile
import uuid
import boto3
from botocore.client import Config

class DuckDBMinIOIntegration:
    """Clase para gestionar la integración entre DuckDB y MinIO"""
    
    def __init__(self, endpoint, access_key, secret_key, secure=False, region=None):
        """
        Inicializa la integración con MinIO
        
        Args:
            endpoint: Endpoint de MinIO (host:port)
            access_key: Access key para MinIO
            secret_key: Secret key para MinIO
            secure: Si es True, utiliza HTTPS en lugar de HTTP
            region: Región de MinIO (opcional)
        """
        self.endpoint = endpoint
        self.access_key = access_key
        self.secret_key = secret_key
        self.secure = secure
        self.region = region
        self.use_ssl = secure
        
        # Inicializar cliente de MinIO utilizando boto3
        protocol = "https" if secure else "http"
        self.client = boto3.client(
            's3',
            endpoint_url=f"{protocol}://{endpoint}",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region if region else 'us-east-1',
            config=Config(signature_version='s3v4'),
            verify=False  # No verificar SSL en entorno de desarrollo
        )
        
        # Inicializar conexión DuckDB
        self.duckdb_conn = None
    
    def connect_duckdb(self, db_path):
        """
        Conecta a una base de datos DuckDB
        
        Args:
            db_path: Ruta a la base de datos DuckDB
            
        Returns:
            bool: True si la conexión fue exitosa, False en caso contrario
        """
        try:
            self.duckdb_conn = duckdb.connect(db_path)
            print(f"Conexión establecida con DuckDB en {db_path}")
            return True
        except Exception as e:
            print(f"Error al conectar con DuckDB: {e}")
            return False
    
    def close_connections(self):
        """Cierra las conexiones a DuckDB y MinIO"""
        if self.duckdb_conn:
            self.duckdb_conn.close()
            print("Conexión a DuckDB cerrada")
    
    def test_minio_connection(self):
        """
        Prueba la conexión con MinIO
        
        Returns:
            bool: True si la conexión fue exitosa, False en caso contrario
        """
        try:
            # Listar los buckets como prueba de conexión
            buckets = self.client.list_buckets()
            print(f"Conexión exitosa a MinIO en {self.endpoint}")
            print(f"Buckets disponibles: {len(buckets['Buckets'])}")
            return True
        except Exception as e:
            print(f"Error al conectar con MinIO: {e}")
            return False
    
    def list_buckets(self):
        """
        Lista los buckets disponibles en MinIO
        
        Returns:
            list: Lista de nombres de buckets
        """
        try:
            buckets = self.client.list_buckets()
            bucket_names = [bucket['Name'] for bucket in buckets['Buckets']]
            print("Buckets disponibles en MinIO:")
            for idx, name in enumerate(bucket_names, 1):
                print(f"{idx}. {name}")
            return bucket_names
        except Exception as e:
            print(f"Error al listar buckets: {e}")
            return []
    
    def create_bucket(self, bucket_name):
        """
        Crea un nuevo bucket en MinIO
        
        Args:
            bucket_name: Nombre del bucket a crear
            
        Returns:
            bool: True si se creó el bucket, False en caso contrario
        """
        try:
            self.client.create_bucket(Bucket=bucket_name)
            print(f"Bucket '{bucket_name}' creado exitosamente")
            return True
        except Exception as e:
            print(f"Error al crear bucket '{bucket_name}': {e}")
            return False
    
    def list_objects(self, bucket_name, prefix=""):
        """
        Lista los objetos en un bucket de MinIO
        
        Args:
            bucket_name: Nombre del bucket
            prefix: Prefijo para filtrar objetos (opcional)
            
        Returns:
            list: Lista de objetos en el bucket
        """
        try:
            response = self.client.list_objects_v2(
                Bucket=bucket_name,
                Prefix=prefix
            )
            
            if 'Contents' not in response:
                print(f"No hay objetos en el bucket '{bucket_name}' con prefijo '{prefix}'")
                return []
            
            objects = response['Contents']
            print(f"Objetos en bucket '{bucket_name}' con prefijo '{prefix}':")
            for idx, obj in enumerate(objects, 1):
                print(f"{idx}. {obj['Key']} ({obj['Size']} bytes, última modificación: {obj['LastModified']})")
            return objects
        except Exception as e:
            print(f"Error al listar objetos en bucket '{bucket_name}': {e}")
            return []
    
    def upload_duckdb_to_minio(self, db_path, bucket_name, object_name=None):
        """
        Sube una base de datos DuckDB a MinIO
        
        Args:
            db_path: Ruta a la base de datos DuckDB
            bucket_name: Nombre del bucket
            object_name: Nombre del objeto en MinIO (opcional)
            
        Returns:
            bool: True si se subió la base de datos, False en caso contrario
        """
        try:
            # Si no se especifica un nombre de objeto, usar el nombre del archivo
            if object_name is None:
                object_name = os.path.basename(db_path)
            
            # Verificar que el archivo exista
            if not os.path.exists(db_path):
                print(f"El archivo {db_path} no existe")
                return False
            
            # Cerrar la conexión a DuckDB si está abierta
            if self.duckdb_conn:
                self.duckdb_conn.close()
                self.duckdb_conn = None
            
            # Subir el archivo
            print(f"Subiendo {db_path} a MinIO bucket '{bucket_name}' como '{object_name}'...")
            self.client.upload_file(
                Filename=db_path,
                Bucket=bucket_name,
                Key=object_name
            )
            
            print(f"Base de datos subida exitosamente a MinIO")
            return True
        except Exception as e:
            print(f"Error al subir la base de datos a MinIO: {e}")
            return False
        finally:
            # Reconectar a DuckDB
            if db_path and not self.duckdb_conn:
                self.duckdb_conn = duckdb.connect(db_path)
    
    def download_duckdb_from_minio(self, bucket_name, object_name, local_path):
        """
        Descarga una base de datos DuckDB desde MinIO
        
        Args:
            bucket_name: Nombre del bucket
            object_name: Nombre del objeto en MinIO
            local_path: Ruta local donde guardar la base de datos
            
        Returns:
            bool: True si se descargó la base de datos, False en caso contrario
        """
        try:
            # Cerrar la conexión a DuckDB si está abierta y la ruta coincide
            if self.duckdb_conn and os.path.abspath(local_path) == self.duckdb_conn.database:
                self.duckdb_conn.close()
                self.duckdb_conn = None
            
            print(f"Descargando '{object_name}' desde bucket '{bucket_name}' a '{local_path}'...")
            self.client.download_file(
                Bucket=bucket_name,
                Key=object_name,
                Filename=local_path
            )
            
            print(f"Base de datos descargada exitosamente")
            return True
        except Exception as e:
            print(f"Error al descargar la base de datos desde MinIO: {e}")
            return False
        finally:
            # Reconectar a DuckDB si es necesario
            if os.path.exists(local_path) and not self.duckdb_conn:
                self.duckdb_conn = duckdb.connect(local_path)
    
    def query_from_minio_parquet(self, bucket_name, parquet_path, sql_query):
        """
        Ejecuta una consulta SQL en DuckDB sobre un archivo Parquet almacenado en MinIO
        
        Args:
            bucket_name: Nombre del bucket
            parquet_path: Ruta al archivo Parquet en MinIO
            sql_query: Consulta SQL a ejecutar
            
        Returns:
            list: Resultados de la consulta
        """
        try:
            if not self.duckdb_conn:
                print("Error: No hay conexión activa a DuckDB")
                return None
            
            # Crear la URL de S3 para acceder al archivo
            protocol = "https" if self.secure else "http"
            s3_url = f"s3://{bucket_name}/{parquet_path}"
            
            # Configurar credenciales para acceso a S3/MinIO desde DuckDB
            self.duckdb_conn.execute(f"""
                SET s3_region='{self.region if self.region else "us-east-1"}';
                SET s3_endpoint='{self.endpoint}';
                SET s3_access_key_id='{self.access_key}';
                SET s3_secret_access_key='{self.secret_key}';
                SET s3_url_style='path';
                SET s3_use_ssl={str(self.use_ssl).lower()};
            """)
            
            # Ejecutar la consulta sobre el archivo Parquet
            print(f"Ejecutando consulta en archivo Parquet '{s3_url}'...")
            result = self.duckdb_conn.execute(f"""
                SELECT * FROM '{s3_url}'
                WHERE {sql_query}
            """).fetchall()
            
            # Mostrar resultados
            print(f"Consulta ejecutada exitosamente. Resultados: {len(result)}")
            
            # Mostrar algunos resultados
            if result:
                for idx, row in enumerate(result[:5], 1):
                    print(f"Fila {idx}: {row}")
                if len(result) > 5:
                    print(f"... y {len(result) - 5} filas más")
            
            return result
        except Exception as e:
            print(f"Error al ejecutar consulta en archivo Parquet: {e}")
            return None
    
    def export_query_to_parquet(self, sql_query, bucket_name, parquet_path):
        """
        Ejecuta una consulta SQL en DuckDB y exporta los resultados a un archivo Parquet en MinIO
        
        Args:
            sql_query: Consulta SQL a ejecutar
            bucket_name: Nombre del bucket
            parquet_path: Ruta al archivo Parquet en MinIO
            
        Returns:
            bool: True si se exportó correctamente, False en caso contrario
        """
        try:
            if not self.duckdb_conn:
                print("Error: No hay conexión activa a DuckDB")
                return False
            
            # Crear un archivo temporal para almacenar el resultado
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.parquet')
            temp_path = temp_file.name
            temp_file.close()
            
            # Ejecutar la consulta y guardar resultados en el archivo temporal
            print(f"Ejecutando consulta y guardando resultados en archivo Parquet...")
            self.duckdb_conn.execute(f"""
                COPY ({sql_query}) TO '{temp_path}' (FORMAT PARQUET);
            """)
            
            # Subir el archivo a MinIO
            print(f"Subiendo archivo Parquet a MinIO bucket '{bucket_name}' como '{parquet_path}'...")
            self.client.upload_file(
                Filename=temp_path,
                Bucket=bucket_name,
                Key=parquet_path
            )
            
            # Eliminar el archivo temporal
            os.unlink(temp_path)
            
            print(f"Resultados exportados exitosamente a MinIO como '{parquet_path}'")
            return True
        except Exception as e:
            print(f"Error al exportar resultados a archivo Parquet en MinIO: {e}")
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            return False

def configurar_parser():
    """Configura el parser de argumentos de línea de comandos"""
    parser = argparse.ArgumentParser(description='Integración de DuckDB con MinIO')
    
    # Comandos principales
    subparsers = parser.add_subparsers(dest='comando', help='Comando a ejecutar')
    
    # Comando: test-connection
    parser_test = subparsers.add_parser('test-connection', help='Probar la conexión con MinIO')
    parser_test.add_argument('--endpoint', required=True, help='Endpoint de MinIO (host:port)')
    parser_test.add_argument('--access-key', required=True, help='Access key para MinIO')
    parser_test.add_argument('--secret-key', required=True, help='Secret key para MinIO')
    parser_test.add_argument('--secure', action='store_true', help='Usar HTTPS en lugar de HTTP')
    
    # Comando: list-buckets
    parser_list = subparsers.add_parser('list-buckets', help='Listar buckets disponibles en MinIO')
    parser_list.add_argument('--endpoint', required=True, help='Endpoint de MinIO (host:port)')
    parser_list.add_argument('--access-key', required=True, help='Access key para MinIO')
    parser_list.add_argument('--secret-key', required=True, help='Secret key para MinIO')
    parser_list.add_argument('--secure', action='store_true', help='Usar HTTPS en lugar de HTTP')
    
    # Comando: create-bucket
    parser_create = subparsers.add_parser('create-bucket', help='Crear un nuevo bucket en MinIO')
    parser_create.add_argument('--endpoint', required=True, help='Endpoint de MinIO (host:port)')
    parser_create.add_argument('--access-key', required=True, help='Access key para MinIO')
    parser_create.add_argument('--secret-key', required=True, help='Secret key para MinIO')
    parser_create.add_argument('--secure', action='store_true', help='Usar HTTPS en lugar de HTTP')
    parser_create.add_argument('--bucket-name', required=True, help='Nombre del bucket a crear')
    
    # Comando: list-objects
    parser_list_obj = subparsers.add_parser('list-objects', help='Listar objetos en un bucket de MinIO')
    parser_list_obj.add_argument('--endpoint', required=True, help='Endpoint de MinIO (host:port)')
    parser_list_obj.add_argument('--access-key', required=True, help='Access key para MinIO')
    parser_list_obj.add_argument('--secret-key', required=True, help='Secret key para MinIO')
    parser_list_obj.add_argument('--secure', action='store_true', help='Usar HTTPS en lugar de HTTP')
    parser_list_obj.add_argument('--bucket-name', required=True, help='Nombre del bucket')
    parser_list_obj.add_argument('--prefix', default='', help='Prefijo para filtrar objetos (opcional)')
    
    # Comando: upload-db
    parser_upload = subparsers.add_parser('upload-db', help='Subir una base de datos DuckDB a MinIO')
    parser_upload.add_argument('--endpoint', required=True, help='Endpoint de MinIO (host:port)')
    parser_upload.add_argument('--access-key', required=True, help='Access key para MinIO')
    parser_upload.add_argument('--secret-key', required=True, help='Secret key para MinIO')
    parser_upload.add_argument('--secure', action='store_true', help='Usar HTTPS en lugar de HTTP')
    parser_upload.add_argument('--db-path', required=True, help='Ruta a la base de datos DuckDB')
    parser_upload.add_argument('--bucket-name', required=True, help='Nombre del bucket')
    parser_upload.add_argument('--object-name', help='Nombre del objeto en MinIO (opcional)')
    
    # Comando: download-db
    parser_download = subparsers.add_parser('download-db', help='Descargar una base de datos DuckDB desde MinIO')
    parser_download.add_argument('--endpoint', required=True, help='Endpoint de MinIO (host:port)')
    parser_download.add_argument('--access-key', required=True, help='Access key para MinIO')
    parser_download.add_argument('--secret-key', required=True, help='Secret key para MinIO')
    parser_download.add_argument('--secure', action='store_true', help='Usar HTTPS en lugar de HTTP')
    parser_download.add_argument('--bucket-name', required=True, help='Nombre del bucket')
    parser_download.add_argument('--object-name', required=True, help='Nombre del objeto en MinIO')
    parser_download.add_argument('--local-path', required=True, help='Ruta local donde guardar la base de datos')
    
    # Comando: query-parquet
    parser_query = subparsers.add_parser('query-parquet', help='Ejecutar consulta SQL en archivo Parquet almacenado en MinIO')
    parser_query.add_argument('--endpoint', required=True, help='Endpoint de MinIO (host:port)')
    parser_query.add_argument('--access-key', required=True, help='Access key para MinIO')
    parser_query.add_argument('--secret-key', required=True, help='Secret key para MinIO')
    parser_query.add_argument('--secure', action='store_true', help='Usar HTTPS en lugar de HTTP')
    parser_query.add_argument('--db-path', required=True, help='Ruta a la base de datos DuckDB')
    parser_query.add_argument('--bucket-name', required=True, help='Nombre del bucket')
    parser_query.add_argument('--parquet-path', required=True, help='Ruta al archivo Parquet en MinIO')
    parser_query.add_argument('--sql-query', required=True, help='Consulta SQL a ejecutar')
    
    # Comando: export-to-parquet
    parser_export = subparsers.add_parser('export-to-parquet', help='Exportar resultados de consulta SQL a archivo Parquet en MinIO')
    parser_export.add_argument('--endpoint', required=True, help='Endpoint de MinIO (host:port)')
    parser_export.add_argument('--access-key', required=True, help='Access key para MinIO')
    parser_export.add_argument('--secret-key', required=True, help='Secret key para MinIO')
    parser_export.add_argument('--secure', action='store_true', help='Usar HTTPS en lugar de HTTP')
    parser_export.add_argument('--db-path', required=True, help='Ruta a la base de datos DuckDB')
    parser_export.add_argument('--bucket-name', required=True, help='Nombre del bucket')
    parser_export.add_argument('--parquet-path', required=True, help='Ruta al archivo Parquet en MinIO')
    parser_export.add_argument('--sql-query', required=True, help='Consulta SQL a ejecutar')
    
    return parser

def main():
    """Función principal"""
    # Configurar el parser de argumentos
    parser = configurar_parser()
    args = parser.parse_args()
    
    # Verificar que se proporcionó un comando
    if not args.comando:
        parser.print_help()
        return
    
    # Crear la integración con MinIO
    integration = None
    
    try:
        # Comandos que requieren conexión a MinIO
        if args.comando in ['test-connection', 'list-buckets', 'create-bucket', 'list-objects',
                           'upload-db', 'download-db', 'query-parquet', 'export-to-parquet']:
            integration = DuckDBMinIOIntegration(
                endpoint=args.endpoint,
                access_key=args.access_key,
                secret_key=args.secret_key,
                secure=args.secure if 'secure' in args else False
            )
        
        # Comandos que requieren conexión a DuckDB
        if args.comando in ['upload-db', 'query-parquet', 'export-to-parquet']:
            if not integration.connect_duckdb(args.db_path):
                return
        
        # Ejecutar el comando correspondiente
        if args.comando == 'test-connection':
            integration.test_minio_connection()
        elif args.comando == 'list-buckets':
            integration.list_buckets()
        elif args.comando == 'create-bucket':
            integration.create_bucket(args.bucket_name)
        elif args.comando == 'list-objects':
            integration.list_objects(args.bucket_name, args.prefix)
        elif args.comando == 'upload-db':
            integration.upload_duckdb_to_minio(args.db_path, args.bucket_name, args.object_name)
        elif args.comando == 'download-db':
            integration.download_duckdb_from_minio(args.bucket_name, args.object_name, args.local_path)
        elif args.comando == 'query-parquet':
            integration.query_from_minio_parquet(args.bucket_name, args.parquet_path, args.sql_query)
        elif args.comando == 'export-to-parquet':
            integration.export_query_to_parquet(args.sql_query, args.bucket_name, args.parquet_path)
        else:
            print(f"Comando no reconocido: {args.comando}")
            parser.print_help()
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if integration:
            integration.close_connections()

if __name__ == "__main__":
    main()