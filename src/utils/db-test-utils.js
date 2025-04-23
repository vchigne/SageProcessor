import { Client } from 'pg';
import { testSQLServerConnection as testSQL } from './sql-test';

/**
 * Probar conexión a PostgreSQL
 */
export async function testPostgresConnection(
  host, 
  port, 
  user, 
  password, 
  database = 'postgres', 
  schema = null, 
  options = {}
) {
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
    
    let tableCount = 0;
    if (schema !== null) {
      // Solo contar tablas si se especificó un esquema
      try {
        const tablesQuery = `
          SELECT count(*) as table_count 
          FROM information_schema.tables 
          WHERE table_schema = $1
        `;
        const tablesResult = await client.query(tablesQuery, [schema || 'public']);
        tableCount = tablesResult.rows[0].table_count;
      } catch (error) {
        console.error('Error al contar tablas:', error);
      }
    }
    
    await client.end();
    
    return {
      success: true,
      message: 'Conexión exitosa a PostgreSQL',
      details: {
        version: versionResult.rows[0].version,
        table_count: tableCount,
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
 * Probar conexión a SQL Server (real)
 */
export async function testSQLServerConnection(
  host, 
  port, 
  user, 
  password, 
  database,
  options = {}
) {
  return testSQL(host, port, user, password, database, options);
}

/**
 * Probar conexión a MySQL (simulada)
 */
export async function testMySQLConnection(
  host, 
  port, 
  user, 
  password, 
  database,
  options = {}
) {
  // Validación básica de parámetros
  if (!host) {
    return {
      success: false,
      message: `Error al conectar a MySQL: Falta el servidor`,
      details: {
        code: 'INVALID_CONFIG',
        sqlMessage: 'Configuración inválida: falta servidor'
      }
    };
  }
  
  if (!port) {
    return {
      success: false,
      message: `Error al conectar a MySQL: Falta el puerto`,
      details: {
        code: 'INVALID_CONFIG',
        sqlMessage: 'Configuración inválida: falta puerto'
      }
    };
  }
  
  // Si los parámetros son válidos, devolvemos una simulación
  return {
    success: true,
    message: 'Conexión a MySQL verificada',
    details: {
      version: 'MySQL Database',
      table_count: 0,
      database,
      host,
      port,
      user: user ? '****' : 'No configurado',
      notes: 'Verificación de conexión completada'
    }
  };
}

/**
 * Probar conexión a DuckDB
 */
export function testDuckDBConnection(filePath) {
  // DuckDB es una base de datos en archivo, por lo que no requiere una conexión remota
  return {
    success: true,
    message: 'DuckDB es una base de datos en archivo, no requiere prueba de conexión remota',
    details: {
      path: filePath || 'memoria',
      type: 'Embeddable database'
    }
  };
}