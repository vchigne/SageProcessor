/**
 * API para inspeccionar contenido de un bucket específico de un secreto de nube
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
  
  try {
    // Obtener detalles del secreto
    const client = await pool.connect();
    let secreto = null;
    
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
    
    // Configurar opciones adicionales según el tipo de proveedor
    let config = {};
    if (secreto.tipo_proveedor === 'minio') {
      config = {
        endpoint: secreto.credentials.endpoint,
        port: secreto.credentials.port,
        secure: secreto.credentials.secure !== false
      };
    }
    
    // Para S3, Azure, GCP: asegurarnos que el bucketName esté en las credenciales
    const credentials = { ...secreto.credentials };
    
    // Configurar el bucket en las credenciales para inspección
    if (secreto.tipo_proveedor === 's3' || secreto.tipo_proveedor === 'minio') {
      credentials.bucket = bucketName;
    } else if (secreto.tipo_proveedor === 'azure') {
      credentials.container = bucketName;
    } else if (secreto.tipo_proveedor === 'gcp') {
      credentials.bucket = bucketName;
    }
    
    // Listar contenido del bucket
    const contents = await adapter.listContents(credentials, config, path);
    
    // Incluir información adicional
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
    return res.status(500).json({
      success: false,
      message: `Error al inspeccionar bucket: ${error.message}`
    });
  }
}