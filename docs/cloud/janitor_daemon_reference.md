# Documentación Técnica del Janitor Daemon

## Introducción

El Janitor Daemon es un componente crítico del sistema SAGE encargado de gestionar la migración automática de archivos de ejecuciones desde almacenamiento local a proveedores de nube, así como la limpieza de archivos temporales. Este documento proporciona una referencia técnica detallada sobre su funcionamiento, configuración y solución de problemas.

## Índice

1. [Propósito y Funcionalidades](#1-propósito-y-funcionalidades)
2. [Arquitectura del Janitor Daemon](#2-arquitectura-del-janitor-daemon)
3. [Configuración](#3-configuración)
4. [Flujo de Migración](#4-flujo-de-migración)
5. [Métodos de Subida por Proveedor](#5-métodos-de-subida-por-proveedor)
6. [Actualización de la Base de Datos](#6-actualización-de-la-base-de-datos)
7. [Limpieza de Archivos Temporales](#7-limpieza-de-archivos-temporales)
8. [Logs y Monitoreo](#8-logs-y-monitoreo)
9. [Programación y Ejecución](#9-programación-y-ejecución)
10. [Solución de Problemas](#10-solución-de-problemas)

## 1. Propósito y Funcionalidades

El Janitor Daemon cumple varias funciones esenciales:

### 1.1 Funciones Principales

* **Migración a la nube**: Transferir archivos de ejecuciones desde el almacenamiento local a proveedores de nube configurados
* **Actualización de registros**: Actualizar la base de datos para reflejar la nueva ubicación de los archivos
* **Limpieza de archivos**: Eliminar archivos temporales y locales después de una migración exitosa
* **Gestión del espacio**: Evitar el acumulamiento de archivos locales, optimizando el uso de almacenamiento

### 1.2 Beneficios

* **Escalabilidad**: Permite manejar un volumen creciente de ejecuciones sin agotar el almacenamiento local
* **Durabilidad**: Aprovecha las características de durabilidad y redundancia de los proveedores de nube
* **Accesibilidad**: Facilita el acceso a los archivos desde diferentes ubicaciones
* **Automatización**: Elimina la necesidad de migración manual

## 2. Arquitectura del Janitor Daemon

El Janitor Daemon está implementado como una clase Python con métodos específicos para cada funcionalidad.

### 2.1 Estructura del Código

```
janitor_daemon.py
├── class JanitorDaemon
│   ├── __init__()
│   ├── _get_database_connection()
│   ├── _load_configuration()
│   ├── _load_cloud_providers()
│   ├── run()
│   ├── _migrate_old_executions()
│   ├── _migrate_execution()
│   ├── _upload_directory_to_cloud()
│   │   ├── _upload_to_s3()
│   │   ├── _upload_to_minio()
│   │   ├── _upload_to_azure()
│   │   ├── _upload_to_gcp()
│   │   └── _upload_to_sftp()
│   └── _clean_temp_files()
└── main()
```

### 2.2 Dependencias

El daemon depende de estas bibliotecas principales:

```python
import os
import sys
import time
import logging
import psycopg2
import shutil
from datetime import datetime, timedelta
import json
import boto3
from azure.storage.blob import BlobServiceClient
from google.cloud import storage
import paramiko  # Para SFTP
```

## 3. Configuración

### 3.1 Configuración en Base de Datos

La configuración del Janitor Daemon se almacena en la tabla `ejecuciones_config`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| nube_primaria_id | INTEGER | ID del proveedor de nube principal |
| nubes_alternativas | INTEGER[] | IDs de proveedores alternativos |
| tiempo_retencion_local | INTEGER | Horas antes de migrar (0 = inmediato) |
| prefijo_ruta_nube | VARCHAR | Prefijo opcional para rutas en la nube |
| migrar_automaticamente | BOOLEAN | Habilitar/deshabilitar migración |

```python
def _load_configuration(self):
    """Cargar la configuración de ejecuciones desde la base de datos"""
    with self.db_connection.cursor() as cursor:
        cursor.execute("SELECT * FROM ejecuciones_config ORDER BY id DESC LIMIT 1")
        config = cursor.fetchone()
        
        if not config:
            logger.warning("No se encontró configuración de ejecuciones. Utilizando valores predeterminados.")
            return {
                'nube_primaria_id': None,
                'nubes_alternativas': [],
                'tiempo_retencion_local': 0,
                'prefijo_ruta_nube': '',
                'migrar_automaticamente': True
            }
        
        # Convertir a diccionario
        columns = [desc[0] for desc in cursor.description]
        config_dict = dict(zip(columns, config))
        return config_dict
```

### 3.2 Configuración de Proveedores de Nube

El Janitor Daemon consulta los proveedores configurados en la tabla `cloud_providers`:

```python
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
    
    with self.db_connection.cursor() as cursor:
        placeholders = ','.join(['%s'] * len(provider_ids))
        query = f"SELECT * FROM cloud_providers WHERE id IN ({placeholders})"
        cursor.execute(query, provider_ids)
        providers = cursor.fetchall()
        
        # Convertir a diccionarios
        columns = [desc[0] for desc in cursor.description]
        
        self.cloud_providers = {}
        for provider in providers:
            provider_dict = dict(zip(columns, provider))
            
            # Deserializar credenciales y configuración
            if 'credenciales' in provider_dict and isinstance(provider_dict['credenciales'], str):
                provider_dict['credenciales'] = json.loads(provider_dict['credenciales'])
            
            if 'configuracion' in provider_dict and isinstance(provider_dict['configuracion'], str):
                provider_dict['configuracion'] = json.loads(provider_dict['configuracion'])
            
            self.cloud_providers[provider_dict['id']] = provider_dict
```

## 4. Flujo de Migración

El proceso de migración sigue los siguientes pasos:

### 4.1 Identificación de Ejecuciones

Se identifican las ejecuciones que cumplen estos criterios:
* No han sido migradas a la nube (`migrado_a_nube = false`)
* Son más antiguas que el tiempo de retención configurado
* Tienen una ruta de directorio local válida

```python
def _migrate_old_executions(self, only_existing_directories=True, max_age_hours=None):
    """Migrar ejecuciones antiguas a la nube"""
    if not self.cloud_providers or not self.config['nube_primaria_id']:
        logger.warning("No hay proveedores de nube configurados. No se puede realizar la migración.")
        return
    
    # Utilizar tiempo de retención configurado si no se especifica
    retention_hours = max_age_hours if max_age_hours is not None else self.config['tiempo_retencion_local']
    
    # Seleccionar ejecuciones antiguas no migradas
    with self.db_connection.cursor() as cursor:
        cursor.execute("""
            SELECT id, uuid, ruta_directorio 
            FROM ejecuciones_yaml 
            WHERE migrado_a_nube = false 
              AND fecha_ejecucion < NOW() - INTERVAL %s HOUR
              AND ruta_directorio IS NOT NULL
        """, (retention_hours,))
        
        ejecuciones = []
        for row in cursor:
            ejecucion = {
                'id': row[0],
                'uuid': row[1],
                'ruta_directorio': row[2]
            }
            
            # Verificar si el directorio existe si se requiere
            if only_existing_directories:
                if os.path.exists(ejecucion['ruta_directorio']):
                    ejecuciones.append(ejecucion)
                else:
                    logger.warning(f"Directorio no encontrado para ejecución {ejecucion['uuid']}: {ejecucion['ruta_directorio']}")
            else:
                ejecuciones.append(ejecucion)
        
        # Procesar las ejecuciones seleccionadas
        for ejecucion in ejecuciones:
            self._migrate_execution(ejecucion, cursor)
```

### 4.2 Migración de Ejecuciones

Para cada ejecución identificada, se realiza la migración al proveedor primario o a uno alternativo si el primario falla:

```python
def _migrate_execution(self, ejecucion, cursor):
    """Migrar una ejecución específica a la nube"""
    logger.info(f"Migrando ejecución {ejecucion['uuid']} a la nube")
    
    # Verificar que el directorio local existe
    local_path = ejecucion['ruta_directorio']
    if not os.path.exists(local_path):
        logger.warning(f"Directorio local no encontrado: {local_path}")
        return False
    
    # Intentar migrar al proveedor primario
    primary_provider = self.cloud_providers.get(self.config['nube_primaria_id'])
    if not primary_provider:
        logger.error(f"No se encontró el proveedor primario con ID {self.config['nube_primaria_id']}")
        return False
    
    # Construir ruta en la nube
    cloud_base_path = self.config.get('prefijo_ruta_nube', '')
    cloud_path = f"{cloud_base_path}/ejecuciones/{ejecucion['uuid']}".strip('/')
    
    # Intentar migrar al proveedor primario
    success = self._upload_directory_to_cloud(local_path, cloud_path, primary_provider)
    
    # Si falla, intentar con proveedores alternativos
    if not success and self.config['nubes_alternativas']:
        for alt_provider_id in self.config['nubes_alternativas']:
            alt_provider = self.cloud_providers.get(alt_provider_id)
            if alt_provider:
                logger.info(f"Intentando migrar al proveedor alternativo: {alt_provider['nombre']}")
                success = self._upload_directory_to_cloud(local_path, cloud_path, alt_provider)
                if success:
                    provider = alt_provider
                    break
    
    if success:
        # Actualizar en la base de datos
        cloud_uri = f"cloud://{provider['tipo']}/{cloud_path}"
        cursor.execute("""
            UPDATE ejecuciones_yaml 
            SET migrado_a_nube = true, 
                ruta_nube = %s, 
                nube_provider_id = %s
            WHERE id = %s
        """, (cloud_uri, provider['id'], ejecucion['id']))
        self.db_connection.commit()
        
        logger.info(f"Ejecución {ejecucion['uuid']} migrada exitosamente a {cloud_uri}")
        
        # Eliminar directorio local si está configurado
        if self.config.get('eliminar_despues_de_migrar', False):
            try:
                shutil.rmtree(local_path)
                logger.info(f"Directorio local eliminado: {local_path}")
            except Exception as e:
                logger.warning(f"Error eliminando directorio local: {str(e)}")
        
        return True
    else:
        logger.error(f"No se pudo migrar la ejecución {ejecucion['uuid']} a ningún proveedor")
        return False
```

## 5. Métodos de Subida por Proveedor

El Janitor Daemon implementa métodos específicos para cada tipo de proveedor de nube:

### 5.1 Amazon S3 y MinIO

```python
def _upload_to_s3(self, local_path, cloud_path, provider):
    """Subir archivos a Amazon S3"""
    try:
        # Configuración del cliente
        import boto3
        
        # Extraer credenciales y configuración
        credentials = provider['credenciales']
        config = provider.get('configuracion', {})
        
        # Configurar cliente S3
        s3_args = {
            'aws_access_key_id': credentials.get('access_key'),
            'aws_secret_access_key': credentials.get('secret_key'),
            'region_name': credentials.get('region', 'us-east-1')
        }
        
        # Para MinIO o S3 compatible, añadir endpoint_url
        if 'endpoint_url' in config:
            s3_args['endpoint_url'] = config['endpoint_url']
        
        s3_client = boto3.client('s3', **s3_args)
        
        # Obtener nombre del bucket
        bucket = config.get('bucket')
        if not bucket:
            raise ValueError(f"No se especificó un bucket para el proveedor {provider['nombre']}")
        
        # Subir archivos recursivamente
        success = True
        for root, dirs, files in os.walk(local_path):
            for file in files:
                local_file_path = os.path.join(root, file)
                # Calcular ruta relativa
                rel_path = os.path.relpath(local_file_path, local_path)
                s3_key = f"{cloud_path}/{rel_path}".replace('\\', '/')
                
                try:
                    logger.info(f"Subiendo {local_file_path} a s3://{bucket}/{s3_key}")
                    s3_client.upload_file(local_file_path, bucket, s3_key)
                except Exception as e:
                    logger.error(f"Error subiendo {local_file_path}: {str(e)}")
                    success = False
        
        return success
    except Exception as e:
        logger.error(f"Error en _upload_to_s3: {str(e)}")
        return False
```

### 5.2 Azure Blob Storage

```python
def _upload_to_azure(self, local_path, cloud_path, provider):
    """Subir archivos a Azure Blob Storage"""
    try:
        # Importar biblioteca de Azure
        from azure.storage.blob import BlobServiceClient
        
        # Extraer credenciales y configuración
        credentials = provider['credenciales']
        config = provider.get('configuracion', {})
        
        # Verificar credenciales
        connection_string = credentials.get('connection_string')
        if not connection_string:
            account_name = credentials.get('account_name')
            sas_token = credentials.get('sas_token')
            if not (account_name and sas_token):
                raise ValueError("Credenciales de Azure incompletas")
        
        # Obtener cliente de Azure Blob
        if connection_string:
            blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        else:
            # Si no hay connection_string, usar account_name y sas_token
            account_url = f"https://{account_name}.blob.core.windows.net{sas_token}"
            blob_service_client = BlobServiceClient(account_url=account_url)
        
        # Obtener container
        container_name = config.get('container')
        if not container_name:
            raise ValueError(f"No se especificó un container para el proveedor {provider['nombre']}")
        
        container_client = blob_service_client.get_container_client(container_name)
        
        # Subir archivos recursivamente
        success = True
        for root, dirs, files in os.walk(local_path):
            for file in files:
                local_file_path = os.path.join(root, file)
                # Calcular ruta relativa
                rel_path = os.path.relpath(local_file_path, local_path)
                blob_path = f"{cloud_path}/{rel_path}".replace('\\', '/')
                
                try:
                    logger.info(f"Subiendo {local_file_path} a Azure: {blob_path}")
                    blob_client = container_client.get_blob_client(blob_path)
                    with open(local_file_path, "rb") as data:
                        blob_client.upload_blob(data, overwrite=True)
                except Exception as e:
                    logger.error(f"Error subiendo {local_file_path}: {str(e)}")
                    success = False
        
        return success
    except Exception as e:
        logger.error(f"Error en _upload_to_azure: {str(e)}")
        return False
```

### 5.3 Google Cloud Storage

```python
def _upload_to_gcp(self, local_path, cloud_path, provider):
    """Subir archivos a Google Cloud Storage"""
    try:
        # Importar biblioteca de GCP
        from google.cloud import storage
        from google.oauth2 import service_account
        
        # Extraer credenciales y configuración
        credentials = provider['credenciales']
        config = provider.get('configuracion', {})
        
        # Configurar cliente GCP
        if isinstance(credentials, dict):
            # Crear credentials object desde el JSON
            service_account_info = credentials
            gcp_credentials = service_account.Credentials.from_service_account_info(service_account_info)
            storage_client = storage.Client(credentials=gcp_credentials)
        else:
            # Asumir que credentials es un path a un archivo JSON
            storage_client = storage.Client.from_service_account_json(credentials)
        
        # Obtener bucket
        bucket_name = config.get('bucket')
        if not bucket_name:
            raise ValueError(f"No se especificó un bucket para el proveedor {provider['nombre']}")
        
        bucket = storage_client.bucket(bucket_name)
        
        # Subir archivos recursivamente
        success = True
        for root, dirs, files in os.walk(local_path):
            for file in files:
                local_file_path = os.path.join(root, file)
                # Calcular ruta relativa
                rel_path = os.path.relpath(local_file_path, local_path)
                blob_path = f"{cloud_path}/{rel_path}".replace('\\', '/')
                
                try:
                    logger.info(f"Subiendo {local_file_path} a GCP: {blob_path}")
                    blob = bucket.blob(blob_path)
                    blob.upload_from_filename(local_file_path)
                except Exception as e:
                    logger.error(f"Error subiendo {local_file_path}: {str(e)}")
                    success = False
        
        return success
    except Exception as e:
        logger.error(f"Error en _upload_to_gcp: {str(e)}")
        return False
```

### 5.4 SFTP

```python
def _upload_to_sftp(self, local_path, cloud_path, provider):
    """Subir archivos a servidor SFTP"""
    try:
        # Importar biblioteca para SFTP
        import paramiko
        
        # Extraer credenciales y configuración
        credentials = provider['credenciales']
        config = provider.get('configuracion', {})
        
        # Configurar cliente SFTP
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Preparar parámetros de conexión
        connect_args = {
            'hostname': credentials.get('host'),
            'port': credentials.get('port', 22),
            'username': credentials.get('username')
        }
        
        # Autenticación por contraseña o clave privada
        if 'password' in credentials:
            connect_args['password'] = credentials['password']
        elif 'private_key' in credentials:
            private_key = paramiko.RSAKey.from_private_key(
                io.StringIO(credentials['private_key']),
                password=credentials.get('private_key_passphrase')
            )
            connect_args['pkey'] = private_key
        else:
            raise ValueError("No se proporcionó método de autenticación (password o private_key)")
        
        # Conectar
        ssh_client.connect(**connect_args)
        sftp_client = ssh_client.open_sftp()
        
        # Crear directorios remotos si no existen
        remote_base = config.get('base_path', '').rstrip('/')
        target_path = f"{remote_base}/{cloud_path}".rstrip('/')
        self._sftp_mkdir_p(sftp_client, target_path)
        
        # Subir archivos recursivamente
        success = True
        for root, dirs, files in os.walk(local_path):
            for file in files:
                local_file_path = os.path.join(root, file)
                # Calcular ruta relativa
                rel_path = os.path.relpath(local_file_path, local_path)
                remote_file_path = f"{target_path}/{rel_path}".replace('\\', '/')
                
                # Crear directorio remoto para el archivo
                remote_dir = os.path.dirname(remote_file_path)
                self._sftp_mkdir_p(sftp_client, remote_dir)
                
                try:
                    logger.info(f"Subiendo {local_file_path} a SFTP: {remote_file_path}")
                    sftp_client.put(local_file_path, remote_file_path)
                except Exception as e:
                    logger.error(f"Error subiendo {local_file_path}: {str(e)}")
                    success = False
        
        # Cerrar conexiones
        sftp_client.close()
        ssh_client.close()
        
        return success
    except Exception as e:
        logger.error(f"Error en _upload_to_sftp: {str(e)}")
        return False
    
def _sftp_mkdir_p(self, sftp, remote_directory):
    """Crear directorio remoto recursivamente (mkdir -p)"""
    if remote_directory == '/':
        return
    
    try:
        sftp.stat(remote_directory)
    except IOError:
        # El directorio no existe, crearlo
        parent = os.path.dirname(remote_directory)
        if parent != remote_directory:
            self._sftp_mkdir_p(sftp, parent)
        
        try:
            sftp.mkdir(remote_directory)
        except IOError as e:
            # Ignorar error si el directorio ya existe (race condition)
            if 'Failure' not in str(e):
                raise
```

## 6. Actualización de la Base de Datos

Después de una migración exitosa, se actualiza la base de datos con la nueva ubicación de los archivos:

```sql
UPDATE ejecuciones_yaml 
SET migrado_a_nube = true, 
    ruta_nube = %s, 
    nube_provider_id = %s 
WHERE id = %s
```

Donde:
* `migrado_a_nube`: Se marca como `true` para indicar que la migración fue exitosa
* `ruta_nube`: Se guarda la URI de nube completa (ej: `cloud://s3/ejecuciones/1234-abcd`)
* `nube_provider_id`: ID del proveedor donde se migraron los archivos

## 7. Limpieza de Archivos Temporales

Además de la migración, el Janitor Daemon se encarga de limpiar archivos temporales:

```python
def _clean_temp_files(self):
    """Limpiar archivos temporales antiguos"""
    # Directorio temporal
    temp_dir = os.environ.get('TEMP_DIR', './tmp')
    if not os.path.exists(temp_dir):
        logger.warning(f"Directorio temporal no encontrado: {temp_dir}")
        return
    
    # Tiempo de retención (por defecto 24 horas)
    retention_hours = float(os.environ.get('TEMP_RETENTION_HOURS', 24))
    cutoff_time = datetime.now() - timedelta(hours=retention_hours)
    
    # Listar archivos en el directorio temporal
    files_removed = 0
    total_size = 0
    
    for filename in os.listdir(temp_dir):
        file_path = os.path.join(temp_dir, filename)
        
        # Saltar directorios
        if os.path.isdir(file_path):
            continue
        
        # Verificar fecha de modificación
        file_mod_time = datetime.fromtimestamp(os.path.getmtime(file_path))
        if file_mod_time < cutoff_time:
            try:
                # Obtener tamaño
                file_size = os.path.getsize(file_path)
                total_size += file_size
                
                # Eliminar archivo
                os.remove(file_path)
                files_removed += 1
                logger.debug(f"Archivo temporal eliminado: {file_path} ({file_size} bytes)")
            except Exception as e:
                logger.warning(f"Error eliminando archivo temporal {file_path}: {str(e)}")
    
    if files_removed > 0:
        logger.info(f"Limpieza completada: {files_removed} archivos temporales eliminados ({total_size/1024/1024:.2f} MB)")
```

## 8. Logs y Monitoreo

El Janitor Daemon utiliza el módulo `logging` de Python para registrar su actividad:

```python
# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='logs/janitor_daemon.log',
    filemode='a'
)

# Crear también un handler para la consola
console = logging.StreamHandler()
console.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console.setFormatter(formatter)
logging.getLogger('').addHandler(console)

# Obtener logger
logger = logging.getLogger('janitor_daemon')
```

### 8.1 Niveles de Log

* **DEBUG**: Información detallada para diagnóstico
* **INFO**: Operaciones normales y confirmaciones
* **WARNING**: Advertencias sobre situaciones anómalas
* **ERROR**: Errores que impiden operaciones específicas
* **CRITICAL**: Errores graves que impiden el funcionamiento

### 8.2 Mensajes Clave

| Mensaje | Nivel | Significado |
|---------|-------|-------------|
| "Migrando ejecución X a la nube" | INFO | Comienza la migración de una ejecución |
| "Ejecución X migrada exitosamente" | INFO | Migración completada correctamente |
| "Error subiendo X" | ERROR | Fallo al subir un archivo específico |
| "No se pudo migrar la ejecución X" | ERROR | La migración completa falló |
| "Limpieza completada" | INFO | Limpieza de archivos temporales finalizada |

## 9. Programación y Ejecución

El Janitor Daemon está diseñado para ejecutarse periódicamente mediante cron o similar.

### 9.1 Ejecución Manual

```bash
# Ejecución estándar
python janitor_daemon.py

# Ejecución con modo debug
python janitor_daemon.py --debug

# Ejecución solo de limpieza
python janitor_daemon.py --clean-only
```

### 9.2 Configuración en Cron

Ejemplo de configuración en crontab:

```
# Ejecutar Janitor Daemon cada 6 horas
0 */6 * * * cd /ruta/al/proyecto && python janitor_daemon.py >> /var/log/janitor_daemon_cron.log 2>&1
```

### 9.3 Parámetros de Configuración

El daemon acepta estos parámetros de línea de comandos:

* `--debug`: Habilita logs de nivel DEBUG
* `--clean-only`: Solo realiza limpieza de archivos temporales, sin migración
* `--migrate-only`: Solo realiza migración, sin limpieza
* `--retention-hours HOURS`: Sobreescribe el tiempo de retención configurado
* `--existing-dirs-only`: Solo migra directorios que existen físicamente (por defecto)
* `--all-dirs`: Intenta migrar todos los directorios, incluso si no existen físicamente

## 10. Solución de Problemas

### 10.1 Problemas Comunes y Soluciones

#### No se Realiza Migración

**Síntomas**: El daemon se ejecuta pero no migra archivos.

**Posibles causas y soluciones**:
1. **Configuración de ejecuciones no existe**: Verificar tabla `ejecuciones_config`.
2. **No hay proveedor primario**: Configurar un proveedor primario válido.
3. **Migración automática desactivada**: Verificar `migrar_automaticamente = true`.
4. **Tiempo de retención muy alto**: Disminuir `tiempo_retencion_local` o usar `--retention-hours`.

#### Errores de Autenticación en la Nube

**Síntomas**: Logs con mensajes como "Access Denied", "Authentication failed".

**Posibles causas y soluciones**:
1. **Credenciales incorrectas**: Verificar y actualizar credenciales en `cloud_providers`.
2. **Credenciales expiradas**: Renovar tokens o credenciales de acceso.
3. **Permisos insuficientes**: Verificar permisos del usuario o rol en el proveedor de nube.

#### Errores de Conexión

**Síntomas**: Errores de timeout, connection refused.

**Posibles causas y soluciones**:
1. **Problemas de red**: Verificar conectividad a internet y configuración de proxy.
2. **Firewall**: Verificar reglas de firewall para permitir conexiones salientes.
3. **Endpoint incorrecto**: Verificar endpoint_url para proveedores S3 compatibles.

#### Errores de Permisos

**Síntomas**: Mensajes como "Permission denied", "Insufficient permissions".

**Posibles causas y soluciones**:
1. **Bucket/container incorrecto**: Verificar nombre del bucket/container en configuración.
2. **IAM incorrecto**: Verificar que el IAM tiene permisos adecuados (s3:PutObject, etc.).
3. **Permisos de archivos locales**: Verificar permisos de lectura en archivos locales.

### 10.2 Verificación de Estado

Para verificar el estado del Janitor Daemon:

```sql
-- Verificar configuración actual
SELECT * FROM ejecuciones_config ORDER BY id DESC LIMIT 1;

-- Verificar proveedores de nube
SELECT id, nombre, tipo, activo FROM cloud_providers WHERE activo = true;

-- Verificar ejecuciones pendientes de migración
SELECT COUNT(*) FROM ejecuciones_yaml WHERE migrado_a_nube = false;

-- Verificar últimas migraciones exitosas
SELECT id, uuid, ruta_nube, fecha_ejecucion 
FROM ejecuciones_yaml 
WHERE migrado_a_nube = true 
ORDER BY fecha_ejecucion DESC LIMIT 10;
```

## Conclusión

El Janitor Daemon es un componente crítico que automatiza la gestión del ciclo de vida de los archivos en SAGE, permitiendo escalar el sistema sin preocuparse por limitaciones de almacenamiento local. Su diseño modular facilita la integración con diferentes proveedores de nube y su configuración flexible permite adaptarlo a diferentes necesidades y entornos.

La correcta configuración y monitoreo del Janitor Daemon asegura un flujo eficiente de datos desde el almacenamiento local a la nube, manteniendo el sistema limpio y optimizado.