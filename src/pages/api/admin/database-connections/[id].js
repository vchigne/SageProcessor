import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper para ejecutar consultas SQL
async function executeSQL(query, params = []) {
  try {
    return await pool.query(query, params);
  } catch (error) {
    console.error('Error ejecutando SQL:', error);
    throw error;
  }
}

/**
 * API para gestionar una conexión de base de datos específica
 */
export default async function handler(req, res) {
  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend
  
  const { id } = req.query;
  
  // Validar que el ID sea un número
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID inválido' });
  }
  
  switch (req.method) {
    case 'GET':
      return getDBConnection(req, res, id);
    case 'PUT':
      return updateDBConnection(req, res, id);
    case 'DELETE':
      return deleteDBConnection(req, res, id);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

/**
 * Obtener una conexión de base de datos específica
 */
async function getDBConnection(req, res, id) {
  try {
    const query = `
      SELECT 
        c.id, 
        c.nombre, 
        c.descripcion, 
        c.secret_id,
        c.base_datos, 
        c.esquema,
        c.configuracion,
        c.estado_conexion,
        c.ultimo_test,
        c.activo,
        c.fecha_creacion,
        c.fecha_actualizacion,
        s.nombre as secret_name,
        s.tipo as tipo_bd
      FROM 
        database_connections c
      LEFT JOIN 
        db_secrets s ON c.secret_id = s.id
      WHERE 
        c.id = $1
    `;
    
    const result = await executeSQL(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conexión no encontrada' });
    }
    
    // Parsear configuración si es necesario
    const connection = result.rows[0];
    
    if (typeof connection.configuracion === 'string') {
      try {
        connection.configuracion = JSON.parse(connection.configuracion);
      } catch (e) {
        connection.configuracion = {};
      }
    }
    
    return res.status(200).json(connection);
  } catch (error) {
    console.error('Error al obtener conexión de BD:', error);
    return res.status(500).json({ message: 'Error al obtener conexión de base de datos' });
  }
}

/**
 * Actualizar una conexión de base de datos
 */
async function updateDBConnection(req, res, id) {
  try {
    const { 
      nombre, 
      descripcion, 
      secret_id, 
      base_datos, 
      esquema,
      configuracion,
      activo
    } = req.body;
    
    // Validaciones básicas
    if (!nombre || !secret_id || !base_datos) {
      return res.status(400).json({ 
        message: 'Faltan campos obligatorios: nombre, secret_id, base_datos' 
      });
    }
    
    // Verificar que el secreto existe
    const checkSecretQuery = 'SELECT id FROM db_secrets WHERE id = $1';
    const secretResult = await executeSQL(checkSecretQuery, [secret_id]);
    
    if (secretResult.rows.length === 0) {
      return res.status(400).json({ 
        message: 'El secreto de base de datos especificado no existe' 
      });
    }
    
    // Verificar que la conexión existe
    const checkConnectionQuery = 'SELECT id FROM database_connections WHERE id = $1';
    const connectionResult = await executeSQL(checkConnectionQuery, [id]);
    
    if (connectionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Conexión no encontrada' });
    }
    
    // Actualizar conexión
    const query = `
      UPDATE database_connections
      SET 
        nombre = $1,
        descripcion = $2,
        secret_id = $3,
        base_datos = $4,
        esquema = $5,
        configuracion = $6,
        activo = $7,
        estado_conexion = $8,
        fecha_actualizacion = NOW()
      WHERE id = $9
      RETURNING id
    `;
    
    const valores = [
      nombre,
      descripcion || '',
      secret_id,
      base_datos,
      esquema || '',
      configuracion ? JSON.stringify(configuracion) : '{}',
      activo !== undefined ? activo : true,
      'pendiente', // Resetear estado a pendiente después de actualizar
      id
    ];
    
    await executeSQL(query, valores);
    
    return res.status(200).json({ 
      message: 'Conexión actualizada correctamente' 
    });
  } catch (error) {
    console.error('Error al actualizar conexión de BD:', error);
    
    // Verificar si es un error de nombre duplicado
    if (error.code === '23505' && error.constraint.includes('nombre')) {
      return res.status(400).json({ 
        message: 'Ya existe una conexión con ese nombre' 
      });
    }
    
    return res.status(500).json({ 
      message: 'Error al actualizar conexión de base de datos' 
    });
  }
}

/**
 * Eliminar una conexión de base de datos
 */
async function deleteDBConnection(req, res, id) {
  try {
    // Verificar si la conexión tiene tablas materializadas
    const checkUsageQuery = `
      SELECT COUNT(*) as count
      FROM materialization_tables
      WHERE db_connection_id = $1
    `;
    
    const usageResult = await executeSQL(checkUsageQuery, [id]);
    
    if (usageResult.rows[0].count > 0) {
      return res.status(400).json({ 
        message: 'No se puede eliminar la conexión porque tiene tablas materializadas asociadas' 
      });
    }
    
    // Eliminar la conexión
    const deleteQuery = 'DELETE FROM database_connections WHERE id = $1 RETURNING id';
    const result = await executeSQL(deleteQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conexión no encontrada' });
    }
    
    return res.status(200).json({ 
      message: 'Conexión eliminada correctamente' 
    });
  } catch (error) {
    console.error('Error al eliminar conexión de BD:', error);
    
    if (error.code === '23503') { // Error de clave foránea
      return res.status(400).json({ 
        message: 'No se puede eliminar la conexión porque está siendo referenciada por otras entidades' 
      });
    }
    
    return res.status(500).json({ 
      message: 'Error al eliminar conexión de base de datos' 
    });
  }
}