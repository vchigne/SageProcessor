/**
 * API para inspeccionar un bucket específico usando un secreto de nube
 * 
 * GET/POST: Obtiene información detallada sobre un bucket específico y sus contenidos
 * 
 * Nota: Se soporta POST para mantener compatibilidad con el componente de SAGE Clouds
 */

import { pool } from '../../../../../../utils/db';
import { getCloudAdapter } from '../../../../../../utils/cloud';

export default async function handler(req, res) {
  try {
    const { id, bucketName } = req.query;
    
    // Validar que el ID sea un número válido
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        error: true,
        message: 'ID de secreto no válido' 
      });
    }
    
    // Validar que se proporcione un nombre de bucket
    if (!bucketName) {
      return res.status(400).json({ 
        error: true,
        message: 'Nombre de bucket no proporcionado' 
      });
    }
    
    // Aceptamos solicitudes GET y POST para compatibilidad con el componente de SAGE Clouds
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ 
        error: true,
        message: 'Método no permitido' 
      });
    }
    
    // Obtener información del bucket
    return await inspectBucket(req, res, parseInt(id), bucketName);
  } catch (error) {
    console.error('Error en API de inspección de bucket:', error);
    return res.status(500).json({ 
      error: true,
      message: `Error interno del servidor: ${error.message}` 
    });
  }
}

/**
 * Inspecciona un bucket específico y lista su contenido
 * 
 * Formato de respuesta compatible con SAGE Clouds:
 * - Éxito: Objeto con propiedades bucket, path, files, folders/directories
 * - Error: Objeto con propiedades error: true, errorMessage
 */
async function inspectBucket(req, res, id, bucketName) {
  // Obtener el path del cuerpo de POST o de la query según el método
  const path = req.method === 'POST' && req.body.path !== undefined 
    ? req.body.path 
    : (req.query.path || '');
    
  const limit = req.query.limit || '50';
  const maxItems = parseInt(limit) || 50;
  
  try {
    const client = await pool.connect();
    
    try {
      // Obtener el secreto por ID
      const secretResult = await client.query(
        `SELECT id, nombre, tipo, secretos
         FROM cloud_secrets
         WHERE id = $1`,
        [id]
      );
      
      if (secretResult.rows.length === 0) {
        return res.status(404).json({ 
          error: true,
          errorMessage: 'Secreto no encontrado' 
        });
      }
      
      const secret = secretResult.rows[0];
      
      // Parsear credenciales si es necesario
      let credenciales = typeof secret.secretos === 'string' 
        ? JSON.parse(secret.secretos) 
        : secret.secretos;
        
      // Para GCP, necesitamos asegurarnos de que el key_file esté parseado correctamente
      if (secret.tipo === 'gcp' && credenciales.key_file && typeof credenciales.key_file === 'string') {
        try {
          console.log('[Inspect API] Intentando parsear key_file de GCP');
          credenciales.key_file = JSON.parse(credenciales.key_file);
          console.log('[Inspect API] key_file parseado correctamente');
        } catch (error) {
          console.error('[Inspect API] Error al parsear key_file:', error);
          // Continuamos aunque haya error, el adaptador intentará manejarlo
        }
      }
      
      console.log('[Inspect API] Credenciales preparadas:', {
        tipo: secret.tipo,
        credenciales_type: typeof credenciales,
        key_file_type: credenciales.key_file ? typeof credenciales.key_file : 'undefined',
        bucket: bucketName,
        path: path
      });
      
      // -------------------- PREPARAR CREDENCIALES ESPECÍFICAS DE CADA PROVEEDOR --------------------
      
      // Enriquecimiento de credenciales según el tipo de proveedor
      if (secret.tipo === 's3') {
        // Asegurar que S3 tenga el bucket correcto
        credenciales.bucket = bucketName;
      } else if (secret.tipo === 'minio') {
        // MinIO requiere bucket y access/secret keys
        credenciales.bucket = bucketName;
        
        // Si no tiene access_key o secret_key, buscarlos en lugares alternativos
        if (!credenciales.access_key && credenciales.accessKey) {
          credenciales.access_key = credenciales.accessKey;
        }
        if (!credenciales.secret_key && credenciales.secretKey) {
          credenciales.secret_key = credenciales.secretKey;
        }
      } else if (secret.tipo === 'azure') {
        // Azure requiere cuenta de almacenamiento y clave
        credenciales.containerName = bucketName;
        credenciales.container_name = bucketName;
        credenciales.bucket = bucketName;
        
        // Configuración específica para Azure
        const configAzure = {
          containerName: bucketName,
          container_name: bucketName,
          bucket: bucketName
        };
        
        console.log(`[Inspect API] Azure adaptador - bucket preparado como: ${bucketName}`);
      } else if (secret.tipo === 'sftp') {
        // SFTP necesita bucket (directorio remoto)
        credenciales.remoteDir = bucketName;
      }
      
      // Normalizar las credenciales según el tipo de proveedor
      let normalizedCredentials = { ...credenciales };
      
      // Asegurarnos de que todas las credenciales tengan formato uniforme
      if (secret.tipo === 's3' || secret.tipo === 'minio') {
        normalizedCredentials = {
          ...normalizedCredentials,
          access_key: normalizedCredentials.access_key || normalizedCredentials.accessKey,
          secret_key: normalizedCredentials.secret_key || normalizedCredentials.secretKey,
          bucket: bucketName,
          bucket_name: bucketName
        };
      } else if (secret.tipo === 'azure') {
        normalizedCredentials = {
          ...normalizedCredentials,
          containerName: bucketName,
          container_name: bucketName,
          bucket: bucketName
        };
      } else if (secret.tipo === 'gcp') {
        normalizedCredentials = {
          ...normalizedCredentials,
          bucket: bucketName,
          bucket_name: bucketName
        };
      } else if (secret.tipo === 'sftp') {
        normalizedCredentials = {
          ...normalizedCredentials,
          remoteDir: bucketName, 
          bucket: bucketName
        };
      }
      
      // Configuración por defecto del proveedor temporal
      const tempProvider = {
        id: 0,
        nombre: `Test de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: normalizedCredentials,
        configuracion: {
          bucket: bucketName // Asegurarnos de que el adaptador sepa qué bucket consultar
        }
      };
      
      // Obtener adaptador e inspeccionar bucket
      try {
        const adapter = await getCloudAdapter(secret.tipo);
        
        if (!adapter) {
          return res.status(200).json({ 
            error: true,
            errorMessage: `Tipo de proveedor no soportado: ${secret.tipo}`,
            bucket: bucketName,
            path: path || '/',
            folders: [],
            files: []
          });
        }
        
        // Listamos el contenido del bucket
        if (!adapter.listContents) {
          return res.status(200).json({ 
            error: true,
            errorMessage: `El proveedor ${secret.tipo} no implementa el método listContents`,
            bucket: bucketName,
            path: path || '/',
            folders: [],
            files: []
          });
        }
        
        // -------------------- LLAMAR AL ADAPTADOR CON PARÁMETROS ESPECÍFICOS --------------------
        
        // Obtener contenido del bucket
        console.log(`[Inspect API] Listando contenido del bucket ${bucketName} en ruta ${path || '/'} con proveedor ${secret.tipo}`);
        const result = await adapter.listContents(
          tempProvider.credenciales, 
          tempProvider.configuracion,
          path,
          maxItems
        );
        
        // Actualizar fecha de última modificación
        await client.query(
          `UPDATE cloud_secrets 
           SET modificado_en = NOW()
           WHERE id = $1`,
          [id]
        );
        
        // -------------------- NORMALIZAR RESPUESTA A FORMATO SAGE CLOUDS --------------------
        
        // IMPORTANTE: Formato de respuesta EXACTAMENTE igual que en SAGE Clouds
        let folders = [];
        let files = [];
        
        // Logs de diagnóstico para ayudar a resolver problemas
        console.log('[Inspect API] Respuesta del adaptador:', JSON.stringify(result).substring(0, 200) + '...');
        
        // Normalizar formato según el tipo de proveedor para tener EXACTAMENTE el mismo formato
        if (secret.tipo === 'gcp') {
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
          
        } else if (secret.tipo === 's3') {
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
          
        } else if (secret.tipo === 'minio') {
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
          
        } else if (secret.tipo === 'azure') {
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
          
        } else if (secret.tipo === 'sftp') {
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
        
        // Verificar si el adaptador ya devolvió el formato exacto de SAGE Clouds
        if (result && 
            result.bucket && 
            result.path !== undefined && 
            (result.folders !== undefined || result.directories !== undefined) && 
            result.files !== undefined) {
          // El adaptador ya devolvió el formato SAGE Clouds, lo usamos directamente
          return res.status(200).json(result);
        }
        
        // Si no, construimos una respuesta con formato SAGE Clouds exacto
        return res.status(200).json({
          bucket: bucketName,
          path: path || '/',
          parentPath: getParentPath(path),
          service: secret.tipo,
          folders: folders || [],
          files: files || [],
          // Incluir propiedades adicionales que podrían ser usadas por el componente
          directories: folders || [],
          region: result.region || "",
          error: false
        });
      } catch (error) {
        console.error('Error al inspeccionar bucket:', error);
        return res.status(200).json({
          error: true,
          errorMessage: `Error al inspeccionar bucket: ${error.message}`,
          bucket: bucketName,
          path: path || '/',
          folders: [],
          files: [],
          directories: [] // Asegurar formato consistente para compatibilidad
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en inspectBucket:', error);
    return res.status(200).json({ 
      error: true,
      errorMessage: `Error al inspeccionar bucket: ${error.message}`,
      bucket: bucketName,
      path: path || '/',
      folders: [],
      files: [],
      directories: [] // Asegurar formato consistente para compatibilidad
    });
  }
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