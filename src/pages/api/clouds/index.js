import { Pool } from 'pg';
import { getConfig } from '@/utils/db';

// Conexión a la base de datos
const pool = new Pool(getConfig());

export default async function handler(req, res) {
  const { method } = req;

  try {
    // Obtener todos los proveedores
    if (method === 'GET') {
      const result = await pool.query(`
        SELECT id, nombre, descripcion, tipo, estado, ultimo_chequeo, activo, creado_en 
        FROM cloud_providers 
        ORDER BY nombre ASC
      `);
      
      return res.status(200).json(result.rows);
    }
    
    // Crear un nuevo proveedor
    else if (method === 'POST') {
      const { nombre, descripcion, tipo, credenciales, configuracion, activo = true } = req.body;
      
      // Validación básica
      if (!nombre || !tipo || !credenciales || !configuracion) {
        return res.status(400).json({ 
          error: 'Datos incompletos. Se requiere nombre, tipo, credenciales y configuración.' 
        });
      }
      
      // Convertir objetos a JSON para almacenamiento
      const credencialesJson = typeof credenciales === 'string' 
        ? credenciales 
        : JSON.stringify(credenciales);
        
      const configuracionJson = typeof configuracion === 'string' 
        ? configuracion 
        : JSON.stringify(configuracion);
      
      const result = await pool.query(`
        INSERT INTO cloud_providers 
        (nombre, descripcion, tipo, credenciales, configuracion, activo) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id, nombre, descripcion, tipo, estado, activo, creado_en
      `, [nombre, descripcion || '', tipo, credencialesJson, configuracionJson, activo]);
      
      return res.status(201).json(result.rows[0]);
    }
    
    // Método no permitido
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error al procesar solicitud de clouds:', error);
    return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
}