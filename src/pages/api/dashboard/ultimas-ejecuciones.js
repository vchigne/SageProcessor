import { pool } from '../../../utils/db';

export default async function handler(req, res) {
  try {
    const conn = pool;
    
    // Consulta para obtener las últimas ejecuciones agrupadas por estado
    const query = `
      SELECT 
        estado,
        COUNT(*) as cantidad
      FROM 
        yaml_executions
      WHERE 
        fecha_inicio > NOW() - INTERVAL '30 days'
      GROUP BY 
        estado
      ORDER BY 
        cantidad DESC
    `;
    
    const result = await conn.query(query);
    
    // Formatear los datos para el gráfico de donut
    const datos = result.rows.map(row => ({
      estado: row.estado || 'desconocido',
      cantidad: parseInt(row.cantidad) || 0
    }));

    // Si no hay datos, agregar algunos valores por defecto para evitar el mensaje "No data"
    if (datos.length === 0) {
      datos.push(
        { estado: 'exito', cantidad: 0 },
        { estado: 'error', cantidad: 0 },
        { estado: 'pendiente', cantidad: 0 }
      );
    }

    res.status(200).json({ datos });
  } catch (error) {
    console.error('Error al obtener últimas ejecuciones del dashboard:', error);
    
    // En caso de error, devolver algunos valores por defecto para evitar el mensaje "No data"
    res.status(200).json({ 
      datos: [
        { estado: 'exito', cantidad: 0 },
        { estado: 'error', cantidad: 0 },
        { estado: 'pendiente', cantidad: 0 }
      ] 
    });
  }
}