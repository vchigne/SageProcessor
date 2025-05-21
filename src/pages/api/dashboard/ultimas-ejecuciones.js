import { pool } from '../../../utils/db';

export default async function handler(req, res) {
  try {
    const conn = pool;
    
    // Obtener parámetros de filtro de fecha
    const { fechaInicio, fechaFin, dias = '30' } = req.query;
    
    let whereClause;
    if (fechaInicio && fechaFin) {
      whereClause = `WHERE fecha_ejecucion BETWEEN '${fechaInicio}' AND '${fechaFin}'`;
    } else {
      // Usar el número de días proporcionado o predeterminado a 30
      whereClause = `WHERE fecha_ejecucion > NOW() - INTERVAL '${parseInt(dias)} days'`;
    }
    
    // Consulta para obtener las últimas ejecuciones agrupadas por estado
    const query = `
      SELECT 
        estado,
        COUNT(*) as cantidad
      FROM 
        ejecuciones_yaml
      ${whereClause}
      GROUP BY 
        estado
      ORDER BY 
        cantidad DESC
    `;
    
    console.log('Consulta de últimas ejecuciones:', query);
    
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

    // Agregar información de diagnóstico
    const incluirDiagnostico = req.query.diagnostico === 'true';
    if (incluirDiagnostico) {
      // Verificar si hay registros en la tabla
      const countResult = await conn.query('SELECT COUNT(*) FROM ejecuciones_yaml');
      const totalRegistros = parseInt(countResult.rows[0].count);
      
      // Obtener todos los estados disponibles
      const estadosResult = await conn.query('SELECT DISTINCT estado FROM ejecuciones_yaml');
      const estados = estadosResult.rows.map(row => row.estado);
      
      // Obtener el rango de fechas disponible
      const fechasResult = await conn.query(`
        SELECT 
          TO_CHAR(MIN(fecha_ejecucion), 'YYYY-MM-DD') as fecha_min, 
          TO_CHAR(MAX(fecha_ejecucion), 'YYYY-MM-DD') as fecha_max 
        FROM ejecuciones_yaml
      `);
      
      // Consulta para listar todos los registros (limitado a 100 para diagnóstico)
      const registrosResult = await conn.query(`
        SELECT 
          id, 
          estado, 
          TO_CHAR(fecha_ejecucion, 'YYYY-MM-DD HH24:MI:SS') as fecha,
          casilla_id
        FROM 
          ejecuciones_yaml 
        ORDER BY 
          fecha_ejecucion DESC 
        LIMIT 100
      `);
      
      const diagnostico = {
        total_registros: totalRegistros,
        estados_disponibles: estados,
        rango_fechas: fechasResult.rows[0],
        ultimos_registros: registrosResult.rows,
        dias_solicitados: parseInt(dias)
      };
      
      res.status(200).json({ datos, diagnostico });
      return;
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
      ],
      error: error.message
    });
  }
}