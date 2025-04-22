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
      SELECT c.*, 
        i.nombre AS nombre_instalacion,
        o.nombre AS nombre_organizacion,
        p.nombre AS nombre_producto,
        pais.nombre AS nombre_pais
      FROM casillas c
      LEFT JOIN instalaciones i ON c.instalacion_id = i.id
      LEFT JOIN organizaciones o ON i.organizacion_id = o.id
      LEFT JOIN productos p ON i.producto_id = p.id
      LEFT JOIN paises pais ON i.pais_id = pais.id
      WHERE c.id = $1
    `;
    
    const { rows } = await conn.query(query, [casillaId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Casilla no encontrada' });
    }
    
    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error al obtener casilla:', error);
    return res.status(500).json({ message: 'Error al obtener casilla', error: error.message });
  }
}