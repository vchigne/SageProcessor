/**
 * API para probar una conexión a un proveedor de nube usando credenciales sin guardar
 * 
 * POST: Prueba la conexión con las credenciales proporcionadas
 */

import { getCloudAdapter } from '@/utils/cloud';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { tipo, secretos } = req.body;
    
    if (!tipo || !secretos) {
      return res.status(400).json({ 
        success: false,
        message: 'Se requiere tipo y secretos para probar la conexión'
      });
    }
    
    // Cargar el adaptador adecuado para el proveedor
    const adapter = await getCloudAdapter(tipo);
    
    if (!adapter) {
      return res.status(400).json({ 
        success: false,
        message: `No se encontró adaptador para el tipo ${tipo}`
      });
    }
    
    // Verificar que el adaptador tenga la función testConnection
    if (!adapter.testConnection) {
      return res.status(400).json({ 
        success: false,
        message: `El adaptador para ${tipo} no soporta pruebas de conexión`
      });
    }
    
    // Configuración básica para la conexión
    const config = {};
    
    // Configuración específica para cada tipo de proveedor
    if (tipo === 'minio') {
      // Para MinIO necesitamos pasar el endpoint a la configuración
      if (secretos.endpoint) {
        config.endpoint = secretos.endpoint;
        
        // Si el endpoint no tiene protocolo, usar http por defecto
        if (!config.endpoint.startsWith('http')) {
          const useSSL = secretos.secure !== false;
          config.endpoint = (useSSL ? 'https://' : 'http://') + config.endpoint;
        }
      }
    } else if (tipo === 's3') {
      // Para S3 podemos necesitar la región
      if (secretos.region) {
        config.region = secretos.region;
      }
    }
    
    // Probar la conexión
    const result = await adapter.testConnection(secretos, config);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error testing cloud connection:', error);
    return res.status(500).json({ 
      success: false,
      message: `Error de servidor: ${error.message}`
    });
  }
}