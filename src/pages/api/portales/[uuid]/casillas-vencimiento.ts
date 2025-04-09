import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../../lib/db';

interface CasillaResponse {
  id: number;
  nombre: string;
  email: string | null;
  fecha_vencimiento: Date;
  dias_anticipacion: number;
  dias_restantes: number;
  responsable: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, query: { uuid } } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!uuid) {
    return res.status(400).json({ error: 'UUID is required' });
  }

  try {
    const portalResult = await pool.query(
      'SELECT id, instalacion_id FROM portales WHERE uuid = $1',
      [uuid]
    );

    if (portalResult.rows.length === 0) {
      return res.status(200).json([]); //No portal found, return empty array.
    }

    const portalId = portalResult.rows[0].id;
    const instalacionId = portalResult.rows[0].instalacion_id;


    // Luego buscamos las casillas de esa instalación y sus responsables desde emisores_por_casilla
    const result = await pool.query(`
      WITH portal_info AS (
        SELECT id 
        FROM portales 
        WHERE uuid = $1
      ),
      casillas_con_responsables AS (
        SELECT 
          cr.id,
          cr.nombre_yaml,
          cr.ultima_ejecucion,
          cr.email_casilla,
          p.id as instalacion_id,
          (
            SELECT me.responsable_nombre 
            FROM emisores_por_casilla me 
            WHERE me.casilla_id = cr.id 
            AND me.responsable_nombre IS NOT NULL
            AND me.responsable_activo = true
            LIMIT 1
          ) as responsable_nombre
        FROM portales p 
        JOIN casillas cr ON cr.instalacion_id = p.id
        WHERE p.uuid = $1 AND cr.is_active = true
      )
      SELECT 
        id,
        nombre_yaml as nombre,
        ultima_ejecucion as fecha_vencimiento,
        email_casilla as email,
        30 as dias_anticipacion,
        true as activo,
        instalacion_id,
        COALESCE(responsable_nombre, 'Sin asignar') as responsable_nombre
      FROM casillas_con_responsables
      ORDER BY ultima_ejecucion ASC
    `, [uuid]);

    console.log('Casillas result:', result.rows);

    if (result.rows.length === 0) {
      return res.status(200).json([]); 
    }

    const casillas = result.rows.map(row => ({
      id: row.id,
      nombre: row.nombre,
      email: row.email,
      instalacion: row.instalacion_id,
      fecha_vencimiento: row.fecha_vencimiento ? new Date(row.fecha_vencimiento) : new Date(),
      dias_anticipacion: 30,
      dias_restantes: 30,
      responsable: row.responsable_nombre
    }));

    return res.status(200).json(casillas);
  } catch (error: any) {
    console.error('Error fetching casillas:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}