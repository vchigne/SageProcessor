import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { executeSQL } from '@/utils/db';

/**
 * API para gestionar un secreto de base de datos específico
 */
export default async function handler(req, res) {
  // Verificar autenticación
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
      return getDBSecret(req, res, id);
    case 'PUT':
      return updateDBSecret(req, res, id);
    case 'DELETE':
      return deleteDBSecret(req, res, id);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

/**
 * Obtener un secreto por ID
 */
async function getDBSecret(req, res, id) {
  try {
    const query = `
      SELECT 
        id, 
        nombre, 
        descripcion, 
        tipo_servidor, 
        configuracion, 
        activo,
        fecha_creacion,
        fecha_actualizacion
      FROM 
        materializacion_db_secrets
      WHERE 
        id = $1
    `;
    
    const result = await executeSQL(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener secreto de BD:', error);
    return res.status(500).json({ message: 'Error al obtener secreto de base de datos' });
  }
}

/**
 * Actualizar un secreto existente
 */
async function updateDBSecret(req, res, id) {
  try {
    const { nombre, descripcion, tipo_servidor, configuracion, activo } = req.body;
    
    // Validar campos obligatorios
    if (!nombre || !tipo_servidor || !configuracion) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    // Verificar que el secreto existe
    const checkQuery = 'SELECT id FROM materializacion_db_secrets WHERE id = $1';
    const checkResult = await executeSQL(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    // Actualizar secreto
    const query = `
      UPDATE materializacion_db_secrets 
      SET 
        nombre = $1, 
        descripcion = $2, 
        tipo_servidor = $3, 
        configuracion = $4, 
        activo = $5,
        fecha_actualizacion = NOW()
      WHERE 
        id = $6
      RETURNING id
    `;
    
    const values = [
      nombre,
      descripcion || null,
      tipo_servidor,
      JSON.stringify(configuracion),
      activo !== undefined ? activo : true,
      id
    ];
    
    await executeSQL(query, values);
    
    return res.status(200).json({ 
      id: parseInt(id), 
      message: 'Secreto actualizado correctamente' 
    });
  } catch (error) {
    console.error('Error al actualizar secreto de BD:', error);
    return res.status(500).json({ message: 'Error al actualizar secreto de base de datos' });
  }
}

/**
 * Eliminar un secreto
 */
async function deleteDBSecret(req, res, id) {
  try {
    // Verificar si hay conexiones que dependen de este secreto
    const dependenciesQuery = `
      SELECT COUNT(*) as count 
      FROM materializacion_db_connections 
      WHERE secret_id = $1
    `;
    
    const dependenciesResult = await executeSQL(dependenciesQuery, [id]);
    const dependenciesCount = parseInt(dependenciesResult.rows[0].count);
    
    if (dependenciesCount > 0) {
      return res.status(400).json({ 
        message: `No se puede eliminar el secreto porque tiene ${dependenciesCount} conexiones dependientes.` 
      });
    }
    
    // Eliminar el secreto
    const query = 'DELETE FROM materializacion_db_secrets WHERE id = $1 RETURNING id';
    const result = await executeSQL(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    return res.status(200).json({ 
      id: parseInt(id), 
      message: 'Secreto eliminado correctamente' 
    });
  } catch (error) {
    console.error('Error al eliminar secreto de BD:', error);
    return res.status(500).json({ message: 'Error al eliminar secreto de base de datos' });
  }
}