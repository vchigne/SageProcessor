import { pool } from '../../../utils/db';

export default async function handler(req, res) {
  try {
    const conn = pool;
    
    // Consulta para obtener la tendencia de procesamiento por día de los últimos 7 días
    const query = `
      SELECT 
        TO_CHAR(DATE_TRUNC('day', fecha_inicio), 'DD/MM') as fecha,
        COUNT(*) as procesados,
        COUNT(CASE WHEN estado = 'exito' THEN 1 END) as exitosos
      FROM 
        yaml_executions
      WHERE 
        fecha_inicio > NOW() - INTERVAL '7 days'
      GROUP BY 
        DATE_TRUNC('day', fecha_inicio)
      ORDER BY 
        DATE_TRUNC('day', fecha_inicio)
    `;
    
    const result = await conn.query(query);
    
    // Formatear los datos para el gráfico
    const datos = result.rows.map(row => ({
      fecha: row.fecha,
      procesados: parseInt(row.procesados) || 0,
      exitosos: parseInt(row.exitosos) || 0
    }));

    res.status(200).json({ datos });
  } catch (error) {
    console.error('Error al obtener tendencia del dashboard:', error);
    
    // En caso de error, devolver un array vacío para evitar ruptura del dashboard
    res.status(200).json({ datos: [] });
  }
}