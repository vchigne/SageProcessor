/**
 * Cliente SFTP para operaciones del lado del servidor
 * 
 * Este módulo proporciona una interfaz para operaciones SFTP
 * ejecutadas directamente en el servidor Node.js, sin hacer llamadas
 * a API adicionales que podrían causar problemas en el contexto de API Routes.
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Lista el contenido de un directorio SFTP usando el script Python
 * @param {Object} credentials Credenciales completas
 * @param {string} directory Directorio a listar
 * @returns {Promise<Object>} Resultado del listado
 */
async function listDirectory(credentials, directory = '/') {
  return new Promise((resolve, reject) => {
    // Validaciones básicas
    if (!credentials.host) {
      return reject(new Error('Se requiere el host del servidor SFTP'));
    }
    
    if (!credentials.user) {
      return reject(new Error('Se requiere el nombre de usuario para la conexión SFTP'));
    }
    
    if (!credentials.password && !credentials.key_path) {
      return reject(new Error('Se requiere contraseña o clave SSH para la conexión SFTP'));
    }
    
    const port = credentials.port || 22;
    
    // Ejecutar el script Python para listar el directorio SFTP
    const scriptPath = path.resolve('./utils/sftp_lister.py');
    
    // Preparar los argumentos para el script
    const args = [
      scriptPath,
      credentials.host,
      port.toString(),
      credentials.user,
    ];
    
    // Agregar autenticación (contraseña o clave SSH)
    if (credentials.password) {
      args.push(credentials.password);
      args.push(''); // Clave SSH vacía
    } else if (credentials.key_path) {
      args.push(''); // Contraseña vacía
      args.push(credentials.key_path);
    } else {
      return reject(new Error('Se requiere contraseña o clave SSH para la conexión SFTP'));
    }
    
    // Agregar el directorio a listar (asegurarse de que sea '/' si está vacío)
    args.push(directory && directory !== '' ? directory : '/');
    
    // Mejorar el mensaje de log con más detalles
    console.log(`[SFTP Server] Ejecutando script Python para listar directorio '${directory || "/"}' en ${credentials.host}:${port}`);
    
    // Ejecutar el script
    const pythonProcess = spawn('python', args);
    
    let dataString = '';
    let errorString = '';
    
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error(`[SFTP Server] Error de Python: ${data.toString()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[SFTP Server] Script Python terminó con código ${code}`);
        console.error(`[SFTP Server] Error: ${errorString}`);
        return reject(new Error(errorString || 'Error desconocido al listar directorio SFTP'));
      }
      
      try {
        // Parsear la salida JSON del script
        const result = JSON.parse(dataString);
        
        if (result.error) {
          return reject(new Error(result.message || 'Error al listar directorio SFTP'));
        }
        
        resolve({
          error: false,
          path: result.path,
          parentPath: result.parentPath,
          files: result.files || [],
          folders: result.folders || [],
          message: result.message || '',
          service: 'sftp'
        });
      } catch (parseError) {
        console.error('[SFTP Server] Error al parsear la salida JSON:', parseError);
        console.error('[SFTP Server] Salida del script:', dataString);
        reject(new Error(`Error al parsear la respuesta: ${parseError.message}`));
      }
    });
  });
}

/**
 * Prueba la conexión a un servidor SFTP
 * @param {Object} credentials Credenciales completas
 * @returns {Promise<Object>} Resultado de la prueba
 */
async function testConnection(credentials) {
  try {
    // Intentamos listar el directorio raíz como test de conexión
    const result = await listDirectory(credentials, '/');
    
    return {
      success: true,
      message: 'Conexión a servidor SFTP exitosa',
      details: {
        host: credentials.host,
        port: credentials.port || 22,
        path: '/'
      }
    };
  } catch (error) {
    console.error('[SFTP Server] Error al probar conexión:', error);
    
    // Mejoramos el mensaje de error para que sea más claro
    let errorMessage = error.message || 'Error desconocido de conexión';
    
    // Detectamos errores comunes y proporcionamos mensajes más amigables
    if (errorMessage.includes('Authentication failed')) {
      errorMessage = 'Fallo de autenticación: Usuario o contraseña incorrectos';
    } else if (errorMessage.includes('Connection refused')) {
      errorMessage = 'Conexión rechazada: Verifica que el servidor SFTP esté funcionando y accesible';
    } else if (errorMessage.includes('Cannot resolve hostname')) {
      errorMessage = 'No se puede resolver el nombre del host: Verifica que el nombre del servidor sea correcto';
    } else if (errorMessage.includes('Timed out')) {
      errorMessage = 'Tiempo de espera agotado: El servidor no responde';
    }
    
    return {
      success: false,
      message: `Error al conectar con servidor SFTP: ${errorMessage}`,
      details: error
    };
  }
}

module.exports = {
  listDirectory,
  testConnection
};