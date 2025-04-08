import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

type TipoFrecuencia = {
  id: number;
  nombre: string;
  descripcion: string | null;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query<TipoFrecuencia>(
          `SELECT id, nombre, descripcion FROM frecuencias_tipos ORDER BY nombre`
        );
        res.status(200).json(result.rows);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Error en conexión a base de datos:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}