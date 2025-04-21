/**
 * API para inspeccionar un bucket específico usando un secreto de nube
 * 
 * GET: Obtiene información detallada sobre un bucket específico y sus contenidos
 */

import { pool } from '../../../../../../utils/db';
import { getCloudAdapter } from '../../../../../../utils/cloud';

export default async function handler(req, res) {
  try {
    const { id, bucketName } = req.query;
    
    // Validar que el ID sea un número válido
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de secreto no válido' 
      });
    }
    
    // Validar que se proporcione un nombre de bucket
    if (!bucketName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nombre de bucket no proporcionado' 
      });
    }
    
    // Solo aceptamos solicitudes GET
    if (req.method !== 'GET') {
      return res.status(405).json({ 
        success: false, 
        message: 'Método no permitido' 
      });
    }
    
    // Obtener información del bucket
    return await inspectBucket(req, res, parseInt(id), bucketName);
  } catch (error) {
    console.error('Error en API de inspección de bucket:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error interno del servidor: ${error.message}` 
    });
  }
}

/**
 * Inspecciona un bucket específico y lista su contenido
 */
async function inspectBucket(req, res, id, bucketName) {
  const { path = '', limit = '50' } = req.query;
  const maxItems = parseInt(limit) || 50;
  
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
      
      // Parsear credenciales si es necesario
      let credenciales = typeof secret.secretos === 'string' 
        ? JSON.parse(secret.secretos) 
        : secret.secretos;
        
      // Para GCP, necesitamos asegurarnos de que el key_file esté parseado correctamente
      if (secret.tipo === 'gcp' && credenciales.key_file && typeof credenciales.key_file === 'string') {
        try {
          console.log('[Inspect API] Intentando parsear key_file de GCP');
          credenciales.key_file = JSON.parse(credenciales.key_file);
          console.log('[Inspect API] key_file parseado correctamente');
        } catch (error) {
          console.error('[Inspect API] Error al parsear key_file:', error);
          // Continuamos aunque haya error, el adaptador intentará manejarlo
        }
      }
      
      console.log('[Inspect API] Credenciales preparadas:', {
        tipo: secret.tipo,
        credenciales_type: typeof credenciales,
        key_file_type: credenciales.key_file ? typeof credenciales.key_file : 'undefined',
        bucket: bucketName,
        path: path
      });
      
      // Configuración por defecto del proveedor temporal
      const tempProvider = {
        id: 0,
        nombre: `Test de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: {
          ...credenciales,
          bucket_name: bucketName // Asegurarnos de que el adaptador sepa qué bucket consultar
        },
        configuracion: {}
      };
      
      // Obtener adaptador e inspeccionar bucket
      try {
        const adapter = await getCloudAdapter(tempProvider.tipo);
        
        if (!adapter) {
          return res.status(400).json({ 
            success: false, 
            message: `Tipo de proveedor no soportado: ${secret.tipo}` 
          });
        }
        
        // Listamos el contenido del bucket
        if (!adapter.listContents) {
          return res.status(400).json({ 
            success: false, 
            message: `El proveedor ${secret.tipo} no implementa el método listContents` 
          });
        }
        
        // Ajustes según el tipo de proveedor
        let config = {};
        
        // Especificar configuración especial para S3 si es necesario
        if (secret.tipo === 's3') {
          // ...
        }
        
        // Obtener contenido del bucket
        console.log(`[Inspect API] Listando contenido del bucket ${bucketName} en ruta ${path || '/'}`);
        const result = await adapter.listContents(
          tempProvider.credenciales, 
          { ...tempProvider.configuracion, ...config },
          path,
          maxItems
        );
        
        // Actualizar fecha de última modificación
        await client.query(
          `UPDATE cloud_secrets 
           SET modificado_en = NOW()
           WHERE id = $1`,
          [id]
        );
        
        return res.status(200).json({
          success: true,
          bucket: bucketName,
          path: path || '/',
          contents: result
        });
      } catch (error) {
        console.error('Error al inspeccionar bucket:', error);
        return res.status(200).json({
          success: false,
          message: `Error al inspeccionar bucket: ${error.message}`,
          bucket: bucketName,
          path: path || '/',
          contents: null
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en inspectBucket:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error al inspeccionar bucket: ${error.message}`
    });
  }
}