import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }
  
  try {
    // Obtener parámetros de consulta para filtros
    const { busqueda, incluir_detalle } = req.query;
    
    // Query base para obtener información básica
    if (incluir_detalle === 'true') {
      // Query con información detallada de instalación y organización
      const query = `
        SELECT 
          c.id,
          c.nombre,
          c.descripcion,
          c.nombre_yaml,
          c.email_casilla,
          c.instalacion_id,
          c.is_active,
          c.yaml_contenido,
          o.nombre as organizacion,
          p.nombre as producto,
          pais.nombre as pais
        FROM 
          casillas c
        LEFT JOIN instalaciones i ON c.instalacion_id = i.id 
        LEFT JOIN organizaciones o ON i.organizacion_id = o.id
        LEFT JOIN productos p ON i.producto_id = p.id
        LEFT JOIN paises pais ON i.pais_id = pais.id
        ${busqueda ? `WHERE 
          c.nombre ILIKE $1 OR
          c.descripcion ILIKE $1 OR
          c.nombre_yaml ILIKE $1 OR 
          c.email_casilla ILIKE $1` : ''}
        ORDER BY COALESCE(c.nombre, c.nombre_yaml)
      `;
      
      const result = await pool.query(query, busqueda ? [`%${busqueda}%`] : []);
      return res.status(200).json(result.rows);
    } else {
      // Query simple para obtener solo información de la casilla
      let query = `
        SELECT 
          id, 
          nombre,
          descripcion,
          nombre_yaml,
          email_casilla,
          is_active,
          yaml_contenido
        FROM 
          casillas
      `;
      
      const queryParams: any[] = [];
      
      // Aplicar filtro de búsqueda si existe
      if (busqueda) {
        query += ` WHERE 
          nombre ILIKE $1 OR
          descripcion ILIKE $1 OR
          nombre_yaml ILIKE $1 OR 
          email_casilla ILIKE $1
        `;
        queryParams.push(`%${busqueda}%`);
      }
      
      // Ordenar por nombre (o nombre_yaml si nombre es nulo)
      query += ' ORDER BY COALESCE(nombre, nombre_yaml)';
      
      const result = await pool.query(query, queryParams);
      return res.status(200).json(result.rows);
    }
  } catch (error: any) {
    console.error('Error al obtener casillas:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}