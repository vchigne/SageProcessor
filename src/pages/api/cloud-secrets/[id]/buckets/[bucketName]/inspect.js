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
    
    // Crear un objeto de credenciales con la información necesaria
    let credentials = { ...secreto.credentials };
    let config = {};
    
    // Configurar credenciales según el tipo de proveedor
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
      // Para Azure, configurar correctamente para que funcione con el adaptador
      if (credentials.connection_string) {
        // Preservar el bucket/container en las credenciales
        credentials.container = bucketName;
        credentials.container_name = bucketName;
      } else {
        credentials.container = bucketName;
        credentials.container_name = bucketName;
      }
    } else if (secreto.tipo_proveedor === 'gcp') {
      credentials.bucket = bucketName;
    }
    
    // Aquí es donde debemos asegurarnos de que estamos usando el mismo formato 
    // que se usa en la API de SAGE CLOUDS
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