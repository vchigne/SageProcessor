import { pool } from '@/lib/db';

/**
 * API para obtener los destinos disponibles para materialización (nubes y bases de datos)
 */
export default async function handler(req, res) {
  switch (req.method) {
    case 'GET':
      return getDestinations(req, res);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

/**
 * Obtener los destinos disponibles para materialización
 */
async function getDestinations(req, res) {
  try {
    // Obtener proveedores de nube activos
    const cloudResult = await pool.query(`
      SELECT id, nombre, tipo, activo
      FROM cloud_providers
      WHERE activo = TRUE
      ORDER BY nombre
    `);
    
    // Obtener conexiones de base de datos
    const dbResult = await pool.query(`
      SELECT id, nombre, base_datos, activo
      FROM database_connections
      WHERE activo = TRUE
      ORDER BY nombre
    `);
    
    // Agrupar resultados
    const destinations = {
      clouds: cloudResult.rows,
      databases: dbResult.rows
    };
    
    return res.status(200).json(destinations);
  } catch (error) {
    console.error('Error al obtener destinos de materialización:', error);
    return res.status(500).json({ message: 'Error al obtener destinos de materialización' });
  }
}