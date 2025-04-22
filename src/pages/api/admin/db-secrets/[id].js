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
    return res.status(400).json({ message: 'ID inválido' });
  }

  switch (req.method) {
    case 'GET':
      try {
        const dbSecret = await query(`
          SELECT id, nombre, descripcion, tipo_servidor, credenciales, activo, creado_en, modificado_en
          FROM db_secrets
          WHERE id = $1
        `, [id]);
        
        if (dbSecret.length === 0) {
          return res.status(404).json({ message: 'Secreto no encontrado' });
        }
        
        return res.status(200).json(dbSecret[0]);
      } catch (error) {
        console.error('Error al obtener secreto:', error);
        return res.status(500).json({ message: 'Error al obtener el secreto de base de datos' });
      }
      
    case 'PUT':
      try {
        const { nombre, descripcion, tipo_servidor, credenciales, activo } = req.body;
        
        if (!nombre || !tipo_servidor) {
          return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        
        // Validación del tipo de servidor
        const tiposValidos = ['postgresql', 'mysql', 'sqlserver', 'duckdb'];
        if (!tiposValidos.includes(tipo_servidor)) {
          return res.status(400).json({ message: 'Tipo de servidor no válido' });
        }
        
        let queryStr, params;
        
        // Si se proporcionan credenciales, actualizarlas también
        if (credenciales) {
          queryStr = `
            UPDATE db_secrets 
            SET nombre = $1, descripcion = $2, tipo_servidor = $3, 
                credenciales = $4, activo = $5, modificado_en = CURRENT_TIMESTAMP
            WHERE id = $6
            RETURNING id
          `;
          params = [nombre, descripcion, tipo_servidor, JSON.stringify(credenciales), activo !== false, id];
        } else {
          // Si no se proporcionan credenciales, mantener las existentes
          queryStr = `
            UPDATE db_secrets 
            SET nombre = $1, descripcion = $2, tipo_servidor = $3, 
                activo = $4, modificado_en = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING id
          `;
          params = [nombre, descripcion, tipo_servidor, activo !== false, id];
        }
        
        const result = await query(queryStr, params);
        
        if (result.length === 0) {
          return res.status(404).json({ message: 'Secreto no encontrado' });
        }
        
        return res.status(200).json({ id: result[0].id, message: 'Secreto actualizado correctamente' });
      } catch (error) {
        console.error('Error al actualizar secreto:', error);
        return res.status(500).json({ message: 'Error al actualizar el secreto de base de datos' });
      }
      
    case 'DELETE':
      try {
        // Primero, verificar si hay conexiones que dependan de este secreto
        const connections = await query(`
          SELECT COUNT(*) as count
          FROM database_connections
          WHERE secret_id = $1
        `, [id]);
        
        if (connections[0].count > 0) {
          return res.status(400).json({ 
            message: `No se puede eliminar el secreto porque hay ${connections[0].count} conexiones que dependen de él` 
          });
        }
        
        const result = await query(`
          DELETE FROM db_secrets
          WHERE id = $1
          RETURNING id
        `, [id]);
        
        if (result.length === 0) {
          return res.status(404).json({ message: 'Secreto no encontrado' });
        }
        
        return res.status(200).json({ message: 'Secreto eliminado correctamente' });
      } catch (error) {
        console.error('Error al eliminar secreto:', error);
        return res.status(500).json({ message: 'Error al eliminar el secreto de base de datos' });
      }
      
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}