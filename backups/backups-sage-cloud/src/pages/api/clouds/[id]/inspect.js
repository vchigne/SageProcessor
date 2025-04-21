/**
 * Endpoint para inspeccionar el contenido de un proveedor de nube
 * 
 * Este endpoint permite listar archivos y carpetas de un proveedor de nube
 * con un nivel de detalle mayor que el listado básico, incluyendo mejor
 * organización y metadatos.
 * 
 * NOTA: Esta implementación se ha adaptado para usar la misma lógica que el endpoint
 * de cloud-secrets, que funciona correctamente con todos los proveedores.
 */

import { getCloudProvider, getCloudAdapter } from '../../../../utils/cloud';

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    // Validar que tenemos un ID válido
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de proveedor inválido' });
    }
    
    // Obtener datos del body
    const { path = '' } = req.body;
    const limit = req.query.limit || '50';
    const maxItems = parseInt(limit) || 50;
    
    // Obtener el proveedor
    const provider = await getCloudProvider(parseInt(id));
    
    if (!provider) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    
    // Obtener el bucket/container del proveedor
    const bucketName = getBucketNameFromProvider(provider);
    if (!bucketName) {
      return res.status(400).json({ 
        error: true,
        errorMessage: 'No se pudo determinar el bucket/container del proveedor',
        bucket: '',
        path: path || '/',
        folders: [],
        files: []
      });
    }
    
    // Cargar el adaptador específico para este tipo de proveedor
    const adapter = await getCloudAdapter(provider.tipo);
    
    if (!adapter || !adapter.listContents) {
      return res.status(200).json({ 
        error: true,
        errorMessage: `El adaptador para ${provider.tipo} no soporta la función de inspección`,
        bucket: bucketName,
        path: path || '/',
        folders: [],
        files: []
      });
    }
    
    // ---------------------- PREPARAR CREDENCIALES NORMALIZADAS ----------------------
    
    // Copiar credenciales para no modificar las originales
    let normalizedCredentials = { ...provider.credenciales };
    
    // Asegurar formato de credenciales según tipo de proveedor
    if (provider.tipo === 's3' || provider.tipo === 'minio') {
      // S3 y MinIO necesitan bucket específico
      normalizedCredentials = {
        ...normalizedCredentials,
        bucket: bucketName,
        bucket_name: bucketName,
        // Asegurar keys en formato correcto
        access_key: normalizedCredentials.access_key || normalizedCredentials.accessKey,
        secret_key: normalizedCredentials.secret_key || normalizedCredentials.secretKey
      };
    } else if (provider.tipo === 'azure') {
      // Azure necesita containerName
      normalizedCredentials = {
        ...normalizedCredentials,
        containerName: bucketName,
        container_name: bucketName,
        bucket: bucketName
      };
    } else if (provider.tipo === 'gcp') {
      // GCP necesita bucket_name
      normalizedCredentials = {
        ...normalizedCredentials,
        bucket: bucketName,
        bucket_name: bucketName
      };
      
      // Asegurar que key_file sea un objeto si es string
      if (normalizedCredentials.key_file && typeof normalizedCredentials.key_file === 'string') {
        try {
          console.log('[S3] Intentando parsear key_file de GCP');
          normalizedCredentials.key_file = JSON.parse(normalizedCredentials.key_file);
        } catch (error) {
          console.error('[S3] Error al parsear key_file GCP:', error);
          // Continuamos aunque haya error, el adaptador intentará manejarlo
        }
      }
    } else if (provider.tipo === 'sftp') {
      // SFTP necesita remoteDir para el directorio
      normalizedCredentials = {
        ...normalizedCredentials,
        remoteDir: bucketName,
        bucket: bucketName
      };
    }
    
    // Configuración normalizada para el proveedor
    const normalizedConfig = {
      ...provider.configuracion,
      bucket: bucketName
    };
    
    // ---------------------- EJECUTAR LISTADO DE CONTENIDO ----------------------
    
    // Ejecutar la función de listado de contenido con credenciales normalizadas
    console.log(`[${provider.tipo}] Listando contenido con credenciales:`, 
      JSON.stringify({...normalizedCredentials, secret_key: '***'}).substring(0, 500));
      
    const result = await adapter.listContents(
      normalizedCredentials,
      normalizedConfig,
      path,
      maxItems
    );
    
    // ---------------------- NORMALIZAR RESPUESTA ----------------------
    
    // Normalizamos la respuesta para tener el mismo formato que en cloud-secrets
    let folders = [];
    let files = [];
    
    // Normalizar formato según el tipo de proveedor
    if (provider.tipo === 'gcp') {
      // GCP puede usar 'folders' o 'directories'
      folders = result.folders || result.directories || [];
      files = result.files || [];
      
      // Normalizar formato de carpetas para GCP
      folders = folders.map(folder => {
        if (typeof folder === 'string') {
          return { name: folder, path: folder, type: 'folder' };
        }
        return { ...folder, type: 'folder' };
      });
      
    } else if (provider.tipo === 's3') {
      // S3 usa 'CommonPrefixes' para carpetas y 'Contents' para archivos
      const commonPrefixes = result.CommonPrefixes || [];
      const contents = result.Contents || [];
      
      // Normalizar carpetas de S3
      folders = commonPrefixes.map(prefix => {
        if (typeof prefix === 'string') {
          return { name: prefix, path: prefix, type: 'folder' };
        } else if (prefix.Prefix) {
          const prefixPath = prefix.Prefix;
          const name = prefixPath.split('/').filter(Boolean).pop() || prefixPath;
          return { name, path: prefixPath, type: 'folder' };
        }
        return { ...prefix, type: 'folder' };
      });
      
      // Normalizar archivos de S3
      files = contents.map(file => {
        if (file.Key) {
          // Excluir archivos que son parte de carpetas (terminan en /)
          if (file.Key.endsWith('/')) {
            return null;
          }
          
          const key = file.Key;
          const name = key.split('/').pop();
          return { 
            name, 
            path: key,
            size: file.Size || 0,
            lastModified: file.LastModified || new Date().toISOString(),
            type: 'file'
          };
        }
        return { ...file, type: 'file' };
      }).filter(Boolean); // Eliminar nulos
      
    } else if (provider.tipo === 'minio') {
      // MinIO es similar a S3, o puede usar formato propio
      // Primero intentamos formato MinIO propio
      folders = result.folders || result.directories || [];
      files = result.files || [];
      
      // Si no hay carpetas o archivos, intentamos formato S3
      if ((!folders || folders.length === 0) && result.CommonPrefixes) {
        folders = result.CommonPrefixes;
      }
      
      if ((!files || files.length === 0) && result.Contents) {
        files = result.Contents;
      }
      
      // Normalizar carpetas de MinIO
      folders = folders.map(folder => {
        if (typeof folder === 'string') {
          return { name: folder, path: folder, type: 'folder' };
        } else if (folder.Prefix) {
          const prefix = folder.Prefix;
          const name = prefix.split('/').filter(Boolean).pop() || prefix;
          return { name, path: prefix, type: 'folder' };
        }
        return { ...folder, type: 'folder' };
      });
      
      // Normalizar archivos de MinIO
      files = files.map(file => {
        if (file.Key) {
          // Excluir archivos que son parte de carpetas
          if (file.Key.endsWith('/')) {
            return null;
          }
          
          const key = file.Key;
          const name = key.split('/').pop();
          return { 
            name, 
            path: key,
            size: file.Size || 0,
            lastModified: file.LastModified || new Date().toISOString(),
            type: 'file'
          };
        } else if (file.name) {
          return {
            ...file,
            type: 'file'
          };
        }
        return { ...file, type: 'file' };
      }).filter(Boolean); // Eliminar nulos
      
    } else if (provider.tipo === 'azure') {
      // Azure usa 'directories' y 'blobs'
      folders = result.directories || result.folders || [];
      files = result.files || result.blobs || [];
      
      // Normalizar carpetas Azure
      folders = folders.map(folder => {
        if (typeof folder === 'string') {
          return { name: folder, path: folder, type: 'folder' };
        }
        return { ...folder, type: 'folder' };
      });
      
      // Normalizar archivos Azure
      files = files.map(file => {
        if (file.name) {
          const name = file.name.split('/').pop();
          return {
            name,
            path: file.name,
            size: file.properties?.contentLength || 0,
            lastModified: file.properties?.lastModified || new Date().toISOString(),
            type: 'file'
          };
        }
        return { ...file, type: 'file' };
      });
      
    } else if (provider.tipo === 'sftp') {
      // SFTP usa 'directories' y 'files'
      folders = result.directories || result.folders || [];
      files = result.files || [];
      
      // Normalizar carpetas SFTP
      folders = folders.map(folder => {
        if (typeof folder === 'string') {
          return { name: folder, path: folder, type: 'folder' };
        }
        return { ...folder, type: 'folder' };
      });
      
      // Normalizar archivos SFTP
      files = files.map(file => {
        if (typeof file === 'string') {
          return { name: file, path: file, type: 'file' };
        }
        return { ...file, type: 'file' };
      });
    }
    
    // Verificar si el adaptador ya devolvió el formato exacto requerido
    if (result && 
        result.bucket && 
        result.path !== undefined && 
        (result.folders !== undefined || result.directories !== undefined) && 
        result.files !== undefined) {
      // El adaptador ya devolvió el formato correcto, lo usamos directamente
      console.log(`[${provider.tipo}] Path: "${path}", calculando parentPath: "${getParentPath(path)}"`);
      return res.status(200).json(result);
    }
    
    // Si no, construimos una respuesta con el formato correcto
    console.log(`[${provider.tipo}] Path: "${path}", calculando parentPath: "${getParentPath(path)}"`);
    return res.status(200).json({
      bucket: bucketName,
      path: path || '/',
      parentPath: getParentPath(path),
      service: provider.tipo,
      folders: folders || [],
      files: files || [],
      // Incluir propiedades adicionales que son usadas por el componente
      directories: folders || [],
      region: result.region || "",
      error: false
    });
    
  } catch (error) {
    console.error('Error al inspeccionar proveedor:', error);
    return res.status(200).json({ 
      error: true,
      errorMessage: `Error al inspeccionar proveedor: ${error.message}`,
      bucket: '',
      path: req.body.path || '/',
      folders: [],
      files: [],
      directories: [] // Asegurar formato consistente para compatibilidad
    });
  }
}

/**
 * Obtiene el nombre del bucket/container del proveedor
 */
function getBucketNameFromProvider(provider) {
  if (!provider) return null;
  
  // Buscar el bucket en credenciales o configuración
  if (provider.credenciales) {
    const creds = typeof provider.credenciales === 'string' 
      ? JSON.parse(provider.credenciales) 
      : provider.credenciales;
      
    if (creds.bucket) return creds.bucket;
    if (creds.bucket_name) return creds.bucket_name;
    if (creds.containerName) return creds.containerName;
    if (creds.container_name) return creds.container_name;
    if (creds.remoteDir) return creds.remoteDir;
  }
  
  if (provider.configuracion) {
    const config = typeof provider.configuracion === 'string' 
      ? JSON.parse(provider.configuracion) 
      : provider.configuracion;
      
    if (config.bucket) return config.bucket;
    if (config.container_name) return config.container_name;
    if (config.containerName) return config.containerName;
    if (config.bucket_name) return config.bucket_name;
  }
  
  return null;
}

/**
 * Obtiene la ruta del directorio padre
 */
function getParentPath(path) {
  if (!path || path === '' || path === '/') {
    return '';
  }
  
  // Eliminar la última barra si existe
  const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
  
  // Encontrar la última barra
  const lastSlashIndex = cleanPath.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return ''; // Si no hay barras o está en la primera posición, volver a la raíz
  }
  
  // Devolver la ruta hasta la última barra
  return cleanPath.substring(0, lastSlashIndex);
}