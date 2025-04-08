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
    const { from, to, organizacion, pais, producto } = req.query;

    // Construir la cláusula WHERE base
    let whereClause = "WHERE fecha_ejecucion >= $1 AND fecha_ejecucion <= $2";
    const params = [from, to];
    let paramCount = 2;

    if (organizacion && organizacion !== 'todas') {
      paramCount++;
      whereClause += ` AND organizacion_id = $${paramCount}`;
      params.push(organizacion);
    }

    if (pais && pais !== 'todos') {
      paramCount++;
      whereClause += ` AND pais_id = $${paramCount}`;
      params.push(pais);
    }

    if (producto && producto !== 'todos') {
      paramCount++;
      whereClause += ` AND producto_id = $${paramCount}`;
      params.push(producto);
    }

    // Métricas principales
    const statsQuery = `
      WITH stats AS (
        SELECT 
          COUNT(*) as archivos_procesados,
          ROUND(AVG(CASE WHEN estado = 'Éxito' THEN 100 ELSE 0 END), 2) as tasa_exito,
          COUNT(CASE WHEN estado = 'Pendiente' THEN 1 END) as archivos_pendientes
        FROM ejecuciones_yaml
        ${whereClause}
      )
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM casillas) as casillas_por_vencer
      FROM stats s
    `;

    const client = await pool.connect();
    try {
      const statsResult = await client.query(statsQuery, params);

      res.json({
        stats: {
          archivos_procesados: parseInt(statsResult.rows[0]?.archivos_procesados) || 0,
          tasa_exito: parseFloat(statsResult.rows[0]?.tasa_exito) || 0,
          archivos_pendientes: parseInt(statsResult.rows[0]?.archivos_pendientes) || 0,
          casillas_por_vencer: parseInt(statsResult.rows[0]?.casillas_por_vencer) || 0
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in dashboard stats:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}