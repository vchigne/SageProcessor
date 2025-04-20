/**
 * API para inspeccionar contenido de un bucket específico de un secreto de nube
 * 
 * Esta API utiliza la misma implementación que la API de inspección en SAGE CLOUDS
 * para garantizar consistencia en el comportamiento, especialmente para Azure.
 */
import { pool } from '@/utils/db';
import { getAdapter } from '@/utils/cloud';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido'
    });
  }
  
  const { id, bucketName } = req.query;
  const { path = '' } = req.body;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({
      success: false,
      message: 'ID de secreto de nube inválido'
    });
  }
  
  if (!bucketName) {
    return res.status(400).json({
      success: false,
      message: 'Nombre de bucket requerido'
    });
  }
  
  const secretoId = parseInt(id);
  let secreto = null;
  
  try {
    // Obtener detalles del secreto
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        `SELECT id, nombre, descripcion, tipo as tipo_proveedor, secretos as credentials, activo, creado_en, modificado_en
         FROM cloud_secrets
         WHERE id = $1`,
        [secretoId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Secreto de nube no encontrado'
        });
      }
      
      secreto = result.rows[0];
      
      // Convertir credenciales de JSON string a objeto
      if (typeof secreto.credentials === 'string') {
        secreto.credentials = JSON.parse(secreto.credentials);
      }
    } finally {
      client.release();
    }
    
    // Determinar qué adaptador usar según el tipo de proveedor
    const adapter = getAdapter(secreto.tipo_proveedor);
    
    if (!adapter) {
      return res.status(400).json({
        success: false,
        message: `Tipo de proveedor no soportado: ${secreto.tipo_proveedor}`
      });
    }
    
    console.log(`[API] Inspeccionando bucket ${bucketName} para secreto tipo ${secreto.tipo_proveedor}`);
    
    // Caso especial para Azure con SAS Token
    if (secreto.tipo_proveedor === 'azure' && 
        secreto.credentials.connection_string && 
        (secreto.credentials.connection_string.includes('SharedAccessSignature=') || 
         secreto.credentials.connection_string.startsWith('http'))) {
      
      // Este bloque usa el mismo enfoque que en clouds/[id]/inspect.js para Azure con SAS
      const credentials = secreto.credentials;
      let accountName = null;
      let sasToken = null;
      let blobEndpoint = null;
      
      // Parsear la connection_string para extraer los valores necesarios
      const connectionString = credentials.connection_string.trim();
      
      // Detectar si es URL directa con SAS o connection string con formato BlobEndpoint
      if (connectionString.startsWith('http') && !connectionString.includes(';')) {
        // Es una URL directa con SAS token
        try {
          const url = new URL(connectionString);
          accountName = url.hostname.split('.')[0];
          sasToken = url.search.substring(1);
          blobEndpoint = `${url.protocol}//${url.host}`;
        } catch (error) {
          throw new Error(`Error al procesar URL de Azure: ${error.message}`);
        }
      } else {
        // Es una connection string con partes separadas por punto y coma
        const parts = connectionString.split(';');
        
        // Primera parte podría ser URL directa
        if (parts[0] && parts[0].startsWith('http')) {
          try {
            const url = new URL(parts[0]);
            blobEndpoint = parts[0];
            accountName = url.hostname.split('.')[0];
          } catch (error) {
            console.warn('[Cloud-Secrets] Error al parsear BlobEndpoint:', error);
          }
        }
        
        // Buscar en todas las partes
        for (const part of parts) {
          const normalizedPart = part.trim();
          const normalizedPartLower = normalizedPart.toLowerCase();
          
          if (normalizedPartLower.startsWith('accountname=')) {
            accountName = normalizedPart.substring(normalizedPart.indexOf('=') + 1);
          } else if (normalizedPartLower.startsWith('blobendpoint=')) {
            blobEndpoint = normalizedPart.substring(normalizedPart.indexOf('=') + 1);
            
            // Intentar extraer el nombre de cuenta del BlobEndpoint
            try {
              const url = new URL(blobEndpoint);
              const hostParts = url.hostname.split('.');
              if (hostParts[0] && !accountName) {
                accountName = hostParts[0];
              }
            } catch (err) {
              console.warn('[Cloud-Secrets] No se pudo extraer nombre de cuenta del BlobEndpoint');
            }
          } else if (normalizedPartLower.startsWith('sharedaccesssignature=')) {
            sasToken = normalizedPart.substring(normalizedPart.indexOf('=') + 1);
          }
        }
      }
      
      // Validar que tengamos lo necesario para SAS
      if (!accountName || !sasToken) {
        throw new Error('Credenciales SAS incompletas. Se requiere nombre de cuenta y SAS token.');
      }
      
      // Construir la URL para listar contenido
      const urlBase = blobEndpoint || `https://${accountName}.blob.core.windows.net/`;
      const delimiter = '/';
      const prefix = path ? `${path}${path.endsWith('/') ? '' : '/'}` : '';
      
      const url = `${urlBase}${bucketName}?restype=container&comp=list&delimiter=${delimiter}&prefix=${encodeURIComponent(prefix)}&${sasToken.startsWith('?') ? sasToken.substring(1) : sasToken}`;
      
      // Hacer solicitud directa con SAS token
      const response = await fetch(url, { method: 'GET' });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
        
        if (errorText.includes('<Code>AuthenticationFailed</Code>')) {
          errorMessage = 'Error de autenticación: El token SAS proporcionado no es válido o ha expirado.';
        } else if (errorText.includes('<Code>ContainerNotFound</Code>')) {
          errorMessage = `El contenedor '${bucketName}' no existe en la cuenta de almacenamiento.`;
        } else if (errorText.includes('<Code>ResourceNotFound</Code>')) {
          errorMessage = `El recurso no existe. Verifique que el nombre del contenedor sea correcto.`;
        }
        
        throw new Error(errorMessage);
      }
      
      // Procesar la respuesta XML
      const xmlResponse = await response.text();
      console.log('[Azure SAS] Respuesta XML recibida (primeros 150 caracteres):', 
                  xmlResponse.substring(0, 150) + '...');
      
      // Extraer archivos y carpetas del XML
      const files = [];
      const folders = [];
      
      // Función para extraer valor de una etiqueta XML
      const extractTagValue = (xml, tagName) => {
        const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's');
        const match = regex.exec(xml);
        return match ? match[1] : '';
      };
      
      // Extraer blobs (archivos)
      const blobRegex = /<Blob>([\s\S]*?)<\/Blob>/g;
      let blobMatch;
      while ((blobMatch = blobRegex.exec(xmlResponse)) !== null) {
        const blobContent = blobMatch[1];
        const name = extractTagValue(blobContent, 'Name');
        
        // Ignorar si es un prefijo de carpeta
        if (name.endsWith('/')) continue;
        
        // Ignorar si no pertenece al path actual (está en una subcarpeta)
        const relativePath = name.startsWith(prefix) ? name.substring(prefix.length) : name;
        if (relativePath.includes('/')) continue;
        
        files.push({
          name: relativePath,
          path: name,
          size: parseInt(extractTagValue(blobContent, 'Properties/Content-Length') || 0, 10),
          lastModified: extractTagValue(blobContent, 'Properties/Last-Modified'),
          type: 'file'
        });
      }
      
      // Extraer prefijos (carpetas)
      const prefixesRegex = /<BlobPrefix>([\s\S]*?)<\/BlobPrefix>/g;
      let prefixMatch;
      while ((prefixMatch = prefixesRegex.exec(xmlResponse)) !== null) {
        const prefixContent = prefixMatch[1];
        const prefixPath = extractTagValue(prefixContent, 'Name');
        
        // Extraer solo el nombre de la carpeta
        const folderName = prefixPath.startsWith(prefix) 
          ? prefixPath.substring(prefix.length) 
          : prefixPath;
        
        const folderNameNoSlash = folderName.endsWith('/') 
          ? folderName.substring(0, folderName.length - 1) 
          : folderName;
        
        folders.push({
          name: folderNameNoSlash,
          path: prefixPath,
          type: 'folder'
        });
      }
      
      // Construir y devolver el resultado
      return res.status(200).json({
        bucket: bucketName,
        path: path || '/',
        files,
        folders,
        service: 'azure',
        authMethod: 'SAS',
        details: {
          secreto_id: secretoId,
          secreto_nombre: secreto.nombre,
          tipo_proveedor: secreto.tipo_proveedor,
          bucket_name: bucketName
        }
      });
    }
    
    // Para todos los demás casos, usar el adaptador normal
    let credentials = { ...secreto.credentials };
    let config = {};
    
    // Configurar credenciales y configuración según el tipo de proveedor
    if (secreto.tipo_proveedor === 'minio') {
      config = {
        endpoint: secreto.credentials.endpoint,
        port: secreto.credentials.port,
        secure: secreto.credentials.secure !== false
      };
      credentials.bucket = bucketName;
    } else if (secreto.tipo_proveedor === 's3') {
      credentials.bucket = bucketName;
    } else if (secreto.tipo_proveedor === 'azure') {
      // Para Azure, usar container_name en lugar de container para mantener compatibilidad con el adaptador
      credentials.container_name = bucketName;
    } else if (secreto.tipo_proveedor === 'gcp') {
      credentials.bucket = bucketName;
    }
    
    // Ejecutar la función de listado de contenido con las credenciales configuradas
    const contents = await adapter.listContents(credentials, config, path);
    
    // Incluir información adicional en la respuesta
    return res.status(200).json({
      ...contents,
      details: {
        secreto_id: secretoId,
        secreto_nombre: secreto.nombre,
        tipo_proveedor: secreto.tipo_proveedor,
        bucket_name: bucketName
      }
    });
  } catch (error) {
    console.error(`[API] Error al inspeccionar bucket ${bucketName} para secreto ID ${secretoId}:`, error);
    
    // Incluir detalles del error y mantener el formato consistente con exploradores funcionales
    return res.status(200).json({
      error: true,
      errorMessage: error.message,
      bucket: bucketName,
      path: path || '/',
      files: [],
      folders: [],
      details: {
        secreto_id: secretoId,
        secreto_nombre: secreto ? secreto.nombre : 'Desconocido',
        tipo_proveedor: secreto ? secreto.tipo_proveedor : 'Desconocido',
        bucket_name: bucketName
      }
    });
  }
}