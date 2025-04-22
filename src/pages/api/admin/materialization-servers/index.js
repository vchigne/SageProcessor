import { query } from '@/lib/db';
import { Pool } from 'pg';

// Obtener la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend

  switch (req.method) {
    case 'GET':
      try {
        const servers = await query(`
          SELECT id, nombre, descripcion, tipo, endpoint, capacidad, 
                 estado, ultimo_test, fecha_creacion, fecha_actualizacion
          FROM materializacion_servidores
          ORDER BY nombre ASC
        `);
        
        return res.status(200).json(servers);
      } catch (error) {
        console.error('Error al obtener servidores:', error);
        return res.status(500).json({ message: 'Error al obtener los servidores de materialización' });
      }
      
    case 'POST':
      try {
        const { 
          nombre, 
          descripcion, 
          tipo, 
          endpoint, 
          capacidad, 
          api_key,
          configuracion, 
          activo 
        } = req.body;
        
        if (!nombre || !tipo || !endpoint) {
          return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        
        // Crear el servidor
        const result = await query(`
          INSERT INTO materializacion_servidores (
            nombre, descripcion, tipo, url, api_key, 
            capacidad, configuracion, estado
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          nombre, 
          descripcion, 
          tipo, 
          endpoint, 
          api_key, 
          capacidad || 10, 
          configuracion ? JSON.stringify(configuracion) : '{}',
          activo !== false ? 'pendiente' : 'inactivo'
        ]);
        
        return res.status(201).json({ id: result[0].id, message: 'Servidor creado correctamente' });
      } catch (error) {
        console.error('Error al crear servidor:', error);
        return res.status(500).json({ message: 'Error al crear el servidor de materialización' });
      }
      
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}