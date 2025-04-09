import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

type SuscripcionesCount = {
  casilla_id: number;
  suscripciones_count: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuscripcionesCount[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const query = `
      SELECT casilla_id, COUNT(*) as suscripciones_count
      FROM suscripciones
      WHERE activo = true
      GROUP BY casilla_id
    `;
    
    const result = await pool.query(query);
    
    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('Error al obtener conteo de suscripciones:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor'
    });
  }
}