import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    const client = await pool.connect();
    try {
      // Obtener el contenido YAML directamente de la casilla
      const result = await client.query(
        `SELECT nombre_yaml, yaml_contenido 
         FROM casillas
         WHERE id = $1 AND yaml_contenido IS NOT NULL`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'YAML content not found' });
      }

      res.status(200).json({ 
        nombre: result.rows[0].nombre_yaml,
        content: result.rows[0].yaml_contenido
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching YAML content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
