import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { uuid } = req.query;

  if (!uuid) {
    return res.status(400).json({ error: 'UUID es requerido' });
  }

  try {
    switch (method) {
      case 'GET':
        // Primero verificamos si el portal existe, independientemente de su estado
        const checkResult = await pool.query(`
          SELECT 
            p.id,
            p.uuid,
            p.nombre,
            p.creado_en,
            p.activo,
            p.ultimo_acceso,
            p.instalacion_id,
            o.id as organizacion_id,
            o.nombre as organizacion_nombre,
            prod.nombre as producto_nombre
          FROM portales p
          JOIN instalaciones i ON p.instalacion_id = i.id
          JOIN organizaciones o ON i.organizacion_id = o.id
          JOIN productos prod ON i.producto_id = prod.id
          WHERE p.uuid = $1
        `, [uuid]);

        if (checkResult.rows.length === 0) {
          return res.status(404).json({ error: 'Portal no encontrado' });
        }
        
        // Verificamos si el portal está activo
        if (!checkResult.rows[0].activo) {
          return res.status(403).json({ error: 'Portal inactivo' });
        }
        
        // Si llegamos aquí, el portal existe y está activo
        const result = checkResult;

        const portal = {
          id: result.rows[0].id,
          uuid: result.rows[0].uuid,
          nombre: result.rows[0].nombre,
          creado_en: result.rows[0].creado_en,
          activo: result.rows[0].activo,
          ultimo_acceso: result.rows[0].ultimo_acceso,
          instalacion: {
            id: result.rows[0].instalacion_id,
            organizacion: {
              nombre: result.rows[0].organizacion_nombre
            },
            producto: {
              nombre: result.rows[0].producto_nombre
            }
          }
        };

        return res.status(200).json(portal);

      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Error in portal API:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}