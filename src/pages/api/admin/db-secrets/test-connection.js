import pg from 'pg';
import mysql from 'mysql2/promise';

/**
 * API para probar la conexión a una base de datos
 */
export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend

  try {
    const { tipo_servidor, configuracion } = req.body;

    if (!tipo_servidor || !configuracion) {
      return res.status(400).json({ message: 'Faltan parámetros requeridos' });
    }

    // Probar conexión según tipo de servidor
    switch (tipo_servidor) {
      case 'postgresql':
        return await testPostgreSQL(res, configuracion);
      case 'mysql':
        return await testMySQL(res, configuracion);
      case 'sqlserver':
        // En caso real, aquí implementaríamos la conexión a SQL Server
        return res.status(200).json({ message: 'API de prueba de conexión SQL Server aún no implementada' });
      case 'duckdb':
        // En caso real, aquí implementaríamos la conexión a DuckDB
        return res.status(200).json({ message: 'API de prueba de conexión DuckDB aún no implementada' });
      default:
        return res.status(400).json({ message: `Tipo de servidor no soportado: ${tipo_servidor}` });
    }
  } catch (error) {
    console.error('Error al probar conexión:', error);
    return res.status(500).json({ message: error.message || 'Error al probar la conexión' });
  }
}

/**
 * Prueba conexión a PostgreSQL
 */
async function testPostgreSQL(res, configuracion) {
  const { host, port, username, password, database, ssl } = configuracion;
  
  // Validar campos requeridos
  if (!host || !port || !username || !database) {
    return res.status(400).json({ message: 'Faltan campos obligatorios para la conexión PostgreSQL' });
  }

  let client = null;
  try {
    // Configurar conexión
    const pgConfig = {
      host,
      port,
      user: username,
      password,
      database,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      // Timeout corto para pruebas
      connectionTimeoutMillis: 5000,
    };

    // Crear cliente
    client = new pg.Client(pgConfig);
    
    // Conectar
    await client.connect();
    
    // Probar consulta simple
    const result = await client.query('SELECT NOW() as server_time');
    
    return res.status(200).json({ 
      success: true, 
      message: 'Conexión establecida correctamente', 
      server_time: result.rows[0].server_time 
    });
  } catch (error) {
    console.error('Error al conectar a PostgreSQL:', error);
    return res.status(400).json({ message: `Error al conectar: ${error.message}` });
  } finally {
    // Cerrar conexión
    if (client) {
      try {
        await client.end();
      } catch (error) {
        console.error('Error al cerrar conexión PostgreSQL:', error);
      }
    }
  }
}

/**
 * Prueba conexión a MySQL
 */
async function testMySQL(res, configuracion) {
  const { host, port, username, password, database, ssl } = configuracion;
  
  // Validar campos requeridos
  if (!host || !port || !username || !database) {
    return res.status(400).json({ message: 'Faltan campos obligatorios para la conexión MySQL' });
  }

  let connection = null;
  try {
    // Configurar conexión
    const mysqlConfig = {
      host,
      port,
      user: username,
      password,
      database,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      // Timeout corto para pruebas
      connectTimeout: 5000,
    };

    // Conectar
    connection = await mysql.createConnection(mysqlConfig);
    
    // Probar consulta simple
    const [rows] = await connection.execute('SELECT NOW() as server_time');
    
    return res.status(200).json({ 
      success: true, 
      message: 'Conexión establecida correctamente', 
      server_time: rows[0].server_time 
    });
  } catch (error) {
    console.error('Error al conectar a MySQL:', error);
    return res.status(400).json({ message: `Error al conectar: ${error.message}` });
  } finally {
    // Cerrar conexión
    if (connection) {
      try {
        await connection.end();
      } catch (error) {
        console.error('Error al cerrar conexión MySQL:', error);
      }
    }
  }
}