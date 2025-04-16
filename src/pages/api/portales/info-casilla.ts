import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

type InfoCasillaResponse = {
  casilla_nombre: string;
  emisor_nombre: string | null;
  yaml_nombre: string;
  yaml_descripcion: string | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InfoCasillaResponse | { error: string }>
) {
  const { casilla_id, emisor_id } = req.query;

  // Validación de parámetros
  if (!casilla_id || isNaN(Number(casilla_id))) {
    return res.status(400).json({ error: 'Se requiere un ID de casilla válido' });
  }

  try {
    console.log(`Consultando información de la casilla ${casilla_id} ${emisor_id ? `y emisor ${emisor_id}` : ''}`);

    // Consulta SQL para obtener la información del YAML y la casilla
    let query = `
      SELECT 
        cr.nombre_yaml AS casilla_nombre,
        e.nombre AS emisor_nombre,
        cr.nombre_yaml AS yaml_nombre,
        cr.descripcion AS yaml_descripcion
      FROM casillas cr
      LEFT JOIN emisores e ON e.id = $2
      WHERE cr.id = $1
    `;

    // Si no hay emisor_id, usamos NULL
    const emisorIdParam = emisor_id && !isNaN(Number(emisor_id)) ? Number(emisor_id) : null;
    
    const result = await pool.query(query, [Number(casilla_id), emisorIdParam]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró información para la casilla especificada' });
    }

    // Devolver la información
    const infoResponse: InfoCasillaResponse = {
      casilla_nombre: result.rows[0].casilla_nombre,
      emisor_nombre: result.rows[0].emisor_nombre,
      yaml_nombre: result.rows[0].yaml_nombre || '',
      yaml_descripcion: result.rows[0].yaml_descripcion || null
    };

    console.log('Información de la casilla obtenida:', infoResponse);
    
    res.status(200).json(infoResponse);
  } catch (error) {
    console.error('Error al obtener información de la casilla:', error);
    res.status(500).json({ error: 'Error al obtener información de la casilla' });
  }
}