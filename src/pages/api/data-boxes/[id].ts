import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { 
    method,
    query: { id }
  } = req;

  if (!id) {
    return res.status(400).json({ error: 'ID es obligatorio' });
  }

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }

  try {
    const query = `
      SELECT 
        c.id, 
        c.nombre_yaml,
        c.email_casilla,
        c.nombre,
        c.descripcion,
        c.yaml_contenido,
        o.nombre as organizacion,
        p.nombre as producto,
        pa.nombre as pais
      FROM 
        casillas c
      JOIN 
        instalaciones i ON c.instalacion_id = i.id
      JOIN 
        organizaciones o ON i.organizacion_id = o.id
      JOIN 
        productos p ON i.producto_id = p.id
      JOIN 
        paises pa ON i.pais_id = pa.id
      WHERE 
        c.id = $1
    `;

    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Casilla no encontrada' });
    }

    const casilla = result.rows[0];
    
    // Usar el nombre de la casilla o fallback al nombre del YAML
    const nombreHumano = casilla.nombre || casilla.nombre_yaml;
    
    return res.status(200).json({
      id: casilla.id,
      nombre_yaml: casilla.nombre_yaml,
      nombre_humano: nombreHumano,
      nombre: casilla.nombre,
      descripcion: casilla.descripcion,
      email_casilla: casilla.email_casilla,
      organizacion: casilla.organizacion,
      producto: casilla.producto,
      pais: casilla.pais,
      yaml_contenido: casilla.yaml_contenido
    });
  } catch (error: any) {
    console.error('Error al obtener detalles de la casilla:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}