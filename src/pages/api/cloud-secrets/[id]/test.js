/**
 * API para probar la conexión a un proveedor usando un secreto existente
 * 
 * POST: Prueba la conexión con el secreto especificado por ID
 */

import { Pool } from 'pg';
import { getCloudAdapter } from '@/utils/cloud';

// Obtener conexión a la base de datos desde las variables de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  const { id } = req.query;
  
  // Validar que el ID es un número
  const secretId = parseInt(id);
  if (isNaN(secretId)) {
    return res.status(400).json({ 
      success: false,
      message: 'ID de secreto inválido' 
    });
  }
  
  try {
    // Obtener el secreto de la base de datos
    const result = await pool.query(`
      SELECT id, nombre, tipo, secretos
      FROM cloud_secrets
      WHERE id = $1 AND activo = true
    `, [secretId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Secreto no encontrado o inactivo' 
      });
    }
    
    const secreto = result.rows[0];
    
    // Parsear los secretos si es necesario
    const credentials = typeof secreto.secretos === 'string'
      ? JSON.parse(secreto.secretos)
      : secreto.secretos;
    
    // Fusionar las credenciales con los nuevos valores si se proporcionan
    const mergedCredentials = {
      ...credentials,
      ...req.body
    };
    
    // Cargar el adaptador adecuado para el proveedor
    const adapter = await getCloudAdapter(secreto.tipo);
    
    if (!adapter) {
      return res.status(400).json({ 
        success: false,
        message: `No se encontró adaptador para el tipo ${secreto.tipo}`
      });
    }
    
    // Verificar que el adaptador tenga la función testConnection
    if (!adapter.testConnection) {
      return res.status(400).json({ 
        success: false,
        message: `El adaptador para ${secreto.tipo} no soporta pruebas de conexión`
      });
    }
    
    // Configuración básica para la conexión
    const config = {};
    
    // Configuración específica para cada tipo de proveedor
    if (secreto.tipo === 'minio') {
      // Para MinIO necesitamos pasar el endpoint a la configuración
      if (mergedCredentials.endpoint) {
        config.endpoint = mergedCredentials.endpoint;
        
        // Si el endpoint no tiene protocolo, usar http por defecto
        if (!config.endpoint.startsWith('http')) {
          const useSSL = mergedCredentials.secure !== false;
          config.endpoint = (useSSL ? 'https://' : 'http://') + config.endpoint;
        }
      }
    } else if (secreto.tipo === 's3') {
      // Para S3 podemos necesitar la región
      if (mergedCredentials.region) {
        config.region = mergedCredentials.region;
      }
    }
    
    // Probar la conexión
    const testResult = await adapter.testConnection(mergedCredentials, config);
    
    return res.status(200).json(testResult);
  } catch (error) {
    console.error(`Error testing connection for secret ${id}:`, error);
    return res.status(500).json({ 
      success: false,
      message: `Error de servidor: ${error.message}`
    });
  }
}