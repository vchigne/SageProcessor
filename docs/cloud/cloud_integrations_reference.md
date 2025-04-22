# Referencia Completa de Integraciones en la Nube para SAGE

## Introducción

Este documento proporciona una referencia técnica detallada sobre cómo SAGE interactúa con diferentes proveedores de almacenamiento en la nube. Se cubren los siguientes aspectos:

1. Arquitectura del sistema de almacenamiento en la nube
2. Secretos y métodos de autenticación para cada proveedor
3. Janitor Daemon y migración automática de datos
4. Solución de problemas comunes
5. Diferencias entre el código Python (backend) y JavaScript (frontend)

## 1. Arquitectura del Sistema de Almacenamiento en la Nube

### 1.1 Componentes Principales

El sistema de almacenamiento en la nube de SAGE está diseñado con una arquitectura modular que incluye:

* **URI Cloud**: Formato unificado para referenciar recursos (cloud://tipo/ruta)
* **Adaptadores**: Módulos específicos para cada proveedor de nube
* **Storage Manager**: Interfaz unificada para operaciones de almacenamiento 
* **Cloud Storage API**: Endpoints HTTP para acceder a archivos en la nube
* **Janitor Daemon**: Proceso para migración automática de ejecuciones
* **Tablas en Base de Datos**: Para almacenar configuración y credenciales

### 1.2 Flujo de Operaciones

1. **Creación de la ejecución**: Inicialmente los archivos se guardan localmente
2. **Migración a la nube**: El Janitor Daemon identifica ejecuciones antiguas
3. **Selección de destino**: Se elige el proveedor primario o uno alternativo
4. **Transferencia de archivos**: Los adaptadores específicos realizan la subida
5. **Actualización de registros**: Se modifica la ruta en la base de datos de local a cloud://
6. **Limpieza**: Se eliminan los archivos locales tras una migración exitosa

### 1.3 Esquema de Base de Datos

La gestión de proveedores de nube se realiza a través de la tabla `cloud_providers` con la siguiente estructura:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | integer | Identificador único del proveedor |
| nombre | varchar | Nombre descriptivo del proveedor |
| tipo | varchar | Tipo de proveedor (s3, azure, gcp, sftp, minio) |
| descripcion | text | Descripción del proveedor |
| credenciales | jsonb | Credenciales de autenticación en formato JSON |
| configuracion | jsonb | Configuración adicional en formato JSON |
| activo | boolean | Estado del proveedor |
| ultimo_chequeo | timestamp | Timestamp del último test de conexión |
| secreto_id | integer | Referencia al cloud secret cuando aplica |
| estado | varchar | Estado de la última verificación |
| mensaje_error | text | Mensaje de error de la última verificación |
| creado_en | timestamp | Fecha de creación |
| modificado_en | timestamp | Fecha de última modificación |

## 2. Secretos y Métodos de Autenticación

Cada proveedor de nube requiere un método de autenticación específico. A continuación, se detallan las credenciales necesarias para cada uno:

### 2.1 Amazon S3 (tipo: 's3')

**Credenciales requeridas**:
```json
{
  "access_key": "AKIAXXXXXXXXXXXXXXXX",
  "secret_key": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "region": "us-east-1"
}
```

**Configuración adicional**:
```json
{
  "bucket": "nombre-del-bucket"
}
```

**Notas importantes**:
- Se recomienda usar un IAM con permisos limitados (s3:GetObject, s3:PutObject, s3:ListBucket)
- Para pruebas locales se pueden usar las variables de entorno AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY

### 2.2 Azure Blob Storage (tipo: 'azure')

**Método 1: Connection String**
```json
{
  "connection_string": "DefaultEndpointsProtocol=https;AccountName=cuenta;AccountKey=key;EndpointSuffix=core.windows.net"
}
```

**Método 2: SAS Token**
```json
{
  "account_name": "nombre-cuenta",
  "sas_token": "?sv=2020-08-04&ss=b&srt=co&sp=rwdlacitfx&se=2025-12-31T23:59:59Z&st=2025-01-01T00:00:00Z&spr=https&sig=XXXXX"
}
```

**Configuración adicional**:
```json
{
  "container": "nombre-del-container"
}
```

**Notas importantes**:
- Los SAS tokens tienen fecha de expiración, verificar su validez periódicamente
- Para acceso a nivel de cuenta, usar la connection string completa
- Para acceso limitado, usar SAS tokens con los permisos mínimos necesarios

### 2.3 Google Cloud Storage (tipo: 'gcp')

**Método 1: JSON Key File**
```json
{
  "credentials": {
    "type": "service_account",
    "project_id": "proyecto-id",
    "private_key_id": "clave-privada-id",
    "private_key": "-----BEGIN PRIVATE KEY-----\nXXXXX\n-----END PRIVATE KEY-----\n",
    "client_email": "cuenta@proyecto-id.iam.gserviceaccount.com",
    "client_id": "client-id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/cuenta%40proyecto-id.iam.gserviceaccount.com"
  }
}
```

**Configuración adicional**:
```json
{
  "bucket": "nombre-del-bucket",
  "project_id": "proyecto-id"
}
```

**Notas importantes**:
- GCP requiere una cuenta de servicio con rol Storage Object Admin o Storage Object Viewer
- El JSON de credenciales contiene la clave privada, debe mantenerse segura
- Se pueden usar variables de entorno (GOOGLE_APPLICATION_CREDENTIALS) en entornos de desarrollo

### 2.4 SFTP (tipo: 'sftp')

**Método 1: Contraseña**
```json
{
  "host": "sftp.example.com",
  "port": 22,
  "username": "usuario",
  "password": "contraseña"
}
```

**Método 2: Clave SSH**
```json
{
  "host": "sftp.example.com",
  "port": 22,
  "username": "usuario",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nXXXXX\n-----END RSA PRIVATE KEY-----",
  "private_key_passphrase": "frase-opcional"
}
```

**Configuración adicional**:
```json
{
  "base_path": "/ruta/remota/base"
}
```

**Notas importantes**:
- Verificar que el servidor SFTP permita el acceso desde la IP del servidor SAGE
- Las claves SSH ofrecen mayor seguridad que las contraseñas
- Es recomendable mantener un archivo known_hosts actualizado

### 2.5 MinIO (tipo: 'minio')

**Credenciales requeridas**:
```json
{
  "access_key": "minioadmin",
  "secret_key": "minioadmin"
}
```

**Configuración adicional**:
```json
{
  "endpoint_url": "http://minio-server:9000",
  "bucket": "bucket-name",
  "region": "us-east-1"
}
```

**Notas importantes**:
- MinIO es compatible con la API de S3, por lo que usa las mismas credenciales
- El endpoint_url debe incluir el protocolo (http:// o https://) y el puerto
- Para MinIO, el region se puede establecer a cualquier valor, pero es requerido

## 3. Janitor Daemon y Migración Automática

### 3.1 Funcionamiento del Janitor Daemon

El Janitor Daemon (`janitor_daemon.py`) es un proceso que se ejecuta periódicamente y se encarga de:

1. Identificar ejecuciones antiguas almacenadas localmente
2. Migrar estas ejecuciones a proveedores de nube configurados
3. Actualizar los registros en la base de datos
4. Eliminar archivos temporales y locales que ya no son necesarios

### 3.2 Configuración de Migración

La configuración de migración se almacena en la tabla `ejecuciones_config`:

| Parámetro | Descripción |
|-----------|-------------|
| nube_primaria_id | ID del proveedor de nube principal |
| nubes_alternativas | Lista de IDs de proveedores alternativos |
| tiempo_retencion_local | Tiempo en horas antes de migrar (>0) |
| prefijo_ruta_nube | Prefijo opcional para rutas en la nube |
| migrar_automaticamente | Flag para habilitar/deshabilitar la migración |

### 3.3 Proceso de Migración

El proceso de migración sigue estos pasos:

1. **Selección de ejecuciones**: Se seleccionan ejecuciones más antiguas que el tiempo de retención y que no estén ya migradas:
   ```sql
   SELECT id, uuid, ruta_directorio 
   FROM ejecuciones_yaml 
   WHERE migrado_a_nube = false 
     AND fecha_ejecucion < NOW() - INTERVAL %s HOUR
     AND ruta_directorio IS NOT NULL
   ```

2. **Selección de proveedor**: Se intenta migrar primero al proveedor primario y, si falla, a uno de los alternativos.

3. **Migración por tipo de proveedor**: Se usa la función específica según el tipo:
   - S3/MinIO: `_upload_to_s3()`
   - Azure: `_upload_to_azure()`
   - GCP: `_upload_to_gcp()`
   - SFTP: `_upload_to_sftp()`

4. **Actualización de registro**: Tras una migración exitosa, se actualiza la base de datos:
   ```sql
   UPDATE ejecuciones_yaml 
   SET migrado_a_nube = true, 
       ruta_nube = %s, 
       nube_provider_id = %s 
   WHERE id = %s
   ```

5. **Limpieza**: Se eliminan los archivos locales si la configuración lo permite.

### 3.4 Estructura URI en la Nube

Las URIs de nube en SAGE siguen el formato:
```
cloud://{tipo_proveedor}/{ruta/al/recurso}
```

Por ejemplo:
- `cloud://s3/ejecuciones/abcd-1234/output.log`
- `cloud://azure/migraciones/2022/01/xyz-5678/results.xlsx`

## 4. Adaptadores de Nube

Cada proveedor de nube tiene un adaptador específico que implementa operaciones de almacenamiento.

### 4.1 Estructura Común

Todos los adaptadores implementan estas operaciones básicas:

| Operación | Descripción |
|-----------|-------------|
| testConnection | Verifica la conectividad con el proveedor |
| listContents | Lista archivos en un directorio/bucket |
| uploadFile | Sube un archivo a la nube |
| downloadFile | Descarga un archivo de la nube |
| fileExists | Verifica si un archivo existe |
| deleteFile | Elimina un archivo de la nube |

### 4.2 Implementación por Proveedor

#### S3 y MinIO (s3.js / s3_fixed.js)

Utiliza la biblioteca AWS SDK para Node.js:
```javascript
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Configura cliente
const s3Client = new S3Client({
  region: credentials.region || 'us-east-1',
  credentials: {
    accessKeyId: credentials.access_key,
    secretAccessKey: credentials.secret_key
  },
  endpoint: config.endpoint_url
});
```

#### Azure (azure.js)

Utiliza @azure/storage-blob:
```javascript
import { BlobServiceClient } from '@azure/storage-blob';

// Configurar cliente
let blobServiceClient;
if (credentials.connection_string) {
  blobServiceClient = BlobServiceClient.fromConnectionString(credentials.connection_string);
} else if (credentials.account_name && credentials.sas_token) {
  const accountUrl = `https://${credentials.account_name}.blob.core.windows.net${credentials.sas_token}`;
  blobServiceClient = new BlobServiceClient(accountUrl);
}
```

#### Google Cloud Storage (gcp.js)

Utiliza @google-cloud/storage:
```javascript
import { Storage } from '@google-cloud/storage';

// Configurar cliente
const storage = new Storage({
  projectId: config.project_id,
  credentials: credentials
});
```

#### SFTP (sftp.js)

Utiliza ssh2:
```javascript
import { Client } from 'ssh2';

// Configurar conexión
const conn = new Client();
conn.connect({
  host: credentials.host,
  port: credentials.port || 22,
  username: credentials.username,
  password: credentials.password,
  privateKey: credentials.private_key
});
```

## 5. Tablas y Relaciones en la Base de Datos

El sistema de almacenamiento en la nube utiliza varias tablas en la base de datos:

### 5.1 cloud_providers

Almacena la configuración de proveedores de nube:

```sql
CREATE TABLE cloud_providers (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- 's3', 'azure', 'gcp', 'sftp', 'minio'
    descripcion TEXT,
    credenciales JSONB NOT NULL,
    configuracion JSONB,
    activo BOOLEAN DEFAULT true,
    ultimo_chequeo TIMESTAMP,
    secreto_id INTEGER REFERENCES cloud_secrets(id),
    estado VARCHAR(50),
    mensaje_error TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modificado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 cloud_secrets

Almacena información sobre secretos en la nube:

```sql
CREATE TABLE cloud_secrets (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL, -- Tipo de servicio: 's3', 'azure', etc.
    secreto JSONB NOT NULL, -- Contiene las credenciales cifradas/seguras
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.3 ejecuciones_config

Configuración global para el procesamiento de ejecuciones:

```sql
CREATE TABLE ejecuciones_config (
    id SERIAL PRIMARY KEY,
    nube_primaria_id INTEGER REFERENCES cloud_providers(id),
    nubes_alternativas INTEGER[] DEFAULT '{}',
    tiempo_retencion_local INTEGER DEFAULT 24, -- Horas
    prefijo_ruta_nube VARCHAR(255) DEFAULT '',
    migrar_automaticamente BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.4 ejecuciones_yaml

Registros de ejecuciones con información de almacenamiento:

```sql
-- Columnas relevantes para almacenamiento en nube
ruta_directorio VARCHAR(255), -- Ruta local
migrado_a_nube BOOLEAN DEFAULT false,
ruta_nube VARCHAR(255), -- URI de la nube
nube_provider_id INTEGER REFERENCES cloud_providers(id)
```

## 6. Compatibilidad entre JavaScript y Python

El sistema de nube debe funcionar de manera similar tanto en el frontend (JavaScript) como en el backend (Python). Aquí están las equivalencias clave:

### 6.1 Bibliotecas Equivalentes

| Funcionalidad | JavaScript | Python |
|---------------|------------|--------|
| S3/MinIO | @aws-sdk/client-s3 | boto3 |
| Azure Blob | @azure/storage-blob | azure-storage-blob |
| Google Cloud | @google-cloud/storage | google-cloud-storage |
| SFTP | ssh2 | paramiko |

### 6.2 Manejo de Credenciales

**JavaScript**:
```javascript
// Desencriptar o deserializar credenciales si es necesario
const credentials = typeof providerCredentials === 'string' 
  ? JSON.parse(providerCredentials) 
  : providerCredentials;
```

**Python**:
```python
# Desencriptar o deserializar credenciales si es necesario
credentials = provider['credenciales']
if isinstance(credentials, str):
    credentials = json.loads(credentials)
```

### 6.3 URLs y Manejo de Rutas

**JavaScript**:
```javascript
// Construcción de URIs cloud
function buildCloudUri(type, path) {
  return `cloud://${type}/${path.replace(/^\/+/, '')}`;
}

// Parsing de URIs cloud
function parseCloudUri(uri) {
  const match = uri.match(/^cloud:\/\/([^\/]+)\/(.*)$/);
  if (!match) throw new Error('Invalid cloud URI format');
  return { type: match[1], path: match[2] };
}
```

**Python**:
```python
# Construcción de URIs cloud
def build_cloud_uri(type, path):
    path = path.lstrip('/')
    return f"cloud://{type}/{path}"

# Parsing de URIs cloud
def parse_cloud_uri(uri):
    import re
    match = re.match(r'^cloud://([^/]+)/(.*)$', uri)
    if not match:
        raise ValueError("Formato de URI cloud inválido")
    return {
        'type': match.group(1),
        'path': match.group(2)
    }
```

## 7. Buenas Prácticas y Consejos

### 7.1 Seguridad

1. **Nunca hardcodear credenciales** en el código fuente
2. **Usar IAM con privilegios mínimos** para cada servicio
3. **Rotar credenciales periódicamente**, especialmente para tokens de acceso
4. **Cifrar credenciales en reposo** en la base de datos
5. **Usar HTTPS/SSL** para todas las conexiones a proveedores de nube

### 7.2 Rendimiento

1. **Implementar caché** para archivos de nube accedidos frecuentemente
2. **Usar compresión** para archivos grandes antes de subirlos
3. **Implementar reintentos con backoff exponencial** para operaciones de nube
4. **Agrupar operaciones pequeñas** para reducir el número de llamadas API
5. **Prefetching** para archivos que probablemente se necesitarán juntos

### 7.3 Organización de Archivos

1. **Estructura jerárquica**: Usar una estructura de directorios que permita escalar
2. **Metadatos**: Almacenar metadatos relevantes además de los archivos
3. **Convenciones de nomenclatura**: Usar nombres coherentes para facilitar la búsqueda
4. **Versioning**: Implementar alguna forma de versionado para archivos importantes
5. **Particionamiento**: Organizar por fecha o ID para mejorar el rendimiento

## 8. Solución de Problemas Comunes

### 8.1 Credenciales Incorrectas o Expiradas

**Síntomas**:
- "Access Denied" o "Unauthorized" en logs
- Las operaciones fallan consistentemente para un proveedor específico

**Soluciones**:
1. Verificar y actualizar credenciales en la base de datos
2. Comprobar fecha de expiración para tokens SAS o credenciales temporales
3. Verificar permisos IAM para la cuenta utilizada

### 8.2 Problemas de Conectividad

**Síntomas**:
- Timeouts o errores "Connection Refused"
- Las operaciones funcionan intermitentemente

**Soluciones**:
1. Verificar firewall y reglas de seguridad en la red
2. Comprobar si hay restricciones de IP en el proveedor de nube
3. Implementar reintentos para operaciones críticas

### 8.3 Problemas con URIs de Nube

**Síntomas**:
- Errores "Invalid Cloud URI format"
- Archivos no se encuentran aunque existen

**Soluciones**:
1. Verificar el formato correcto de la URI (cloud://tipo/ruta)
2. Comprobar que el tipo de proveedor existe y está activo
3. Verificar que no hay caracteres especiales o problemas de codificación en la ruta

## Conclusión

El sistema de almacenamiento en la nube de SAGE ofrece una solución flexible y robusta para gestionar archivos en diferentes proveedores. La arquitectura modular y la abstracción mediante URIs facilita la interoperabilidad y mantiene una experiencia de usuario consistente independientemente de dónde se almacenen los datos.

Esta documentación está pensada como referencia técnica y debería actualizarse cuando se realicen cambios significativos en el sistema de almacenamiento en la nube.