import { pool } from '../../../utils/db';

export default async function handler(req, res) {
  try {
    const conn = pool;
    
    // Obtener parámetros de filtro de fecha
    const { fechaInicio, fechaFin } = req.query;
    const whereClause = fechaInicio && fechaFin ? 
      `WHERE fecha_ejecucion BETWEEN '${fechaInicio}' AND '${fechaFin}'` : 
      '';
    
    // Generar cláusulas WHERE para subqueries
    const whereExito = fechaInicio && fechaFin ? 
      `WHERE estado = 'Éxito' AND fecha_ejecucion BETWEEN '${fechaInicio}' AND '${fechaFin}'` : 
      `WHERE estado = 'Éxito'`;
      
    const wherePendientes = fechaInicio && fechaFin ? 
      `WHERE estado IN ('pendiente', 'en_proceso') AND fecha_ejecucion BETWEEN '${fechaInicio}' AND '${fechaFin}'` : 
      `WHERE estado IN ('pendiente', 'en_proceso')`;
    
    // Consulta para obtener estadísticas solo de los últimos 30 días para mantener consistencia con otros gráficos
    const diasClause = `WHERE fecha_ejecucion > NOW() - INTERVAL '30 days'`;
    
    const query = `
      SELECT
        COUNT(*) AS archivos_procesados,
        COUNT(CASE WHEN estado = 'Éxito' THEN 1 END) AS archivos_exitosos,
        COUNT(CASE WHEN estado IN ('pendiente', 'en_proceso') THEN 1 END) AS archivos_pendientes,
        COUNT(CASE WHEN estado = 'Fallido' THEN 1 END) AS archivos_fallidos
      FROM 
        ejecuciones_yaml
        ${fechaInicio && fechaFin ? whereClause : diasClause}
    `;
    
    console.log('Consulta de estadísticas:', query);
    
    const result = await conn.query(query);
    
    // Calcular tasa de éxito
    let tasa_exito = 0;
    if (result.rows[0].archivos_procesados > 0) {
      tasa_exito = Math.round((result.rows[0].archivos_exitosos / result.rows[0].archivos_procesados) * 100);
    }
    
    const stats = {
      archivos_procesados: parseInt(result.rows[0].archivos_procesados) || 0,
      tasa_exito: tasa_exito || 0,
      archivos_pendientes: parseInt(result.rows[0].archivos_pendientes) || 0,
      casillas_por_vencer: parseInt(result.rows[0].casillas_por_vencer) || 0
    };

    // Agregar información de diagnóstico
    const incluirDiagnostico = req.query.diagnostico === 'true';
    if (incluirDiagnostico) {
      // Verificar si hay algún registro en la tabla
      const countResult = await conn.query('SELECT COUNT(*) FROM ejecuciones_yaml');
      const totalRegistros = parseInt(countResult.rows[0].count);
      
      // Obtener los estados disponibles
      const estadosResult = await conn.query('SELECT DISTINCT estado FROM ejecuciones_yaml');
      const estados = estadosResult.rows.map(row => row.estado);
      
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
        estados_disponibles: estados,
        rango_fechas: fechasResult.rows[0],
        muestra_registros: muestraResult.rows
      };
      
      res.status(200).json({ stats, diagnostico });
      return;
    }

    res.status(200).json({ stats });
  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    
    // En caso de error, devolver estadísticas en cero para evitar ruptura del dashboard
    res.status(200).json({ 
      stats: {
        archivos_procesados: 0,
        tasa_exito: 0,
        archivos_pendientes: 0,
        casillas_por_vencer: 0
      },
      error: error.message
    });
  }
}