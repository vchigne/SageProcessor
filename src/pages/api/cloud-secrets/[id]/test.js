/**
 * API para probar la conexión a un proveedor usando un secreto existente
 * 
 * POST: Prueba la conexión con el secreto especificado por ID
 */

import { pool } from '../../../../utils/db';
import { getCloudAdapter } from '../../../../utils/cloud';

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    
    // Validar que id sea un número válido
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de secreto no válido' });
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }
    
    return await testCloudSecret(req, res, parseInt(id));
  } catch (error) {
    console.error('Error en API de prueba de secreto:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error interno del servidor: ${error.message}` 
    });
  }
}

/**
 * Prueba la conexión usando un secreto específico
 */
async function testCloudSecret(req, res, id) {
  try {
    const client = await pool.connect();
    
    try {
      // Obtener el secreto por ID
      const secretResult = await client.query(
        `SELECT id, nombre, tipo, secretos
         FROM cloud_secrets
         WHERE id = $1`,
        [id]
      );
      
      if (secretResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Secreto no encontrado' 
        });
      }
      
      const secret = secretResult.rows[0];
      
      // Crear un proveedor temporal para probar la conexión
      // Parsear credenciales si es necesario
      let credenciales = typeof secret.secretos === 'string' 
        ? JSON.parse(secret.secretos) 
        : secret.secretos;
      
      const tempProvider = {
        id: 0,
        nombre: `Test de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: credenciales,
        configuracion: {}
      };
      
      // Obtener adaptador y probar la conexión
      try {
        const adapter = await getCloudAdapter(tempProvider.tipo);
        
        if (!adapter) {
          return res.status(400).json({ 
            success: false, 
            message: `Tipo de proveedor no soportado: ${secret.tipo}` 
          });
        }
        
        if (!adapter.testConnection) {
          return res.status(400).json({ 
            success: false, 
            message: `El proveedor ${secret.tipo} no implementa el método testConnection` 
          });
        }
        
        // Probar conexión pasando credenciales y configuración
        const result = await adapter.testConnection(tempProvider.credenciales, tempProvider.configuracion);
        
        // Actualizar fecha de última prueba
        await client.query(
          `UPDATE cloud_secrets 
           SET modificado_en = NOW()
           WHERE id = $1`,
          [id]
        );
        
        // Usar el resultado devuelto por el adaptador o uno por defecto
        if (result && typeof result === 'object') {
          return res.status(200).json({
            ...result,
            message: result.message || `Conexión exitosa a ${secret.nombre}`
          });
        } else {
          return res.status(200).json({
            success: true,
            message: `Conexión exitosa a ${secret.nombre}`
          });
        }
      } catch (error) {
        console.error('Error al probar conexión:', error);
        return res.status(200).json({
          success: false,
          message: `Error al conectar: ${error.message}`
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en testCloudSecret:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error al probar secreto: ${error.message}` 
    });
  }
}