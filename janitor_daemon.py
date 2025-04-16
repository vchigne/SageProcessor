#!/usr/bin/env python3
"""
SAGE Janitor Daemon

Este daemon se encarga de:
1. Migrar ejecuciones antiguas del almacenamiento local a la nube
2. Actualizar los registros en la base de datos para reflejar la nueva ubicación
3. Limpiar archivos temporales

Se recomienda ejecutarlo periódicamente (p.ej. cada 6-12 horas) mediante cron o similar.
"""

import os
import sys
import time
import logging
import psycopg2
import shutil
from datetime import datetime, timedelta
import json
import requests
from pathlib import Path

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='logs/janitor_daemon.log',
    filemode='a'
)
logger = logging.getLogger('janitor_daemon')

# Añadir handler para consola
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

class JanitorDaemon:
    """Daemon para gestionar la migración de ejecuciones a la nube y limpieza de archivos temporales"""
    
    def __init__(self):
        """Inicializar el daemon"""
        self.db_connection = None
        self.config = None
        self.cloud_providers = {}
        
        try:
            # Obtener la conexión a la base de datos
            self.db_connection = self._get_database_connection()
            
            # Cargar la configuración
            self.config = self._load_configuration()
            
            # Cargar los proveedores de nube configurados
            self._load_cloud_providers()
            
        except Exception as e:
            logger.error(f"Error inicializando Janitor Daemon: {e}")
            raise
    
    def _get_database_connection(self):
        """Obtener conexión a la base de datos"""
        db_url = os.environ.get('DATABASE_URL')
        if not db_url:
            raise ValueError("No se encontró la variable de entorno DATABASE_URL")
        
        connection = psycopg2.connect(db_url)
        return connection
    
    def _load_configuration(self):
        """Cargar la configuración de ejecuciones desde la base de datos"""
        if not self.db_connection:
            raise ValueError("No hay conexión a la base de datos")
        
        with self.db_connection.cursor() as cursor:
            cursor.execute("SELECT * FROM ejecuciones_config ORDER BY id DESC LIMIT 1")
            config = cursor.fetchone()
            
            if not config:
                logger.warning("No se encontró configuración de ejecuciones. Utilizando valores predeterminados.")
                return {
                    'nube_primaria_id': None,
                    'nubes_alternativas': [],
                    'tiempo_retencion_local': 0,  # Migrar todas las ejecuciones sin importar la antigüedad
                    'prefijo_ruta_nube': '',
                    'migrar_automaticamente': True
                }
            
            # Convertir a diccionario
            columns = [desc[0] for desc in cursor.description]
            config_dict = dict(zip(columns, config))
            
            # Verificar que nubes_alternativas sea una lista
            if config_dict.get('nubes_alternativas') is None:
                config_dict['nubes_alternativas'] = []
            
            return config_dict
    
    def _load_cloud_providers(self):
        """Cargar los proveedores de nube configurados"""
        if not self.db_connection or not self.config:
            raise ValueError("No hay conexión a la base de datos o configuración")
        
        # Solo cargar si hay un proveedor primario configurado
        if not self.config['nube_primaria_id']:
            logger.warning("No hay proveedor de nube primario configurado. No se realizará migración.")
            return
        
        # Obtener todos los proveedores necesarios
        provider_ids = [self.config['nube_primaria_id']]
        if self.config['nubes_alternativas']:
            provider_ids.extend(self.config['nubes_alternativas'])
        
        logger.info(f"Cargando proveedores con IDs: {provider_ids}")
        
        with self.db_connection.cursor() as cursor:
            placeholders = ','.join(['%s'] * len(provider_ids))
            query = f"SELECT * FROM cloud_providers WHERE id IN ({placeholders})"
            logger.info(f"Ejecutando consulta: {query} con parámetros {provider_ids}")
            
            cursor.execute(query, provider_ids)
            providers = cursor.fetchall()
            
            logger.info(f"Proveedores obtenidos: {len(providers) if providers else 0}")
            
            if not providers:
                logger.warning(f"No se encontraron proveedores con los IDs: {provider_ids}")
                return
            
            # Convertir a diccionarios
            columns = [desc[0] for desc in cursor.description]
            logger.info(f"Columnas de proveedores en la BD: {columns}")
            
            for provider in providers:
                provider_dict = dict(zip(columns, provider))
                
                # Log para depuración - Mostrar estructura de cada proveedor
                logger.info(f"Estructura del proveedor {provider_dict.get('id')} - {provider_dict.get('nombre')}: {provider_dict.keys()}")
                
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
                
                self.cloud_providers[provider_dict['id']] = provider_dict
                
            logger.info(f"Proveedores cargados: {list(self.cloud_providers.keys())}")
    
    def run(self):
        """Ejecutar el daemon"""
        logger.info("Iniciando Janitor Daemon")
        
        try:
            # Verificar si la migración automática está habilitada
            if not self.config['migrar_automaticamente']:
                logger.info("La migración automática está deshabilitada. Saliendo.")
                return
            
            # Verificar si hay un proveedor primario configurado
            if not self.config['nube_primaria_id']:
                logger.warning("No hay proveedor de nube primario configurado. No se realizará migración.")
                return
            
            logger.info(f"Configuración cargada: {self.config}")
            logger.info(f"Proveedores de nube cargados: {list(self.cloud_providers.keys())}")
            
            # Migrar ejecuciones antiguas a la nube 
            self._migrate_old_executions()
            
            # Limpiar archivos temporales
            self._clean_temp_files()
            
            logger.info("Janitor Daemon completado con éxito")
            
        except Exception as e:
            import traceback
            logger.error(f"Error ejecutando Janitor Daemon: {e}")
            logger.error(f"Traza completa: {traceback.format_exc()}")
            raise
        finally:
            # Cerrar la conexión a la base de datos
            if self.db_connection:
                self.db_connection.close()
    
    def _migrate_old_executions(self, only_existing_directories=True, max_age_hours=None):
        """
        Migrar ejecuciones antiguas a la nube
        
        Args:
            only_existing_directories (bool): Si es True, solo procesa directorios que existen físicamente
            max_age_hours (float, optional): Edad máxima en horas para migrar (sobreescribe configuración)
        """
        logger.info(f"Iniciando migración de ejecuciones antiguas a la nube (solo existentes: {only_existing_directories})")
        
        # Calcular la fecha límite para migración
        if max_age_hours is not None:
            # Usar el valor proporcionado para pruebas
            horas_retencion = max_age_hours
            logger.info(f"Usando tiempo de retención personalizado: {max_age_hours} horas")
        else:
            # Usar la configuración normal
            horas_retencion = self.config['tiempo_retencion_local']
            logger.info(f"Usando tiempo de retención configurado: {horas_retencion} horas")
            
        fecha_limite = datetime.now() - timedelta(hours=horas_retencion)
        
        logger.info(f"Fecha límite para migración: {fecha_limite}")
        
        # Obtener ejecuciones antiguas no migradas
        with self.db_connection.cursor() as cursor:
            try:
                # Usar directamente la consulta SQL sin parámetros dinámicos para evitar problemas
                fecha_limite_str = fecha_limite.strftime('%Y-%m-%d %H:%M:%S')
                logger.info(f"Fecha límite formateada: {fecha_limite_str}")
                
                # En esta versión, incluimos la fecha directamente en la consulta SQL
                # También incluimos ejecuciones que están marcadas como migradas pero sin ruta_nube
                # Modificada para migrar todas las ejecuciones no migradas
                sql_query = f"""
                    SELECT id, nombre_yaml, ruta_directorio, fecha_ejecucion, casilla_id
                    FROM ejecuciones_yaml
                    WHERE (
                        (migrado_a_nube = FALSE OR migrado_a_nube IS NULL)
                        OR
                        (migrado_a_nube = TRUE AND (ruta_nube IS NULL OR ruta_nube = ''))
                    )
                    AND ruta_directorio IS NOT NULL
                    AND ruta_directorio NOT LIKE 'cloud://%'
                    ORDER BY fecha_ejecucion DESC
                    LIMIT 10  -- Solo tomar las 10 más recientes para probar
                """
                logger.info(f"Ejecutando SQL: {sql_query}")
                
                cursor.execute(sql_query)
                
                ejecuciones = cursor.fetchall()
                
                if not ejecuciones:
                    logger.info("No hay ejecuciones para migrar.")
                    return
                
                logger.info(f"Se encontraron {len(ejecuciones)} ejecuciones para migrar.")
                
                # Filtrar ejecuciones si solo_existing_directories es True
                if only_existing_directories:
                    ejecuciones_filtradas = []
                    for ejecucion in ejecuciones:
                        ruta_directorio = ejecucion[2]  # Índice 2 es ruta_directorio
                        
                        # Solo incluir ejecuciones donde el directorio existe
                        if os.path.exists(ruta_directorio):
                            ejecuciones_filtradas.append(ejecucion)
                        else:
                            # Marcar como migrada sin migrar archivos
                            logger.warning(f"La ruta local {ruta_directorio} no existe. Marcando ejecución {ejecucion[0]} como migrada sin migrar archivos.")
                            cursor.execute("""
                                UPDATE ejecuciones_yaml
                                SET migrado_a_nube = TRUE
                                WHERE id = %s
                            """, (ejecucion[0],))
                            # Confirmar la transacción inmediatamente
                            self.db_connection.commit()
                    
                    logger.info(f"Después de filtrar, quedan {len(ejecuciones_filtradas)} ejecuciones con directorios existentes para migrar.")
                    ejecuciones = ejecuciones_filtradas
                
                # Migrar cada ejecución
                for ejecucion in ejecuciones:
                    try:
                        self._migrate_execution(ejecucion, cursor)
                        # Confirmar la transacción
                        self.db_connection.commit()
                    except Exception as e:
                        # Revertir la transacción en caso de error
                        self.db_connection.rollback()
                        logger.error(f"Error migrando ejecución {ejecucion[0]}: {e}")
            except Exception as e:
                logger.error(f"Error al obtener ejecuciones para migrar: {e}")
                raise
    
    def _migrate_execution(self, ejecucion, cursor):
        """Migrar una ejecución específica a la nube"""
        ejecucion_id, nombre_yaml, ruta_directorio, fecha_ejecucion, id_casilla = ejecucion
        
        logger.info(f"Migrando ejecución {ejecucion_id} ({nombre_yaml}) a la nube")
        
        # Verificar que la ruta local existe
        if not os.path.exists(ruta_directorio):
            logger.warning(f"La ruta local {ruta_directorio} no existe. Marcando como migrada sin migrar archivos.")
            cursor.execute("""
                UPDATE ejecuciones_yaml
                SET migrado_a_nube = TRUE
                WHERE id = %s
            """, (ejecucion_id,))
            return
        
        # Construir la ruta en la nube
        prefijo = self.config['prefijo_ruta_nube'] or ''
        if prefijo and not prefijo.endswith('/'):
            prefijo += '/'
        
        # Formatear la fecha para la ruta
        fecha_str = fecha_ejecucion.strftime('%Y/%m/%d')
        
        # Manejar el caso donde id_casilla puede ser NULL
        casilla_path = f"casilla{id_casilla}" if id_casilla else "sin_casilla"
        
        # Construir un nombre único para la carpeta en la nube
        carpeta_nube = f"{prefijo}{casilla_path}/{fecha_str}/{nombre_yaml}_{ejecucion_id}"
        
        # Proveedor primario
        nube_primaria_id = self.config['nube_primaria_id']
        proveedor_primario = self.cloud_providers.get(nube_primaria_id)
        
        if not proveedor_primario:
            raise ValueError(f"No se encontró el proveedor primario con ID {nube_primaria_id}")
            
        # Asegurar que tenemos la configuración como diccionario
        if 'configuracion' in proveedor_primario and not isinstance(proveedor_primario['configuracion'], dict):
            try:
                proveedor_primario['configuracion'] = json.loads(proveedor_primario['configuracion'])
            except:
                logger.warning(f"No se pudo parsear la configuración del proveedor {proveedor_primario['nombre']}")
                
        # Asegurar que tenemos las credenciales como diccionario
        if 'credenciales' in proveedor_primario and not isinstance(proveedor_primario['credenciales'], dict):
            try:
                proveedor_primario['credenciales'] = json.loads(proveedor_primario['credenciales'])
            except:
                logger.warning(f"No se pudo parsear las credenciales del proveedor {proveedor_primario['nombre']}")
        
        # Debug para ver qué tiene el proveedor
        logger.info(f"Estructura del proveedor primario: {proveedor_primario.keys()}")
        
        # Construir la ruta URI para la nube primaria
        ruta_nube_primaria = f"cloud://{proveedor_primario['nombre']}/{carpeta_nube}"
        
        # Lista de rutas alternativas
        rutas_alternativas = []
        
        # Migrar a la nube primaria
        self._upload_directory_to_cloud(
            ruta_directorio, 
            carpeta_nube, 
            proveedor_primario
        )
        
        # Migrar a nubes alternativas si están configuradas
        if self.config['nubes_alternativas']:
            for nube_alt_id in self.config['nubes_alternativas']:
                try:
                    proveedor_alt = self.cloud_providers.get(nube_alt_id)
                    if proveedor_alt:
                        # Asegurar que tenemos la configuración como diccionario
                        if 'configuracion' in proveedor_alt and not isinstance(proveedor_alt['configuracion'], dict):
                            try:
                                proveedor_alt['configuracion'] = json.loads(proveedor_alt['configuracion'])
                            except:
                                logger.warning(f"No se pudo parsear la configuración del proveedor alternativo {proveedor_alt['nombre']}")
                                
                        # Asegurar que tenemos las credenciales como diccionario
                        if 'credenciales' in proveedor_alt and not isinstance(proveedor_alt['credenciales'], dict):
                            try:
                                proveedor_alt['credenciales'] = json.loads(proveedor_alt['credenciales'])
                            except:
                                logger.warning(f"No se pudo parsear las credenciales del proveedor alternativo {proveedor_alt['nombre']}")
                                
                        # Construir la ruta URI para la nube alternativa
                        ruta_alt = f"cloud://{proveedor_alt['nombre']}/{carpeta_nube}"
                        rutas_alternativas.append(ruta_alt)
                        
                        # Migrar a la nube alternativa
                        self._upload_directory_to_cloud(
                            ruta_directorio, 
                            carpeta_nube, 
                            proveedor_alt
                        )
                except Exception as e:
                    logger.error(f"Error migrando a nube alternativa {nube_alt_id}: {e}")
        
        # Actualizar el registro en la base de datos
        # Convertir las listas a formato adecuado para PostgreSQL (TEXT[] o JSON)
        nubes_alt = None
        rutas_alt = None
        
        if self.config['nubes_alternativas']:
            # Convertir lista a string para PostgreSQL array
            nubes_alt = '{' + ','.join(str(id) for id in self.config['nubes_alternativas']) + '}'
            logger.debug(f"nubes_alternativas formateado para PostgreSQL: {nubes_alt}")
        
        if rutas_alternativas:
            # Convertir lista a string para PostgreSQL array
            rutas_alt = '{' + ','.join(f'"{ruta}"' for ruta in rutas_alternativas) + '}'
            logger.debug(f"rutas_alternativas formateado para PostgreSQL: {rutas_alt}")
        
        cursor.execute("""
            UPDATE ejecuciones_yaml
            SET nube_primaria_id = %s,
                ruta_nube = %s,
                ruta_directorio = %s,   /* Actualizar también la ruta_directorio para que sea la ruta en la nube */
                nubes_alternativas = %s,
                rutas_alternativas = %s,
                migrado_a_nube = TRUE
            WHERE id = %s
        """, (
            nube_primaria_id,
            ruta_nube_primaria,
            ruta_nube_primaria,         # Usar la misma ruta_nube_primaria como ruta_directorio
            nubes_alt,
            rutas_alt,
            ejecucion_id
        ))
        
        # Si la migración fue exitosa, eliminar los archivos locales
        shutil.rmtree(ruta_directorio)
        
        logger.info(f"Ejecución {ejecucion_id} migrada correctamente a {ruta_nube_primaria}")
    
    def _upload_directory_to_cloud(self, local_path, cloud_path, provider):
        """Subir un directorio a la nube usando el proveedor adecuado"""
        logger.info(f"Subiendo {local_path} a {provider['nombre']}/{cloud_path}")
        
        # Log de proveedor para depuración
        logger.info(f"Detalles del proveedor: ID={provider.get('id')}, Nombre={provider.get('nombre')}, Tipo={provider.get('tipo')}")
        
        # La lógica de subida dependerá del tipo de proveedor
        provider_type = provider['tipo'].lower()
        
        if provider_type == 's3' or provider_type == 'minio':
            self._upload_to_s3(local_path, cloud_path, provider)
        elif provider_type == 'azure':
            self._upload_to_azure(local_path, cloud_path, provider)
        elif provider_type == 'gcp':
            self._upload_to_gcp(local_path, cloud_path, provider)
        elif provider_type == 'sftp':
            self._upload_to_sftp(local_path, cloud_path, provider)
        else:
            raise ValueError(f"Tipo de proveedor no soportado: {provider_type}")
    
    def _upload_to_s3(self, local_path, cloud_path, provider):
        """Subir archivos a S3 o MinIO"""
        import boto3
        from botocore.exceptions import ClientError
        
        # Parsear credenciales y configuración
        config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion']) if 'configuracion' in provider else {}
        credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales']) if 'credenciales' in provider else {}
        
        # Logs para depuración
        logger.info(f"Credenciales S3: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
        logger.info(f"Configuración S3: {list(config.keys()) if config else 'No hay configuración'}")
        
        # Crear cliente S3 - Ajustado para coincidir con la implementación JS
        s3_client = boto3.client(
            's3',
            endpoint_url=credentials.get('endpoint'),
            aws_access_key_id=credentials.get('access_key'),
            aws_secret_access_key=credentials.get('secret_key'),
            region_name=credentials.get('region', 'us-east-1')  # Valor predeterminado como en el JavaScript
        )
        
        # Bucket puede estar en credenciales o en configuración
        bucket = credentials.get('bucket') or config.get('bucket')
        
        # Subir todos los archivos en el directorio
        for root, dirs, files in os.walk(local_path):
            for file in files:
                local_file_path = os.path.join(root, file)
                
                # Calcular la ruta relativa para el objeto S3
                rel_path = os.path.relpath(local_file_path, local_path)
                s3_key = f"{cloud_path}/{rel_path}"
                
                # Subir el archivo
                try:
                    s3_client.upload_file(local_file_path, bucket, s3_key)
                    logger.debug(f"Archivo {local_file_path} subido a s3://{bucket}/{s3_key}")
                except ClientError as e:
                    logger.error(f"Error subiendo archivo a S3: {e}")
                    raise
    
    def _upload_to_azure(self, local_path, cloud_path, provider):
        """Subir archivos a Azure Blob Storage"""
        from azure.storage.blob import BlobServiceClient
        
        # Parsear credenciales y configuración
        config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion']) if 'configuracion' in provider else {}
        credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales']) if 'credenciales' in provider else {}
        
        # Logs para depuración
        logger.info(f"Credenciales Azure: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
        logger.info(f"Configuración Azure: {list(config.keys()) if config else 'No hay configuración'}")
        
        # Obtener string de conexión y nombre del contenedor
        # El string de conexión puede estar en credenciales o configuración
        connection_string = credentials.get('connection_string') or config.get('connection_string')
        container_name = credentials.get('container_name') or config.get('container_name')
        
        if not connection_string:
            raise ValueError("No se configuró correctamente la cadena de conexión para Azure")
            
        if not container_name:
            raise ValueError("No se configuró correctamente el nombre del contenedor para Azure")
            
        # Crear cliente de servicio usando la cadena de conexión
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        
        # Obtener cliente de contenedor
        container_client = blob_service_client.get_container_client(container_name)
        
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
    
    def _upload_to_gcp(self, local_path, cloud_path, provider):
        """Subir archivos a Google Cloud Storage"""
        from google.cloud import storage
        import tempfile
        
        # Parsear credenciales y configuración
        config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion']) if 'configuracion' in provider else {}
        credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales']) if 'credenciales' in provider else {}
        
        # Logs para depuración
        logger.info(f"Credenciales GCP: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
        logger.info(f"Configuración GCP: {list(config.keys()) if config else 'No hay configuración'}")
        
        # Obtener el archivo de clave y el nombre del bucket (puede estar en credenciales o configuración)
        key_data = credentials.get('key_file') or config.get('key_file')
        bucket_name = credentials.get('bucket_name') or config.get('bucket_name')
        
        if not key_data:
            raise ValueError("No se encontró el archivo de clave (key_file) para GCP")
            
        if not bucket_name:
            raise ValueError("No se encontró el nombre del bucket para GCP")
        
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
    
    def _upload_to_sftp(self, local_path, cloud_path, provider):
        """Subir archivos a servidor SFTP"""
        import paramiko
        
        # Parsear credenciales y configuración
        config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion']) if 'configuracion' in provider else {}
        credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales']) if 'credenciales' in provider else {}
        
        # Logs para depuración
        logger.info(f"Credenciales SFTP: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
        logger.info(f"Configuración SFTP: {list(config.keys()) if config else 'No hay configuración'}")
        
        # Los parámetros pueden estar en credenciales o en configuración
        host = credentials.get('host') or config.get('host')
        port = int(credentials.get('port', 22) or config.get('port', 22))
        user = credentials.get('user') or config.get('user')
        password = credentials.get('password') or config.get('password')
        
        if not host:
            raise ValueError("No se configuró correctamente el host para SFTP")
            
        if not user:
            raise ValueError("No se configuró correctamente el usuario para SFTP")
            
        if not password:
            raise ValueError("No se configuró correctamente la contraseña para SFTP")
        
        # Crear cliente SFTP
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        try:
            # Conectar al servidor
            ssh_client.connect(
                hostname=host,
                port=port,
                username=user,
                password=password
            )
            
            # Crear cliente SFTP
            sftp_client = ssh_client.open_sftp()
            
            # Asegurarse de que el directorio remoto existe
            self._sftp_mkdir_p(sftp_client, cloud_path)
            
            # Subir todos los archivos en el directorio
            for root, dirs, files in os.walk(local_path):
                for dir_name in dirs:
                    # Crear subdirectorios
                    local_dir_path = os.path.join(root, dir_name)
                    rel_path = os.path.relpath(local_dir_path, local_path)
                    remote_dir_path = f"{cloud_path}/{rel_path}"
                    
                    try:
                        self._sftp_mkdir_p(sftp_client, remote_dir_path)
                    except Exception as e:
                        logger.error(f"Error creando directorio SFTP {remote_dir_path}: {e}")
                
                for file in files:
                    local_file_path = os.path.join(root, file)
                    
                    # Calcular la ruta relativa para el archivo SFTP
                    rel_path = os.path.relpath(local_file_path, local_path)
                    remote_file_path = f"{cloud_path}/{rel_path}"
                    
                    # Asegurarse de que el directorio padre existe
                    remote_dir = os.path.dirname(remote_file_path)
                    self._sftp_mkdir_p(sftp_client, remote_dir)
                    
                    # Subir el archivo
                    try:
                        sftp_client.put(local_file_path, remote_file_path)
                        logger.debug(f"Archivo {local_file_path} subido a sftp://{host}:{port}/{remote_file_path}")
                    except Exception as e:
                        logger.error(f"Error subiendo archivo a SFTP: {e}")
                        raise
                        
        finally:
            # Cerrar la conexión
            if 'sftp_client' in locals():
                sftp_client.close()
            if 'ssh_client' in locals():
                ssh_client.close()
    
    def _sftp_mkdir_p(self, sftp, remote_directory):
        """Crear directorio remoto recursivamente (mkdir -p)"""
        if remote_directory == '/':
            # Directorio raíz
            return
        
        if remote_directory == '':
            # Directorio vacío
            return
        
        try:
            sftp.stat(remote_directory)
        except IOError:
            # El directorio no existe, crearlo
            parent = os.path.dirname(remote_directory)
            if parent:
                self._sftp_mkdir_p(sftp, parent)
            
            try:
                sftp.mkdir(remote_directory)
            except IOError as e:
                if 'Failure' in str(e):
                    # Puede ser que el directorio ya exista (debido a una condición de carrera)
                    pass
                else:
                    raise
    
    def _clean_temp_files(self):
        """Limpiar archivos temporales antiguos"""
        logger.info("Iniciando limpieza de archivos temporales")
        
        # Limpiar directorio tmp
        temp_dir = os.path.join(os.getcwd(), 'tmp')
        if not os.path.exists(temp_dir):
            logger.info("El directorio tmp no existe. No hay nada que limpiar.")
            return
        
        # Calcular la fecha límite para eliminar archivos (24 horas)
        fecha_limite = datetime.now() - timedelta(hours=24)
        
        # Contar archivos eliminados
        count = 0
        
        # Recorrer el directorio temporal
        for root, dirs, files in os.walk(temp_dir, topdown=False):
            for name in files:
                file_path = os.path.join(root, name)
                file_mod_time = datetime.fromtimestamp(os.path.getmtime(file_path))
                
                # Eliminar archivos antiguos
                if file_mod_time < fecha_limite:
                    try:
                        os.remove(file_path)
                        count += 1
                    except Exception as e:
                        logger.warning(f"No se pudo eliminar {file_path}: {e}")
            
            # Eliminar directorios vacíos
            for name in dirs:
                dir_path = os.path.join(root, name)
                try:
                    if not os.listdir(dir_path):  # Si el directorio está vacío
                        os.rmdir(dir_path)
                except Exception as e:
                    logger.warning(f"No se pudo eliminar el directorio {dir_path}: {e}")
        
        logger.info(f"Limpieza completada. Se eliminaron {count} archivos temporales.")

def main():
    """Función principal"""
    try:
        # Crear directorio de logs si no existe
        os.makedirs('logs', exist_ok=True)
        
        daemon = JanitorDaemon()
        daemon.run()
    except Exception as e:
        logger.critical(f"Error crítico en Janitor Daemon: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()