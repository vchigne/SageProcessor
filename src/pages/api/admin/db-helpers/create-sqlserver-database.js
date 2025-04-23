/**
 * API para crear una base de datos real en SQL Server usando pymssql desde Python
 */

import { spawn } from 'child_process';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper para ejecutar consultas SQL en PostgreSQL
async function executeSQL(query, params = []) {
  try {
    return await pool.query(query, params);
  } catch (error) {
    console.error('Error ejecutando SQL:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Obtener los parámetros
    const { server, port, user, password, databaseName, secretId } = req.body;

    // Validar parámetros requeridos
    if (!server || !port || !user || !password || !databaseName || !secretId) {
      return res.status(400).json({
        message: 'Faltan parámetros requeridos: server, port, user, password, databaseName, secretId',
      });
    }

    // Validar formato del nombre de base de datos
    if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
      return res.status(400).json({ 
        message: 'Nombre de base de datos inválido. Use solo letras, números y guiones bajos.' 
      });
    }

    // Ejecutar script Python para crear la base de datos
    const scriptResult = await createSQLServerDatabaseWithPython(
      server, 
      port, 
      user, 
      password, 
      databaseName
    );

    if (scriptResult.success) {
      // Actualizar el secreto con la nueva base de datos
      const updateQuery = `
        UPDATE db_secrets
        SET basedatos = $1
        WHERE id = $2
      `;
      
      await executeSQL(updateQuery, [databaseName, secretId]);
      
      // Registrar un log en PostgreSQL para documentar la operación
      try {
        // Creamos primero la tabla si no existe
        await executeSQL(`
          CREATE TABLE IF NOT EXISTS db_operations_log (
            id SERIAL PRIMARY KEY,
            secreto_id INTEGER NOT NULL,
            operacion VARCHAR(100) NOT NULL,
            detalles JSONB,
            estado VARCHAR(20),
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Insertamos el registro
        const logQuery = `
          INSERT INTO db_operations_log
          (secreto_id, operacion, detalles, estado)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `;
        
        await executeSQL(logQuery, [
          secretId,
          'CREATE_DATABASE',
          JSON.stringify({
            database: databaseName,
            tipo: 'mssql',
            host: server,
            port: port,
            user: user
          }),
          'COMPLETED'
        ]);
      } catch (logError) {
        console.error('Error al registrar log:', logError);
        // Continuamos con la operación aunque falle el log
      }

      return res.status(201).json({
        message: `Base de datos ${databaseName} creada correctamente en SQL Server`,
        details: scriptResult.details
      });
    } else {
      return res.status(500).json({
        message: `Error al crear base de datos en SQL Server: ${scriptResult.error}`,
        details: {
          error: scriptResult.error,
          errorCode: scriptResult.errorCode
        }
      });
    }
  } catch (error) {
    console.error('Error en create-sqlserver-database:', error);
    return res.status(500).json({
      message: 'Error en el servidor al crear base de datos en SQL Server',
      error: error.message
    });
  }
}

/**
 * Crear una base de datos en SQL Server usando pymssql desde Python
 * 
 * @param {string} server - Dirección del servidor
 * @param {number} port - Puerto
 * @param {string} user - Usuario
 * @param {string} password - Contraseña
 * @param {string} databaseName - Nombre de la base de datos a crear
 * @returns {Promise<Object>} Resultado de la operación
 */
function createSQLServerDatabaseWithPython(server, port, user, password, databaseName) {
  return new Promise((resolve, reject) => {
    // Crear un proceso Python para crear la base de datos
    const pythonProcess = spawn('python', ['-c', `
import sys
import json
import pymssql

try:
    # Intentar conectar a SQL Server (master database)
    conn = pymssql.connect(
        server='${server}',
        port=${port},
        user='${user}',
        password='${password}',
        database='master',  # Conectar a master para crear la nueva base de datos
        charset='utf8',
        timeout=30  # Timeout en segundos (más largo para creación de DB)
    )
    
    # Si llegamos aquí, la conexión fue exitosa
    cursor = conn.cursor()
    
    # Verificar si la base de datos ya existe
    cursor.execute("SELECT name FROM sys.databases WHERE name = %s", ('${databaseName}',))
    existing_db = cursor.fetchone()
    
    if existing_db:
        # La base de datos ya existe
        result = {
            'success': True,
            'details': {
                'message': 'La base de datos ya existe',
                'database': '${databaseName}',
                'server': '${server}',
                'port': ${port}
            }
        }
    else:
        # Crear la base de datos
        cursor.execute(f"CREATE DATABASE [{databaseName}]")
        conn.commit()
        
        # Verificar que se haya creado correctamente
        cursor.execute("SELECT name FROM sys.databases WHERE name = %s", ('${databaseName}',))
        if cursor.fetchone():
            result = {
                'success': True,
                'details': {
                    'message': 'Base de datos creada correctamente',
                    'database': '${databaseName}',
                    'server': '${server}',
                    'port': ${port}
                }
            }
        else:
            result = {
                'success': False,
                'error': 'No se pudo verificar la creación de la base de datos',
                'errorCode': 'VerificationFailed'
            }
    
    # Cerrar la conexión
    conn.close()
    
    # Retornar resultado
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