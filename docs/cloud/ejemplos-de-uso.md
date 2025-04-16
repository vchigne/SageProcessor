# Ejemplos de Uso del Sistema de Almacenamiento en la Nube

Este documento proporciona ejemplos concretos de cómo utilizar el sistema de almacenamiento en la nube en diferentes contextos dentro de SAGE.

## Índice

1. [Frontend - Acceso a Archivos](#frontend---acceso-a-archivos)
2. [Backend - APIs](#backend---apis)
3. [Janitor Daemon - Migración de Ejecuciones](#janitor-daemon---migración-de-ejecuciones)
4. [Interfaz de Administración - Gestión de Proveedores](#interfaz-de-administración---gestión-de-proveedores)
5. [Debugging y Solución de Problemas](#debugging-y-solución-de-problemas)

## Frontend - Acceso a Archivos

### Obtener Contenido de un Archivo

```javascript
import { useEffect, useState } from 'react';

function VisorArchivo({ rutaArchivo }) {
  const [contenido, setContenido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function cargarArchivo() {
      try {
        // Usar la API para obtener el contenido (funciona para local o nube)
        const respuesta = await fetch(`/api/cloud-files/content?path=${encodeURIComponent(rutaArchivo)}`);
        
        if (!respuesta.ok) {
          throw new Error(`Error ${respuesta.status}: ${respuesta.statusText}`);
        }
        
        const datos = await respuesta.text();
        setContenido(datos);
      } catch (err) {
        console.error('Error cargando archivo:', err);
        setError(err.message);
      } finally {
        setCargando(false);
      }
    }
    
    cargarArchivo();
  }, [rutaArchivo]);
  
  if (cargando) return <div>Cargando...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  
  return (
    <div className="visor-archivo">
      <pre>{contenido}</pre>
    </div>
  );
}

// Uso para archivo local
<VisorArchivo rutaArchivo="/ruta/local/archivo.txt" />

// Uso para archivo en la nube
<VisorArchivo rutaArchivo="cloud://s3/ruta/en/nube/archivo.txt" />
```

### Verificar Existencia de Archivos

```javascript
import { useEffect, useState } from 'react';

function VerificadorArchivo({ rutaArchivo }) {
  const [existe, setExiste] = useState(false);
  const [verificado, setVerificado] = useState(false);
  
  useEffect(() => {
    async function verificarExistencia() {
      try {
        const respuesta = await fetch(`/api/cloud-files/exists?path=${encodeURIComponent(rutaArchivo)}`);
        setExiste(respuesta.ok);
      } catch (err) {
        console.error('Error verificando archivo:', err);
        setExiste(false);
      } finally {
        setVerificado(true);
      }
    }
    
    verificarExistencia();
  }, [rutaArchivo]);
  
  if (!verificado) return <span>Verificando...</span>;
  
  return (
    <span className={existe ? 'archivo-disponible' : 'archivo-no-disponible'}>
      {existe ? '✓ Disponible' : '✗ No disponible'}
    </span>
  );
}
```

### Listar Archivos en un Directorio

```javascript
import { useEffect, useState } from 'react';

function ExplorarDirectorio({ rutaDirectorio }) {
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function cargarArchivos() {
      try {
        const respuesta = await fetch(`/api/cloud-files/list?path=${encodeURIComponent(rutaDirectorio)}`);
        
        if (!respuesta.ok) {
          throw new Error(`Error ${respuesta.status}: ${respuesta.statusText}`);
        }
        
        const datos = await respuesta.json();
        setArchivos(datos);
      } catch (err) {
        console.error('Error listando archivos:', err);
        setError(err.message);
      } finally {
        setCargando(false);
      }
    }
    
    cargarArchivos();
  }, [rutaDirectorio]);
  
  if (cargando) return <div>Cargando archivos...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  
  return (
    <div className="explorador-archivos">
      <h3>Contenido de {rutaDirectorio}</h3>
      <ul>
        {archivos.map(archivo => (
          <li key={archivo.path} className={archivo.isDirectory ? 'directorio' : 'archivo'}>
            {archivo.name} 
            {!archivo.isDirectory && <span className="tamano">({formatearTamano(archivo.size)})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatearTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
```

## Backend - APIs

### API para Obtener Contenido de Archivo

```javascript
// src/pages/api/cloud-files/content.js
import { readFile } from '@/utils/cloud-storage';

export default async function handler(req, res) {
  // Obtener la ruta del archivo desde la query
  const { path } = req.query;
  
  if (!path) {
    return res.status(400).json({ error: 'Se requiere el parámetro path' });
  }
  
  try {
    // Leer el archivo (funciona para local o en la nube)
    const contenido = await readFile(path);
    
    // Determinar tipo MIME básico basado en la extensión
    const extension = path.split('.').pop().toLowerCase();
    let mimeType = 'application/octet-stream'; // Por defecto
    
    // Mapeo básico de MIME types
    const mimeTypes = {
      'txt': 'text/plain',
      'json': 'application/json',
      'csv': 'text/csv',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'html': 'text/html',
      'xml': 'application/xml',
      'yaml': 'application/x-yaml',
      'yml': 'application/x-yaml',
      'log': 'text/plain'
    };
    
    if (extension in mimeTypes) {
      mimeType = mimeTypes[extension];
    }
    
    // Configurar headers
    res.setHeader('Content-Type', mimeType);
    
    // Para archivos de texto, intentar detectar el encoding
    if (mimeType.startsWith('text/') || 
        mimeType === 'application/json' || 
        mimeType === 'application/xml' ||
        mimeType === 'application/x-yaml') {
      res.setHeader('Content-Type', `${mimeType}; charset=utf-8`);
    }
    
    // Enviar el contenido
    res.send(contenido);
  } catch (error) {
    console.error(`Error leyendo archivo ${path}:`, error);
    
    // Determinar código de error apropiado
    if (error.message.includes('no encontrado') || error.message.includes('not found')) {
      return res.status(404).json({ error: `Archivo no encontrado: ${error.message}` });
    }
    
    if (error.message.includes('permiso') || error.message.includes('permission')) {
      return res.status(403).json({ error: `Acceso denegado: ${error.message}` });
    }
    
    return res.status(500).json({ error: `Error leyendo archivo: ${error.message}` });
  }
}
```

### API para Verificar Existencia de Archivo

```javascript
// src/pages/api/cloud-files/exists.js
import { fileExists } from '@/utils/cloud-storage';

export default async function handler(req, res) {
  const { path } = req.query;
  
  if (!path) {
    return res.status(400).json({ error: 'Se requiere el parámetro path' });
  }
  
  try {
    const existe = await fileExists(path);
    
    if (existe) {
      return res.status(200).json({ exists: true });
    } else {
      return res.status(404).json({ exists: false });
    }
  } catch (error) {
    console.error(`Error verificando existencia de ${path}:`, error);
    return res.status(500).json({ 
      error: `Error verificando existencia: ${error.message}`,
      exists: false
    });
  }
}
```

### API para Listar Archivos en Directorio

```javascript
// src/pages/api/cloud-files/list.js
import { listFiles } from '@/utils/cloud-storage';

export default async function handler(req, res) {
  const { path } = req.query;
  
  if (!path) {
    return res.status(400).json({ error: 'Se requiere el parámetro path' });
  }
  
  try {
    const archivos = await listFiles(path);
    return res.status(200).json(archivos);
  } catch (error) {
    console.error(`Error listando archivos en ${path}:`, error);
    
    if (error.message.includes('no encontrado') || error.message.includes('not found')) {
      return res.status(404).json({ error: `Directorio no encontrado: ${error.message}` });
    }
    
    if (error.message.includes('permiso') || error.message.includes('permission')) {
      return res.status(403).json({ error: `Acceso denegado: ${error.message}` });
    }
    
    return res.status(500).json({ error: `Error listando archivos: ${error.message}` });
  }
}
```

## Janitor Daemon - Migración de Ejecuciones

La implementación en Python para el Janitor Daemon utiliza la misma lógica de migración pero con las bibliotecas específicas para cada proveedor.

```python
import os
import shutil
import json
import psycopg2
import boto3
from azure.storage.blob import BlobServiceClient
from google.cloud import storage
import paramiko

class CloudMigrator:
    def __init__(self, connection_string):
        self.conn = psycopg2.connect(connection_string)
        
    def get_cloud_providers(self):
        """Obtiene todos los proveedores de nube activos"""
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT id, nombre, tipo, credenciales, configuracion FROM cloud_providers WHERE activo = true"
        )
        providers = []
        for row in cursor.fetchall():
            provider = {
                'id': row[0],
                'nombre': row[1],
                'tipo': row[2],
                'credenciales': json.loads(row[3]) if isinstance(row[3], str) else row[3],
                'configuracion': json.loads(row[4]) if isinstance(row[4], str) else row[4]
            }
            providers.append(provider)
        cursor.close()
        return providers
    
    def get_ejecuciones_a_migrar(self, antiguedad_horas=5):
        """Obtiene ejecuciones locales que deben migrarse a la nube"""
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT id, uuid, ruta_directorio 
            FROM ejecuciones_yaml 
            WHERE migrado_a_nube = false 
              AND fecha_ejecucion < NOW() - INTERVAL %s HOUR
              AND ruta_directorio IS NOT NULL
            """, 
            (antiguedad_horas,)
        )
        ejecuciones = []
        for row in cursor.fetchall():
            ejecuciones.append({
                'id': row[0],
                'uuid': row[1],
                'ruta_directorio': row[2]
            })
        cursor.close()
        return ejecuciones
    
    def migrar_ejecucion(self, ejecucion, provider):
        """Migra una ejecución específica a la nube"""
        print(f"Migrando ejecución {ejecucion['uuid']} a {provider['nombre']}")
        
        # Verificar que el directorio local existe
        local_path = ejecucion['ruta_directorio']
        if not os.path.exists(local_path):
            print(f"Directorio local no encontrado: {local_path}")
            return False
        
        # Directorio de destino en la nube
        cloud_path = f"ejecuciones/{ejecucion['uuid']}"
        
        # Migrar según el tipo de proveedor
        success = False
        if provider['tipo'] == 's3' or provider['tipo'] == 'minio':
            success = self._migrar_a_s3(local_path, cloud_path, provider)
        elif provider['tipo'] == 'azure':
            success = self._migrar_a_azure(local_path, cloud_path, provider)
        elif provider['tipo'] == 'gcp':
            success = self._migrar_a_gcp(local_path, cloud_path, provider)
        elif provider['tipo'] == 'sftp':
            success = self._migrar_a_sftp(local_path, cloud_path, provider)
        
        if success:
            # Actualizar en la base de datos
            self._actualizar_ejecucion_en_db(ejecucion['id'], f"cloud://{provider['tipo']}/{cloud_path}", provider['id'])
            
            # Eliminar directorio local
            try:
                shutil.rmtree(local_path)
                print(f"Directorio local eliminado: {local_path}")
            except Exception as e:
                print(f"Error eliminando directorio local: {e}")
                # Continuar aunque falle la eliminación
        
        return success
    
    def _migrar_a_s3(self, local_path, cloud_path, provider):
        """Migra archivos a S3 o MinIO"""
        try:
            # Configurar cliente S3
            s3_client = boto3.client(
                's3',
                aws_access_key_id=provider['credenciales'].get('access_key'),
                aws_secret_access_key=provider['credenciales'].get('secret_key'),
                region_name=provider['credenciales'].get('region', 'us-east-1'),
                endpoint_url=provider['configuracion'].get('endpoint_url')  # Para MinIO o S3 compatible
            )
            
            bucket = provider['configuracion'].get('bucket')
            if not bucket:
                print("Error: No se especificó el bucket")
                return False
            
            # Subir todos los archivos en el directorio
            for root, dirs, files in os.walk(local_path):
                for file in files:
                    local_file_path = os.path.join(root, file)
                    
                    # Determinar ruta relativa
                    rel_path = os.path.relpath(local_file_path, local_path)
                    s3_key = f"{cloud_path}/{rel_path}".replace('\\', '/')
                    
                    print(f"Subiendo {local_file_path} a s3://{bucket}/{s3_key}")
                    s3_client.upload_file(local_file_path, bucket, s3_key)
            
            return True
        except Exception as e:
            print(f"Error migrando a S3: {e}")
            return False
    
    def _migrar_a_azure(self, local_path, cloud_path, provider):
        """Migra archivos a Azure Blob Storage"""
        try:
            connection_string = provider['credenciales'].get('connection_string')
            if not connection_string:
                print("Error: No se especificó la cadena de conexión de Azure")
                return False
            
            container_name = provider['configuracion'].get('container')
            if not container_name:
                print("Error: No se especificó el contenedor de Azure")
                return False
            
            # Crear cliente de Azure Blob Storage
            blob_service_client = BlobServiceClient.from_connection_string(connection_string)
            container_client = blob_service_client.get_container_client(container_name)
            
            # Subir todos los archivos en el directorio
            for root, dirs, files in os.walk(local_path):
                for file in files:
                    local_file_path = os.path.join(root, file)
                    
                    # Determinar ruta relativa
                    rel_path = os.path.relpath(local_file_path, local_path)
                    blob_path = f"{cloud_path}/{rel_path}".replace('\\', '/')
                    
                    print(f"Subiendo {local_file_path} a Azure Blob Storage: {blob_path}")
                    
                    # Crear cliente de blob y subir
                    blob_client = container_client.get_blob_client(blob_path)
                    with open(local_file_path, "rb") as data:
                        blob_client.upload_blob(data, overwrite=True)
            
            return True
        except Exception as e:
            print(f"Error migrando a Azure: {e}")
            return False
    
    def _migrar_a_gcp(self, local_path, cloud_path, provider):
        """Migra archivos a Google Cloud Storage"""
        try:
            bucket_name = provider['configuracion'].get('bucket')
            if not bucket_name:
                print("Error: No se especificó el bucket de GCP")
                return False
            
            # Inicializar cliente de GCP
            # Dependiendo de cómo estén almacenadas las credenciales
            storage_client = storage.Client()
            bucket = storage_client.bucket(bucket_name)
            
            # Subir todos los archivos en el directorio
            for root, dirs, files in os.walk(local_path):
                for file in files:
                    local_file_path = os.path.join(root, file)
                    
                    # Determinar ruta relativa
                    rel_path = os.path.relpath(local_file_path, local_path)
                    blob_path = f"{cloud_path}/{rel_path}".replace('\\', '/')
                    
                    print(f"Subiendo {local_file_path} a GCS: {blob_path}")
                    
                    blob = bucket.blob(blob_path)
                    blob.upload_from_filename(local_file_path)
            
            return True
        except Exception as e:
            print(f"Error migrando a GCP: {e}")
            return False
    
    def _migrar_a_sftp(self, local_path, cloud_path, provider):
        """Migra archivos a un servidor SFTP"""
        try:
            host = provider['credenciales'].get('host')
            port = provider['credenciales'].get('port', 22)
            username = provider['credenciales'].get('username')
            password = provider['credenciales'].get('password')
            key_path = provider['credenciales'].get('key_path')
            
            if not host or not username:
                print("Error: Faltan credenciales SFTP (host o username)")
                return False
            
            # Conectar al servidor SFTP
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Conectar con contraseña o clave según lo que se proporcione
            if key_path and os.path.exists(key_path):
                key = paramiko.RSAKey.from_private_key_file(key_path)
                ssh.connect(host, port=port, username=username, pkey=key)
            else:
                ssh.connect(host, port=port, username=username, password=password)
            
            sftp = ssh.open_sftp()
            
            # Asegurar que el directorio remoto existe
            self._sftp_mkdir_p(sftp, cloud_path)
            
            # Subir todos los archivos en el directorio
            for root, dirs, files in os.walk(local_path):
                for file in files:
                    local_file_path = os.path.join(root, file)
                    
                    # Determinar ruta relativa
                    rel_path = os.path.relpath(local_file_path, local_path)
                    remote_path = f"{cloud_path}/{rel_path}".replace('\\', '/')
                    
                    # Asegurar que el directorio remoto existe
                    remote_dir = os.path.dirname(remote_path)
                    self._sftp_mkdir_p(sftp, remote_dir)
                    
                    print(f"Subiendo {local_file_path} a SFTP: {remote_path}")
                    sftp.put(local_file_path, remote_path)
            
            sftp.close()
            ssh.close()
            return True
        except Exception as e:
            print(f"Error migrando a SFTP: {e}")
            return False
    
    def _sftp_mkdir_p(self, sftp, remote_directory):
        """Crea recursivamente directorios en el servidor SFTP (como mkdir -p)"""
        if remote_directory == '/':
            sftp.chdir('/')
            return
        
        if remote_directory == '':
            return
        
        try:
            sftp.chdir(remote_directory)
        except IOError:
            dirname, basename = os.path.split(remote_directory.rstrip('/'))
            self._sftp_mkdir_p(sftp, dirname)
            try:
                sftp.mkdir(basename)
            except IOError:
                pass
            sftp.chdir(basename)
    
    def _actualizar_ejecucion_en_db(self, ejecucion_id, cloud_uri, provider_id):
        """Actualiza la ejecución en la base de datos con su nueva ubicación en la nube"""
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                """
                UPDATE ejecuciones_yaml 
                SET migrado_a_nube = true, 
                    ruta_nube = %s,
                    nube_primaria_id = %s
                WHERE id = %s
                """,
                (cloud_uri, provider_id, ejecucion_id)
            )
            self.conn.commit()
            print(f"Ejecución {ejecucion_id} actualizada en DB: {cloud_uri}")
            return True
        except Exception as e:
            self.conn.rollback()
            print(f"Error actualizando ejecución en DB: {e}")
            return False
        finally:
            cursor.close()
    
    def ejecutar_migracion(self):
        """Proceso principal de migración"""
        providers = self.get_cloud_providers()
        if not providers:
            print("No hay proveedores de nube activos configurados")
            return
        
        ejecuciones = self.get_ejecuciones_a_migrar()
        print(f"Encontradas {len(ejecuciones)} ejecuciones para migrar")
        
        for ejecucion in ejecuciones:
            # Utilizar el primer proveedor activo como ejemplo
            # En un caso real, podría seleccionarse según reglas o configuración
            provider = providers[0]
            self.migrar_ejecucion(ejecucion, provider)
```

## Interfaz de Administración - Gestión de Proveedores

### Formulario para Añadir/Editar Proveedor

```javascript
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

// Configuración de campos según tipo de proveedor
const providerFields = {
  s3: {
    credenciales: [
      { name: 'access_key', label: 'Access Key', type: 'text', required: true },
      { name: 'secret_key', label: 'Secret Key', type: 'password', required: true },
      { name: 'region', label: 'Región', type: 'text', defaultValue: 'us-east-1' }
    ],
    configuracion: [
      { name: 'bucket', label: 'Bucket', type: 'text', required: true },
      { name: 'endpoint_url', label: 'Endpoint URL (opcional)', type: 'text', placeholder: 'https://s3.amazonaws.com' }
    ]
  },
  azure: {
    credenciales: [
      { name: 'connection_string', label: 'Cadena de Conexión', type: 'password', required: true }
    ],
    configuracion: [
      { name: 'container', label: 'Contenedor', type: 'text', required: true }
    ]
  },
  gcp: {
    credenciales: [
      { name: 'project_id', label: 'ID del Proyecto', type: 'text', required: true },
      { name: 'credentials_json', label: 'Credenciales (JSON)', type: 'textarea', required: true }
    ],
    configuracion: [
      { name: 'bucket', label: 'Bucket', type: 'text', required: true }
    ]
  },
  sftp: {
    credenciales: [
      { name: 'host', label: 'Host/Servidor', type: 'text', required: true },
      { name: 'port', label: 'Puerto', type: 'number', defaultValue: 22 },
      { name: 'username', label: 'Usuario', type: 'text', required: true },
      { name: 'password', label: 'Contraseña', type: 'password' },
      { name: 'key_path', label: 'Ruta de Clave Privada', type: 'text' }
    ],
    configuracion: [
      { name: 'base_path', label: 'Ruta Base', type: 'text', defaultValue: '/' }
    ]
  },
  minio: {
    credenciales: [
      { name: 'access_key', label: 'Access Key', type: 'text', required: true },
      { name: 'secret_key', label: 'Secret Key', type: 'password', required: true }
    ],
    configuracion: [
      { name: 'bucket', label: 'Bucket', type: 'text', required: true },
      { name: 'endpoint_url', label: 'Endpoint URL', type: 'text', required: true, placeholder: 'https://play.min.io' }
    ]
  }
};

export default function FormularioProveedor({ providerId }) {
  const router = useRouter();
  const [provider, setProvider] = useState({
    nombre: '',
    tipo: 's3',
    descripcion: '',
    credenciales: {},
    configuracion: {},
    activo: true,
    predeterminado: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // Cargar datos del proveedor si estamos editando
  useEffect(() => {
    async function loadProvider() {
      if (!providerId) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/clouds/${providerId}`);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Asegurar que credenciales y configuración son objetos
        const providerData = {
          ...data,
          credenciales: typeof data.credenciales === 'string' 
            ? JSON.parse(data.credenciales) 
            : data.credenciales || {},
          configuracion: typeof data.configuracion === 'string' 
            ? JSON.parse(data.configuracion) 
            : data.configuracion || {}
        };
        
        setProvider(providerData);
      } catch (err) {
        console.error('Error cargando proveedor:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadProvider();
  }, [providerId]);

  // Manejar cambios en campos básicos
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProvider({
      ...provider,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // Manejar cambios en credenciales
  const handleCredentialChange = (e) => {
    const { name, value } = e.target;
    setProvider({
      ...provider,
      credenciales: {
        ...provider.credenciales,
        [name]: value
      }
    });
  };

  // Manejar cambios en configuración
  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setProvider({
      ...provider,
      configuracion: {
        ...provider.configuracion,
        [name]: value
      }
    });
  };

  // Probar conexión
  const handleTestConnection = async () => {
    try {
      setLoading(true);
      setTestResult(null);
      
      const response = await fetch('/api/cloud-files/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider_id: providerId,
          provider_type: provider.tipo,
          credentials: provider.credenciales,
          config: provider.configuracion
        })
      });
      
      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      console.error('Error probando conexión:', err);
      setTestResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      // Preparar datos para enviar
      const providerData = {
        ...provider,
        credenciales: JSON.stringify(provider.credenciales),
        configuracion: JSON.stringify(provider.configuracion)
      };
      
      // Determinar si es creación o actualización
      const url = providerId 
        ? `/api/clouds/${providerId}` 
        : '/api/clouds';
      
      const method = providerId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error ${response.status}`);
      }
      
      const result = await response.json();
      
      setSuccessMessage(`Proveedor ${providerId ? 'actualizado' : 'creado'} correctamente`);
      
      // Redireccionar después de un breve delay
      setTimeout(() => {
        router.push('/admin/clouds');
      }, 2000);
    } catch (err) {
      console.error('Error guardando proveedor:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Renderizar campos dinámicamente según el tipo de proveedor
  const renderCredentialFields = () => {
    const fields = providerFields[provider.tipo]?.credenciales || [];
    
    return fields.map(field => (
      <div key={field.name} className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={field.name}>
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        
        {field.type === 'textarea' ? (
          <textarea
            id={field.name}
            name={field.name}
            value={provider.credenciales[field.name] || ''}
            onChange={handleCredentialChange}
            required={field.required}
            placeholder={field.placeholder}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            rows={5}
          />
        ) : (
          <input
            type={field.type}
            id={field.name}
            name={field.name}
            value={provider.credenciales[field.name] || field.defaultValue || ''}
            onChange={handleCredentialChange}
            required={field.required}
            placeholder={field.placeholder}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        )}
      </div>
    ));
  };

  const renderConfigFields = () => {
    const fields = providerFields[provider.tipo]?.configuracion || [];
    
    return fields.map(field => (
      <div key={field.name} className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={`config-${field.name}`}>
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        <input
          type={field.type}
          id={`config-${field.name}`}
          name={field.name}
          value={provider.configuracion[field.name] || field.defaultValue || ''}
          onChange={handleConfigChange}
          required={field.required}
          placeholder={field.placeholder}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        />
      </div>
    ));
  };

  if (loading && !provider.nombre) {
    return <div className="text-center p-4">Cargando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">
        {providerId ? 'Editar Proveedor de Nube' : 'Crear Nuevo Proveedor de Nube'}
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Error: </strong>
          <span>{error}</span>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Éxito: </strong>
          <span>{successMessage}</span>
        </div>
      )}
      
      {testResult && (
        <div className={`${testResult.success ? 'bg-green-100 text-green-700 border-green-400' : 'bg-red-100 text-red-700 border-red-400'} border px-4 py-3 rounded mb-4`}>
          <strong className="font-bold">{testResult.success ? 'Conexión exitosa: ' : 'Error de conexión: '}</strong>
          <span>{testResult.message}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Campos básicos */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="nombre">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            value={provider.nombre}
            onChange={handleChange}
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="tipo">
            Tipo de Proveedor <span className="text-red-500">*</span>
          </label>
          <select
            id="tipo"
            name="tipo"
            value={provider.tipo}
            onChange={handleChange}
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="s3">Amazon S3</option>
            <option value="azure">Azure Blob Storage</option>
            <option value="gcp">Google Cloud Storage</option>
            <option value="sftp">SFTP</option>
            <option value="minio">MinIO</option>
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="descripcion">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={provider.descripcion}
            onChange={handleChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            rows={3}
          />
        </div>
        
        <div className="mb-4 flex items-center">
          <input
            type="checkbox"
            id="activo"
            name="activo"
            checked={provider.activo}
            onChange={handleChange}
            className="mr-2"
          />
          <label className="text-gray-700" htmlFor="activo">
            Activo
          </label>
        </div>
        
        <div className="mb-6 flex items-center">
          <input
            type="checkbox"
            id="predeterminado"
            name="predeterminado"
            checked={provider.predeterminado}
            onChange={handleChange}
            className="mr-2"
          />
          <label className="text-gray-700" htmlFor="predeterminado">
            Predeterminado para este tipo
          </label>
        </div>
        
        {/* Sección de Credenciales */}
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h2 className="text-lg font-bold mb-4">Credenciales</h2>
          {renderCredentialFields()}
        </div>
        
        {/* Sección de Configuración */}
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <h2 className="text-lg font-bold mb-4">Configuración</h2>
          {renderConfigFields()}
        </div>
        
        {/* Botones */}
        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            Probar Conexión
          </button>
          
          <div>
            <button
              type="button"
              onClick={() => router.push('/admin/clouds')}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-2"
            >
              Cancelar
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
            >
              {loading ? 'Guardando...' : (providerId ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}