import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { executeSQL } from '@/utils/db';
import { Client } from 'pg';
import mysql from 'mysql2/promise';

/**
 * API para probar la conexión a una base de datos específica
 */
export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user.isAdmin) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  const { id } = req.query;
  
  // Validar que el ID sea un número
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID inválido' });
  }
  
  try {
    // Obtener información de la conexión y su secreto asociado
    const query = `
      SELECT 
        c.id, 
        c.nombre, 
        c.base_datos, 
        c.esquema,
        c.configuracion,
        s.id as secret_id,
        s.tipo,
        s.servidor,
        s.puerto,
        s.usuario,
        s.contrasena,
        s.opciones_conexion as secret_options
      FROM 
        database_connections c
      JOIN 
        db_secrets s ON c.secret_id = s.id
      WHERE 
        c.id = $1
    `;
    
    const result = await executeSQL(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Conexión no encontrada' });
    }
    
    const connection = result.rows[0];
    
    // Combinar configuración de conexión y secreto para las opciones
    let connectionConfig = {};
    
    try {
      if (typeof connection.configuracion === 'string') {
        connectionConfig = JSON.parse(connection.configuracion);
      } else if (connection.configuracion) {
        connectionConfig = connection.configuracion;
      }
    } catch (e) {
      // Ignorar error de parseo
      connectionConfig = {};
    }
    
    let secretOptions = {};
    
    try {
      if (typeof connection.secret_options === 'string') {
        secretOptions = JSON.parse(connection.secret_options);
      } else if (connection.secret_options) {
        secretOptions = connection.secret_options;
      }
    } catch (e) {
      // Ignorar error de parseo
      secretOptions = {};
    }
    
    // Configuración combinada
    const combinedConfig = {
      ...secretOptions,
      ...connectionConfig
    };
    
    let testResult = null;
    
    // Probar conexión según el tipo de base de datos
    switch (connection.tipo) {
      case 'postgresql':
        testResult = await testPostgresConnection(
          connection.servidor, 
          connection.puerto, 
          connection.usuario, 
          connection.contrasena, 
          connection.base_datos,
          connection.esquema,
          combinedConfig
        );
        break;
      case 'mysql':
        testResult = await testMySQLConnection(
          connection.servidor, 
          connection.puerto, 
          connection.usuario, 
          connection.contrasena, 
          connection.base_datos,
          combinedConfig
        );
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
      UPDATE database_connections
      SET 
        estado_conexion = $1,
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
async function testPostgresConnection(host, port, user, password, database, schema, options = {}) {
  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    // Si hay opciones adicionales de conexión, agregarlas aquí
    ...options,
    // Timeout de conexión
    connectionTimeoutMillis: 5000,
  });
  
  try {
    await client.connect();
    
    // Probar si el esquema existe (si se especificó)
    if (schema) {
      try {
        const schemaQuery = `SELECT EXISTS (
          SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
        )`;
        const schemaResult = await client.query(schemaQuery, [schema]);
        
        if (!schemaResult.rows[0].exists) {
          await client.end();
          return {
            success: false,
            message: `El esquema "${schema}" no existe en la base de datos`,
          };
        }
      } catch (schemaError) {
        console.error('Error al verificar esquema:', schemaError);
        // Continuar aunque falle la verificación del esquema
      }
    }
    
    // Obtener información del servidor
    const versionResult = await client.query('SELECT version()');
    const tablesQuery = `
      SELECT count(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = $1
    `;
    const tablesResult = await client.query(tablesQuery, [schema || 'public']);
    
    await client.end();
    
    return {
      success: true,
      message: 'Conexión exitosa a PostgreSQL',
      details: {
        version: versionResult.rows[0].version,
        table_count: tablesResult.rows[0].table_count,
        schema: schema || 'public'
      }
    };
  } catch (error) {
    try {
      await client.end();
    } catch (e) {
      // Ignorar errores al cerrar la conexión
    }
    
    return {
      success: false,
      message: `Error al conectar a PostgreSQL: ${error.message}`,
      details: {
        code: error.code,
        sqlMessage: error.message
      }
    };
  }
}

/**
 * Probar conexión a MySQL
 */
async function testMySQLConnection(host, port, user, password, database, options = {}) {
  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      // Si hay opciones adicionales de conexión, agregarlas aquí
      ...options,
      // Timeout de conexión
      connectTimeout: 5000,
    });
    
    // Obtener información del servidor
    const [versionRows] = await connection.execute('SELECT VERSION() as version');
    const [tablesResult] = await connection.execute(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = ?
    `, [database]);
    
    await connection.end();
    
    return {
      success: true,
      message: 'Conexión exitosa a MySQL',
      details: {
        version: versionRows[0].version,
        table_count: tablesResult[0].table_count,
        database
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