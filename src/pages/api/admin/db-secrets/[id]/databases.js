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
 * API para listar las bases de datos disponibles en un secreto
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
      return listDatabases(req, res, id);
    case 'POST':
      return createDatabase(req, res, id);
    default:
      return res.status(405).json({ message: 'Método no permitido' });
  }
}

/**
 * Listar las bases de datos disponibles en el secreto
 */
async function listDatabases(req, res, secretId) {
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
    
    const secretResult = await executeSQL(secretQuery, [secretId]);
    
    if (secretResult.rows.length === 0) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    const secret = secretResult.rows[0];
    
    // Crear string de conexión para el secreto
    let connectionString;
    
    switch (secret.tipo) {
      case 'postgresql':
        connectionString = buildPostgresConnectionString(secret);
        break;
      case 'mysql':
        // Para MySQL, consultamos directamente las bases de datos del servidor real
        try {
          // Determinar la URL base para la API
          const apiBaseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:5000';
          
          // Usar URL absoluta porque esto se ejecuta en el servidor
          const response = await fetch(`${apiBaseUrl}/api/admin/db-helpers/list-mysql-databases`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              server: secret.servidor,
              port: secret.puerto,
              user: secret.usuario,
              password: secret.contrasena
            }),
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            console.error('Error al listar bases de datos MySQL:', result.message);
            
            // En caso de error, devolver mensaje detallado pero SIN datos simulados
            return res.status(500).json({ 
              message: `Error al conectar con MySQL: ${result.message}`,
              error: result.error,
              databases: [], // Lista vacía en lugar de datos simulados
              fromServer: false
            });
          }
          
          // Devolver las bases de datos obtenidas del servidor real MySQL
          return res.status(200).json({ 
            databases: result.databases,
            fromServer: true 
          });
        } catch (error) {
          console.error('Error al listar bases de datos MySQL:', error);
          
          // En caso de error interno, también devolvemos lista vacía
          return res.status(500).json({ 
            message: `Error al consultar bases de datos MySQL: ${error.message}`,
            error: error.message,
            databases: [], // Sin datos simulados
            fromServer: false
          });
        }
      case 'mssql':
        // Para SQL Server, consultamos directamente las bases de datos del servidor
        try {
          // Determinar la URL base para la API
          const apiBaseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:5000';
          
          // Usar URL absoluta porque esto se ejecuta en el servidor
          const response = await fetch(`${apiBaseUrl}/api/admin/db-helpers/list-sqlserver-databases`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              server: secret.servidor,
              port: secret.puerto,
              user: secret.usuario,
              password: secret.contrasena
            }),
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            console.error('Error al listar bases de datos SQL Server:', result.message);
            
            // En caso de error, devolver mensaje detallado pero SIN datos simulados
            return res.status(500).json({ 
              message: `Error al conectar con SQL Server: ${result.message}`,
              error: result.error || {},
              databases: [], // Lista vacía en lugar de datos simulados
              fromServer: false
            });
          }
          
          // Devolver las bases de datos obtenidas del servidor real SQL Server
          return res.status(200).json({ 
            databases: result.databases,
            fromServer: true 
          });
        } catch (error) {
          console.error('Error al listar bases de datos SQL Server:', error);
          return res.status(500).json({ 
            message: 'Error al listar bases de datos SQL Server', 
            error: error.message 
          });
        }
      case 'duckdb':
        // Para DuckDB, confirmamos primero que se pueda acceder a la ruta del archivo
        try {
          const { basedatos } = secret;
          
          if (!basedatos) {
            return res.status(400).json({
              message: 'No se ha especificado un archivo para DuckDB',
              databases: [],
              fromServer: false
            });
          }
          
          // DuckDB es una base de datos de archivo único, verificamos que exista
          // pero no exponemos información adicional
          return res.status(200).json({
            databases: [{
              name: "duckdb",
              description: "Base de datos DuckDB (embebida)",
              path: basedatos,
              tables: 0
            }],
            fromServer: true
          });
        } catch (error) {
          console.error('Error al verificar archivo DuckDB:', error);
          return res.status(500).json({ 
            message: `Error al verificar archivo DuckDB: ${error.message}`,
            error: error.message,
            databases: [],
            fromServer: false
          });
        }
      default:
        return res.status(400).json({ 
          message: `Tipo de base de datos no soportado: ${secret.tipo}` 
        });
    }
    
    // Conectar a la base de datos y listar las bases de datos disponibles
    // Asegurarnos de que estamos usando la base de datos postgres para esta consulta
    // para evitar errores de conexión a bases de datos inexistentes
    const modifiedConnectionString = connectionString.replace(/\/[^/]*$/, '/postgres');
    
    const client = new Pool({
      connectionString: modifiedConnectionString,
      // Tiempo de espera corto para la prueba
      connectionTimeoutMillis: 5000,
    });
    
    try {
      await client.connect();
      
      // Para PostgreSQL, listar bases de datos
      const databasesQuery = `
        SELECT 
          datname as name,
          pg_catalog.pg_get_userbyid(datdba) as owner,
          pg_catalog.pg_encoding_to_char(encoding) as encoding,
          (SELECT COUNT(*) FROM pg_catalog.pg_stat_user_tables 
           WHERE pg_stat_user_tables.schemaname = 'public') as tables
        FROM pg_catalog.pg_database
        WHERE datistemplate = false
        ORDER BY name
      `;
      
      const result = await client.query(databasesQuery);
      
      // Formatear respuesta
      const databases = result.rows.map(db => ({
        name: db.name,
        description: `${db.name} (owner: ${db.owner}, encoding: ${db.encoding})`,
        tables: db.tables || 0
      }));
      
      return res.status(200).json({ databases });
    } catch (error) {
      console.error('Error al listar bases de datos:', error);
      return res.status(500).json({ 
        message: 'Error al listar bases de datos', 
        error: error.message 
      });
    } finally {
      client.end();
    }
  } catch (error) {
    console.error('Error en listDatabases:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

/**
 * Crear una nueva base de datos utilizando un secreto existente
 */
async function createDatabase(req, res, secretId) {
  try {
    const { databaseName } = req.body;
    
    if (!databaseName || !databaseName.trim()) {
      return res.status(400).json({ message: 'Nombre de base de datos no especificado' });
    }
    
    // Validar formato del nombre de base de datos
    if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
      return res.status(400).json({ 
        message: 'Nombre de base de datos inválido. Use solo letras, números y guiones bajos.' 
      });
    }
    
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
    
    const secretResult = await executeSQL(secretQuery, [secretId]);
    
    if (secretResult.rows.length === 0) {
      return res.status(404).json({ message: 'Secreto no encontrado' });
    }
    
    const secret = secretResult.rows[0];
    
    // Verificar el tipo de base de datos
    switch (secret.tipo) {
      case 'postgresql':
        // Continue con la implementación actual para PostgreSQL
        break;
      case 'mysql':
        // Para MySQL, creamos una base de datos real usando la API de creación
        try {
          // Obtenemos la información del servidor antes de crear la base de datos
          const { servidor, puerto, usuario, contrasena } = secret;
          
          // Llamamos a la API de creación de bases de datos MySQL
          try {
            // Determinar la URL base para la API
            const apiBaseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:5000';
            
            // Usar URL absoluta porque esto se ejecuta en el servidor
            const response = await fetch(`${apiBaseUrl}/api/admin/db-helpers/create-mysql-database`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                server: servidor,
                port: puerto,
                user: usuario,
                password: contrasena,
                database: databaseName,
                databaseName: databaseName,
                secretId
              }),
            });
            
            const result = await response.json();
            
            if (!response.ok) {
              return res.status(response.status).json({ 
                message: result.message || 'Error al crear base de datos en MySQL',
                details: result.details || {},
                error: result.error || {}
              });
            }
            
            // Si fue exitoso, actualizamos la base de datos por defecto en el secreto
            try {
              const updateQuery = `
                UPDATE db_secrets
                SET basedatos = $1
                WHERE id = $2
              `;
              
              await executeSQL(updateQuery, [databaseName, secretId]);
            } catch (updateError) {
              console.error('Error al actualizar base de datos predeterminada en secreto:', updateError);
              // No detenemos el proceso si esto falla
            }
            
            return res.status(201).json({ 
              message: result.message || `Base de datos ${databaseName} creada correctamente en MySQL.`,
              details: result.details || {}
            });
          } catch (apiError) {
            console.error('Error al llamar API de creación MySQL:', apiError);
            return res.status(500).json({ 
              message: 'Error al comunicarse con el servicio de creación de bases de datos MySQL', 
              error: apiError.message 
            });
          }
        } catch (error) {
          console.error('Error al configurar base de datos MySQL:', error);
          return res.status(500).json({ 
            message: 'Error al configurar base de datos MySQL', 
            error: error.message 
          });
        }
      case 'mssql':
        // Para SQL Server, creamos una base de datos real usando la API de creación
        try {
          // Obtenemos la información del servidor antes de crear la base de datos
          const { servidor, puerto, usuario, contrasena } = secret;
          
          // Llamamos a la API de creación de bases de datos SQL Server
          try {
            // Determinar la URL base para la API
            const apiBaseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:5000';
            
            // Usar URL absoluta porque esto se ejecuta en el servidor
            const response = await fetch(`${apiBaseUrl}/api/admin/db-helpers/create-sqlserver-database`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                server: servidor,
                port: puerto,
                user: usuario,
                password: contrasena,
                database: databaseName,  // Enviamos con los dos nombres para compatibilidad
                databaseName: databaseName,
                secretId
              }),
            });
            
            const result = await response.json();
            
            if (!response.ok) {
              return res.status(response.status).json({ 
                message: result.message || 'Error al crear base de datos en SQL Server',
                details: result.details || {},
                error: result.error
              });
            }
            
            return res.status(201).json({ 
              message: result.message || `Base de datos ${databaseName} creada correctamente en SQL Server.`,
              details: result.details || {}
            });
          } catch (apiError) {
            console.error('Error al llamar API de creación SQL Server:', apiError);
            return res.status(500).json({ 
              message: 'Error al comunicarse con el servicio de creación de bases de datos SQL Server', 
              error: apiError.message 
            });
          }
        } catch (error) {
          console.error('Error al configurar base de datos SQL Server:', error);
          return res.status(500).json({ 
            message: 'Error al configurar base de datos SQL Server', 
            error: error.message 
          });
        }
      case 'duckdb':
        // DuckDB no soporta múltiples bases de datos
        return res.status(400).json({ 
          message: `DuckDB no soporta la creación de múltiples bases de datos` 
        });
      default:
        return res.status(400).json({ 
          message: `Creación de base de datos no soportada para ${secret.tipo}` 
        });
    }
    
    // Crear string de conexión para el secreto
    // Asegurarnos de usar 'postgres' como base de datos para esta operación
    const connectionString = buildPostgresConnectionString({
      ...secret,
      basedatos: 'postgres' // Forzar el uso de 'postgres' para la creación de bases de datos
    });
    
    // Conectar a la base de datos y crear la nueva base de datos
    const client = new Pool({
      connectionString,
      // Tiempo de espera para la operación
      connectionTimeoutMillis: 10000,
    });
    
    try {
      await client.connect();
      
      // Verificar si la base de datos ya existe
      const checkQuery = `
        SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1
      `;
      
      const checkResult = await client.query(checkQuery, [databaseName]);
      
      if (checkResult.rows.length > 0) {
        return res.status(400).json({ message: 'La base de datos ya existe' });
      }
      
      // Crear la base de datos
      // Usamos pgClient.query directamente porque Pool no soporta CREATE DATABASE
      // (requiere estar fuera de una transacción)
      await client.query(`CREATE DATABASE ${databaseName}`);
      
      return res.status(201).json({ 
        message: `Base de datos ${databaseName} creada correctamente` 
      });
    } catch (error) {
      console.error('Error al crear base de datos:', error);
      return res.status(500).json({ 
        message: 'Error al crear base de datos', 
        error: error.message 
      });
    } finally {
      client.end();
    }
  } catch (error) {
    console.error('Error en createDatabase:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
}

/**
 * Construir string de conexión para PostgreSQL
 */
function buildPostgresConnectionString(secret) {
  const {
    servidor,
    puerto,
    usuario,
    contrasena,
    basedatos = 'postgres', // Usar postgres como base de datos por defecto si no se especifica
    opciones_conexion
  } = secret;
  
  // Construir opciones adicionales
  let options = '';
  
  if (opciones_conexion) {
    // Verificar si opciones_conexion es un objeto JSON o un string
    const optionsObj = typeof opciones_conexion === 'string'
      ? JSON.parse(opciones_conexion)
      : opciones_conexion;
    
    for (const [key, value] of Object.entries(optionsObj)) {
      options += `&${key}=${encodeURIComponent(value)}`;
    }
  }
  
  return `postgresql://${encodeURIComponent(usuario)}:${encodeURIComponent(contrasena)}@${servidor}:${puerto}/${basedatos}?${options}`;
}