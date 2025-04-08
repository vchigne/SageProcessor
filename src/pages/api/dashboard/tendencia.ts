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
    const { from, to, intervalType = 'day' } = req.query;
    let dateFormat = "'DD/MM/YYYY'";
    let intervalSql = "day";
    
    // Ajustar el formato e intervalo según el tipo solicitado
    if (intervalType === 'week') {
      dateFormat = "'WW/YYYY'";
      intervalSql = "week";
    } else if (intervalType === 'month') {
      dateFormat = "'MM/YYYY'";
      intervalSql = "month";
    }

    const query = `
      WITH dates AS (
        SELECT 
          date_trunc('${intervalSql}', generate_series($1::timestamp, $2::timestamp, '1 ${intervalSql}'::interval)) AS date
      ),
      estados_totales AS (
        SELECT 
          date_trunc('${intervalSql}', fecha_ejecucion) AS date,
          COUNT(*) AS total,
          COUNT(CASE WHEN estado = 'Éxito' THEN 1 END) AS exito,
          COUNT(CASE WHEN estado = 'Error' THEN 1 END) AS error,
          COUNT(CASE WHEN estado = 'Pendiente' THEN 1 END) AS pendiente
        FROM 
          ejecuciones_yaml
        WHERE 
          fecha_ejecucion BETWEEN $1 AND $2
        GROUP BY 
          date_trunc('${intervalSql}', fecha_ejecucion)
      )
      SELECT 
        to_char(d.date, ${dateFormat}) AS periodo,
        COALESCE(e.total, 0) AS total,
        COALESCE(e.exito, 0) AS exito,
        COALESCE(e.error, 0) AS error,
        COALESCE(e.pendiente, 0) AS pendiente
      FROM 
        dates d
        LEFT JOIN estados_totales e ON d.date = e.date
      ORDER BY 
        d.date ASC;
    `;

    const result = await pool.query(query, [from, to]);

    // Devolver los datos de tendencia
    res.status(200).json({
      tendencia: result.rows
    });
  } catch (error) {
    console.error('Error obteniendo tendencia de ejecuciones:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}