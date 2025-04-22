import { pool } from '../../../../../utils/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID de casilla inválido' });
  }

  const casillaId = parseInt(id);

  try {
    const conn = pool;
    const query = `
      SELECT * FROM materializaciones 
      WHERE casilla_id = $1
      ORDER BY id ASC
    `;
    
    const { rows } = await conn.query(query, [casillaId]);
    
    // Transformar la configuración de JSONB a objeto JavaScript
    const materializaciones = rows.map(row => ({
      ...row,
      configuracion: row.configuracion || {}
    }));
    
    return res.status(200).json(materializaciones);
  } catch (error) {
    console.error('Error al obtener materializaciones:', error);
    return res.status(500).json({ message: 'Error al obtener materializaciones', error: error.message });
  }
}