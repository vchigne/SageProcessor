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
    // Extraer parámetros de fecha
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const limite = req.query.limite ? parseInt(req.query.limite as string) : 10;

    // Consulta para obtener estadísticas por instalación y casilla
    const query = `
      WITH instalaciones_casillas AS (
        SELECT 
          i.id as instalacion_id,
          CONCAT(
            org.nombre, ' - ', 
            p.nombre, ' - ', 
            prod.nombre
          ) as instalacion_nombre,
          c.id as casilla_id,
          c.nombre_yaml as casilla_nombre,
          (
            SELECT COUNT(DISTINCT emisor_id) 
            FROM ejecuciones_yaml 
            WHERE casilla_id = c.id AND fecha_ejecucion BETWEEN $1 AND $2
          ) as cantidad_emisores,
          COUNT(e.id) as archivos_procesados,
          (
            SELECT estado 
            FROM ejecuciones_yaml 
            WHERE casilla_id = c.id 
            ORDER BY fecha_ejecucion DESC LIMIT 1
          ) as ultimo_estado,
          (
            SELECT fecha_ejecucion 
            FROM ejecuciones_yaml 
            WHERE casilla_id = c.id 
            ORDER BY fecha_ejecucion DESC LIMIT 1
          ) as ultima_ejecucion
        FROM 
          instalaciones i
          JOIN organizaciones org ON i.organizacion_id = org.id
          JOIN paises p ON i.pais_id = p.id
          JOIN productos prod ON i.producto_id = prod.id
          JOIN casillas c ON c.instalacion_id = i.id
          LEFT JOIN ejecuciones_yaml e ON e.casilla_id = c.id AND e.fecha_ejecucion BETWEEN $1 AND $2
        GROUP BY 
          i.id, org.nombre, p.nombre, prod.nombre, c.id, c.nombre_yaml
        ORDER BY 
          org.nombre, p.nombre, c.nombre_yaml
        LIMIT $3
      )
      SELECT 
        instalacion_id,
        instalacion_nombre,
        casilla_id,
        casilla_nombre,
        COALESCE(cantidad_emisores, 0) as cantidad_emisores,
        COALESCE(archivos_procesados, 0) as archivos_procesados,
        ultimo_estado,
        ultima_ejecucion
      FROM 
        instalaciones_casillas
    `;

    const result = await pool.query(query, [from, to, limite]);

    // Formatear y devolver los resultados
    res.status(200).json({
      instalaciones: result.rows.map(row => ({
        instalacion: {
          id: row.instalacion_id,
          nombre: row.instalacion_nombre
        },
        casilla: {
          id: row.casilla_id,
          nombre: row.casilla_nombre
        },
        cantidadEmisores: row.cantidad_emisores,
        archivosProc: row.archivos_procesados,
        ultimoEstado: row.ultimo_estado,
        ultimaEjecucion: row.ultima_ejecucion
      }))
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de instalaciones y casillas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}