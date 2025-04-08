import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Endpoint para obtener el historial de envíos y el estado de retraso
 * basado en la frecuencia configurada para cada responsable
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Obtener los parámetros de la solicitud
    const { casilla_id, emisor_id } = req.query;

    // Validar que casilla_id o emisor_id existe
    if (!casilla_id && !emisor_id) {
      return res.status(400).json({ error: 'Se requiere al menos casilla_id o emisor_id' });
    }

    // Construir la consulta base
    let query = `
      WITH ultimos_envios AS (
        SELECT 
          e.casilla_id,
          e.emisor_id,
          c.nombre_yaml AS nombre_casilla,
          em.nombre AS nombre_emisor,
          e.fecha_ejecucion,
          e.estado,
          er.id AS responsable_id,
          er.responsable_nombre,
          er.configuracion_frecuencia
        FROM 
          ejecuciones_yaml e
        INNER JOIN 
          casillas c ON e.casilla_id = c.id
        LEFT JOIN 
          emisores em ON e.emisor_id = em.id
        LEFT JOIN 
          emisores_por_casilla er ON e.emisor_id = er.emisor_id AND e.casilla_id = er.casilla_id
        WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Agregar filtros si se proporcionan
    if (casilla_id) {
      query += ` AND e.casilla_id = $${paramIndex}`;
      queryParams.push(casilla_id);
      paramIndex++;
    }

    if (emisor_id) {
      query += ` AND e.emisor_id = $${paramIndex}`;
      queryParams.push(emisor_id);
      paramIndex++;
    }

    // Completar la consulta para obtener los últimos envíos
    query += `
        ORDER BY e.fecha_ejecucion DESC
      )
      SELECT 
        casilla_id,
        emisor_id,
        nombre_casilla,
        nombre_emisor,
        responsable_id,
        responsable_nombre,
        fecha_ejecucion,
        estado,
        configuracion_frecuencia,
        EXTRACT(EPOCH FROM (NOW() - fecha_ejecucion))/3600 AS horas_desde_ultimo_envio
      FROM ultimos_envios
      GROUP BY 
        casilla_id, 
        emisor_id, 
        nombre_casilla, 
        nombre_emisor, 
        responsable_id,
        responsable_nombre,
        fecha_ejecucion,
        estado,
        configuracion_frecuencia
    `;

    // Ejecutar la consulta
    const client = await pool.connect();
    try {
      const result = await client.query(query, queryParams);
      
      // Procesar los datos para determinar retrasos
      const enviosConEstadoRetraso = result.rows.map(envio => {
        let configuracionFrecuencia = null;
        try {
          if (envio.configuracion_frecuencia) {
            configuracionFrecuencia = JSON.parse(envio.configuracion_frecuencia);
          }
        } catch (e) {
          console.error('Error al parsear configuración de frecuencia:', e);
        }

        // Calcular tiempo máximo permitido según la frecuencia
        let tiempoMaximoHoras = 24; // Por defecto 1 día
        let estadoRetraso = false;
        let tiempoRetrasoHoras = 0;
        
        if (configuracionFrecuencia) {
          switch (configuracionFrecuencia.tipo?.toLowerCase()) {
            case 'diaria':
              tiempoMaximoHoras = 24;
              break;
            case 'semanal':
              tiempoMaximoHoras = 24 * 7;
              break;
            case 'mensual':
              tiempoMaximoHoras = 24 * 30;
              break;
            default:
              tiempoMaximoHoras = 24;
          }
        }
        
        // Verificar si hay retraso
        if (envio.horas_desde_ultimo_envio > tiempoMaximoHoras) {
          estadoRetraso = true;
          tiempoRetrasoHoras = envio.horas_desde_ultimo_envio - tiempoMaximoHoras;
        }
        
        return {
          ...envio,
          tiempoMaximoHoras,
          estadoRetraso,
          tiempoRetrasoHoras
        };
      });
      
      // Obtener historial completo de envíos para cada casilla/emisor
      const historialQuery = `
        SELECT 
          e.casilla_id,
          e.emisor_id,
          c.nombre_yaml AS nombre_casilla,
          em.nombre AS nombre_emisor,
          e.fecha_ejecucion,
          e.estado,
          e.errores_detectados,
          e.warnings_detectados,
          e.metodo_envio
        FROM 
          ejecuciones_yaml e
        INNER JOIN 
          casillas c ON e.casilla_id = c.id
        LEFT JOIN 
          emisores em ON e.emisor_id = em.id
        WHERE 1=1
      `;
      
      let historialQueryParams = [...queryParams];
      let historialParamIndex = paramIndex;
      
      // Construir una nueva consulta para el historial con parámetros directamente
      let historialQueryFinal = historialQuery;
      let historialParams = [];
      let historialIndex = 1;
      
      if (casilla_id) {
        historialQueryFinal += ` AND e.casilla_id = $${historialIndex}`;
        historialParams.push(casilla_id);
        historialIndex++;
      }
      
      if (emisor_id) {
        historialQueryFinal += ` AND e.emisor_id = $${historialIndex}`;
        historialParams.push(emisor_id);
        historialIndex++;
      }
      
      historialQueryFinal += ` ORDER BY e.fecha_ejecucion DESC LIMIT 10`;
      
      const historialResult = await client.query(historialQueryFinal, historialParams);
      
      return res.status(200).json({
        envios: enviosConEstadoRetraso,
        historial: historialResult.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al obtener el historial de envíos:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}