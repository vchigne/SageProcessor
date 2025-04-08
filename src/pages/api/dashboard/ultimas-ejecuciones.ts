import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Extraer límite de registros a devolver
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    
    // Consulta para obtener las últimas ejecuciones con información de casilla y emisor
    const query = `
      SELECT 
        e.id,
        e.uuid,
        e.fecha_ejecucion,
        e.nombre_yaml,
        e.archivo_datos,
        e.estado,
        e.errores_detectados,
        e.warnings_detectados,
        c.nombre_yaml as casilla_nombre,
        c.id as casilla_id,
        em.nombre as emisor_nombre,
        em.id as emisor_id
      FROM 
        ejecuciones_yaml e
        JOIN casillas c ON e.casilla_id = c.id
        LEFT JOIN emisores em ON e.emisor_id = em.id
      ORDER BY 
        e.fecha_ejecucion DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

    // Devolver las últimas ejecuciones formateadas
    res.status(200).json({
      ejecuciones: result.rows.map(row => ({
        id: row.id,
        uuid: row.uuid,
        fecha: row.fecha_ejecucion,
        nombreYaml: row.nombre_yaml,
        archivoDatos: row.archivo_datos,
        estado: row.estado,
        errores: row.errores_detectados,
        warnings: row.warnings_detectados,
        casilla: {
          id: row.casilla_id,
          nombre: row.casilla_nombre
        },
        emisor: {
          id: row.emisor_id,
          nombre: row.emisor_nombre
        }
      }))
    });
  } catch (error) {
    console.error('Error obteniendo últimas ejecuciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}