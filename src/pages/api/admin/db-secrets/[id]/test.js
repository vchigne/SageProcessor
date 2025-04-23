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
    
    // Extraer opciones de conexión
    let connectionOptions = {};
    try {
      if (typeof secret.opciones_conexion === 'string') {
        connectionOptions = JSON.parse(secret.opciones_conexion);
      } else if (secret.opciones_conexion) {
        connectionOptions = secret.opciones_conexion;
      }
    } catch (e) {
      // Ignorar error de parseo
      connectionOptions = {};
    }
    
    // Probar conexión según el tipo de base de datos
    switch (secret.tipo) {
      case 'postgresql':
        testResult = await testPostgresConnection(
          secret.servidor, 
          secret.puerto, 
          secret.usuario, 
          secret.contrasena, 
          'postgres', // Siempre probar con la base de datos postgres primero
          null, // No probar esquema en el test de secreto
          connectionOptions
        );
        break;
      case 'mysql':
        testResult = testMySQLConnection(
          secret.servidor, 
          secret.puerto, 
          secret.usuario, 
          secret.contrasena, 
          secret.basedatos || 'mysql',
          connectionOptions
        );
        break;
      case 'mssql':
        testResult = await testSQLServerConnection(
          secret.servidor, 
          secret.puerto, 
          secret.usuario, 
          secret.contrasena, 
          secret.basedatos || 'master',
          connectionOptions
        );
        break;
      case 'duckdb':
        testResult = testDuckDBConnection(secret.basedatos);
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