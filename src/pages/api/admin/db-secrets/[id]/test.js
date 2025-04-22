import { Pool, Client } from 'pg';
import mysql from 'mysql2/promise';

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
 * API para probar la conexión de un secreto de base de datos
 */
export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend
  
  const { id } = req.query;
  
  // Validar que el ID sea un número
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID inválido' });
  }
  
  try {
    // Obtener información del secreto
    const secretQuery = `
      SELECT 
        id, 
        nombre, 
        tipo, 
        servidor, 
        puerto, 
        usuario, 
        contrasena,
        basedatos,
        opciones_conexion
      FROM 
        db_secrets 
      WHERE 
        id = $1
    `;
    
    const result = await executeSQL(secretQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    const secret = result.rows[0];
    let testResult = null;
    
    // Probar conexión según el tipo de base de datos
    switch (secret.tipo) {
      case 'postgresql':
        testResult = await testPostgresConnection(secret);
        break;
      case 'mysql':
        testResult = await testMySQLConnection(secret);
        break;
      case 'mssql':
        // La implementación de SQL Server requiere bibliotecas adicionales
        testResult = { success: false, message: 'Prueba de SQL Server aún no implementada' };
        break;
      case 'duckdb':
        // DuckDB es una base de datos en memoria/archivo, no requiere conexión
        testResult = { success: true, message: 'DuckDB es una base de datos en archivo, no requiere prueba de conexión remota' };
        break;
      default:
        testResult = { success: false, message: 'Tipo de base de datos no soportado' };
    }
    
    // Actualizar estado de la conexión en la base de datos
    const updateQuery = `
      UPDATE db_secrets
      SET 
        estado = $1,
        ultimo_test = NOW()
      WHERE id = $2
    `;
    
    await executeSQL(updateQuery, [
      testResult.success ? 'activo' : 'error',
      id
    ]);
    
    if (testResult.success) {
      return res.status(200).json({ 
        message: testResult.message || 'Conexión exitosa a la base de datos',
        details: testResult.details || {}
      });
    } else {
      return res.status(400).json({ 
        message: testResult.message || 'Error al conectar a la base de datos',
        details: testResult.details || {}
      });
    }
  } catch (error) {
    console.error('Error al probar conexión de BD:', error);
    return res.status(500).json({ 
      message: 'Error al probar conexión a la base de datos',
      error: error.message
    });
  }
}

/**
 * Probar conexión a PostgreSQL
 */
async function testPostgresConnection(secret) {
  const client = new Client({
    host: secret.servidor,
    port: secret.puerto,
    user: secret.usuario,
    password: secret.contrasena,
    database: secret.basedatos || 'postgres', // Usar 'postgres' como base de datos predeterminada
    // Si hay opciones adicionales de conexión, agregarlas aquí
    ...(typeof secret.opciones_conexion === 'object' ? secret.opciones_conexion : {}),
    // Timeout de conexión
    connectionTimeoutMillis: 5000,
  });
  
  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    
    return {
      success: true,
      message: 'Conexión exitosa a PostgreSQL',
      details: {
        version: result.rows[0].version
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error al conectar a PostgreSQL: ${error.message}`,
      details: {
        code: error.code,
        sqlMessage: error.message
      }
    };
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignorar errores al cerrar la conexión
    }
  }
}

/**
 * Probar conexión a MySQL
 */
async function testMySQLConnection(secret) {
  try {
    const connection = await mysql.createConnection({
      host: secret.servidor,
      port: secret.puerto,
      user: secret.usuario,
      password: secret.contrasena,
      database: secret.basedatos,
      // Si hay opciones adicionales de conexión, agregarlas aquí
      ...(typeof secret.opciones_conexion === 'object' ? secret.opciones_conexion : {}),
      // Timeout de conexión
      connectTimeout: 5000,
    });
    
    const [rows] = await connection.execute('SELECT VERSION() as version');
    await connection.end();
    
    return {
      success: true,
      message: 'Conexión exitosa a MySQL',
      details: {
        version: rows[0].version
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Error al conectar a MySQL: ${error.message}`,
      details: {
        code: error.code,
        sqlMessage: error.sqlMessage || error.message
      }
    };
  }
}