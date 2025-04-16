/**
 * Funciones de acceso a la base de datos para proveedores de nube
 */

import { pool } from '@/utils/db';

/**
 * Obtiene un proveedor de nube por su ID
 * @param {number} id - ID del proveedor 
 * @returns {Promise<Object>} - Proveedor encontrado o null
 */
export async function getProviderById(id) {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, nombre, tipo, descripcion, credenciales, configuracion, activo, predeterminado 
         FROM cloud_providers 
         WHERE id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al obtener proveedor de nube:', error);
    throw new Error(`No se pudo obtener el proveedor de nube: ${error.message}`);
  }
}

/**
 * Obtiene todos los proveedores de nube
 * @param {Object} filters - Filtros opcionales (activo, tipo, etc.)
 * @returns {Promise<Array<Object>>} - Lista de proveedores
 */
export async function getAllProviders(filters = {}) {
  try {
    const client = await pool.connect();
    try {
      let query = `
        SELECT id, nombre, tipo, descripcion, credenciales, configuracion, activo, predeterminado 
        FROM cloud_providers
        WHERE 1=1
      `;
      
      const params = [];
      let paramCounter = 1;
      
      // Aplicar filtros
      if (filters.activo !== undefined) {
        query += ` AND activo = $${paramCounter++}`;
        params.push(filters.activo);
      }
      
      if (filters.tipo) {
        query += ` AND tipo = $${paramCounter++}`;
        params.push(filters.tipo);
      }
      
      if (filters.predeterminado !== undefined) {
        query += ` AND predeterminado = $${paramCounter++}`;
        params.push(filters.predeterminado);
      }
      
      // Ordenar por prederminado (primero) y nombre
      query += ` ORDER BY predeterminado DESC, nombre ASC`;
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al obtener proveedores de nube:', error);
    throw new Error(`No se pudieron obtener los proveedores de nube: ${error.message}`);
  }
}

/**
 * Obtiene el proveedor predeterminado para un tipo específico
 * @param {string} tipo - Tipo de proveedor (s3, azure, gcp, sftp, minio)
 * @returns {Promise<Object>} - Proveedor predeterminado o null
 */
export async function getDefaultProviderByType(tipo) {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, nombre, tipo, descripcion, credenciales, configuracion, activo, predeterminado 
         FROM cloud_providers 
         WHERE tipo = $1 AND activo = true
         ORDER BY predeterminado DESC
         LIMIT 1`,
        [tipo]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Error al obtener proveedor predeterminado para ${tipo}:`, error);
    throw new Error(`No se pudo obtener el proveedor predeterminado: ${error.message}`);
  }
}

/**
 * Crea un nuevo proveedor de nube
 * @param {Object} provider - Datos del proveedor
 * @returns {Promise<Object>} - Proveedor creado
 */
export async function createProvider(provider) {
  try {
    const client = await pool.connect();
    try {
      // Si es predeterminado, desactivar otros predeterminados del mismo tipo
      if (provider.predeterminado) {
        await client.query(
          `UPDATE cloud_providers 
           SET predeterminado = false 
           WHERE tipo = $1 AND predeterminado = true`,
          [provider.tipo]
        );
      }
      
      // Insertar nuevo proveedor
      const result = await client.query(
        `INSERT INTO cloud_providers 
          (nombre, tipo, descripcion, credenciales, configuracion, activo, predeterminado)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, nombre, tipo, descripcion, credenciales, configuracion, activo, predeterminado`,
        [
          provider.nombre,
          provider.tipo,
          provider.descripcion || '',
          provider.credenciales || '{}',
          provider.configuracion || '{}',
          provider.activo !== undefined ? provider.activo : true,
          provider.predeterminado !== undefined ? provider.predeterminado : false
        ]
      );
      
      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al crear proveedor de nube:', error);
    throw new Error(`No se pudo crear el proveedor de nube: ${error.message}`);
  }
}

/**
 * Actualiza un proveedor de nube existente
 * @param {number} id - ID del proveedor a actualizar
 * @param {Object} provider - Datos actualizados
 * @returns {Promise<Object>} - Proveedor actualizado
 */
export async function updateProvider(id, provider) {
  try {
    const client = await pool.connect();
    try {
      // Si es predeterminado, desactivar otros predeterminados del mismo tipo
      if (provider.predeterminado) {
        await client.query(
          `UPDATE cloud_providers 
           SET predeterminado = false 
           WHERE tipo = $1 AND predeterminado = true AND id != $2`,
          [provider.tipo, id]
        );
      }
      
      // Construir consulta dinámica para actualizar solo los campos proporcionados
      let query = 'UPDATE cloud_providers SET ';
      const params = [];
      const updates = [];
      let paramCounter = 1;
      
      if (provider.nombre !== undefined) {
        updates.push(`nombre = $${paramCounter++}`);
        params.push(provider.nombre);
      }
      
      if (provider.tipo !== undefined) {
        updates.push(`tipo = $${paramCounter++}`);
        params.push(provider.tipo);
      }
      
      if (provider.descripcion !== undefined) {
        updates.push(`descripcion = $${paramCounter++}`);
        params.push(provider.descripcion);
      }
      
      if (provider.credenciales !== undefined) {
        updates.push(`credenciales = $${paramCounter++}`);
        params.push(provider.credenciales);
      }
      
      if (provider.configuracion !== undefined) {
        updates.push(`configuracion = $${paramCounter++}`);
        params.push(provider.configuracion);
      }
      
      if (provider.activo !== undefined) {
        updates.push(`activo = $${paramCounter++}`);
        params.push(provider.activo);
      }
      
      if (provider.predeterminado !== undefined) {
        updates.push(`predeterminado = $${paramCounter++}`);
        params.push(provider.predeterminado);
      }
      
      // Si no hay nada que actualizar, devolver el proveedor existente
      if (updates.length === 0) {
        const existingProvider = await getProviderById(id);
        return existingProvider;
      }
      
      query += updates.join(', ');
      query += ` WHERE id = $${paramCounter++} RETURNING *`;
      params.push(id);
      
      const result = await client.query(query, params);
      
      if (result.rows.length === 0) {
        throw new Error(`Proveedor con ID ${id} no encontrado`);
      }
      
      return result.rows[0];
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Error al actualizar proveedor de nube ${id}:`, error);
    throw new Error(`No se pudo actualizar el proveedor de nube: ${error.message}`);
  }
}

/**
 * Elimina un proveedor de nube
 * @param {number} id - ID del proveedor a eliminar
 * @returns {Promise<boolean>} - true si se eliminó correctamente
 */
export async function deleteProvider(id) {
  try {
    const client = await pool.connect();
    try {
      // Verificar si hay ejecuciones que usan este proveedor
      const usageCheck = await client.query(
        `SELECT COUNT(*) as count
         FROM ejecuciones_yaml
         WHERE nube_primaria_id = $1`,
        [id]
      );
      
      if (usageCheck.rows[0].count > 0) {
        throw new Error(`No se puede eliminar el proveedor porque está siendo utilizado por ${usageCheck.rows[0].count} ejecuciones`);
      }
      
      // Eliminar el proveedor
      const result = await client.query(
        'DELETE FROM cloud_providers WHERE id = $1 RETURNING id',
        [id]
      );
      
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Error al eliminar proveedor de nube ${id}:`, error);
    throw new Error(`No se pudo eliminar el proveedor de nube: ${error.message}`);
  }
}