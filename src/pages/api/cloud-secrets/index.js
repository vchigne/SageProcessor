/**
 * API para gestionar secretos de nubes
 * 
 * Este endpoint permite listar y crear secretos de nubes
 * que pueden ser utilizados para conectarse a proveedores de almacenamiento
 */

import { Pool } from 'pg';

// Obtener conexión a la base de datos desde las variables de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  const { method } = req;
  
  try {
    // Obtener todos los secretos (GET)
    if (method === 'GET') {
      const result = await pool.query(`
        SELECT id, nombre, descripcion, tipo, 
               creado_en, modificado_en, activo
        FROM cloud_secrets 
        ORDER BY nombre ASC
      `);
      
      return res.status(200).json(result.rows);
    }
    
    // Crear un nuevo secreto (POST)
    else if (method === 'POST') {
      const { nombre, descripcion, tipo, secretos, activo = true } = req.body;
      
      // Validación básica
      if (!nombre || !tipo || !secretos) {
        return res.status(400).json({ 
          error: 'Datos incompletos. Se requiere nombre, tipo y secretos.' 
        });
      }
      
      // Convertir objeto de secretos a JSON para almacenamiento
      const secretosJson = typeof secretos === 'string' 
        ? secretos 
        : JSON.stringify(secretos);
      
      const result = await pool.query(`
        INSERT INTO cloud_secrets 
        (nombre, descripcion, tipo, secretos, activo) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id, nombre, descripcion, tipo, activo, creado_en
      `, [nombre, descripcion || '', tipo, secretosJson, activo]);
      
      return res.status(201).json(result.rows[0]);
    }
    
    // Método no permitido
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API de cloud-secrets:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message 
    });
  }
}