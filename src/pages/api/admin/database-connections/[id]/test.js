import { Pool } from 'pg';
import { 
  testPostgresConnection, 
  testMySQLConnection,
  testSQLServerConnection,
  testDuckDBConnection
} from '@/utils/db-test-utils';

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
 * API para probar la conexión a una base de datos específica
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
    let estado_conexion = 'pendiente';
    
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
        estado_conexion = testResult.success ? 'activo' : 'error';
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
        estado_conexion = testResult.success ? 'activo' : 'error';
        break;
      case 'mssql':
        testResult = await testSQLServerConnection(
          connection.servidor, 
          connection.puerto, 
          connection.usuario, 
          connection.contrasena, 
          connection.base_datos,
          combinedConfig
        );
        estado_conexion = testResult.success ? 'activo' : 'error';
        break;
      case 'duckdb':
        testResult = testDuckDBConnection(connection.base_datos);
        estado_conexion = testResult.success ? 'activo' : 'error';
        break;
      default:
        testResult = { success: false, message: 'Tipo de base de datos no soportado' };
        estado_conexion = 'error';
    }
    
    // Asegurarse de que el estado de conexión sea válido
    if (!['activo', 'error', 'inactivo'].includes(estado_conexion)) {
      estado_conexion = testResult.success ? 'activo' : 'error';
    }
    
    // Actualizar estado de la conexión en la base de datos
    const updateQuery = `
      UPDATE database_connections
      SET 
        estado_conexion = $1,
        ultimo_test = NOW()
      WHERE id = $2
    `;
    
    await executeSQL(updateQuery, [estado_conexion, id]);
    
    if (testResult.success) {
      return res.status(200).json({ 
        message: testResult.message || 'Conexión exitosa a la base de datos',
        details: testResult.details || {},
        estado_conexion
      });
    } else {
      return res.status(400).json({ 
        message: testResult.message || 'Error al conectar a la base de datos',
        details: testResult.details || {},
        estado_conexion
      });
    }
  } catch (error) {
    console.error('Error al probar conexión de BD:', error);
    
    // Actualizar estado a error en caso de excepción
    try {
      const updateQuery = `
        UPDATE database_connections
        SET 
          estado_conexion = 'error',
          ultimo_test = NOW()
        WHERE id = $1
      `;
      await executeSQL(updateQuery, [id]);
    } catch (updateError) {
      console.error('Error al actualizar estado de conexión:', updateError);
    }
    
    return res.status(500).json({ 
      message: 'Error al probar conexión a la base de datos',
      error: error.message,
      estado_conexion: 'error'
    });
  }
}