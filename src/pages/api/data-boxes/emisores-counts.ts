import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

type EmisoresCount = {
  casilla_id: number;
  emisores_count: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EmisoresCount[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('Consultando conteo de emisores para todas las casillas...');
    
    // Utilizamos la tabla emisores_por_casilla (anteriormente metodos_envio_emisor)
    // para contar cuántos emisores están asociados a cada casilla
    const query = `
      SELECT 
        c.id as casilla_id, 
        COALESCE(epc.emisores_count, 0) as emisores_count
      FROM 
        casillas c
      LEFT JOIN (
        SELECT 
          casilla_id, 
          COUNT(*) as emisores_count
        FROM 
          emisores_por_casilla
        GROUP BY 
          casilla_id
      ) epc ON c.id = epc.casilla_id
      WHERE 
        c.is_active = true
    `;
    
    const result = await pool.query(query);
    console.log('Resultados obtenidos:', result.rows);
    
    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('Error al obtener conteo de emisores:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor'
    });
  }
}