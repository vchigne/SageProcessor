import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import yaml from 'yaml';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Se requiere ID de casilla válido' });
  }

  try {
    // Obtener la información de la casilla
    const casillaQuery = `
      SELECT nombre, descripcion, nombre_yaml FROM casillas
      WHERE id = $1
    `;
    
    const casillaResult = await pool.query(casillaQuery, [id]);
    
    if (casillaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Casilla no encontrada' });
    }
    
    const { nombre, nombre_yaml } = casillaResult.rows[0];
    
    // Si tenemos un nombre definido, lo usamos directamente
    if (nombre) {
      return res.status(200).json({
        nombre: nombre,
        nombreArchivo: nombre_yaml || null
      });
    }
    
    // Si no hay nombre definido pero hay nombre_yaml, lo usamos como referencia
    if (nombre_yaml) {
      return res.status(200).json({ 
        nombre: `Configuración ${nombre_yaml}`,
        nombreArchivo: nombre_yaml 
      });
    }
    
    // Si no hay información disponible
    return res.status(200).json({ 
      nombre: 'Casilla sin configuración',
      nombreArchivo: null 
    });
  } catch (error) {
    console.error('Error al obtener nombre humano de casilla:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}