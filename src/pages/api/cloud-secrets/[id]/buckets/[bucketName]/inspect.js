/**
 * API para inspeccionar el contenido de un bucket específico de un secreto de nube
 * 
 * GET: Obtiene la estructura de carpetas y archivos en la ruta especificada
 */

import { pool } from '../../../../../../utils/db';
import { getCloudAdapter } from '../../../../../../utils/cloud';

export default async function handler(req, res) {
  try {
    const { id, bucketName } = req.query;
    const path = req.query.path || '';
    
    // Validar que id sea un número válido
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de secreto no válido' });
    }
    
    if (!bucketName) {
      return res.status(400).json({ error: 'Nombre de bucket no proporcionado' });
    }
    
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método no permitido' });
    }
    
    return await inspectBucket(req, res, parseInt(id), bucketName, path);
  } catch (error) {
    console.error('Error en API de inspección de bucket:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error interno del servidor: ${error.message}` 
    });
  }
}

/**
 * Inspecciona el contenido de un bucket específico
 */
async function inspectBucket(req, res, id, bucketName, path) {
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
      
      // Asegurarse de que el bucket_name esté disponible
      credenciales.bucket_name = bucketName;
      
      const tempProvider = {
        id: 0,
        nombre: `Explorador de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: credenciales,
        configuracion: {}
      };
      
      // Obtener adaptador y explorar bucket
      try {
        const adapter = await getCloudAdapter(tempProvider.tipo);
        
        if (!adapter) {
          return res.status(400).json({ 
            success: false, 
            message: `Tipo de proveedor no soportado: ${secret.tipo}` 
          });
        }
        
        // Si estamos trabajando con GCP, redirigimos a la API de clouds que ya funciona
        if (secret.tipo === 'gcp') {
          // Reutilizamos el adaptador GCP existente con la función listContents que ya funciona
          console.log(`[GCP Cloud Secrets] Usando adaptador existente para explorar bucket ${bucketName} en ruta ${path}`);
          const result = await adapter.listContents(tempProvider.credenciales, tempProvider.configuracion, path);
          
          // Actualizar fecha de última modificación
          await client.query(
            `UPDATE cloud_secrets 
             SET modificado_en = NOW()
             WHERE id = $1`,
            [id]
          );
          
          return res.status(200).json(result);
        }
        
        // Verificar que el adaptador tenga el método listContents
        if (!adapter.listContents) {
          return res.status(400).json({ 
            success: false, 
            message: `El proveedor ${secret.tipo} no implementa el método listContents` 
          });
        }
        
        // Listar contenido del bucket en la ruta especificada
        const result = await adapter.listContents(tempProvider.credenciales, tempProvider.configuracion, path);
        
        // Actualizar fecha de última modificación
        await client.query(
          `UPDATE cloud_secrets 
           SET modificado_en = NOW()
           WHERE id = $1`,
          [id]
        );
        
        return res.status(200).json(result);
      } catch (error) {
        console.error('Error al inspeccionar bucket:', error);
        return res.status(200).json({
          error: true,
          errorMessage: error.message,
          bucket: bucketName,
          path: path || '/',
          files: [],
          folders: []
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