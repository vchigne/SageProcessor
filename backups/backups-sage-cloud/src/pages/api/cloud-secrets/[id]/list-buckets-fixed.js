import { pool } from '../../../../lib/db';
import { listBuckets } from '../../../../src/utils/cloud/adapters/minio_fixed';

/**
 * API para listar buckets MinIO (versión corregida)
 * 
 * Este endpoint usa la versión corregida del adaptador MinIO
 * para listar correctamente los buckets disponibles.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
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
      WHERE id = $1
    `, [secretId]);
    
    if (secretResult.rows.length === 0) {
      return res.status(404).json({ error: 'Secreto no encontrado' });
    }
    
    const secret = secretResult.rows[0];
    console.log(`[API] list-buckets-fixed: Procesando secreto ID ${secret.id} (${secret.nombre})`);
    
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
      console.log("[API] list-buckets-fixed: Endpoint encontrado en credenciales:", config.endpoint);
    }
    
    try {
      // Listar buckets usando versión corregida
      console.log('[API] list-buckets-fixed: Solicitando lista de buckets');
      const buckets = await listBuckets(credentials, config);
      
      return res.status(200).json({
        success: true,
        buckets: buckets
      });
    } catch (error) {
      console.error('[API] list-buckets-fixed: Error al listar buckets:', error);
      return res.status(500).json({
        success: false,
        error: `Error al listar buckets: ${error.message}`
      });
    }
  } catch (error) {
    console.error('[API] Error en endpoint list-buckets-fixed:', error);
    return res.status(500).json({ error: `Error interno: ${error.message}` });
  }
}