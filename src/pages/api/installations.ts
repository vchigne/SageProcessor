import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT 
        i.id,
        i.organizacion_id,
        o.nombre as organizacion_nombre,
        p.nombre as producto_nombre,
        pa.nombre as pais_nombre
      FROM instalaciones i
      JOIN organizaciones o ON i.organizacion_id = o.id
      JOIN productos p ON i.producto_id = p.id
      JOIN paises pa ON i.pais_id = pa.id;
    `);
    client.release();

    const installations = result.rows.map(row => ({
      id: row.id,
      nombre: `${row.producto_nombre} - ${row.organizacion_nombre}`,
      organizacion: {
        id: row.organizacion_id,
        nombre: row.organizacion_nombre
      },
      producto: {
        nombre: row.producto_nombre
      },
      pais: {
        nombre: row.pais_nombre
      }
    }));

    res.status(200).json(installations);
  } catch (error) {
    console.error('Error fetching installations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
