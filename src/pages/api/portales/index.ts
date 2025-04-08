import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const result = await pool.query(`
          SELECT 
            p.id,
            p.uuid,
            p.nombre,
            p.creado_en,
            p.activo,
            p.ultimo_acceso,
            p.instalacion_id,
            i.organizacion_id,
            o.nombre as organizacion_nombre,
            prod.nombre as producto_nombre
          FROM portales p
          JOIN instalaciones i ON p.instalacion_id = i.id
          JOIN organizaciones o ON i.organizacion_id = o.id
          JOIN productos prod ON i.producto_id = prod.id
          ORDER BY p.creado_en DESC
        `);

        const portales = result.rows.map(row => ({
          id: row.id,
          uuid: row.uuid,
          nombre: row.nombre,
          creado_en: row.creado_en,
          activo: row.activo,
          ultimo_acceso: row.ultimo_acceso,
          instalacion: {
            id: row.instalacion_id,
            organizacion: {
              nombre: row.organizacion_nombre
            },
            producto: {
              nombre: row.producto_nombre
            }
          }
        }));

        return res.status(200).json(portales);

      case 'POST':
        const { nombre, instalacion_id } = req.body;

        if (!nombre || !instalacion_id) {
          return res.status(400).json({
            error: 'Nombre e instalación son requeridos'
          });
        }

        const newPortal = await pool.query(
          'INSERT INTO portales (nombre, instalacion_id) VALUES ($1, $2) RETURNING *',
          [nombre, instalacion_id]
        );

        return res.status(201).json(newPortal.rows[0]);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in portales API:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}