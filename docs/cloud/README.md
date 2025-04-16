# Sistema de Almacenamiento en la Nube para SAGE

## Introducción

El sistema de almacenamiento en la nube de SAGE proporciona una forma transparente y unificada de interactuar con diferentes proveedores de almacenamiento en la nube (como Amazon S3, Azure Blob Storage, Google Cloud Storage, SFTP y MinIO) para almacenar y recuperar archivos de ejecuciones de YAML.

Este documento describe la arquitectura, componentes y flujos de trabajo del sistema.

## Arquitectura

El sistema utiliza una arquitectura modular en capas:

1. **Capa de API**: Endpoints HTTP para operaciones de archivos en la nube
2. **Capa de Servicio**: Utilidades de alto nivel para manipular archivos (local o nube)
3. **Capa de Adaptadores**: Conectores específicos para cada proveedor de nube
4. **Capa de Base de Datos**: Gestión de proveedores y configuraciones

### Diagrama de Componentes

```
┌────────────────────────────────┐
│  APIs de Archivos en la Nube   │  // Endpoints HTTP para acceso a los archivos
└─────────────────┬──────────────┘
                  │
┌─────────────────▼──────────────┐
│    utils/cloud-storage.js      │  // Interfaz de alto nivel unificada
└─────────────────┬──────────────┘
                  │
┌─────────────────▼──────────────┐
│ utils/cloud/storage-manager.js │  // Gestiona proveedores a través de adaptadores
└─────────────────┬──────────────┘
                  │
       ┌──────────▼────────┐
       │                   │
┌──────▼─────┐     ┌───────▼──────┐
│ Adaptadores │     │ Base de Datos│
└──────┬─────┘     └───────┬──────┘
       │                   │
┌──────▼─────┐     ┌───────▼──────┐
│  S3, Azure │     │ Proveedores  │
│  GCP, SFTP │     │ Credenciales │
└────────────┘     └──────────────┘
```

## Componentes Principales

### 1. Utilidad de Almacenamiento Cloud (`utils/cloud-storage.js`)

Es la interfaz principal para el código cliente. Proporciona funciones de alto nivel para manipular archivos independientemente de la ubicación (local o en la nube).

**Características:**
- Detección automática de rutas locales vs. rutas en la nube (`cloud://`)
- Operaciones unificadas: lectura, escritura, copia, eliminación, etc.
- Migración automática de directorios locales a la nube

**Ejemplo de uso:**
```javascript
import { readFile, writeFile, fileExists, migrateToCloud } from '@/utils/cloud-storage';

// Leer un archivo (local o en la nube)
const content = await readFile('cloud://s3/ruta/al/archivo.txt');

// Verificar si un archivo existe
if (await fileExists('cloud://azure/mi/archivo.json')) {
  // Hacer algo con el archivo
}

// Migrar un directorio local a la nube
const result = await migrateToCloud(
  '/ruta/local', 
  's3',
  'directorio/destino'
);
```

### 2. Gestor de Almacenamiento (`utils/cloud/storage-manager.js`)

Se encarga de la selección e inicialización de adaptadores específicos para cada tipo de proveedor, proporcionando una interfaz unificada.

**Características:**
- Gestión de credenciales y configuración de proveedores
- Inicialización de adaptadores correspondientes
- Interfaz estandarizada para operaciones de almacenamiento
- Manejo centralizado de errores

**Ejemplo de uso:**
```javascript
import { getStorageManager } from '@/utils/cloud/storage-manager';

// Obtener un gestor para un proveedor específico
const storageManager = getStorageManager(proveedorDesdeDB);

// Probar conexión
const connectionResult = await storageManager.testConnection();

// Listar contenidos
const contents = await storageManager.listContents('ruta/en/nube');

// Descargar archivo
await storageManager.downloadFile('ruta/archivo.zip', 'destino/local.zip');
```

### 3. Adaptadores de Nube (`utils/cloud/adapters/`)

Implementan las operaciones específicas para cada proveedor de nube.

**Adaptadores disponibles:**
- **S3** (`s3.js` / `s3_fixed.js`): Para Amazon S3 y servicios compatibles como MinIO
- **Azure** (`azure.js`): Para Azure Blob Storage
- **GCP** (`gcp.js`): Para Google Cloud Storage
- **SFTP** (`sftp.js`): Para servidores SFTP

**Características de cada adaptador:**
- Autenticación específica para el proveedor
- Implementación de operaciones básicas (listar, subir, descargar, etc.)
- Transformación de errores específicos del proveedor a formato estándar

### 4. Gestión de Proveedores (`utils/db/cloud-providers.js`)

Gestiona los proveedores de nube en la base de datos.

**Operaciones:**
- Obtener proveedores por ID o tipo
- Crear, actualizar y eliminar proveedores
- Gestionar proveedores predeterminados

## URIs de Nube

El sistema utiliza un formato especial de URI para identificar recursos en la nube:

```
cloud://{tipo_proveedor}/{ruta/al/recurso}
```

Donde:
- `{tipo_proveedor}`: Identifica el tipo de proveedor (s3, azure, gcp, sftp, minio)
- `{ruta/al/recurso}`: Es la ruta completa al recurso dentro del proveedor

**Ejemplos:**
- `cloud://s3/ejecuciones/2022/01/informe.xlsx`
- `cloud://azure/datos/cliente42/resultados.csv`
- `cloud://sftp/upload/datos.json`

## Flujos de Trabajo

### 1. Migración de Ejecuciones a la Nube

El proceso de migración de ejecuciones locales a la nube:

1. **Janitor Daemon** identifica ejecuciones antiguas para migrar
2. Obtiene la configuración de la nube de la base de datos
3. Crea un gestor de almacenamiento para el proveedor adecuado
4. Sube todos los archivos de la ejecución a la nube
5. Actualiza la base de datos con la nueva ubicación (cloud://...)
6. Elimina los archivos locales después de una migración exitosa

### 2. Acceso a Archivos de Ejecuciones

El proceso para acceder a archivos de ejecuciones:

1. La aplicación cliente solicita un archivo a través de API
2. El sistema determina la ubicación del archivo (local o nube)
3. Si es local, lo sirve directamente
4. Si está en la nube:
   - Parsea la URI cloud://
   - Identifica el proveedor de nube
   - Descarga a un archivo temporal (si es necesario)
   - Sirve el contenido al cliente

## Buenas Prácticas

### Manejo de Credenciales

- Almacenar credenciales de proveedores de nube como objetos JSON en la base de datos
- Utilizar variables de entorno para credenciales en entornos de desarrollo/prueba
- Nunca hardcodear credenciales en el código

### Estrategias de Recuperación de Errores

1. **Reintentos con backoff exponencial** para problemas de conectividad
2. **Degradado gracioso** a almacenamiento local cuando la nube no está disponible
3. **Logueo detallado** de errores para diagnóstico

### Organización de Archivos en la Nube

Se recomienda organizar los archivos en la nube siguiendo este patrón:

```
{base_path}/{año}/{mes}/{casilla_id}/{ejecucion_id}/
```

Esto facilita:
- Navegación y búsqueda
- Políticas de retención basadas en tiempo
- Separación de datos por casilla

## Referencia de API

### Módulo `cloud-storage.js`

| Función | Descripción |
|---------|-------------|
| `readFile(path)` | Lee un archivo local o en la nube como Buffer |
| `readFileAsText(path, encoding)` | Lee un archivo como texto |
| `writeFile(path, content)` | Escribe contenido a un archivo local o en la nube |
| `fileExists(path)` | Verifica si un archivo existe |
| `listFiles(dirPath)` | Lista archivos en un directorio |
| `copyFile(source, destination)` | Copia un archivo a otro destino |
| `deleteFile(path)` | Elimina un archivo |
| `migrateToCloud(localDir, cloudType, basePath)` | Migra un directorio a la nube |
| `buildCloudUri(cloudType, path)` | Construye una URI de nube |
| `isCloudPath(path)` | Verifica si una ruta es de nube |

### Módulo `storage-manager.js`

| Función | Descripción |
|---------|-------------|
| `getStorageManager(provider)` | Crea un gestor para un proveedor específico |
| `createStorageManager(type, credentials, config)` | Crea un gestor personalizado |
| `parseCloudUri(uri)` | Analiza una URI de nube |

## Ejemplos de Código

### Migración de Ejecuciones

```javascript
import { migrateToCloud } from '@/utils/cloud-storage';

async function migrarEjecucion(ejecucionId, rutaLocal) {
  try {
    // Migrar a un proveedor S3
    const resultado = await migrateToCloud(
      rutaLocal,                        // Directorio local
      's3',                             // Tipo de proveedor
      `ejecuciones/${ejecucionId}`      // Ruta base en la nube
    );
    
    if (resultado.success) {
      console.log(`Migración exitosa de ${resultado.filesUploaded} archivos`);
      console.log(`Nueva URI: ${resultado.cloudUri}`);
      
      // Actualizar en la base de datos
      await actualizarEjecucionEnDB(ejecucionId, resultado.cloudUri);
      
      // Eliminar archivos locales
      await eliminarDirectorioLocal(rutaLocal);
    } else {
      console.error(`Error en migración: ${resultado.errors.join(', ')}`);
    }
  } catch (error) {
    console.error(`Error migrando ejecución ${ejecucionId}:`, error);
  }
}
```

### Acceso a Archivos en API

```javascript
import { readFile, fileExists } from '@/utils/cloud-storage';

export default async function handler(req, res) {
  const { path } = req.query;
  
  try {
    // Verificar si el archivo existe
    const exists = await fileExists(path);
    if (!exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    // Leer el archivo (funciona para local o nube)
    const content = await readFile(path);
    
    // Determinar tipo MIME
    const mimeType = determinarMimeType(path);
    
    // Enviar respuesta
    res.setHeader('Content-Type', mimeType);
    res.send(content);
  } catch (error) {
    console.error(`Error accediendo al archivo ${path}:`, error);
    res.status(500).json({ error: `Error al acceder al archivo: ${error.message}` });
  }
}
```

## Estructura de Objetos

### Proveedor de Nube (en Base de Datos)

```javascript
{
  id: 1,                       // ID único
  nombre: "Amazon S3 - Prod",  // Nombre descriptivo
  tipo: "s3",                  // Tipo de proveedor (s3, azure, gcp, sftp, minio)
  descripcion: "...",          // Descripción opcional
  credenciales: {              // Credenciales específicas del proveedor
    access_key: "...",
    secret_key: "...",
    region: "us-east-1"
  },
  configuracion: {             // Configuración específica del proveedor
    bucket: "mi-bucket",
    endpoint: "..."            // Opcional, para S3 compatible
  },
  activo: true,                // Estado del proveedor
  predeterminado: true         // Si es el predeterminado para su tipo
}
```

### Resultado de Listado de Archivos

```javascript
[
  {
    name: "archivo1.xlsx",     // Nombre del archivo
    path: "cloud://s3/ruta/archivo1.xlsx", // Ruta completa
    isDirectory: false,        // Si es directorio
    size: 1024,                // Tamaño en bytes
    modified: "2025-04-15T..."  // Fecha de modificación
  },
  {
    name: "carpeta1",
    path: "cloud://s3/ruta/carpeta1",
    isDirectory: true,
    size: 0,
    modified: "2025-04-15T..."
  }
]
```

## Conclusión

El sistema de almacenamiento en la nube de SAGE proporciona una interfaz unificada y transparente para trabajar con diferentes proveedores de nube, lo que permite una migración eficiente de ejecuciones locales a la nube y un acceso consistente a los archivos independientemente de su ubicación.

La arquitectura modular facilita la expansión para soportar nuevos proveedores de nube en el futuro y la abstracción mediante URIs simplifica el trabajar con diferentes proveedores simultáneamente.