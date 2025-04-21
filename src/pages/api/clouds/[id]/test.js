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
    // Obtener los datos del proveedor desde la base de datos, ahora incluyendo secreto_id
    const result = await pool.query(`
      SELECT id, nombre, tipo, credenciales, configuracion, secreto_id
      FROM cloud_providers 
      WHERE id = $1
    `, [providerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    
    const provider = result.rows[0];
    
    // Si hay un secreto_id, obtener las credenciales del secreto
    let credentials;
    
    if (provider.secreto_id) {
      // Obtener credenciales desde el secreto
      const secretResult = await pool.query(`
        SELECT secretos
        FROM cloud_secrets
        WHERE id = $1
      `, [provider.secreto_id]);
      
      if (secretResult.rows.length === 0) {
        return res.status(400).json({ error: 'El secreto asociado no existe' });
      }
      
      credentials = typeof secretResult.rows[0].secretos === 'string'
        ? JSON.parse(secretResult.rows[0].secretos)
        : secretResult.rows[0].secretos;
        
      console.log(`Usando credenciales del secreto #${provider.secreto_id} para proveedor ${providerId}`);
    } else {
      // Usar credenciales directas del proveedor
      credentials = typeof provider.credenciales === 'string' 
        ? JSON.parse(provider.credenciales) 
        : provider.credenciales;
    }
    
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
    
    // Si es MinIO, imprimir la configuración completa para debug
    if (provider.tipo === 'minio') {
      console.log('Probando conexión MinIO con config:', JSON.stringify(config, null, 2));
      console.log('Y credenciales completas:', JSON.stringify(credentials, null, 2));
      console.log('Validando endpoint existe:', config && config.endpoint ? 'Sí' : 'No');
      console.log('Adaptador cargado:', adapter ? 'Sí' : 'No');
      
      // Si no hay endpoint en la configuración, revisar si está en las credenciales
      if (!config?.endpoint && credentials?.endpoint) {
        console.log('Endpoint encontrado en credenciales, moviendo a config');
        config.endpoint = credentials.endpoint;
      }
      
      // Si hay un endpoint pero no tiene protocolo, agregarlo
      if (config?.endpoint && !config.endpoint.startsWith('http')) {
        const useSSL = config.secure !== false;
        const protocol = useSSL ? 'https://' : 'http://';
        console.log(`Añadiendo protocolo ${protocol} al endpoint ${config.endpoint}`);
        config.endpoint = protocol + config.endpoint;
      }
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