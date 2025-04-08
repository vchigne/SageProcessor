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
    const { from, to, metric } = req.query;

    let detailsQuery = '';
    const params = [from, to];

    switch (metric) {
      case 'archivos_procesados':
        detailsQuery = `
          SELECT 
            estado as nombre,
            COUNT(*) as valor
          FROM ejecuciones_yaml
          WHERE fecha_ejecucion BETWEEN $1 AND $2
          GROUP BY estado
          ORDER BY estado
        `;
        break;

      case 'casillas_por_vencer':
        detailsQuery = `
          SELECT 
            nombre_yaml as nombre,
            'Activa' as valor
          FROM casillas 
          WHERE is_active = true
          LIMIT 5
        `;
        break;

      case 'archivos_pendientes':
        detailsQuery = `
          SELECT 
            nombre_yaml as nombre,
            TO_CHAR(fecha_ejecucion, 'DD/MM/YYYY HH24:MI') as valor
          FROM ejecuciones_yaml
          WHERE estado = 'Pendiente'
          AND fecha_ejecucion BETWEEN $1 AND $2
          ORDER BY fecha_ejecucion DESC
        `;
        break;

      default:
        return res.status(400).json({ message: 'Métrica no válida' });
    }

    const client = await pool.connect();
    try {
      const detailsResult = await client.query(detailsQuery, params);
      res.json({ details: detailsResult.rows });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in dashboard details:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
