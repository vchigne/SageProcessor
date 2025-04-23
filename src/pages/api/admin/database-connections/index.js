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
 * API para gestionar conexiones a bases de datos
 */
export default async function handler(req, res) {
  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend

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
    // Consultar conexiones con información del secreto, incluyendo servidor y usuario
    const query = `
      SELECT 
        c.id, 
        c.nombre, 
        c.descripcion, 
        c.secret_id,
        c.base_datos, 
        c.esquema,
        c.estado_conexion,
        c.ultimo_test,
        c.activo,
        c.fecha_creacion,
        s.nombre as secret_name,
        s.tipo as tipo_bd,
        s.servidor,
        s.puerto,
        s.usuario,
        0 as table_count
      FROM 
        database_connections c
      LEFT JOIN 
        db_secrets s ON c.secret_id = s.id
      ORDER BY 
        c.fecha_creacion DESC
    `;
    
    const result = await executeSQL(query);
    
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener conexiones de BD:', error);
    return res.status(500).json({ message: 'Error al obtener conexiones de bases de datos' });
  }
}

/**
 * Crear una nueva conexión a base de datos
 */
async function createDBConnection(req, res) {
  try {
    const { 
      nombre, 
      descripcion, 
      secret_id, 
      base_datos, 
      esquema,
      configuracion
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
    
    // Insertar nueva conexión
    const query = `
      INSERT INTO database_connections (
        nombre, 
        descripcion, 
        secret_id, 
        base_datos, 
        esquema,
        configuracion,
        estado_conexion,
        activo,
        fecha_creacion,
        fecha_actualizacion
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id
    `;
    
    const valores = [
      nombre,
      descripcion || '',
      secret_id,
      base_datos,
      esquema || '',
      configuracion ? JSON.stringify(configuracion) : '{}',
      'pendiente',
      true // Activo por defecto
    ];
    
    const result = await executeSQL(query, valores);
    
    return res.status(201).json({ 
      id: result.rows[0].id,
      message: 'Conexión a base de datos creada correctamente' 
    });
  } catch (error) {
    console.error('Error al crear conexión a BD:', error);
    
    // Verificar si es un error de nombre duplicado
    if (error.code === '23505' && error.constraint.includes('nombre')) {
      return res.status(400).json({ 
        message: 'Ya existe una conexión con ese nombre' 
      });
    }
    
    return res.status(500).json({ 
      message: 'Error al crear conexión a base de datos' 
    });
  }
}