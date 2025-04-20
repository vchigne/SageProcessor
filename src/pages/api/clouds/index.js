import { Pool } from 'pg';
import { pool } from '../../../lib/db';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // Obtener todos los proveedores
    if (method === 'GET') {
      const result = await pool.query(`
        SELECT cp.id, cp.nombre, cp.descripcion, cp.tipo, cp.estado, 
               cp.ultimo_chequeo, cp.activo, cp.creado_en, cp.secreto_id,
               CASE WHEN cp.secreto_id IS NOT NULL THEN cs.nombre ELSE NULL END AS secreto_nombre,
               CASE WHEN cp.secreto_id IS NOT NULL THEN TRUE ELSE FALSE END AS usando_secreto
        FROM cloud_providers cp
        LEFT JOIN cloud_secrets cs ON cp.secreto_id = cs.id
        ORDER BY cp.nombre ASC
      `);
      
      return res.status(200).json(result.rows);
    }
    
    // Crear un nuevo proveedor
    else if (method === 'POST') {
      const { nombre, descripcion, tipo, credenciales, configuracion, secreto_id, activo = true } = req.body;
      
      // Validación básica - ahora permitimos credenciales directas o secreto_id
      if (!nombre || !tipo || (!credenciales && !secreto_id) || !configuracion) {
        return res.status(400).json({ 
          error: 'Datos incompletos. Se requiere nombre, tipo, (credenciales o secreto_id) y configuración.' 
        });
      }
      
      // Convertir objetos a JSON para almacenamiento
      const credencialesJson = credenciales && typeof credenciales === 'string' 
        ? credenciales 
        : credenciales ? JSON.stringify(credenciales) : null;
        
      const configuracionJson = typeof configuracion === 'string' 
        ? configuracion 
        : JSON.stringify(configuracion);
      
      // SQL dinámico dependiendo de si tenemos credenciales directas o un secreto_id
      let sql, params;
      
      if (secreto_id) {
        // Verificar que el secreto existe
        const secretoCheck = await pool.query(
          'SELECT id FROM cloud_secrets WHERE id = $1',
          [secreto_id]
        );
        
        if (secretoCheck.rows.length === 0) {
          return res.status(400).json({ error: 'El secreto seleccionado no existe' });
        }
        
        sql = `
          INSERT INTO cloud_providers 
          (nombre, descripcion, tipo, credenciales, configuracion, secreto_id, activo) 
          VALUES ($1, $2, $3, $4, $5, $6, $7) 
          RETURNING id, nombre, descripcion, tipo, estado, activo, creado_en, secreto_id
        `;
        params = [nombre, descripcion || '', tipo, credencialesJson, configuracionJson, secreto_id, activo];
      } else {
        sql = `
          INSERT INTO cloud_providers 
          (nombre, descripcion, tipo, credenciales, configuracion, activo) 
          VALUES ($1, $2, $3, $4, $5, $6) 
          RETURNING id, nombre, descripcion, tipo, estado, activo, creado_en
        `;
        params = [nombre, descripcion || '', tipo, credencialesJson, configuracionJson, activo];
      }
      
      const result = await pool.query(sql, params);
      
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