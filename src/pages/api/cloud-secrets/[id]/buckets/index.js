/**
 * API para gestionar buckets de un proveedor de nube específico
 * 
 * GET: Obtiene la lista de buckets disponibles
 * POST: Crea un nuevo bucket
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
    
    switch (req.method) {
      case 'GET':
        return await listBuckets(req, res, parseInt(id));
      case 'POST':
        return await createBucket(req, res, parseInt(id));
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API de buckets:', error);
    return res.status(500).json({ error: `Error interno del servidor: ${error.message}` });
  }
}

/**
 * Obtiene la lista de buckets disponibles para un secreto específico
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
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      const secret = secretResult.rows[0];
      
      // Verificar que sea un proveedor MinIO
      if (secret.tipo !== 'minio') {
        return res.status(400).json({ 
          error: 'Esta operación solo está disponible para proveedores MinIO' 
        });
      }
      
      // Crear un proveedor temporal para probar la conexión
      const tempProvider = {
        id: 0,
        nombre: `Buckets de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: secret.secretos,
        configuracion: {}
      };
      
      try {
        // Obtener adaptador
        const adapter = getCloudAdapter(tempProvider);
        
        if (!adapter) {
          return res.status(400).json({ error: `Tipo de proveedor no soportado: ${secret.tipo}` });
        }
        
        // Verificar que el adaptador tenga la función listBuckets
        if (typeof adapter.listBuckets !== 'function') {
          return res.status(400).json({ 
            error: 'Este proveedor no soporta la operación de listar buckets' 
          });
        }
        
        // Listar buckets
        const buckets = await adapter.listBuckets();
        
        return res.status(200).json({ buckets });
      } catch (error) {
        console.error('Error al listar buckets:', error);
        return res.status(500).json({ error: `Error al listar buckets: ${error.message}` });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en listBuckets:', error);
    return res.status(500).json({ error: `Error al listar buckets: ${error.message}` });
  }
}

/**
 * Crea un nuevo bucket para un secreto específico
 */
async function createBucket(req, res, id) {
  const { bucketName } = req.body;
  
  // Validar nombre de bucket
  if (!bucketName || typeof bucketName !== 'string' || bucketName.trim() === '') {
    return res.status(400).json({ error: 'El nombre del bucket es obligatorio' });
  }
  
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
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      const secret = secretResult.rows[0];
      
      // Verificar que sea un proveedor MinIO
      if (secret.tipo !== 'minio') {
        return res.status(400).json({ 
          error: 'Esta operación solo está disponible para proveedores MinIO' 
        });
      }
      
      // Crear un proveedor temporal para probar la conexión
      const tempProvider = {
        id: 0,
        nombre: `Buckets de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: secret.secretos,
        configuracion: {}
      };
      
      try {
        // Obtener adaptador
        const adapter = getCloudAdapter(tempProvider);
        
        if (!adapter) {
          return res.status(400).json({ error: `Tipo de proveedor no soportado: ${secret.tipo}` });
        }
        
        // Verificar que el adaptador tenga la función createBucket
        if (typeof adapter.createBucket !== 'function') {
          return res.status(400).json({ 
            error: 'Este proveedor no soporta la operación de crear buckets' 
          });
        }
        
        // Crear bucket
        await adapter.createBucket(bucketName);
        
        return res.status(201).json({ 
          message: `Bucket ${bucketName} creado correctamente`,
          bucketName
        });
      } catch (error) {
        console.error('Error al crear bucket:', error);
        return res.status(500).json({ error: `Error al crear bucket: ${error.message}` });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en createBucket:', error);
    return res.status(500).json({ error: `Error al crear bucket: ${error.message}` });
  }
}