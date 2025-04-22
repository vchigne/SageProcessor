import { query } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user.isAdmin) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  switch (req.method) {
    case 'GET':
      try {
        const dbConnections = await query(`
          SELECT dc.id, dc.nombre, dc.descripcion, dc.base_datos, dc.esquema, 
                 dc.estado_conexion, dc.ultimo_test, dc.activo, dc.secret_id,
                 ds.nombre AS secret_nombre
          FROM database_connections dc
          JOIN db_secrets ds ON dc.secret_id = ds.id
          ORDER BY dc.nombre ASC
        `);
        
        return res.status(200).json(dbConnections);
      } catch (error) {
        console.error('Error al obtener conexiones:', error);
        return res.status(500).json({ message: 'Error al obtener las conexiones a bases de datos' });
      }
      
    case 'POST':
      try {
        const { nombre, descripcion, secret_id, base_datos, esquema, configuracion, activo } = req.body;
        
        if (!nombre || !secret_id || !base_datos) {
          return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        
        // Verificar que el secreto existe
        const secrets = await query(`SELECT id FROM db_secrets WHERE id = $1`, [secret_id]);
        if (secrets.length === 0) {
          return res.status(404).json({ message: 'El secreto seleccionado no existe' });
        }
        
        // Crear la conexión
        const result = await query(`
          INSERT INTO database_connections (
            nombre, descripcion, secret_id, base_datos, esquema, 
            configuracion, estado_conexion, activo
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          nombre, 
          descripcion, 
          secret_id, 
          base_datos, 
          esquema || null, 
          configuracion ? JSON.stringify(configuracion) : '{}',
          'pendiente',
          activo !== false
        ]);
        
        return res.status(201).json({ id: result[0].id, message: 'Conexión creada correctamente' });
      } catch (error) {
        console.error('Error al crear conexión:', error);
        return res.status(500).json({ message: 'Error al crear la conexión a base de datos' });
      }
      
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}