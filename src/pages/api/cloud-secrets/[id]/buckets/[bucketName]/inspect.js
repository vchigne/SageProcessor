/**
 * API para inspeccionar contenido de un bucket específico de un secreto de nube
 * 
 * Esta API utiliza la misma implementación que la API de inspección en SAGE CLOUDS
 * para garantizar consistencia en el comportamiento, especialmente para Azure.
 */
import { pool } from '@/utils/db';
import { getAdapter } from '@/utils/cloud';

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
    
    // Aquí está el cambio clave: Estructurar exactamente como en SAGE CLOUDS
    // En SAGE CLOUDS, las credenciales incluyen container_name y se pasa configuracion
    // Vamos a recrear ese mismo formato aquí
    let credentials = {};
    let config = {};
    
    console.log(`[DEBUG] secret.credentials:`, JSON.stringify(secreto.credentials).substring(0, 50) + '...');
    
    // Configurar las credenciales y la configuración según el tipo de proveedor
    if (secreto.tipo_proveedor === 'minio') {
      credentials = {
        ...secreto.credentials,
        bucket: bucketName
      };
      config = {
        endpoint: secreto.credentials.endpoint,
        port: secreto.credentials.port,
        secure: secreto.credentials.secure !== false
      };
    } else if (secreto.tipo_proveedor === 's3') {
      credentials = {
        ...secreto.credentials,
        bucket: bucketName
      };
    } else if (secreto.tipo_proveedor === 'azure') {
      // Para Azure con SAS token a través de una URL
      if (secreto.credentials.connection_string && secreto.credentials.connection_string.startsWith('https://')) {
        // Es un formato de URL con SAS token
        const url = new URL(secreto.credentials.connection_string);
        const hostname = url.hostname;
        
        // Extraer nombre de cuenta del hostname (account.blob.core.windows.net)
        const accountName = hostname.split('.')[0];
        
        // Extraer SAS token de la parte query de la URL
        const sasToken = url.search.startsWith('?') ? url.search.substring(1) : url.search;
        
        console.log(`[DEBUG] URL format - AccountName: ${accountName}, SAS token length: ${sasToken.length}`);
        
        // Crear estructura de credenciales para URL con SAS token
        credentials = {
          container_name: bucketName,
          account_name: accountName,
          sas_token: sasToken,
          blob_endpoint: `https://${accountName}.blob.core.windows.net/`
        };
        
        console.log(`[DEBUG] Azure URL-SAS credentials:`, JSON.stringify(credentials).substring(0, 50) + '...');
      } else {
        // Formato tradicional de connection string
        credentials = {
          connection_string: secreto.credentials.connection_string,
          container_name: bucketName
        };
        
        console.log(`[DEBUG] Azure connection string credentials:`, JSON.stringify(credentials).substring(0, 50) + '...');
      }
      
      // Configuración para Azure
      config = {
        use_sas: true,
        sas_expiry: "3600"
      };
      
      console.log(`[DEBUG] Azure config:`, JSON.stringify(config));
    } else if (secreto.tipo_proveedor === 'gcp') {
      credentials = {
        ...secreto.credentials,
        bucket: bucketName
      };
    }
    
    // Llamar al adaptador igual que en SAGE CLOUDS
    console.log(`[API] Llamando al adaptador ${secreto.tipo_proveedor} con container_name:`, credentials.container_name);
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