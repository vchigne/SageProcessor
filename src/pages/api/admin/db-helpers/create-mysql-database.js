/**
 * API para crear una base de datos en un servidor MySQL
 * 
 * Este endpoint realiza una conexión real al servidor MySQL
 * y crea una nueva base de datos.
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
    // Obtener credenciales y nombre de base de datos del cuerpo de la solicitud
    const { server, port, user, password, database, databaseName, secretId } = req.body;
    
    // Usamos databaseName si está definido, si no, usamos database
    const dbName = databaseName || database;
    
    // Validar parámetros requeridos
    if (!server || !port || !user || !dbName) {
      return res.status(400).json({ 
        success: false,
        message: 'Faltan parámetros requeridos (servidor, puerto, usuario, nombre base de datos)'
      });
    }
    
    const host = server;
    
    // Crear conexión a MySQL (sin especificar base de datos porque la vamos a crear)
    const connection = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password: password || '',
      // No especificamos una base de datos para poder crear una nueva
      connectTimeout: 10000, // 10 segundos
    });
    
    // Verificar si la base de datos ya existe
    const [rows] = await connection.execute(`
      SELECT 
        SCHEMA_NAME
      FROM 
        information_schema.SCHEMATA
      WHERE 
        SCHEMA_NAME = ?
    `, [dbName]);
    
    if (rows.length > 0) {
      await connection.end();
      return res.status(200).json({
        success: true,
        message: `La base de datos '${dbName}' ya existe`,
        details: {
          database: dbName,
          existingDatabase: true
        }
      });
    }
    
    // Crear la base de datos
    try {
      await connection.execute(`CREATE DATABASE \`${dbName}\``);
      
      // Verificar que la base de datos se creó correctamente
      const [checkRows] = await connection.execute(`
        SELECT 
          SCHEMA_NAME
        FROM 
          information_schema.SCHEMATA
        WHERE 
          SCHEMA_NAME = ?
      `, [dbName]);
      
      if (checkRows.length === 0) {
        await connection.end();
        return res.status(500).json({
          success: false,
          message: `No se pudo verificar la creación de la base de datos '${dbName}'`,
          details: {
            database: dbName
          }
        });
      }
      
      await connection.end();
      
      return res.status(201).json({
        success: true,
        message: `Base de datos '${dbName}' creada correctamente`,
        details: {
          database: dbName,
          secretId: secretId
        }
      });
    } catch (createError) {
      await connection.end();
      
      return res.status(500).json({
        success: false,
        message: `Error al crear la base de datos: ${createError.message}`,
        details: {
          database: dbName,
          error: {
            code: createError.code,
            errno: createError.errno,
            sqlState: createError.sqlState,
            sqlMessage: createError.sqlMessage
          }
        }
      });
    }
  } catch (error) {
    console.error('Error al crear base de datos MySQL:', error);
    
    // Devolver error detallado
    return res.status(500).json({
      success: false,
      message: `Error al crear base de datos MySQL: ${error.message}`,
      error: {
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      }
    });
  }
}