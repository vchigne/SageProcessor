/**
 * API para probar conexión a SQL Server usando pymssql desde Python
 * Esta API permite probar conexiones reales a SQL Server
 */

import { spawn } from 'child_process';

export default async function handler(req, res) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Obtener los parámetros de conexión del body
    const { server, port, user, password, database } = req.body;

    // Validar parámetros requeridos
    if (!server || !port) {
      return res.status(400).json({
        message: 'Faltan parámetros requeridos: server, port',
      });
    }

    // Ejecutar script Python para probar la conexión
    const scriptResult = await testSQLServerConnectionWithPython(
      server, 
      port, 
      user, 
      password, 
      database || 'master'
    );

    if (scriptResult.success) {
      return res.status(200).json({
        message: 'Conexión exitosa a SQL Server',
        details: scriptResult.details
      });
    } else {
      return res.status(500).json({
        message: `Error al conectar a SQL Server: ${scriptResult.error}`,
        details: {
          error: scriptResult.error,
          errorCode: scriptResult.errorCode
        }
      });
    }
  } catch (error) {
    console.error('Error en test-sqlserver-connection:', error);
    return res.status(500).json({
      message: 'Error en el servidor al probar conexión con SQL Server',
      error: error.message
    });
  }
}

/**
 * Probar conexión a SQL Server usando pymssql desde Python
 * 
 * @param {string} server - Dirección del servidor
 * @param {number} port - Puerto
 * @param {string} user - Usuario
 * @param {string} password - Contraseña
 * @param {string} database - Base de datos
 * @returns {Promise<Object>} Resultado de la prueba
 */
function testSQLServerConnectionWithPython(server, port, user, password, database) {
  return new Promise((resolve, reject) => {
    // Crear un proceso Python para probar la conexión
    const pythonProcess = spawn('python', ['-c', `
import sys
import json
import pymssql

try:
    # Intentar conectar a SQL Server
    conn = pymssql.connect(
        server='${server}',
        port=${port},
        user='${user}',
        password='${password}',
        database='${database}',
        charset='utf8',
        timeout=10  # Timeout en segundos
    )
    
    # Si llegamos aquí, la conexión fue exitosa
    cursor = conn.cursor()
    
    # Obtener la versión de SQL Server
    cursor.execute('SELECT @@VERSION')
    version = cursor.fetchone()[0]
    
    # Contar tablas en la base de datos actual
    cursor.execute("SELECT COUNT(*) FROM sys.tables")
    table_count = cursor.fetchone()[0]
    
    # Cerrar la conexión
    conn.close()
    
    # Retornar éxito
    result = {
        'success': True,
        'details': {
            'version': version,
            'table_count': table_count,
            'server': '${server}',
            'port': ${port},
            'database': '${database}'
        }
    }
    print(json.dumps(result))
    sys.exit(0)
except Exception as e:
    # En caso de error, retornar el mensaje
    result = {
        'success': False,
        'error': str(e),
        'errorCode': type(e).__name__
    }
    print(json.dumps(result))
    sys.exit(1)
`]);

    let resultData = '';
    let errorData = '';

    // Capturar la salida estándar
    pythonProcess.stdout.on('data', (data) => {
      resultData += data.toString();
    });

    // Capturar la salida de error
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    // Cuando el proceso termina
    pythonProcess.on('close', (code) => {
      if (code === 0 && resultData) {
        try {
          const result = JSON.parse(resultData);
          resolve(result);
        } catch (e) {
          console.error('Error parsing Python output:', e, resultData);
          reject(new Error('Error al procesar la salida del script Python'));
        }
      } else {
        console.error('Python process error:', errorData || 'No error output');
        reject(new Error(errorData || 'Error al ejecutar el script Python'));
      }
    });

    // Manejar errores del proceso
    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(new Error(`Error al iniciar el proceso Python: ${error.message}`));
    });
  });
}