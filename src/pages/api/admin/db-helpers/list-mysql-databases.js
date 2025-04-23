/**
 * API para listar bases de datos desde un servidor MySQL
 * 
 * Este endpoint realiza una conexión real al servidor MySQL
 * y devuelve la lista completa de bases de datos disponibles.
 */

// Activar modo estricto
'use strict';

// Importar módulos
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Obtener credenciales del cuerpo de la solicitud
    const { server, port, user, password } = req.body;
    
    // Validar parámetros requeridos
    if (!server || !port || !user) {
      return res.status(400).json({ 
        success: false,
        message: 'Faltan parámetros requeridos (servidor, puerto, usuario)'
      });
    }
    
    const host = server;
    
    // Crear conexión a MySQL (sin especificar base de datos para poder listar todas)
    const connection = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password: password || '',
      // No especificamos una base de datos para poder listar todas
      connectTimeout: 10000, // 10 segundos
    });
    
    // Ejecutar query para listar todas las bases de datos
    const [rows] = await connection.execute(`
      SELECT 
        SCHEMA_NAME as name,
        DEFAULT_CHARACTER_SET_NAME as encoding,
        CAST(NULL as CHAR) as owner,
        (
          SELECT COUNT(*) 
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = SCHEMA_NAME
        ) as table_count
      FROM 
        information_schema.SCHEMATA
      WHERE 
        SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
      ORDER BY 
        SCHEMA_NAME
    `);
    
    // Añadir bases de datos del sistema al principio
    const systemDatabases = [
      {
        name: "information_schema",
        description: "Base de datos information_schema (sistema)",
        encoding: "utf8",
        owner: "mysql",
        tables: 0,
        system: true
      },
      {
        name: "mysql",
        description: "Base de datos mysql (sistema)",
        encoding: "utf8",
        owner: "mysql",
        tables: 0,
        system: true
      },
      {
        name: "performance_schema",
        description: "Base de datos performance_schema (sistema)",
        encoding: "utf8",
        owner: "mysql",
        tables: 0,
        system: true
      },
      {
        name: "sys",
        description: "Base de datos sys (sistema)",
        encoding: "utf8",
        owner: "mysql",
        tables: 0,
        system: true
      }
    ];
    
    // Formatear bases de datos de usuario
    const userDatabases = rows.map(db => ({
      name: db.name,
      description: `${db.name} (encoding: ${db.encoding})`,
      encoding: db.encoding,
      owner: db.owner || 'mysql',
      tables: parseInt(db.table_count) || 0,
      system: false
    }));
    
    // Cerrar conexión
    await connection.end();
    
    // Combinar bases de datos del sistema y de usuario
    const databases = [...systemDatabases, ...userDatabases];
    
    // Devolver respuesta exitosa
    return res.status(200).json({
      success: true,
      databases,
      total: databases.length,
      message: `Se encontraron ${userDatabases.length} bases de datos de usuario y 4 bases de datos del sistema`
    });
    
  } catch (error) {
    console.error('Error al listar bases de datos MySQL:', error);
    
    // Devolver error detallado
    return res.status(500).json({
      success: false,
      message: `Error al listar bases de datos MySQL: ${error.message}`,
      error: {
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      }
    });
  }
}