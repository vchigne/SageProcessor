/**
 * API para probar la conexión usando un secreto de nube
 * 
 * Este endpoint permite verificar si un secreto puede conectarse correctamente
 * al proveedor de nube respectivo
 */

import { Pool } from 'pg';
import { getCloudAdapter } from '@/utils/cloud';

// Obtener conexión a la base de datos desde las variables de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Solo permitimos POST para pruebas de conexión
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'ID de secreto inválido' });
  }
  
  const secretId = parseInt(id);
  
  try {
    // Obtener los datos del secreto desde la base de datos
    const result = await pool.query(`
      SELECT id, nombre, tipo, secretos
      FROM cloud_secrets 
      WHERE id = $1
    `, [secretId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Secreto no encontrado' });
    }
    
    const secreto = result.rows[0];
    
    // Parsear secretos
    const credentials = typeof secreto.secretos === 'string' 
      ? JSON.parse(secreto.secretos) 
      : secreto.secretos;
    
    // Cargar el adaptador para este tipo de proveedor
    const adapter = await getCloudAdapter(secreto.tipo);
    
    if (!adapter || !adapter.testConnection) {
      return res.status(400).json({ 
        error: `El adaptador para ${secreto.tipo} no soporta la función de prueba de conexión` 
      });
    }
    
    // Configuración básica para la prueba
    const config = {};
    
    // Si es MinIO, algunos valores podrían estar en credenciales en lugar de config
    if (secreto.tipo === 'minio') {
      console.log('Probando conexión MinIO con credenciales:', JSON.stringify(credentials, null, 2));
      
      // Si hay un endpoint en las credenciales, moverlo a config
      if (credentials?.endpoint) {
        config.endpoint = credentials.endpoint;
        
        // Si el endpoint no tiene protocolo, agregarlo
        if (config.endpoint && !config.endpoint.startsWith('http')) {
          const useSSL = config.secure !== false;
          const protocol = useSSL ? 'https://' : 'http://';
          console.log(`Añadiendo protocolo ${protocol} al endpoint ${config.endpoint}`);
          config.endpoint = protocol + config.endpoint;
        }
      }
    }
    
    // Probar la conexión usando el adaptador real
    const testResult = await adapter.testConnection(credentials, config);
    
    return res.status(200).json(testResult);
  } catch (error) {
    console.error(`Error al probar secreto de nube ${id}:`, error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message,
      success: false
    });
  }
}