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
    // Extraer parámetros de fecha
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const limite = req.query.limite ? parseInt(req.query.limite as string) : 5;

    // Consulta para estadísticas de casillas
    const casillasQuery = `
      WITH stats AS (
        SELECT 
          c.id,
          c.nombre_yaml,
          COUNT(e.id) AS total_ejecuciones,
          COUNT(CASE WHEN e.estado = 'Éxito' THEN 1 END)::float / NULLIF(COUNT(e.id), 0) * 100 AS tasa_exito,
          MAX(e.fecha_ejecucion) AS ultima_ejecucion
        FROM 
          casillas c
          LEFT JOIN ejecuciones_yaml e ON c.id = e.casilla_id
        WHERE 
          (e.fecha_ejecucion BETWEEN $1 AND $2 OR e.fecha_ejecucion IS NULL)
        GROUP BY 
          c.id, c.nombre_yaml
        ORDER BY 
          total_ejecuciones DESC
        LIMIT $3
      )
      SELECT 
        id,
        nombre_yaml AS nombre,
        COALESCE(total_ejecuciones, 0) AS total_ejecuciones,
        ROUND(COALESCE(tasa_exito, 0))::integer AS tasa_exito,
        ultima_ejecucion
      FROM 
        stats
    `;

    // Consulta para estadísticas de emisores
    const emisoresQuery = `
      WITH stats AS (
        SELECT 
          em.id,
          em.nombre,
          COUNT(e.id) AS total_ejecuciones,
          COUNT(CASE WHEN e.estado = 'Éxito' THEN 1 END)::float / NULLIF(COUNT(e.id), 0) * 100 AS tasa_exito,
          MAX(e.fecha_ejecucion) AS ultima_ejecucion
        FROM 
          emisores em
          LEFT JOIN ejecuciones_yaml e ON em.id = e.emisor_id
        WHERE 
          (e.fecha_ejecucion BETWEEN $1 AND $2 OR e.fecha_ejecucion IS NULL)
        GROUP BY 
          em.id, em.nombre
        ORDER BY 
          total_ejecuciones DESC
        LIMIT $3
      )
      SELECT 
        id,
        nombre,
        COALESCE(total_ejecuciones, 0) AS total_ejecuciones,
        ROUND(COALESCE(tasa_exito, 0))::integer AS tasa_exito,
        ultima_ejecucion
      FROM 
        stats
    `;

    // Ejecutar consultas en paralelo
    const [casillasResult, emisoresResult] = await Promise.all([
      pool.query(casillasQuery, [from, to, limite]),
      pool.query(emisoresQuery, [from, to, limite])
    ]);

    // Formatear y devolver los resultados
    res.status(200).json({
      casillas: casillasResult.rows.map(row => ({
        id: row.id,
        nombre: row.nombre,
        totalEjecuciones: row.total_ejecuciones,
        tasaExito: row.tasa_exito,
        ultimaEjecucion: row.ultima_ejecucion
      })),
      emisores: emisoresResult.rows.map(row => ({
        id: row.id,
        nombre: row.nombre,
        totalEjecuciones: row.total_ejecuciones,
        tasaExito: row.tasa_exito,
        ultimaEjecucion: row.ultima_ejecucion
      }))
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de entidades:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}