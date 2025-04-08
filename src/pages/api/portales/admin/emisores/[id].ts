import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { 
    method,
    query: { id }
  } = req;

  if (!id) {
    return res.status(400).json({ error: 'ID de la casilla es obligatorio' });
  }

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }

  try {
    // En el contexto administrativo, obtenemos todos los emisores activos sin filtrar por organización
    const query = `
      SELECT 
        e.id, 
        e.nombre,
        e.activo
      FROM 
        emisores e
      WHERE
        e.activo = true
      ORDER BY 
        e.nombre
    `;

    const result = await pool.query(query);
    
    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('Error al obtener emisores:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}