import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }
  
  try {
    // Consulta para obtener casillas sin configuración de email
    const query = `
      SELECT 
        cr.id, 
        cr.nombre,
        cr.nombre_yaml
      FROM 
        casillas cr
      WHERE 
        NOT EXISTS (
          SELECT 1 
          FROM email_configuraciones ec 
          WHERE ec.casilla_id = cr.id
        )
      ORDER BY 
        cr.nombre
    `;
    
    const result = await pool.query(query);
    
    return res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('Error al obtener casillas sin configurar:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}