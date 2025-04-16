import { Pool } from 'pg';
import { pool } from '../../../../lib/db';
import { getCloudAdapter } from '../../../../utils/cloud';

export default async function handler(req, res) {
  // Solo permitimos POST para pruebas de conexión
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'ID de proveedor inválido' });
  }
  
  const providerId = parseInt(id);
  
  try {
    // Obtener los datos del proveedor desde la base de datos
    const result = await pool.query(`
      SELECT id, nombre, tipo, credenciales, configuracion 
      FROM cloud_providers 
      WHERE id = $1
    `, [providerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    
    const provider = result.rows[0];
    
    // Parsear credenciales
    const credentials = typeof provider.credenciales === 'string' 
      ? JSON.parse(provider.credenciales) 
      : provider.credenciales;
    
    // Cargar el adaptador para este tipo de proveedor
    const adapter = await getCloudAdapter(provider.tipo);
    
    if (!adapter || !adapter.testConnection) {
      return res.status(400).json({ 
        error: `El adaptador para ${provider.tipo} no soporta la función de prueba de conexión` 
      });
    }
    
    // Parsear configuración
    const config = typeof provider.configuracion === 'string' 
      ? JSON.parse(provider.configuracion) 
      : provider.configuracion;
    
    // Si es MinIO, imprimir la configuración para debug
    if (provider.tipo === 'minio') {
      console.log('Probando conexión MinIO con config:', JSON.stringify(config));
      console.log('Y credenciales (bucket solo):', credentials.bucket);
    }
    
    // Probar la conexión usando el adaptador real
    const testResult = await adapter.testConnection(credentials, config);
    
    // Actualizar el estado del proveedor
    await pool.query(`
      UPDATE cloud_providers 
      SET 
        estado = $1, 
        ultimo_chequeo = NOW(), 
        mensaje_error = $2,
        modificado_en = NOW()
      WHERE id = $3
    `, [
      testResult.success ? 'conectado' : 'error',
      testResult.success ? null : testResult.message,
      providerId
    ]);
    
    return res.status(200).json({
      provider_id: providerId,
      provider_name: provider.nombre,
      provider_type: provider.tipo,
      ...testResult
    });
    
  } catch (error) {
    console.error(`Error al probar conexión para proveedor ${providerId}:`, error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message 
    });
  }
}