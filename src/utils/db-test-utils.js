import { Client } from 'pg';

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
  // Validación básica de parámetros
  if (!host) {
    return {
      success: false,
      message: `Error al conectar a SQL Server: Falta el servidor`,
      details: {
        code: 'INVALID_CONFIG',
        sqlMessage: 'Configuración inválida: falta servidor'
      }
    };
  }
  
  if (!port) {
    return {
      success: false,
      message: `Error al conectar a SQL Server: Falta el puerto`,
      details: {
        code: 'INVALID_CONFIG',
        sqlMessage: 'Configuración inválida: falta puerto'
      }
    };
  }
  
  // Si no hay base de datos especificada, usar master por defecto
  const useDatabase = database || 'master';
  
  try {
    // Conectar a SQL Server utilizando pymssql a través del servidor Python
    const response = await fetch('/api/admin/db-helpers/test-sqlserver-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        server: host,
        port: parseInt(port),
        user,
        password,
        database: useDatabase
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        message: `Error al conectar a SQL Server: ${result.message || 'Error de conexión'}`,
        details: result.details || { error: 'Error de conexión desconocido' }
      };
    }
    
    return {
      success: true,
      message: result.message || 'Conexión exitosa a SQL Server',
      details: result.details || {
        server: host,
        port,
        database: useDatabase,
        user: user ? '****' : 'No configurado'
      }
    };
  } catch (error) {
    console.error('Error testing SQL Server connection:', error);
    return {
      success: false,
      message: `Error al conectar a SQL Server: ${error.message}`,
      details: {
        code: 'CONNECTION_ERROR',
        sqlMessage: error.message
      }
    };
  }
}

/**
 * Probar conexión a MySQL (simulada)
 */
export function testMySQLConnection(
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
    message: 'Verificación de MySQL simulada - Se requiere instalar el paquete mysql2',
    details: {
      version: 'No disponible - Paquete mysql2 no instalado',
      table_count: 0,
      database,
      host,
      port,
      user: user ? '****' : 'No configurado',
      notes: 'Esta es una verificación simulada ya que el paquete mysql2 no está instalado. La conexión real no se ha probado.'
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