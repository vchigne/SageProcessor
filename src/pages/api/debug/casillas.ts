import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Consulta para obtener casillas con sus conteos
    const query = `
      SELECT 
        c.id, 
        c.nombre_yaml,
        c.tipo_casilla,
        c.is_active,
        i.nombre as instalacion_nombre,
        o.nombre as organizacion_nombre,
        pa.nombre as pais_nombre,
        COALESCE(e.emisores_count, 0) as emisores_count,
        COALESCE(s.suscriptores_count, 0) as suscriptores_count
      FROM 
        casillas c
      LEFT JOIN instalaciones i ON c.instalacion_id = i.id
      LEFT JOIN organizaciones o ON i.organizacion_id = o.id
      LEFT JOIN paises pa ON i.pais_id = pa.id
      LEFT JOIN (
        SELECT 
          casilla_id, 
          COUNT(*) as emisores_count
        FROM 
          emisores_por_casilla
        GROUP BY 
          casilla_id
      ) e ON c.id = e.casilla_id
      LEFT JOIN (
        SELECT 
          casilla_id, 
          COUNT(*) as suscriptores_count
        FROM 
          suscripciones
        WHERE
          activo = true
        GROUP BY 
          casilla_id
      ) s ON c.id = s.casilla_id
      WHERE 
        c.is_active = true
      ORDER BY
        c.id ASC
    `;
    
    const result = await pool.query(query);
    
    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('Error al obtener información de casillas:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message 
    });
  }
}