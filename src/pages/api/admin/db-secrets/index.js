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
        const dbSecrets = await query(`
          SELECT id, nombre, descripcion, tipo, servidor, puerto, 
                 usuario, estado, ultimo_test, fecha_creacion
          FROM db_secrets
          ORDER BY nombre ASC
        `);
        
        return res.status(200).json(dbSecrets);
      } catch (error) {
        console.error('Error al obtener secretos:', error);
        return res.status(500).json({ message: 'Error al obtener los secretos de bases de datos' });
      }
      
    case 'POST':
      try {
        const { 
          nombre, 
          descripcion, 
          tipo, 
          servidor, 
          puerto, 
          usuario, 
          contrasena, 
          basedatos, 
          opciones_conexion, 
          activo 
        } = req.body;
        
        if (!nombre || !tipo || !servidor || !puerto || !usuario) {
          return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        
        // Crear el secreto
        const result = await query(`
          INSERT INTO db_secrets (
            nombre, descripcion, tipo, servidor, puerto, 
            usuario, contrasena, basedatos, opciones_conexion, estado
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          nombre, 
          descripcion, 
          tipo, 
          servidor, 
          puerto, 
          usuario, 
          contrasena, 
          basedatos || null, 
          opciones_conexion ? JSON.stringify(opciones_conexion) : '{}',
          activo !== false ? 'activo' : 'inactivo'
        ]);
        
        return res.status(201).json({ id: result[0].id, message: 'Secreto creado correctamente' });
      } catch (error) {
        console.error('Error al crear secreto:', error);
        return res.status(500).json({ message: 'Error al crear el secreto de base de datos' });
      }
      
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}