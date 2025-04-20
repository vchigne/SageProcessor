/**
 * API para gestionar un secreto de nube específico
 * 
 * GET: Obtiene un secreto de nube por su ID
 * PUT: Actualiza un secreto de nube
 * DELETE: Elimina un secreto de nube
 */

import { pool } from '../../../utils/db';

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    
    // Validar que id sea un número válido
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de secreto no válido' });
    }
    
    switch (req.method) {
      case 'GET':
        return await getCloudSecret(req, res, parseInt(id));
      case 'PUT':
        return await updateCloudSecret(req, res, parseInt(id));
      case 'DELETE':
        return await deleteCloudSecret(req, res, parseInt(id));
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API de secreto de nube:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * Obtiene un secreto de nube por su ID
 */
async function getCloudSecret(req, res, id) {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        `SELECT id, nombre, descripcion, tipo, secretos, activo, creado_en, modificado_en
         FROM cloud_secrets
         WHERE id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      return res.status(200).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al obtener secreto de nube:', error);
    return res.status(500).json({ error: 'Error al obtener secreto de nube' });
  }
}

/**
 * Actualiza un secreto de nube
 */
async function updateCloudSecret(req, res, id) {
  const { nombre, descripcion, tipo, secretos, activo } = req.body;
  
  // Validaciones
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  
  if (!tipo) {
    return res.status(400).json({ error: 'El tipo de proveedor es obligatorio' });
  }
  
  // No validamos que secretos esté presente, lo manejaremos más adelante
  
  try {
    const client = await pool.connect();
    
    try {
      // Obtener el secreto existente
      const existingSecretResult = await client.query(
        'SELECT id, secretos FROM cloud_secrets WHERE id = $1',
        [id]
      );
      
      if (existingSecretResult.rows.length === 0) {
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      // Obtener las credenciales existentes
      const existingSecret = existingSecretResult.rows[0];
      let existingSecretData = {};
      
      try {
        if (existingSecret.secretos) {
          existingSecretData = typeof existingSecret.secretos === 'string' 
            ? JSON.parse(existingSecret.secretos) 
            : existingSecret.secretos;
        }
      } catch (e) {
        console.error('Error al parsear secretos existentes:', e);
      }
      
      // Verificar si el nombre ya está en uso por otro secreto
      const nameExistsResult = await client.query(
        'SELECT id FROM cloud_secrets WHERE nombre = $1 AND id != $2',
        [nombre, id]
      );
      
      if (nameExistsResult.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe otro secreto con ese nombre' });
      }
      
      // Combinar secretos existentes con los nuevos si se proporcionan
      let secretosActualizados = existingSecretData;
      
      if (secretos && Object.keys(secretos).length > 0) {
        // Solo actualizar los campos que se proporcionan, mantener el resto
        secretosActualizados = { ...existingSecretData, ...secretos };
      }
      
      // Actualizar el secreto
      const result = await client.query(
        `UPDATE cloud_secrets 
         SET nombre = $1, descripcion = $2, tipo = $3, secretos = $4, activo = $5, modificado_en = NOW()
         WHERE id = $6
         RETURNING id, nombre, descripcion, tipo, activo, creado_en, modificado_en`,
        [nombre, descripcion || null, tipo, JSON.stringify(secretosActualizados), activo, id]
      );
      
      return res.status(200).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al actualizar secreto de nube:', error);
    return res.status(500).json({ error: 'Error al actualizar secreto de nube' });
  }
}

/**
 * Elimina un secreto de nube
 */
async function deleteCloudSecret(req, res, id) {
  try {
    const client = await pool.connect();
    
    try {
      // Verificar si el secreto está siendo utilizado por algún proveedor
      const usageCheck = await client.query(
        'SELECT id FROM cloud_providers WHERE secreto_id = $1 LIMIT 1',
        [id]
      );
      
      if (usageCheck.rows.length > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar el secreto porque está siendo utilizado por uno o más proveedores' 
        });
      }
      
      // Eliminar el secreto
      const result = await client.query(
        'DELETE FROM cloud_secrets WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Secreto no encontrado' });
      }
      
      return res.status(200).json({ message: 'Secreto eliminado correctamente', id });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al eliminar secreto de nube:', error);
    return res.status(500).json({ error: 'Error al eliminar secreto de nube' });
  }
}