import { pool } from '../../../utils/db';

export default async function handler(req, res) {
  try {
    const conn = pool;
    
    // Consulta para obtener estadísticas reales
    const query = `
      SELECT
        COUNT(*) AS archivos_procesados,
        (SELECT COUNT(*) FROM ejecuciones_yaml WHERE estado = 'exito') AS archivos_exitosos,
        (SELECT COUNT(*) FROM ejecuciones_yaml WHERE estado IN ('pendiente', 'en_proceso')) AS archivos_pendientes,
        (SELECT COUNT(*) FROM casillas WHERE fecha_vencimiento < NOW() + INTERVAL '30 days') AS casillas_por_vencer
      FROM 
        ejecuciones_yaml
    `;
    
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
      }
    });
  }
}