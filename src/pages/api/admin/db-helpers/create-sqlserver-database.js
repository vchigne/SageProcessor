import { spawn } from 'child_process';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { server, port, user, password, database, databaseName } = req.body;
    
    // Usar databaseName si está presente, database como alternativa
    const dbName = databaseName || database;

    if (!server || !port || !user || !password || !dbName) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros incompletos',
        details: {
          code: 'INVALID_PARAMS',
          sqlMessage: 'Faltan parámetros requeridos (server, port, user, password, database/databaseName)'
        }
      });
    }

    // Ejecutar script Python para crear la base de datos
    const result = await createSQLServerDatabase(server, port, user, password, dbName);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error creating SQL Server database:', error);
    return res.status(500).json({
      success: false,
      message: `Error al crear la base de datos: ${error.message}`,
      details: {
        code: 'SERVER_ERROR',
        sqlMessage: error.message
      }
    });
  }
}

/**
 * Crear una base de datos en SQL Server
 */
async function createSQLServerDatabase(host, port, user, password, database) {
  try {
    // Crear un proceso Python para crear la base de datos
    const scriptResult = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', ['-c', `
# Script simplificado que utiliza Try/Except para mayor robustez
import sys
import json
import traceback

# Intentar ejecutar el comando
try:
    import pymssql
    
    # Conectar a la base de datos master
    conn = pymssql.connect(
        server='${host}',
        port=${parseInt(port)},
        user='${user}',
        password='${password}',
        database='master',
        charset='utf8',
        autocommit=True
    )
    
    cursor = conn.cursor()
    
    # Verificar si la base de datos ya existe
    cursor.execute("SELECT name FROM sys.databases WHERE name = %s", ('${database}',))
    database_exists = cursor.fetchone() is not None
    
    if database_exists:
        result = {
            'success': True,
            'message': 'La base de datos ya existe',
            'details': {
                'database': '${database}',
                'created': False,
                'existed': True
            }
        }
    else:
        # Crear la base de datos
        cursor.execute("CREATE DATABASE [${database}]")
        
        # Verificar que se haya creado correctamente
        cursor.execute("SELECT name FROM sys.databases WHERE name = %s", ('${database}',))
        database_created = cursor.fetchone() is not None
        
        if database_created:
            result = {
                'success': True,
                'message': 'Base de datos creada exitosamente',
                'details': {
                    'database': '${database}',
                    'created': True,
                    'existed': False
                }
            }
        else:
            result = {
                'success': False,
                'message': 'No se pudo crear la base de datos',
                'details': {
                    'database': '${database}',
                    'created': False,
                    'existed': False
                }
            }
    
    # Cerrar la conexión
    conn.close()
    
    # Imprimir el resultado para que lo recoja Node.js
    print(json.dumps(result))
    
except Exception as e:
    # Capturar cualquier excepción
    error_trace = traceback.format_exc()
    error_message = str(e)
    
    result = {
        'success': False,
        'message': f'Error: {error_message}',
        'details': {
            'error': error_message,
            'traceback': error_trace
        }
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
            reject(new Error(`Error al procesar la salida del script Python: ${resultData}`));
          }
        } else {
          console.error('Python process error (code ' + code + '):', errorData || 'No error output', 'Result data:', resultData);
          
          // Verificar si pymssql está instalado
          const checkPymssql = spawn('python', ['-c', 'import pymssql; print("pymssql installed, version:", pymssql.__version__)']);
          
          let pymssqlCheck = '';
          checkPymssql.stdout.on('data', (data) => {
            pymssqlCheck += data.toString();
          });
          
          let pymssqlError = '';
          checkPymssql.stderr.on('data', (data) => {
            pymssqlError += data.toString();
          });
          
          checkPymssql.on('close', (checkCode) => {
            console.log('PyMSSQL check:', pymssqlCheck || 'No output', 'Error:', pymssqlError || 'No error');
            reject(new Error(`Error al ejecutar el script Python (código ${code}): ${errorData || 'Error desconocido'}`));
          });
        }
      });

      // Manejar errores del proceso
      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        reject(new Error(`Error al iniciar el proceso Python: ${error.message}`));
      });
    });
    
    if (scriptResult.success) {
      return {
        success: true,
        message: scriptResult.message || 'Base de datos creada o verificada correctamente',
        details: scriptResult.details || { database }
      };
    } else {
      // Construir mensaje de error detallado
      let errorMessage = 'Error al crear la base de datos';
      let errorDetails = {};
      
      if (scriptResult.message) {
        errorMessage = scriptResult.message;
      }
      
      if (scriptResult.details) {
        errorDetails = scriptResult.details;
      } else if (scriptResult.error) {
        errorDetails.sqlMessage = scriptResult.error;
        errorDetails.code = scriptResult.errorCode || 'UNKNOWN_ERROR';
      }
      
      return {
        success: false,
        message: errorMessage,
        details: errorDetails
      };
    }
  } catch (error) {
    console.error('Error executing Python script:', error);
    throw error;
  }
}