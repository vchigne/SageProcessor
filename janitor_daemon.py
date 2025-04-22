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
                provider_id = provider_dict.get('id')
                provider_name = provider_dict.get('nombre')
                logger.info(f"Estructura del proveedor {provider_id} - {provider_name}: {provider_dict.keys()}")
                
                # Si credenciales o configuración son strings JSON, convertirlos a dict
                if 'credenciales' in provider_dict and isinstance(provider_dict['credenciales'], str):
                    try:
                        provider_dict['credenciales'] = json.loads(provider_dict['credenciales'])
                    except:
                        logger.warning(f"No se pudo parsear las credenciales del proveedor {provider_name}")
                        
                if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], str):
                    try:
                        provider_dict['configuracion'] = json.loads(provider_dict['configuracion'])
                    except:
                        logger.warning(f"No se pudo parsear la configuración del proveedor {provider_name}")
                
                # NUEVA FUNCIONALIDAD: Verificar si este proveedor usa secreto_id
                if 'secreto_id' in provider_dict and provider_dict['secreto_id'] is not None:
                    secreto_id = provider_dict['secreto_id']
                    logger.info(f"El proveedor {provider_id} - {provider_name} usa secreto_id: {secreto_id}")
                    
                    try:
                        # Obtener el secreto correspondiente
                        cursor.execute(
                            "SELECT id, nombre, tipo, secretos FROM cloud_secrets WHERE id = %s AND activo = TRUE",
                            (secreto_id,)
                        )
                        secret_result = cursor.fetchone()
                        
                        if not secret_result:
                            logger.error(f"No se encontró el secreto activo con ID {secreto_id} para el proveedor {provider_name}")
                            # Continuar con el siguiente proveedor
                            continue
                            
                        # Convertir a diccionario
                        secret_dict = dict(zip(
                            ['id', 'nombre', 'tipo', 'secretos'], 
                            secret_result
                        ))
                        
                        # Si el secreto está en formato string JSON, convertirlo a dict
                        if isinstance(secret_dict['secretos'], str):
                            try:
                                secret_dict['secretos'] = json.loads(secret_dict['secretos'])
                            except:
                                logger.error(f"No se pudo parsear el secreto del proveedor {provider_name}")
                                # Continuar con el siguiente proveedor
                                continue
                        
                        # Verificar que los tipos coincidan
                        if secret_dict['tipo'] != provider_dict['tipo']:
                            logger.warning(
                                f"El tipo del secreto ({secret_dict['tipo']}) no coincide con el tipo del proveedor ({provider_dict['tipo']})"
                            )
                            
                        # Reemplazar las credenciales del proveedor con las del secreto
                        logger.info(f"Reemplazando credenciales del proveedor {provider_name} con las del secreto {secret_dict['nombre']}")
                        credentials = secret_dict['secretos']
                        
                        # Normalizar las credenciales según el tipo de proveedor
                        if provider_dict['tipo'] == 's3' or provider_dict['tipo'] == 'minio':
                            # Asegurar formato uniforme para S3/MinIO
                            normalized_credentials = {
                                **credentials,
                                'access_key': credentials.get('access_key') or credentials.get('accessKey'),
                                'secret_key': credentials.get('secret_key') or credentials.get('secretKey')
                            }
                            # Eliminar campos no reconocidos por boto3
                            if 'aws_account_id' in normalized_credentials:
                                logger.info(f"Eliminando campo 'aws_account_id' no compatible con boto3")
                                normalized_credentials.pop('aws_account_id', None)
                            
                            # SOLUCIÓN: Para MinIO, transferir el bucket desde la configuración a las credenciales
                            if provider_dict['tipo'] == 'minio':
                                # Obtener el bucket desde la configuración
                                if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], dict):
                                    bucket_from_config = provider_dict['configuracion'].get('bucket')
                                    if bucket_from_config:
                                        logger.info(f"Transferido bucket '{bucket_from_config}' desde configuración a credenciales para MinIO con secreto")
                                        normalized_credentials['bucket'] = bucket_from_config
                                else:
                                    logger.warning(f"Proveedor MinIO con secreto sin configuración para obtener bucket")
                            
                            provider_dict['credenciales'] = normalized_credentials
                        elif provider_dict['tipo'] == 'azure':
                            # SOLUCIÓN: Para Azure, transferir el container_name desde la configuración a las credenciales
                            if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], dict):
                                # Buscar todas las posibles nomenclaturas para el contenedor en Azure
                                container_from_config = (
                                    provider_dict['configuracion'].get('container_name') or 
                                    provider_dict['configuracion'].get('bucket') or
                                    provider_dict['configuracion'].get('container') or
                                    provider_dict['configuracion'].get('blob_container')
                                )
                                if container_from_config:
                                    logger.info(f"Transferido container '{container_from_config}' desde configuración a credenciales para Azure con secreto")
                                    credentials['container_name'] = container_from_config
                                    # También guardar como 'bucket' por compatibilidad
                                    if 'bucket' not in credentials:
                                        credentials['bucket'] = container_from_config
                            provider_dict['credenciales'] = credentials
                        elif provider_dict['tipo'] == 'gcp':
                            # Para GCP, asegurar que key_file sea un diccionario
                            if 'key_file' in credentials and isinstance(credentials['key_file'], str):
                                try:
                                    credentials['key_file'] = json.loads(credentials['key_file'])
                                    logger.info(f"Convertido key_file de formato string a diccionario para GCP")
                                except:
                                    logger.warning(f"No se pudo convertir key_file a diccionario para GCP, manteniendo formato original")
                            
                            # SOLUCIÓN: Transferir el bucket_name desde la configuración a las credenciales
                            if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], dict):
                                bucket_from_config = provider_dict['configuracion'].get('bucket_name') or provider_dict['configuracion'].get('bucket')
                                if bucket_from_config:
                                    logger.info(f"Transferido bucket '{bucket_from_config}' desde configuración a credenciales para GCP con secreto")
                                    credentials['bucket_name'] = bucket_from_config
                            provider_dict['credenciales'] = credentials
                        else:
                            # Para otros tipos, usar tal cual
                            provider_dict['credenciales'] = credentials
                        
                        # Añadir información de que se usó un secreto
                        provider_dict['usa_secreto'] = True
                        provider_dict['secreto_nombre'] = secret_dict['nombre']
                        
                    except Exception as e:
                        logger.error(f"Error cargando secreto para proveedor {provider_name}: {e}")
                        # No añadir el proveedor al diccionario si hubo un error con el secreto
                        continue
                else:
                    # El proveedor NO usa secreto, continúa con el flujo normal
                    logger.info(f"El proveedor {provider_id} - {provider_name} usa credenciales directas")
                
                # Guardar el proveedor en el diccionario
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
                    -- Comentado temporalmente para permitir migrar ejecuciones desde cloud://
                    -- AND ruta_directorio NOT LIKE 'cloud://%'
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
        
        # Si la ruta es cloud://, significa que ya está en una nube pero necesitamos migrar a otras
        es_ruta_cloud = ruta_directorio and ruta_directorio.startswith('cloud://')
        
        if es_ruta_cloud:
            logger.info(f"La ejecución {ejecucion_id} ya está en la nube ({ruta_directorio}). Preparando para migrar a nubes alternativas.")
            
            # Extraer información de la ruta cloud:// original
            # Formato: cloud://bucket/path
            try:
                original_bucket = ruta_directorio.split('/')[2]
                original_path = '/'.join(ruta_directorio.split('/')[3:])
                logger.info(f"Ruta cloud original: bucket={original_bucket}, path={original_path}")
            except Exception as e:
                logger.error(f"Error parseando ruta cloud original {ruta_directorio}: {e}")
                cursor.execute("""
                    UPDATE ejecuciones_yaml
                    SET migrado_a_nube = TRUE
                    WHERE id = %s
                """, (ejecucion_id,))
                return
                
        # Verificar que la ruta local existe (si no es ruta cloud)
        elif not os.path.exists(ruta_directorio):
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
        
        # Normalizar credenciales del proveedor primario antes de usarlo
        if 'credenciales' in proveedor_primario and isinstance(proveedor_primario['credenciales'], dict):
            credentials = proveedor_primario['credenciales']
            provider_type = proveedor_primario['tipo'].lower()
            
            # Normalizar credenciales para S3/MinIO
            if provider_type in ['s3', 'minio']:
                normalized_credentials = {
                    **credentials,
                    'access_key': credentials.get('access_key') or credentials.get('accessKey'),
                    'secret_key': credentials.get('secret_key') or credentials.get('secretKey')
                }
                
                # Eliminar campo aws_account_id que causa problemas con boto3
                if 'aws_account_id' in normalized_credentials:
                    logger.info(f"Eliminando campo 'aws_account_id' no compatible con boto3 del proveedor primario")
                    normalized_credentials.pop('aws_account_id', None)
                
                proveedor_primario['credenciales'] = normalized_credentials
            
            # Normalizar credenciales para GCP
            elif provider_type == 'gcp':
                # Para GCP, asegurar que key_file sea un diccionario
                if 'key_file' in credentials and isinstance(credentials['key_file'], str):
                    try:
                        credentials['key_file'] = json.loads(credentials['key_file'])
                        logger.info(f"Convertido key_file de formato string a diccionario para GCP en proveedor primario")
                    except Exception as e:
                        logger.warning(f"No se pudo convertir key_file a diccionario para GCP en proveedor primario: {e}")
                proveedor_primario['credenciales'] = credentials
        
        # Debug para ver qué tiene el proveedor
        logger.info(f"Estructura del proveedor primario: {proveedor_primario.keys()}")
        
        # CORRECCIÓN CRÍTICA: Extraer el nombre real del bucket de las credenciales en lugar de usar el nombre descriptivo
        # Esto corrige el problema de rutas cloud:// mal formadas
        bucket_real = None
        try:
            if 'credenciales' in proveedor_primario and isinstance(proveedor_primario['credenciales'], dict):
                if proveedor_primario['tipo'].lower() in ['s3', 'minio']:
                    bucket_real = proveedor_primario['credenciales'].get('bucket')
                elif proveedor_primario['tipo'].lower() == 'azure':
                    bucket_real = proveedor_primario['credenciales'].get('container_name')
                elif proveedor_primario['tipo'].lower() == 'gcp':
                    bucket_real = proveedor_primario['credenciales'].get('bucket_name')
                elif proveedor_primario['tipo'].lower() == 'sftp':
                    bucket_real = proveedor_primario['credenciales'].get('directory', 'storage')
            
            # Si no se pudo determinar el bucket, usar un identificador único
            if not bucket_real:
                logger.warning(f"No se pudo determinar el nombre real del bucket para el proveedor {proveedor_primario['nombre']}. Usando ID como fallback.")
                bucket_real = f"storage-{proveedor_primario['id']}"
                
            logger.info(f"Nombre del bucket real para URI cloud:// : {bucket_real}")
        except Exception as e:
            logger.error(f"Error obteniendo el bucket real: {e}")
            bucket_real = f"storage-{proveedor_primario['id']}"
            
        # Construir la ruta URI para la nube primaria usando el bucket real
        ruta_nube_primaria = f"cloud://{bucket_real}/{carpeta_nube}"
        logger.info(f"URI cloud construido correctamente: {ruta_nube_primaria}")
        
        # Lista de rutas alternativas
        rutas_alternativas = []
        
        # Si la ruta ya es de nube (cloud://), primero necesitamos crear un directorio temporal y descargar
        if ruta_directorio and ruta_directorio.startswith('cloud://'):
            logger.info(f"La ruta {ruta_directorio} es de tipo cloud://. Procesando como migración entre nubes.")
            # Crear un directorio temporal para los archivos descargados de S3
            temp_dir = os.path.join('tmp', f'cloud-migration-{ejecucion_id}')
            os.makedirs(temp_dir, exist_ok=True)
            
            try:
                # Intentar encontrar el proveedor de origen
                origen_bucket = ruta_directorio.split('/')[2]
                origen_path = '/'.join(ruta_directorio.split('/')[3:])
                
                # Buscar el proveedor que tenga ese bucket en sus credenciales
                proveedor_origen = None
                for prov_id, prov in self.cloud_providers.items():
                    prov_credenciales = prov['credenciales'] if isinstance(prov['credenciales'], dict) else json.loads(prov['credenciales']) if 'credenciales' in prov else {}
                    prov_bucket = prov_credenciales.get('bucket')
                    
                    if prov_bucket == origen_bucket:
                        proveedor_origen = prov
                        break
                
                if not proveedor_origen:
                    logger.error(f"No se encontró un proveedor para el bucket {origen_bucket}")
                    # En este caso, marcar como migrado sin realmente migrar
                    cursor.execute("""
                        UPDATE ejecuciones_yaml
                        SET migrado_a_nube = TRUE
                        WHERE id = %s
                    """, (ejecucion_id,))
                    return
                    
                # Descargar archivos del origen al directorio temporal
                if proveedor_origen['tipo'].lower() == 's3':
                    self._download_s3_directory(origen_bucket, origen_path, temp_dir, proveedor_origen)
                elif proveedor_origen['tipo'].lower() == 'minio':
                    self._download_minio_directory(origen_bucket, origen_path, temp_dir, proveedor_origen)
                elif proveedor_origen['tipo'].lower() == 'azure':
                    self._download_azure_directory(origen_bucket, origen_path, temp_dir, proveedor_origen)
                elif proveedor_origen['tipo'].lower() == 'gcp':
                    self._download_gcp_directory(origen_bucket, origen_path, temp_dir, proveedor_origen)
                elif proveedor_origen['tipo'].lower() == 'sftp':
                    self._download_sftp_directory(origen_bucket, origen_path, temp_dir, proveedor_origen)
                else:
                    raise ValueError(f"Tipo de proveedor no soportado para descarga: {proveedor_origen['tipo']}")
                
                # Usar el directorio temporal como origen para la migración
                ruta_directorio = temp_dir
                logger.info(f"Archivos descargados a {temp_dir} para su migración")
            except Exception as e:
                logger.error(f"Error preparando migración entre nubes: {e}")
                # En este caso, marcar como migrado sin realmente migrar
                cursor.execute("""
                    UPDATE ejecuciones_yaml
                    SET migrado_a_nube = TRUE
                    WHERE id = %s
                """, (ejecucion_id,))
                return
        
        # Migrar a la nube primaria solo si no era ya una ruta cloud://
        if not es_ruta_cloud:
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
                        
                        # Normalizar credenciales del proveedor alternativo antes de usarlo
                        if 'credenciales' in proveedor_alt and isinstance(proveedor_alt['credenciales'], dict):
                            credentials = proveedor_alt['credenciales']
                            provider_type = proveedor_alt['tipo'].lower()
                            
                            # Normalizar credenciales para S3/MinIO
                            if provider_type in ['s3', 'minio']:
                                normalized_credentials = {
                                    **credentials,
                                    'access_key': credentials.get('access_key') or credentials.get('accessKey'),
                                    'secret_key': credentials.get('secret_key') or credentials.get('secretKey')
                                }
                                
                                # Eliminar campo aws_account_id que causa problemas con boto3
                                if 'aws_account_id' in normalized_credentials:
                                    logger.info(f"Eliminando campo 'aws_account_id' no compatible con boto3 del proveedor alternativo")
                                    normalized_credentials.pop('aws_account_id', None)
                                
                                proveedor_alt['credenciales'] = normalized_credentials
                            
                            # Normalizar credenciales para GCP
                            elif provider_type == 'gcp':
                                # Para GCP, asegurar que key_file sea un diccionario
                                if 'key_file' in credentials and isinstance(credentials['key_file'], str):
                                    try:
                                        credentials['key_file'] = json.loads(credentials['key_file'])
                                        logger.info(f"Convertido key_file de formato string a diccionario para GCP en proveedor alternativo")
                                    except Exception as e:
                                        logger.warning(f"No se pudo convertir key_file a diccionario para GCP en proveedor alternativo: {e}")
                                proveedor_alt['credenciales'] = credentials
                        # CORRECCIÓN CRÍTICA: Extraer el nombre real del bucket para nubes alternativas
                        # Al igual que con la nube primaria, debemos usar el bucket real, no el nombre descriptivo
                        bucket_alt_real = None
                        try:
                            if 'credenciales' in proveedor_alt and isinstance(proveedor_alt['credenciales'], dict):
                                if proveedor_alt['tipo'].lower() in ['s3', 'minio']:
                                    bucket_alt_real = proveedor_alt['credenciales'].get('bucket')
                                elif proveedor_alt['tipo'].lower() == 'azure':
                                    bucket_alt_real = proveedor_alt['credenciales'].get('container_name')
                                elif proveedor_alt['tipo'].lower() == 'gcp':
                                    bucket_alt_real = proveedor_alt['credenciales'].get('bucket_name')
                                elif proveedor_alt['tipo'].lower() == 'sftp':
                                    bucket_alt_real = proveedor_alt['credenciales'].get('directory', 'storage')
                                    
                            # Si no se pudo determinar el bucket, usar un identificador único
                            if not bucket_alt_real:
                                logger.warning(f"No se pudo determinar el nombre real del bucket para el proveedor alternativo {proveedor_alt['nombre']}. Usando ID como fallback.")
                                bucket_alt_real = f"storage-{proveedor_alt['id']}"
                                
                            logger.info(f"Nombre del bucket real alternativo para URI cloud:// : {bucket_alt_real}")
                        except Exception as e:
                            logger.error(f"Error obteniendo el bucket alternativo real: {e}")
                            bucket_alt_real = f"storage-{proveedor_alt['id']}"
                            
                        # Construir la ruta URI para la nube alternativa usando el bucket real
                        ruta_alt = f"cloud://{bucket_alt_real}/{carpeta_nube}"
                        logger.info(f"URI cloud alternativo construido correctamente: {ruta_alt}")
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
        
        # Asegurar que tenemos las credenciales y configuración como diccionarios
        if 'credenciales' in provider and not isinstance(provider['credenciales'], dict):
            try:
                provider['credenciales'] = json.loads(provider['credenciales'])
            except Exception as e:
                logger.error(f"Error parseando credenciales: {e}")
                raise ValueError(f"No se pudieron parsear las credenciales del proveedor {provider.get('nombre')}")
        
        if 'configuracion' in provider and not isinstance(provider['configuracion'], dict):
            try:
                provider['configuracion'] = json.loads(provider['configuracion'])
            except Exception as e:
                logger.error(f"Error parseando configuración: {e}")
                provider['configuracion'] = {}
        
        # Normalizar credenciales según el tipo de proveedor para evitar errores
        if 'credenciales' in provider and isinstance(provider['credenciales'], dict):
            credentials = provider['credenciales']
            provider_type = provider['tipo'].lower()
            
            # Normalizar credenciales para S3/MinIO
            if provider_type in ['s3', 'minio']:
                normalized_credentials = {
                    **credentials,
                    'access_key': credentials.get('access_key') or credentials.get('accessKey'),
                    'secret_key': credentials.get('secret_key') or credentials.get('secretKey')
                }
                
                # Eliminar campo aws_account_id que causa problemas con boto3
                if 'aws_account_id' in normalized_credentials:
                    logger.info(f"Eliminando campo 'aws_account_id' no compatible con boto3")
                    normalized_credentials.pop('aws_account_id', None)
                
                provider['credenciales'] = normalized_credentials
            
            # Normalizar credenciales para GCP
            elif provider_type == 'gcp':
                # Para GCP, asegurar que key_file sea un diccionario
                if 'key_file' in credentials and isinstance(credentials['key_file'], str):
                    try:
                        credentials['key_file'] = json.loads(credentials['key_file'])
                        logger.info(f"Normalizado: key_file convertido de formato string a diccionario para GCP")
                    except Exception as e:
                        logger.warning(f"No se pudo convertir key_file a diccionario para GCP: {e}")
                provider['credenciales'] = credentials
        
        # La lógica de subida dependerá del tipo de proveedor
        provider_type = provider['tipo'].lower()
        
        if provider_type == 's3':
            self._upload_to_s3(local_path, cloud_path, provider)
        elif provider_type == 'minio':
            self._upload_to_minio(local_path, cloud_path, provider)
        elif provider_type == 'azure':
            self._upload_to_azure(local_path, cloud_path, provider)
        elif provider_type == 'gcp':
            self._upload_to_gcp(local_path, cloud_path, provider)
        elif provider_type == 'sftp':
            self._upload_to_sftp(local_path, cloud_path, provider)
        else:
            raise ValueError(f"Tipo de proveedor no soportado: {provider_type}")
    
    def _upload_to_s3(self, local_path, cloud_path, provider):
        """Subir archivos a Amazon S3"""
        import boto3
        import botocore
        import os
        import subprocess
        from botocore.exceptions import ClientError
        
        # Parsear credenciales y configuración
        config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion']) if 'configuracion' in provider else {}
        credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales']) if 'credenciales' in provider else {}
        
        # Logs para depuración
        logger.info(f"Credenciales S3: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
        logger.info(f"Configuración S3: {list(config.keys()) if config else 'No hay configuración'}")
        
        # Obtener solo los parámetros necesarios para S3
        endpoint_url = credentials.get('endpoint')
        access_key = credentials.get('access_key') or credentials.get('accessKey')
        secret_key = credentials.get('secret_key') or credentials.get('secretKey')
        region = credentials.get('region', 'us-east-1')  # Valor predeterminado como en el JavaScript
        
        # Logs específicos para S3
        logger.info(f"Usando endpoint S3: {endpoint_url or 'Default S3'}")
        logger.info(f"Usando región S3: {region}")
        logger.info(f"Credenciales procesadas: access_key={access_key}, region={region}")
        
        # Bucket puede estar en credenciales o en configuración
        bucket = credentials.get('bucket') or config.get('bucket')
        logger.info(f"Bucket a usar: {bucket}")
        
        if not bucket:
            raise ValueError("No se pudo determinar el bucket desde las credenciales o configuración")
        
        # ============ SOLUCIÓN ALTERNATIVA USANDO AWS CLI ============
        # Al tener problemas persistentes con boto3 y el parámetro aws_account_id,
        # usaremos la AWS CLI directamente como solución alternativa
        try:
            logger.info("Usando AWS CLI como alternativa a boto3...")
            
            # Crear archivo temporal para credenciales AWS
            import tempfile
            aws_dir = os.path.expanduser('~/.aws')
            os.makedirs(aws_dir, exist_ok=True)
            
            # Escribir configuración temporal
            with open(os.path.join(aws_dir, 'credentials'), 'w') as f:
                f.write(f"[default]\n")
                f.write(f"aws_access_key_id = {access_key}\n")
                f.write(f"aws_secret_access_key = {secret_key}\n")
                
            with open(os.path.join(aws_dir, 'config'), 'w') as f:
                f.write(f"[default]\n")
                f.write(f"region = {region}\n")
                
            # Comando base para AWS CLI
            aws_cmd = ["aws", "s3"]
            
            # Añadir endpoint si es necesario (para MinIO/otros proveedores)
            if endpoint_url:
                aws_cmd.extend(["--endpoint-url", endpoint_url])
                
            # Subir todos los archivos en el directorio recursivamente
            sync_cmd = aws_cmd + ["sync", local_path, f"s3://{bucket}/{cloud_path}"]
            logger.info(f"Ejecutando comando: {' '.join(sync_cmd)}")
            
            # Ejecutar comando
            result = subprocess.run(sync_cmd, 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE,
                                   text=True)
            
            # Verificar resultado
            if result.returncode != 0:
                logger.error(f"Error al ejecutar AWS CLI: {result.stderr}")
                raise ValueError(f"Error al subir archivos con AWS CLI: {result.stderr}")
            else:
                logger.info(f"Archivos sincronizados exitosamente usando AWS CLI")
                logger.info(f"Salida: {result.stdout}")
                
            return  # Terminar aquí si la sincronización fue exitosa
                
        except Exception as e:
            logger.error(f"Error usando AWS CLI: {str(e)}")
            logger.warning("Intentando con método alternativo (boto3)...")
        
        # Fallback a boto3 si AWS CLI falla
        try:
            # Crear un entorno limpio para boto3
            # Usamos un enfoque muy específico para evitar contaminación de variables
            logger.info("Intentando con boto3 en entorno limpio...")
            
            # Limpiar variables de entorno que puedan interferir
            boto3_env = os.environ.copy()
            for key in list(boto3_env.keys()):
                if key.startswith('AWS_'):
                    del boto3_env[key]
            
            # Crear cliente boto3 con los parámetros mínimos necesarios
            import importlib
            import sys
            
            # Importar boto3 limpio
            if 'boto3' in sys.modules:
                del sys.modules['boto3']
            if 'botocore' in sys.modules:
                del sys.modules['botocore']
                
            # Reimportar boto3 limpio
            boto3_clean = importlib.import_module('boto3')
            
            # Crear cliente con solo los parámetros necesarios
            s3_params = {
                'aws_access_key_id': access_key,
                'aws_secret_access_key': secret_key,
                'region_name': region
            }
            
            if endpoint_url:
                s3_params['endpoint_url'] = endpoint_url
                
            logger.info(f"Parámetros boto3: {s3_params.keys()}")
            s3_client = boto3_clean.client('s3', **s3_params)
            
            # Subir los archivos
            for root, dirs, files in os.walk(local_path):
                for file in files:
                    local_file_path = os.path.join(root, file)
                    
                    # Calcular la ruta relativa para el objeto S3
                    rel_path = os.path.relpath(local_file_path, local_path)
                    s3_key = f"{cloud_path}/{rel_path}"
                    
                    # Subir el archivo
                    logger.info(f"Subiendo archivo {local_file_path} -> s3://{bucket}/{s3_key}")
                    s3_client.upload_file(local_file_path, bucket, s3_key)
                    logger.info(f"Archivo subido correctamente")
            
        except Exception as e:
            logger.error(f"Error con boto3: {str(e)}")
            raise ValueError(f"No se pudieron subir los archivos a S3: {str(e)}")
    
    def _upload_to_minio(self, local_path, cloud_path, provider):
        """Subir archivos a MinIO Storage"""
        from minio import Minio
        from minio.error import S3Error
        
        # Parsear credenciales y configuración
        config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion']) if 'configuracion' in provider else {}
        credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales']) if 'credenciales' in provider else {}
        
        # Logs para depuración
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
                raise ValueError(f"El bucket {bucket} no existe en MinIO")
            logger.info(f"Bucket {bucket} existe y es accesible")
        except Exception as e:
            raise ValueError(f"Error verificando bucket de MinIO: {str(e)}")
        
        # Subir todos los archivos en el directorio
        for root, dirs, files in os.walk(local_path):
            for file in files:
                local_file_path = os.path.join(root, file)
                
                # Calcular la ruta relativa para el objeto MinIO
                rel_path = os.path.relpath(local_file_path, local_path)
                minio_key = f"{cloud_path}/{rel_path}".replace('\\', '/')  # Asegurar uso de forward slashes
                
                # Determinar el tipo de contenido
                content_type = 'application/octet-stream'
                if file.endswith('.txt') or file.endswith('.log'):
                    content_type = 'text/plain'
                elif file.endswith('.json'):
                    content_type = 'application/json'
                elif file.endswith('.yaml') or file.endswith('.yml'):
                    content_type = 'application/yaml'
                
                # Subir el archivo usando la API nativa de MinIO
                try:
                    if os.path.exists(local_file_path):
                        logger.info(f"Subiendo archivo {local_file_path} a minio://{bucket}/{minio_key}")
                        minio_client.fput_object(
                            bucket, 
                            minio_key, 
                            local_file_path,
                            content_type=content_type
                        )
                        logger.info(f"✓ Archivo {local_file_path} subido exitosamente a minio://{bucket}/{minio_key}")
                    else:
                        logger.warning(f"Archivo no encontrado, omitiendo: {local_file_path}")
                except Exception as e:
                    logger.error(f"Error subiendo archivo a MinIO: {str(e)}")
                    raise ValueError(f"Error subiendo archivo a MinIO: {str(e)}")
    
    def _upload_to_azure(self, local_path, cloud_path, provider):
        """Subir archivos a Azure Blob Storage"""
        from azure.storage.blob import BlobServiceClient, ContainerClient
        import re
        from urllib.parse import urlparse
        
        # Parsear credenciales y configuración
        config = provider['configuracion'] if isinstance(provider['configuracion'], dict) else json.loads(provider['configuracion']) if 'configuracion' in provider else {}
        credentials = provider['credenciales'] if isinstance(provider['credenciales'], dict) else json.loads(provider['credenciales']) if 'credenciales' in provider else {}
        
        # Logs para depuración
        logger.info(f"Credenciales Azure: {list(credentials.keys()) if credentials else 'No hay credenciales'}")
        logger.info(f"Configuración Azure: {list(config.keys()) if config else 'No hay configuración'}")
        
        # Buscar el contenedor con diferentes nombres posibles (container_name, bucket, etc.)
        container_name = (credentials.get('container_name') or 
                          config.get('container_name') or 
                          credentials.get('bucket') or 
                          config.get('bucket') or
                          credentials.get('container') or
                          config.get('container') or
                          credentials.get('blob_container') or
                          config.get('blob_container'))
        
        if not container_name:
            raise ValueError("No se configuró correctamente el nombre del contenedor para Azure")
            
        logger.info(f"Usando container Azure: {container_name}")
        
        # Obtener string de conexión y/o componentes individuales
        connection_string = credentials.get('connection_string') or config.get('connection_string')
        
        if not connection_string:
            raise ValueError("No se configuró correctamente la cadena de conexión para Azure")
        
        # Comprobar si es una connection string con SAS token 
        use_sas = False
        account_name = None
        if connection_string and 'blob.core.windows.net' in connection_string:
            use_sas = True
            logger.info("Detectado formato connection_string con URL Blob Storage, activando modo SAS")
            
            # Intentar extraer el account_name de la URL
            try:
                parts = connection_string.split(';')
                for part in parts:
                    if part.startswith('https://'):
                        parsed_url = urlparse(part)
                        hostname = parsed_url.netloc
                        account_match = re.match(r'([^\.]+)\.blob\.core\.windows\.net', hostname)
                        if account_match:
                            account_name = account_match.group(1)
                            logger.info(f"Extraído account_name de la URL: {account_name}")
                            break
            except Exception as e:
                logger.warning(f"No se pudo extraer el account_name de la URL: {e}")
        
        # Crear cliente de blob service según el tipo de credenciales
        if use_sas:
            logger.info("Usando modo SAS para Azure con URL + SAS token")
            
            # Si la connection_string incluye 'SharedAccessSignature=' necesitamos procesarla
            if ';SharedAccessSignature=' in connection_string:
                parts = connection_string.split(';')
                base_url = None
                sas_token = None
                
                for part in parts:
                    if part.startswith('https://'):
                        base_url = part
                    elif part.startswith('SharedAccessSignature='):
                        sas_token = part.replace('SharedAccessSignature=', '')
                
                if not base_url or not sas_token:
                    raise ValueError("No se pudo extraer la URL base o el SAS token de la cadena de conexión")
                
                # Si el base_url no incluye el container, lo añadimos
                if not f"/{container_name}" in base_url:
                    container_url = f"{base_url}/{container_name}"
                else:
                    container_url = base_url
                
                # Asegurarnos de que el SAS token comience con ?
                if not sas_token.startswith('?'):
                    sas_token = f"?{sas_token}"
                
                logger.info(f"URL del contenedor: {container_url}")
                logger.info(f"Longitud del SAS token: {len(sas_token)}")
                
                # Crear el container_client directamente con la URL + SAS
                container_client = ContainerClient.from_container_url(f"{container_url}{sas_token}")
                
                # Si necesitamos un BlobServiceClient para operaciones a nivel de servicio 
                if account_name:
                    blob_service_url = f"https://{account_name}.blob.core.windows.net"
                    blob_service_client = BlobServiceClient(account_url=blob_service_url, credential=sas_token)
                else:
                    # En este caso no podemos crear un BlobServiceClient, pero no lo necesitamos
                    # si ya tenemos un ContainerClient
                    blob_service_client = None
            else:
                # La cadena parece ser una URL completa con SAS token en la query
                try:
                    parsed_url = urlparse(connection_string)
                    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"
                    sas_token = f"?{parsed_url.query}" if parsed_url.query else ""
                    
                    # Si la URL no incluye el contenedor, lo añadimos
                    if not f"/{container_name}" in base_url:
                        container_url = f"{base_url}/{container_name}"
                    else:
                        container_url = base_url
                    
                    logger.info(f"URL del contenedor: {container_url}")
                    logger.info(f"Longitud del SAS token: {len(sas_token)}")
                    
                    # Crear el container_client directamente con la URL + SAS
                    container_client = ContainerClient.from_container_url(f"{container_url}{sas_token}")
                    
                    # Si necesitamos un BlobServiceClient para operaciones a nivel de servicio
                    if account_name:
                        blob_service_url = f"https://{account_name}.blob.core.windows.net"
                        blob_service_client = BlobServiceClient(account_url=blob_service_url, credential=sas_token.lstrip('?'))
                    else:
                        blob_service_client = None
                except Exception as e:
                    logger.error(f"Error al procesar la URL de Azure: {e}")
                    raise ValueError(f"No se pudo procesar la URL de Azure: {e}")
        else:
            # Usar el formato estándar de connection_string
            logger.info("Usando connection_string estándar para Azure")
            try:
                blob_service_client = BlobServiceClient.from_connection_string(connection_string)
                container_client = blob_service_client.get_container_client(container_name)
            except Exception as e:
                logger.error(f"Error al crear el cliente de Azure con connection_string: {e}")
                raise ValueError(f"Error al crear el cliente de Azure: {e}")
        
        # Verificar si el contenedor existe y crearlo si no - solo si tenemos blob_service_client
        if use_sas:
            # Ya tenemos el container_client mediante URL directa, no necesitamos verificar o crear
            logger.info(f"Usando container_client directo para Azure con SAS token")
        else:
            try:
                # Primero verificar si el contenedor existe
                container_exists = False
                containers_list = blob_service_client.list_containers()
                for container in containers_list:
                    if container.name == container_name:
                        container_exists = True
                        break
                
                if not container_exists:
                    logger.warning(f"El contenedor {container_name} no existe en Azure. Intentando crear...")
                    blob_service_client.create_container(container_name)
                    logger.info(f"Contenedor {container_name} creado exitosamente")
                
                # Obtener cliente de contenedor 
                container_client = blob_service_client.get_container_client(container_name)
            except Exception as e:
                logger.error(f"Error verificando/creando contenedor Azure: {e}")
                # Continuamos de todas formas, tal vez ya existe o será creado automáticamente
        
        # Subir todos los archivos en el directorio
        for root, dirs, files in os.walk(local_path):
            for file in files:
                local_file_path = os.path.join(root, file)
                
                # Calcular la ruta relativa para el blob
                rel_path = os.path.relpath(local_file_path, local_path)
                blob_name = f"{cloud_path}/{rel_path}"
                
                # Subir el archivo
                try:
                    if os.path.exists(local_file_path):
                        with open(local_file_path, "rb") as data:
                            container_client.upload_blob(name=blob_name, data=data, overwrite=True)
                        logger.info(f"✓ Archivo {local_file_path} subido exitosamente a azure://{container_name}/{blob_name}")
                    else:
                        logger.warning(f"Archivo no encontrado, omitiendo: {local_file_path}")
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
        bucket_name = credentials.get('bucket_name') or config.get('bucket_name') or credentials.get('bucket') or config.get('bucket')
        
        if not key_data:
            raise ValueError("No se encontró el archivo de clave (key_file) para GCP")
            
        if not bucket_name:
            raise ValueError("No se encontró el nombre del bucket para GCP")
        
        logger.info(f"Usando bucket GCP: {bucket_name}")
        
        # Crear archivo temporal para las credenciales
        fd, path = tempfile.mkstemp()
        try:
            with os.fdopen(fd, 'w') as tmp:
                # Guardar credenciales en archivo JSON
                # Si key_data es un diccionario, convertirlo a string JSON
                if isinstance(key_data, dict):
                    import json
                    logger.info("Convirtiendo key_file de diccionario a JSON string para escribir al archivo")
                    key_data_str = json.dumps(key_data)
                    tmp.write(key_data_str)
                else:
                    tmp.write(key_data)
            
            # Crear cliente de almacenamiento
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = path
            storage_client = storage.Client()
            
            bucket = storage_client.bucket(bucket_name)
            
            # Verificar que el bucket existe
            logger.info(f"Verificando que el bucket {bucket_name} existe en GCP")
            if not bucket.exists():
                logger.warning(f"¡El bucket {bucket_name} no existe en GCP! Intentando crear...")
                bucket.create()
                logger.info(f"Bucket {bucket_name} creado exitosamente")
            
            # Subir todos los archivos en el directorio
            for root, dirs, files in os.walk(local_path):
                for file in files:
                    local_file_path = os.path.join(root, file)
                    
                    # Calcular la ruta relativa para el objeto GCS
                    rel_path = os.path.relpath(local_file_path, local_path)
                    blob_name = f"{cloud_path}/{rel_path}"
                    
                    # Subir el archivo
                    try:
                        if os.path.exists(local_file_path):
                            blob = bucket.blob(blob_name)
                            blob.upload_from_filename(local_file_path)
                            logger.info(f"✓ Archivo {local_file_path} subido exitosamente a gs://{bucket_name}/{blob_name}")
                        else:
                            logger.warning(f"Archivo no encontrado, omitiendo: {local_file_path}")
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
                        if os.path.exists(local_file_path):
                            sftp_client.put(local_file_path, remote_file_path)
                            logger.info(f"✓ Archivo {local_file_path} subido exitosamente a sftp://{host}:{port}/{remote_file_path}")
                        else:
                            logger.warning(f"Archivo no encontrado, omitiendo: {local_file_path}")
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