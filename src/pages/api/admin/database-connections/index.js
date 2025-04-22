import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { executeSQL } from '@/utils/db';

/**
 * API para gestionar conexiones a bases de datos
 */
export default async function handler(req, res) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user.isAdmin) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  switch (req.method) {
    case 'GET':
      return getDBConnections(req, res);
    case 'POST':
      return createDBConnection(req, res);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

/**
 * Obtener lista de conexiones a bases de datos
 */
async function getDBConnections(req, res) {
  try {
    // Consultar conexiones con información del secreto y número de tablas
    const query = `
      SELECT 
        c.id, 
        c.nombre, 
        c.descripcion, 
        c.database, 
        c.schema,
        c.tipo_servidor,
        c.activo,
        c.fecha_creacion,
        s.nombre as secret_name,
        (
          SELECT COUNT(*) 
          FROM materializacion_tablas 
          WHERE db_connection_id = c.id
        ) as table_count
      FROM 
        materializacion_db_connections c
      LEFT JOIN 
        materializacion_db_secrets s ON c.secret_id = s.id
      ORDER BY 
        c.fecha_creacion DESC
    `;
    
    const result = await executeSQL(query);
    
    // No exponer información sensible
    const connections = result.rows.map(connection => ({
      ...connection,
      config: undefined, // No enviar configuración específica
    }));
    
    return res.status(200).json(connections);
  } catch (error) {
    console.error('Error al obtener conexiones de BD:', error);
    return res.status(500).json({ message: 'Error al obtener conexiones de bases de datos' });
  }
}

/**
 * Crear nueva conexión a base de datos
 */
async function createDBConnection(req, res) {
  try {
    const { 
      nombre, 
      descripcion, 
      tipo_servidor, 
      secret_id,
      database, 
      schema, 
      config, 
      activo 
    } = req.body;
    
    // Validar campos obligatorios
    if (!nombre || !tipo_servidor || !secret_id || !database) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    
    // Verificar que el secreto existe
    const secretQuery = 'SELECT id FROM materializacion_db_secrets WHERE id = $1';
    const secretResult = await executeSQL(secretQuery, [secret_id]);
    
    if (secretResult.rows.length === 0) {
      return res.status(400).json({ message: 'El secreto especificado no existe' });
    }
    
    // Insertar la nueva conexión
    const query = `
      INSERT INTO materializacion_db_connections (
        nombre, 
        descripcion, 
        tipo_servidor, 
        secret_id,
        database, 
        schema, 
        config, 
        activo
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    const values = [
      nombre,
      descripcion || null,
      tipo_servidor,
      secret_id,
      database,
      schema || null,
      JSON.stringify(config || {}),
      activo !== undefined ? activo : true
    ];
    
    const result = await executeSQL(query, values);
    const connectionId = result.rows[0].id;
    
    return res.status(201).json({ 
      id: connectionId, 
      message: 'Conexión a base de datos creada correctamente' 
    });
  } catch (error) {
    console.error('Error al crear conexión de BD:', error);
    return res.status(500).json({ message: 'Error al crear conexión a base de datos' });
  }
}