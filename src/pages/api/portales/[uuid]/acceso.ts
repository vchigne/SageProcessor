import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { uuid } = req.query;

  if (method !== 'POST' && method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  try {
    // Primero verificamos si el portal existe
    const checkQuery = `
      SELECT id, uuid, nombre, activo, instalacion_id
      FROM portales 
      WHERE uuid = $1
    `;
    
    const checkResult = await pool.query(checkQuery, [uuid]);
    
    // Si no existe el portal
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Portal no encontrado' });
    }
    
    const portal = checkResult.rows[0];
    
    // Si el portal está inactivo
    if (!portal.activo) {
      return res.status(403).json({ error: 'Portal inactivo' });
    }
    
    // Si el portal existe y está activo, actualizamos la fecha de acceso
    await pool.query(
      'UPDATE portales SET ultimo_acceso = NOW() WHERE uuid = $1',
      [uuid]
    );
    
    if (method === 'GET') {
      // Para solicitudes GET, devolvemos la información del portal
      return res.status(200).json(portal);
    } else {
      // Para solicitudes POST (registrar acceso)
      return res.status(200).json({ success: true });
    }
  } catch (error: any) {
    console.error('Error updating portal access:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}
