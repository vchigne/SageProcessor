import { pool } from '../../../utils/db';

export default async function handler(req, res) {
  try {
    const conn = pool;
    
    // Obtener parámetros de filtro de fecha
    const { fechaInicio, fechaFin, dias = '7' } = req.query;
    
    let whereClause;
    if (fechaInicio && fechaFin) {
      whereClause = `WHERE fecha_ejecucion BETWEEN '${fechaInicio}' AND '${fechaFin}'`;
    } else {
      // Usar el número de días proporcionado o predeterminado a 7
      whereClause = `WHERE fecha_ejecucion > NOW() - INTERVAL '${parseInt(dias)} days'`;
    }
    
    // Consulta para obtener la tendencia de procesamiento por día
    const query = `
      SELECT 
        TO_CHAR(DATE_TRUNC('day', fecha_ejecucion), 'DD/MM') as fecha,
        COUNT(*) as procesados,
        COUNT(CASE WHEN estado = 'Éxito' THEN 1 END) as exitosos,
        COUNT(CASE WHEN estado = 'Parcial' THEN 1 END) as parciales,
        COUNT(CASE WHEN estado = 'Fallido' THEN 1 END) as fallidos
      FROM 
        ejecuciones_yaml
      ${whereClause}
      GROUP BY 
        DATE_TRUNC('day', fecha_ejecucion)
      ORDER BY 
        DATE_TRUNC('day', fecha_ejecucion)
    `;
    
    console.log('Consulta de tendencia:', query);
    
    const result = await conn.query(query);
    
    // Formatear los datos para el gráfico incluyendo parciales y fallidos
    const datos = result.rows.map(row => ({
      fecha: row.fecha,
      procesados: parseInt(row.procesados) || 0,
      exitosos: parseInt(row.exitosos) || 0,
      parciales: parseInt(row.parciales) || 0,
      fallidos: parseInt(row.fallidos) || 0
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
          TO_CHAR(MIN(fecha_ejecucion), 'YYYY-MM-DD') as fecha_min, 
          TO_CHAR(MAX(fecha_ejecucion), 'YYYY-MM-DD') as fecha_max 
        FROM ejecuciones_yaml
      `);
      
      // Mostrar algunos registros para diagnóstico
      const muestraResult = await conn.query(`
        SELECT id, nombre_yaml, estado, TO_CHAR(fecha_ejecucion, 'YYYY-MM-DD HH24:MI:SS') as fecha
        FROM ejecuciones_yaml 
        ORDER BY fecha_ejecucion DESC
        LIMIT 5
      `);
      
      const diagnostico = {
        total_registros: totalRegistros,
        rango_fechas: fechasResult.rows[0],
        registros_encontrados: datos.length,
        dias_solicitados: parseInt(dias),
        muestra_registros: muestraResult.rows
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