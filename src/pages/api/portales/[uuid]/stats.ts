import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { uuid } = req.query;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  try {
    const result = await pool.query(`
      WITH portal_info AS (
        SELECT id 
        FROM portales 
        WHERE uuid = $1
      ),
      archivos_stats AS (
        SELECT 
          COUNT(*) as total_archivos,
          0 as archivos_error
        FROM portal_info pi
        JOIN casillas c ON c.portal_id = pi.id
        JOIN procesamiento_archivos pa ON pa.casilla_id = c.id
        WHERE pa.fecha_procesamiento >= NOW() - INTERVAL '30 days'
      )
      SELECT 
        total_archivos as archivos_procesados,
        archivos_error,
        CASE 
          WHEN total_archivos > 0 
          THEN ROUND((1 - (archivos_error::float / total_archivos)) * 100)
          ELSE 0
        END as porcentaje_exito
      FROM archivos_stats
    `, [uuid]);

    return res.status(200).json(result.rows[0] || {
      archivos_procesados: 0,
      archivos_error: 0,
      porcentaje_exito: 0
    });
  } catch (error: any) {
    console.error('Error fetching portal stats:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}