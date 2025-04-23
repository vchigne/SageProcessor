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
        // Para MySQL, usamos una lista predefinida de bases de datos comunes
        // Ya que no podemos instalar mysql2 para conectarnos directamente
        try {
          // Bases de datos comunes en MySQL
          const databases = [
            {
              name: "information_schema",
              description: "Base de datos information_schema (sistema)",
              tables: 0
            },
            {
              name: "mysql",
              description: "Base de datos mysql (sistema)",
              tables: 0
            },
            {
              name: "performance_schema",
              description: "Base de datos performance_schema (sistema)",
              tables: 0
            },
            {
              name: "sys",
              description: "Base de datos sys (sistema)",
              tables: 0
            }
          ];
          
          // Añadir la base de datos configurada en el secreto si existe
          if (secret.basedatos && secret.basedatos !== 'mysql') {
            databases.push({
              name: secret.basedatos,
              description: `Base de datos ${secret.basedatos} (configurada)`,
              tables: 0
            });
          }
          
          return res.status(200).json({ databases });
        } catch (error) {
          console.error('Error al preparar lista de bases de datos MySQL:', error);
          return res.status(500).json({ 
            message: 'Error al preparar lista de bases de datos MySQL', 
            error: error.message 
          });
        }
      case 'mssql':
        // Para SQL Server, usamos una lista predefinida de bases de datos comunes
        try {
          // Bases de datos comunes en SQL Server
          const databases = [
            {
              name: "master",
              description: "Base de datos master (sistema)",
              tables: 0
            },
            {
              name: "model",
              description: "Base de datos model (sistema)",
              tables: 0
            },
            {
              name: "msdb",
              description: "Base de datos msdb (sistema)",
              tables: 0
            },
            {
              name: "tempdb",
              description: "Base de datos temporal (sistema)",
              tables: 0
            }
          ];
          
          // Añadir la base de datos configurada en el secreto si existe
          if (secret.basedatos && !databases.some(db => db.name === secret.basedatos)) {
            databases.push({
              name: secret.basedatos,
              description: `Base de datos ${secret.basedatos} (configurada)`,
              tables: 0
            });
          }
          
          return res.status(200).json({ databases });
        } catch (error) {
          console.error('Error al preparar lista de bases de datos SQL Server:', error);
          return res.status(500).json({ 
            message: 'Error al preparar lista de bases de datos SQL Server', 
            error: error.message 
          });
        }
      case 'duckdb':
        // DuckDB no tiene un concepto de múltiples bases de datos
        return res.status(200).json({
          databases: [{
            name: "duckdb",
            description: "Base de datos DuckDB (embebida)",
            tables: 0
          }]
        });
      default:
        return res.status(400).json({ 
          message: `Tipo de base de datos no soportado: ${secret.tipo}` 
        });
    }
    
    // Conectar a la base de datos y listar las bases de datos disponibles
    const client = new Pool({
      connectionString,
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
        // Para MySQL, guardamos solo la configuración
        try {
          // Actualizamos el secreto con la nueva base de datos por defecto
          const updateQuery = `
            UPDATE db_secrets
            SET basedatos = $1
            WHERE id = $2
          `;
          
          await executeSQL(updateQuery, [databaseName, secretId]);
          
          return res.status(201).json({ 
            message: `Base de datos ${databaseName} registrada correctamente. La configuración se ha actualizado.` 
          });
        } catch (error) {
          console.error('Error al registrar base de datos MySQL:', error);
          return res.status(500).json({ 
            message: 'Error al registrar base de datos MySQL', 
            error: error.message 
          });
        }
      case 'mssql':
        // Para SQL Server, guardamos solo la configuración
        try {
          // Actualizamos el secreto con la nueva base de datos por defecto
          const updateQuery = `
            UPDATE db_secrets
            SET basedatos = $1
            WHERE id = $2
          `;
          
          await executeSQL(updateQuery, [databaseName, secretId]);
          
          return res.status(201).json({ 
            message: `Base de datos ${databaseName} registrada correctamente. La configuración se ha actualizado.` 
          });
        } catch (error) {
          console.error('Error al registrar base de datos SQL Server:', error);
          return res.status(500).json({ 
            message: 'Error al registrar base de datos SQL Server', 
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
    const connectionString = buildPostgresConnectionString(secret);
    
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