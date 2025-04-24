/**
 * API para listar buckets disponibles de un secreto cloud
 * 
 * GET: Lista los buckets disponibles para un secreto específico
 * Reutiliza la misma lógica que ya existe en /api/cloud-secrets/[id]/buckets
 */

import { pool } from '../../../utils/db';
import { getCloudAdapter } from '../../../utils/cloud';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Obtener secreto_id de los parámetros de consulta
  const { secreto_id } = req.query;

  // Validar que id sea un número válido
  if (!secreto_id || isNaN(parseInt(secreto_id))) {
    return res.status(400).json({ error: 'ID de secreto no válido' });
  }

  try {
    const client = await pool.connect();
    
    try {
      // Obtener el secreto por ID
      const secretResult = await client.query(
        `SELECT id, nombre, tipo, secretos
         FROM cloud_secrets
         WHERE id = $1`,
        [secreto_id]
      );
      
      if (secretResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Secreto no encontrado' 
        });
      }
      
      const secret = secretResult.rows[0];
      
      // Crear un proveedor temporal para listar buckets
      // Parsear credenciales si es necesario
      let credenciales = typeof secret.secretos === 'string' 
        ? JSON.parse(secret.secretos) 
        : secret.secretos;
        
      // Para GCP, necesitamos asegurarnos de que el key_file esté parseado correctamente
      if (secret.tipo === 'gcp' && credenciales.key_file && typeof credenciales.key_file === 'string') {
        try {
          console.log('[Buckets API] Intentando parsear key_file de GCP');
          credenciales.key_file = JSON.parse(credenciales.key_file);
          console.log('[Buckets API] key_file parseado correctamente');
        } catch (error) {
          console.error('[Buckets API] Error al parsear key_file:', error);
          // Continuamos aunque haya error, el adaptador intentará manejarlo
        }
      }
      
      // Cargar el adaptador para el tipo de proveedor
      const adapter = await getCloudAdapter(secret.tipo);
      
      if (!adapter || !adapter.listBuckets) {
        return res.status(400).json({
          success: false,
          message: `El proveedor ${secret.tipo} no soporta la función de listar buckets`
        });
      }
      
      // Ejecutar la función para listar buckets
      console.log(`[Buckets API] Listando buckets para secreto ${secreto_id} (${secret.tipo})`);
      const result = await adapter.listBuckets(credenciales, {});
      
      // Agregar información del tipo de proveedor a la respuesta
      return res.status(200).json({
        success: true,
        tipo_proveedor: secret.tipo,
        nombre_secreto: secret.nombre,
        buckets: result
      });
    } finally {
      // Siempre liberamos el cliente
      client.release();
    }
  } catch (error) {
    console.error('Error en API de buckets de secreto:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error interno del servidor: ${error.message}` 
    });
  }
}