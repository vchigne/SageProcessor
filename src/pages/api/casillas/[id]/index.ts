import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Configurar conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }
  
  const { id } = req.query;
  const { uuid } = req.query; // UUID del portal para verificar acceso
  
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID de casilla no proporcionado' });
  }
  
  try {
    // Si se proporciona un UUID de portal, verificar que la casilla pertenece a ese portal
    if (uuid) {
      const portalAccess = await pool.query(
        `SELECT i.id 
         FROM portales p 
         JOIN instalaciones i ON p.instalacion_id = i.id 
         JOIN data_boxes d ON d.instalacion_id = i.id 
         WHERE p.uuid = $1 AND d.id = $2`,
        [uuid, id]
      );
      
      if (portalAccess.rowCount === 0) {
        return res.status(403).json({ 
          success: false, 
          error: 'La casilla no pertenece al portal especificado o el portal no existe' 
        });
      }
      
      // Registrar acceso al portal
      await pool.query(
        `INSERT INTO portal_accesos 
         (uuid, instalacion_id, fecha_acceso, accion, casilla_id) 
         VALUES ($1, (SELECT instalacion_id FROM portales WHERE uuid = $1), NOW(), 'consulta_casilla', $2)`,
        [uuid, id]
      );
    }
    
    // Obtener los datos de la casilla
    const casillaQuery = await pool.query(
      `SELECT db.*, 
              i.id as instalacion_id,
              o.id as organizacion_id,
              o.nombre as organizacion_nombre,
              pr.id as producto_id,
              pr.nombre as producto_nombre,
              pa.id as pais_id,
              pa.nombre as pais_nombre
       FROM data_boxes db
       LEFT JOIN instalaciones i ON db.instalacion_id = i.id
       LEFT JOIN organizaciones o ON i.organizacion_id = o.id
       LEFT JOIN productos pr ON i.producto_id = pr.id
       LEFT JOIN paises pa ON i.pais_id = pa.id
       WHERE db.id = $1`,
      [id]
    );
    
    if (casillaQuery.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Casilla no encontrada' });
    }
    
    // Formatear la respuesta
    const casilla = casillaQuery.rows[0];
    
    // Formatear instalación anidada
    const formattedCasilla = {
      id: casilla.id,
      nombre_yaml: casilla.nombre_yaml,
      yaml_contenido: casilla.yaml_contenido,
      archivo_yaml_contenido: casilla.archivo_yaml_contenido,
      nombreCompleto: casilla.nombre_completo,
      nombre: casilla.nombre,
      descripcion: casilla.descripcion,
      instalacion: {
        id: casilla.instalacion_id,
        organizacion: {
          id: casilla.organizacion_id,
          nombre: casilla.organizacion_nombre
        },
        producto: {
          id: casilla.producto_id,
          nombre: casilla.producto_nombre
        },
        pais: {
          id: casilla.pais_id,
          nombre: casilla.pais_nombre
        }
      }
    };
    
    // Obtener emisores de la casilla
    const emisoresQuery = await pool.query(
      'SELECT id, nombre FROM emisores WHERE casilla_id = $1',
      [id]
    );
    
    formattedCasilla['emisores'] = emisoresQuery.rows;
    
    // Responder con éxito
    return res.status(200).json(formattedCasilla);
    
  } catch (error) {
    console.error('Error al obtener información de la casilla:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}