/**
 * API para gestionar secretos de nube
 * 
 * GET: Obtiene todos los secretos de nube
 * POST: Crea un nuevo secreto de nube
 */

import { pool } from '../../../utils/db';

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case 'GET':
        return await getCloudSecrets(req, res);
      case 'POST':
        return await createCloudSecret(req, res);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API de secretos de nube:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * Obtiene todos los secretos de nube
 */
async function getCloudSecrets(req, res) {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT id, nombre, descripcion, tipo, activo, creado_en, modificado_en
        FROM cloud_secrets
        ORDER BY nombre ASC
      `);
      
      return res.status(200).json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al obtener secretos de nube:', error);
    return res.status(500).json({ error: 'Error al obtener secretos de nube' });
  }
}

/**
 * Crea un nuevo secreto de nube
 */
async function createCloudSecret(req, res) {
  const { nombre, descripcion, tipo, secretos, activo = true } = req.body;
  
  // Validaciones
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  
  if (!tipo) {
    return res.status(400).json({ error: 'El tipo de proveedor es obligatorio' });
  }
  
  if (!secretos || Object.keys(secretos).length === 0) {
    return res.status(400).json({ error: 'Las credenciales son obligatorias' });
  }
  
  try {
    const client = await pool.connect();
    
    try {
      // Verificar si ya existe un secreto con el mismo nombre
      const existingSecret = await client.query(
        'SELECT id FROM cloud_secrets WHERE nombre = $1',
        [nombre]
      );
      
      if (existingSecret.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe un secreto con ese nombre' });
      }
      
      // Insertar el nuevo secreto
      const result = await client.query(
        `INSERT INTO cloud_secrets (nombre, descripcion, tipo, secretos, activo) 
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nombre, descripcion, tipo, activo, creado_en, modificado_en`,
        [nombre, descripcion || null, tipo, JSON.stringify(secretos), activo]
      );
      
      return res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al crear secreto de nube:', error);
    return res.status(500).json({ error: 'Error al crear secreto de nube' });
  }
}