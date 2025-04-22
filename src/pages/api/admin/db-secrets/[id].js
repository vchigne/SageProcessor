import { query } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user.isAdmin) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID de secreto inválido' });
  }

  const secretId = parseInt(id);

  switch (req.method) {
    case 'GET':
      try {
        const dbSecret = await query(`
          SELECT id, nombre, descripcion, tipo, servidor, puerto, 
                 usuario, basedatos, opciones_conexion, estado, ultimo_test, 
                 fecha_creacion, fecha_actualizacion
          FROM db_secrets
          WHERE id = $1
        `, [secretId]);
        
        if (dbSecret.length === 0) {
          return res.status(404).json({ message: 'Secreto no encontrado' });
        }

        // Por seguridad, no enviamos la contraseña al frontend
        const secret = dbSecret[0];
        
        // Deserializar opciones de conexión si es necesario
        if (secret.opciones_conexion) {
          try {
            if (typeof secret.opciones_conexion === 'string') {
              secret.opciones_conexion = JSON.parse(secret.opciones_conexion);
            }
          } catch (error) {
            console.error('Error al deserializar opciones:', error);
            // Mantener como cadena si hay error
          }
        }
        
        return res.status(200).json(secret);
      } catch (error) {
        console.error('Error al obtener secreto:', error);
        return res.status(500).json({ message: 'Error al obtener el secreto de base de datos' });
      }
      
    case 'PUT':
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
          estado 
        } = req.body;
        
        if (!nombre || !tipo || !servidor || !puerto || !usuario) {
          return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        
        // Verificar si el secreto existe
        const existingSecret = await query('SELECT id FROM db_secrets WHERE id = $1', [secretId]);
        if (existingSecret.length === 0) {
          return res.status(404).json({ message: 'Secreto no encontrado' });
        }
        
        // Preparar la consulta según si se actualiza la contraseña o no
        let queryText, queryParams;
        
        if (contrasena) {
          queryText = `
            UPDATE db_secrets SET
              nombre = $1, descripcion = $2, tipo = $3, 
              servidor = $4, puerto = $5, usuario = $6, 
              contrasena = $7, basedatos = $8, opciones_conexion = $9,
              estado = $10, fecha_actualizacion = NOW()
            WHERE id = $11
            RETURNING id
          `;
          queryParams = [
            nombre, 
            descripcion, 
            tipo, 
            servidor, 
            puerto, 
            usuario, 
            contrasena, 
            basedatos || null, 
            opciones_conexion ? JSON.stringify(opciones_conexion) : '{}',
            estado || 'activo',
            secretId
          ];
        } else {
          // No actualizar la contraseña si no se proporcionó
          queryText = `
            UPDATE db_secrets SET
              nombre = $1, descripcion = $2, tipo = $3, 
              servidor = $4, puerto = $5, usuario = $6, 
              basedatos = $7, opciones_conexion = $8,
              estado = $9, fecha_actualizacion = NOW()
            WHERE id = $10
            RETURNING id
          `;
          queryParams = [
            nombre, 
            descripcion, 
            tipo, 
            servidor, 
            puerto, 
            usuario, 
            basedatos || null, 
            opciones_conexion ? JSON.stringify(opciones_conexion) : '{}',
            estado || 'activo',
            secretId
          ];
        }
        
        const result = await query(queryText, queryParams);
        
        return res.status(200).json({ 
          id: result[0].id, 
          message: 'Secreto actualizado correctamente' 
        });
      } catch (error) {
        console.error('Error al actualizar secreto:', error);
        return res.status(500).json({ message: 'Error al actualizar el secreto de base de datos' });
      }
      
    case 'DELETE':
      try {
        // Verificar si el secreto existe
        const existingSecret = await query('SELECT id FROM db_secrets WHERE id = $1', [secretId]);
        if (existingSecret.length === 0) {
          return res.status(404).json({ message: 'Secreto no encontrado' });
        }
        
        // Verificar si el secreto está siendo utilizado en conexiones
        const usedConnections = await query(`
          SELECT id FROM database_connections WHERE secret_id = $1 LIMIT 1
        `, [secretId]);
        
        if (usedConnections.length > 0) {
          return res.status(400).json({ 
            message: 'No se puede eliminar este secreto porque está siendo utilizado en conexiones activas' 
          });
        }
        
        // Eliminar el secreto
        await query('DELETE FROM db_secrets WHERE id = $1', [secretId]);
        
        return res.status(200).json({ message: 'Secreto eliminado correctamente' });
      } catch (error) {
        console.error('Error al eliminar secreto:', error);
        return res.status(500).json({ message: 'Error al eliminar el secreto de base de datos' });
      }
      
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}