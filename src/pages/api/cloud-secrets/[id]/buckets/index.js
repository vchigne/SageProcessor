/**
 * API para listar buckets de un proveedor cloud usando un secreto de nube
 * 
 * GET: Lista todos los buckets disponibles para el secreto especificado por ID
 * POST: Crea un nuevo bucket utilizando las credenciales del secreto
 */

import { pool } from '../../../../../utils/db';
import { getCloudAdapter } from '../../../../../utils/cloud';

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    
    // Validar que id sea un número válido
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de secreto no válido' });
    }
    
    if (req.method === 'GET') {
      return await listBuckets(req, res, parseInt(id));
    } else if (req.method === 'POST') {
      return await createBucket(req, res, parseInt(id));
    } else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API de buckets de secreto:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error interno del servidor: ${error.message}` 
    });
  }
}

/**
 * Lista los buckets disponibles para un secreto cloud específico
 */
async function listBuckets(req, res, id) {
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
      
      console.log('[Buckets API] Credenciales preparadas:', {
        tipo: secret.tipo,
        credenciales_type: typeof credenciales,
        key_file_type: credenciales.key_file ? typeof credenciales.key_file : 'undefined'
      });
      
      const tempProvider = {
        id: 0,
        nombre: `Test de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: credenciales,
        configuracion: {}
      };
      
      // Obtener adaptador y listar buckets
      try {
        const adapter = await getCloudAdapter(tempProvider.tipo);
        
        if (!adapter) {
          return res.status(400).json({ 
            success: false, 
            message: `Tipo de proveedor no soportado: ${secret.tipo}` 
          });
        }
        
        // Anteriormente se simulaba GCP, pero ahora usamos API real conforme a directiva NO USAR SIMULACIONES
        // No hay caso especial para GCP, usamos el mismo flujo para todos los proveedores
        
        // Verificamos que el adaptador tenga el método listBuckets
        if (!adapter.listBuckets) {
          return res.status(400).json({ 
            success: false, 
            message: `El proveedor ${secret.tipo} no implementa el método listBuckets` 
          });
        }
        
        // Listar buckets
        const result = await adapter.listBuckets(tempProvider.credenciales, tempProvider.configuracion);
        
        // Actualizar fecha de última modificación
        await client.query(
          `UPDATE cloud_secrets 
           SET modificado_en = NOW()
           WHERE id = $1`,
          [id]
        );
        
        // Usar el resultado devuelto por el adaptador o un formato predeterminado
        if (result && Array.isArray(result)) {
          return res.status(200).json({
            success: true,
            buckets: result
          });
        } else if (result && result.buckets && Array.isArray(result.buckets)) {
          return res.status(200).json({
            success: true,
            buckets: result.buckets
          });
        } else {
          return res.status(200).json({
            success: true,
            buckets: []
          });
        }
      } catch (error) {
        console.error('Error al listar buckets:', error);
        return res.status(200).json({
          success: false,
          message: `Error al listar buckets: ${error.message}`,
          buckets: []
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en listBuckets:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error al listar buckets: ${error.message}`,
      buckets: []
    });
  }
}

/**
 * Crea un nuevo bucket en el proveedor cloud usando un secreto específico
 */
async function createBucket(req, res, id) {
  try {
    // Validar el cuerpo de la solicitud
    const { bucketName } = req.body;
    
    if (!bucketName) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de bucket no proporcionado'
      });
    }
    
    // Validar formato del nombre (letras minúsculas, números, puntos y guiones)
    if (!/^[a-z0-9.-]+$/.test(bucketName)) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de bucket inválido. Use sólo letras minúsculas, números, puntos y guiones.'
      });
    }
    
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
      
      console.log('[Buckets API] Credenciales preparadas para crear bucket:', {
        tipo: secret.tipo,
        credenciales_type: typeof credenciales,
        key_file_type: credenciales.key_file ? typeof credenciales.key_file : 'undefined',
        bucket_name: bucketName
      });
      
      const tempProvider = {
        id: 0,
        nombre: `Test de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: credenciales,
        configuracion: {}
      };
      
      // Obtener adaptador y crear bucket
      try {
        const adapter = await getCloudAdapter(tempProvider.tipo);
        
        if (!adapter) {
          return res.status(400).json({ 
            success: false, 
            message: `Tipo de proveedor no soportado: ${secret.tipo}` 
          });
        }
        
        // Verificamos que el adaptador tenga el método createBucket
        if (!adapter.createBucket) {
          return res.status(400).json({ 
            success: false, 
            message: `El proveedor ${secret.tipo} no implementa el método createBucket` 
          });
        }
        
        // Crear bucket con posibles opciones específicas según el proveedor
        let options = {};
        
        // Configuraciones específicas por tipo de proveedor
        if (secret.tipo === 'gcp') {
          options = {
            location: 'us-central1',  // Valor predeterminado para GCP
            storageClass: 'STANDARD'
          };
        } else if (secret.tipo === 'azure') {
          // Opciones específicas para Azure si son necesarias
        } else if (secret.tipo === 's3') {
          // Opciones específicas para S3 si son necesarias
        }
        
        // Crear bucket
        console.log(`[Buckets API] Creando bucket "${bucketName}" en proveedor tipo ${secret.tipo}`);
        const result = await adapter.createBucket(tempProvider.credenciales, bucketName, options);
        
        // Actualizar fecha de última modificación
        await client.query(
          `UPDATE cloud_secrets 
           SET modificado_en = NOW()
           WHERE id = $1`,
          [id]
        );
        
        return res.status(200).json({
          success: true,
          message: `Bucket "${bucketName}" creado exitosamente`,
          bucket: result
        });
      } catch (error) {
        console.error('Error al crear bucket:', error);
        return res.status(400).json({
          success: false,
          error: `Error al crear bucket: ${error.message}`
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en createBucket:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error al crear bucket: ${error.message}`
    });
  }
}