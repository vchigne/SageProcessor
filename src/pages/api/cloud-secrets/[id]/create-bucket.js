import { pool } from '../../../../lib/db';
import { createBucket } from '../../../../src/utils/cloud/adapters/minio';

/**
 * API para crear el bucket "rawmondelezperustrategiotradicional" en MinIO
 * 
 * Este endpoint es específico para solucionar un problema con la creación
 * de buckets en el proveedor MinIO.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id: secretId } = req.query;
  
  if (!secretId) {
    return res.status(400).json({ error: 'Se requiere ID del secreto' });
  }

  try {
    // Obtener el secreto de MinIO
    const secretResult = await pool.query(`
      SELECT id, nombre, tipo, secretos
      FROM cloud_secrets
      WHERE id = $1 AND tipo = 'minio'
    `, [secretId]);
    
    if (secretResult.rows.length === 0) {
      return res.status(404).json({ error: 'Secreto MinIO no encontrado' });
    }
    
    const secret = secretResult.rows[0];
    
    // Parsear credenciales
    const credentials = typeof secret.secretos === 'string'
      ? JSON.parse(secret.secretos)
      : secret.secretos;
      
    // Verificar que sea MinIO
    if (secret.tipo !== 'minio') {
      return res.status(400).json({ error: 'Este endpoint solo funciona con secretos de tipo MinIO' });
    }
    
    // Configuración de MinIO
    const config = {};
    
    // Verificar si el endpoint está en credenciales en lugar de config
    if (credentials.endpoint) {
      // Mover el endpoint a la configuración
      config.endpoint = credentials.endpoint;
      console.log("[API] create-bucket: Endpoint encontrado en credenciales:", config.endpoint);
    }
    
    // Nombre fijo del bucket a crear
    const bucketName = "rawmondelezperustrategiotradicional";
    
    // Intentar crear el bucket con MinIO adapter
    try {
      console.log(`[API] create-bucket: Intentando crear bucket "${bucketName}" en MinIO`);
      
      // Llamar directamente al adaptador de MinIO
      const result = await createBucket(credentials, config, bucketName);
      
      return res.status(200).json({
        success: true,
        message: `Bucket "${bucketName}" creado exitosamente`,
        bucket: {
          name: bucketName,
          details: result
        }
      });
    } catch (error) {
      console.error('[API] create-bucket: Error al crear bucket:', error);
      return res.status(500).json({
        success: false,
        message: `Error al crear bucket: ${error.message}`
      });
    }
  } catch (error) {
    console.error('[API] Error en endpoint create-bucket:', error);
    return res.status(500).json({ error: `Error interno: ${error.message}` });
  }
}