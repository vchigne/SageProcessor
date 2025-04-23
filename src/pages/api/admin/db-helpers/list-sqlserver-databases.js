import { spawn } from 'child_process';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { server, port, user, password, database } = req.body;

    if (!server || !port || !user || !password) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros incompletos',
        details: {
          code: 'INVALID_PARAMS',
          sqlMessage: 'Faltan parámetros requeridos (server, port, user, password)'
        }
      });
    }

    // Ejecutar script Python para listar las bases de datos
    const result = await listSQLServerDatabases(server, port, user, password);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error listing SQL Server databases:', error);
    return res.status(500).json({
      success: false,
      message: `Error al listar bases de datos: ${error.message}`,
      details: {
        code: 'SERVER_ERROR',
        sqlMessage: error.message
      }
    });
  }
}

/**
 * Listar las bases de datos disponibles en SQL Server
 */
async function listSQLServerDatabases(host, port, user, password) {
  try {
    // Crear un proceso Python para listar las bases de datos
    const scriptResult = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', ['-c', `
import sys
import json
import pymssql

try:
    # Conectar a SQL Server (usamos 'master' para consultar todas las bases de datos)
    conn = pymssql.connect(
        server='${host}',
        port=${parseInt(port)},
        user='${user}',
        password='${password}',
        database='master',
        charset='utf8',
        timeout=10  # Timeout en segundos
    )
    
    cursor = conn.cursor(as_dict=True)
    
    # Consultar todas las bases de datos
    cursor.execute("""
        SELECT 
            name,
            database_id,
            create_date,
            state_desc,
            recovery_model_desc,
            compatibility_level,
            (SELECT COUNT(*) FROM sys.tables) as table_count
        FROM 
            sys.databases
        WHERE 
            name NOT IN ('tempdb') 
        ORDER BY 
            name
    """)
    
    # Convertir a lista de diccionarios
    databases = []
    for row in cursor.fetchall():
        # Ajustar formato de fecha para JSON
        if row['create_date']:
            row['create_date'] = row['create_date'].isoformat()
            
        # Convertir ID a entero
        if row['database_id']:
            row['database_id'] = int(row['database_id'])
            
        databases.append(row)
    
    # Cerrar la conexión
    conn.close()
    
    # Crear respuesta
    result = {
        'success': True,
        'databases': databases,
        'total': len(databases)
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
    
    if (scriptResult.success) {
      // Formatear los resultados para que sean consistentes con el resto de la API
      const formattedDatabases = scriptResult.databases.map(db => ({
        name: db.name,
        description: `${db.name} (${db.state_desc || 'ONLINE'}, modelo: ${db.recovery_model_desc || 'SIMPLE'})`,
        tables: db.table_count || 0,
        details: {
          ...db
        }
      }));
      
      return {
        success: true,
        message: 'Bases de datos listadas correctamente',
        databases: formattedDatabases
      };
    } else {
      return {
        success: false,
        message: `Error al listar bases de datos: ${scriptResult.error || 'Error desconocido'}`,
        details: {
          code: scriptResult.errorCode || 'UNKNOWN_ERROR',
          sqlMessage: scriptResult.error || 'Error al listar bases de datos'
        }
      };
    }
  } catch (error) {
    console.error('Error executing Python script:', error);
    throw error;
  }
}