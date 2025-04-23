/**
 * API para ejecutar operaciones MySQL a través de scripts Python
 * 
 * Este endpoint utiliza un script Python para realizar operaciones en bases de datos MySQL,
 * evitando así los problemas de dependencias en Node.js.
 */

// Activar modo estricto
'use strict';

// Importar módulos necesarios
import { exec } from 'child_process';
import { promisify } from 'util';

// Convertir exec en una versión basada en promesas
const execAsync = promisify(exec);

// Función principal para manejar las solicitudes
export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Obtener parámetros de la solicitud
    const { operation, server, port, user, password, database, databaseName } = req.body;
    
    // Validar parámetros requeridos
    if (!operation || !server || !port || !user) {
      return res.status(400).json({ 
        success: false,
        message: 'Faltan parámetros requeridos (operación, servidor, puerto, usuario)'
      });
    }
    
    // Crear un objeto de parámetros para el script Python
    const pythonParams = {
      operation,
      host: server,
      port,
      user,
      password: password || '',
      database: databaseName || database || null
    };
    
    try {
      // Ejecutar el script Python con los parámetros
      const { stdout, stderr } = await execAsync(`python3 mysql_helper.py '${JSON.stringify(pythonParams)}'`);
      
      if (stderr) {
        console.error('Error en script Python:', stderr);
      }
      
      // Analizar la respuesta del script Python
      let result;
      try {
        result = JSON.parse(stdout.trim());
      } catch (parseError) {
        console.error('Error al parsear la respuesta del script Python:', parseError);
        return res.status(500).json({
          success: false,
          message: 'Error al procesar la respuesta del servidor',
          error: parseError.message,
          stdout
        });
      }
      
      // Devolver el resultado
      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(500).json(result);
      }
    } catch (execError) {
      console.error('Error al ejecutar el script Python:', execError);
      
      return res.status(500).json({
        success: false,
        message: `Error al ejecutar operación MySQL: ${execError.message}`,
        error: {
          stdout: execError.stdout,
          stderr: execError.stderr
        }
      });
    }
  } catch (error) {
    console.error('Error en el handler Python MySQL:', error);
    
    return res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${error.message}`,
      error: error.stack
    });
  }
}