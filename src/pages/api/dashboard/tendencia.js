import { pool } from '../../../utils/db';

export default async function handler(req, res) {
  try {
    const conn = pool;
    
    // Obtener parámetros de filtro de fecha
    const { fechaInicio, fechaFin, dias = '7' } = req.query;
    
    let whereClause;
    if (fechaInicio && fechaFin) {
      whereClause = `WHERE fecha_inicio BETWEEN '${fechaInicio}' AND '${fechaFin}'`;
    } else {
      // Usar el número de días proporcionado o predeterminado a 7
      whereClause = `WHERE fecha_inicio > NOW() - INTERVAL '${parseInt(dias)} days'`;
    }
    
    // Consulta para obtener la tendencia de procesamiento por día
    const query = `
      SELECT 
        TO_CHAR(DATE_TRUNC('day', fecha_inicio), 'DD/MM') as fecha,
        COUNT(*) as procesados,
        COUNT(CASE WHEN estado = 'exito' THEN 1 END) as exitosos
      FROM 
        ejecuciones_yaml
      ${whereClause}
      GROUP BY 
        DATE_TRUNC('day', fecha_inicio)
      ORDER BY 
        DATE_TRUNC('day', fecha_inicio)
    `;
    
    console.log('Consulta de tendencia:', query);
    
    const result = await conn.query(query);
    
    // Formatear los datos para el gráfico
    const datos = result.rows.map(row => ({
      fecha: row.fecha,
      procesados: parseInt(row.procesados) || 0,
      exitosos: parseInt(row.exitosos) || 0
    }));

    // Agregar información de diagnóstico
    const incluirDiagnostico = req.query.diagnostico === 'true';
    if (incluirDiagnostico) {
      // Verificar si hay registros en la tabla
      const countResult = await conn.query('SELECT COUNT(*) FROM ejecuciones_yaml');
      const totalRegistros = parseInt(countResult.rows[0].count);
      
      // Obtener el rango de fechas disponible
      const fechasResult = await conn.query(`
        SELECT 
          TO_CHAR(MIN(fecha_inicio), 'YYYY-MM-DD') as fecha_min, 
          TO_CHAR(MAX(fecha_inicio), 'YYYY-MM-DD') as fecha_max 
        FROM ejecuciones_yaml
      `);
      
      const diagnostico = {
        total_registros: totalRegistros,
        rango_fechas: fechasResult.rows[0],
        registros_encontrados: datos.length,
        dias_solicitados: parseInt(dias)
      };
      
      res.status(200).json({ datos, diagnostico });
      return;
    }

    res.status(200).json({ datos });
  } catch (error) {
    console.error('Error al obtener tendencia del dashboard:', error);
    
    // En caso de error, devolver un array vacío para evitar ruptura del dashboard
    res.status(200).json({ 
      datos: [],
      error: error.message
    });
  }
}