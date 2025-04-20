/**
 * API para gestionar buckets asociados a un cloud-secret específico
 * 
 * GET: Listar buckets disponibles
 * POST: Crear un nuevo bucket
 */
import { pool } from '../../../../../utils/db';
import { getAdapter } from '../../../../../utils/cloud';

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({
      success: false,
      message: 'ID de secreto de nube inválido'
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
    
    // Extraer credenciales del secreto
    const credentials = secreto.credentials;
    
    // Configurar opciones adicionales según el tipo de proveedor
    let config = {};
    if (secreto.tipo_proveedor === 'minio') {
      config = {
        endpoint: credentials.endpoint,
        port: credentials.port,
        secure: credentials.secure !== false
      };
    }
    
    // Manejar diferentes métodos HTTP
    if (req.method === 'GET') {
      try {
        console.log(`[API] Listando buckets para secreto ID ${secretoId} (${secreto.tipo_proveedor})`);
        
        // Obtener lista de buckets
        const buckets = await adapter.listBuckets(credentials, config);
        
        return res.status(200).json({
          success: true,
          data: buckets,
          details: {
            secreto_id: secretoId,
            secreto_nombre: secreto.nombre,
            tipo_proveedor: secreto.tipo_proveedor
          }
        });
      } catch (error) {
        console.error(`[API] Error al listar buckets para secreto ID ${secretoId}:`, error);
        return res.status(500).json({
          success: false,
          message: `Error al listar buckets: ${error.message}`
        });
      }
    } else if (req.method === 'POST') {
      try {
        const { bucketName } = req.body;
        
        if (!bucketName) {
          return res.status(400).json({
            success: false,
            message: 'El nombre del bucket es requerido'
          });
        }
        
        console.log(`[API] Creando bucket "${bucketName}" para secreto ID ${secretoId} (${secreto.tipo_proveedor})`);
        
        // Crear el bucket
        const result = await adapter.createBucket(credentials, config, bucketName);
        
        if (!result.success) {
          return res.status(400).json(result);
        }
        
        return res.status(201).json({
          success: true,
          message: `Bucket "${bucketName}" creado con éxito`,
          details: {
            bucketName,
            secreto_id: secretoId,
            secreto_nombre: secreto.nombre,
            tipo_proveedor: secreto.tipo_proveedor
          }
        });
      } catch (error) {
        console.error(`[API] Error al crear bucket para secreto ID ${secretoId}:`, error);
        return res.status(500).json({
          success: false,
          message: `Error al crear bucket: ${error.message}`
        });
      }
    } else {
      return res.status(405).json({
        success: false,
        message: 'Método no permitido'
      });
    }
  } catch (error) {
    console.error(`[API] Error en endpoint de buckets para secreto ID ${id}:`, error);
    return res.status(500).json({
      success: false,
      message: `Error inesperado: ${error.message}`
    });
  }
}