/**
 * Cliente SFTP para operaciones del lado del servidor
 * 
 * Este módulo proporciona una interfaz para operaciones SFTP
 * ejecutadas directamente en el servidor Node.js, sin hacer llamadas
 * a API adicionales que podrían causar problemas en el contexto de API Routes.
 */

const { spawn } = require('child_process');
const path = require('path');

// Caché de directorio para evitar múltiples conexiones repetidas
const directoryCache = new Map();
const CACHE_TTL = 60000; // 1 minuto en ms

/**
 * Lista el contenido de un directorio SFTP usando el script Python
 * @param {Object} credentials Credenciales completas
 * @param {string} directory Directorio a listar
 * @param {boolean} useCache Si se debe usar la caché
 * @returns {Promise<Object>} Resultado del listado
 */
async function listDirectory(credentials, directory = '/', useCache = true) {
  // Generar clave de caché única para esta combinación de credenciales y directorio
  const cacheKey = `${credentials.host}:${credentials.port || 22}:${credentials.user}:${directory}`;
  
  // Verificar si hay datos en caché
  if (useCache && directoryCache.has(cacheKey)) {
    const cachedData = directoryCache.get(cacheKey);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log(`[SFTP Server] Usando datos en caché para ${credentials.host}:${credentials.port || 22} ruta: ${directory}`);
      return cachedData.data;
    } else {
      // Caché expirado, eliminar
      directoryCache.delete(cacheKey);
    }
  }
  
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
    
    // Crear un script Python temporal con timeout reducido
    const pythonScript = `
import paramiko
import json
import sys
import os
import logging
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SFTP_Lister')

def list_directory(hostname, port, username, password, key_path, directory):
    try:
        logger.info(f"Conectando a {hostname}:{port} como {username}")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Usar timeout más largo para permitir conexiones lentas (15 segundos)
        connect_kwargs = {
            'hostname': hostname,
            'port': port,
            'username': username,
            'timeout': 15
        }
        
        # Conectar con contraseña o clave
        if key_path and key_path.strip():
            try:
                privkey = paramiko.RSAKey.from_private_key_file(key_path)
                connect_kwargs['pkey'] = privkey
            except Exception as key_error:
                logger.error(f"Error al cargar clave SSH: {key_error}")
                return {"error": True, "message": f"Error al cargar clave SSH: {str(key_error)}"}
        elif password:
            connect_kwargs['password'] = password
        else:
            return {"error": True, "message": "Se requiere contraseña o clave SSH"}
        
        # Intentar conexión con timeout
        try:
            ssh.connect(**connect_kwargs)
        except paramiko.ssh_exception.SSHException as ssh_error:
            if "Error reading SSH protocol banner" in str(ssh_error):
                logger.error(f"Error de timeout al conectar: {ssh_error}")
                return {"error": True, "message": "Tiempo de espera agotado al conectar al servidor SFTP"}
            else:
                logger.error(f"Error SSH: {ssh_error}")
                return {"error": True, "message": f"Error en la conexión SFTP: {str(ssh_error)}"}
        except TimeoutError:
            logger.error("Tiempo de espera agotado al conectar al servidor SFTP")
            return {"error": True, "message": "Tiempo de espera agotado al conectar al servidor SFTP"}
        except Exception as generic_error:
            logger.error(f"Error de conexión: {generic_error}")
            return {"error": True, "message": f"Error de conexión: {str(generic_error)}"}
        
        # Obtener cliente SFTP
        sftp = ssh.open_sftp()
        
        # Normalizar el directorio (expansión de ~)
        if directory == '~' or directory == '':
            home_dir = sftp.normalize('.')
            logger.info(f"Usando directorio home para Dreamhost: {home_dir}")
            directory = home_dir
        
        # Listar el directorio
        logger.info(f"Intentando listar directorio: '{directory}'")
        
        try:
            file_list = []
            folder_list = []
            
            for item in sftp.listdir_attr(directory):
                is_dir = False
                
                # Determinar si es directorio
                try:
                    is_dir = stat.S_ISDIR(item.st_mode)
                except:
                    # Si falla, intentar con otro método
                    try:
                        is_dir = sftp.isdir(os.path.join(directory, item.filename))
                    except:
                        # Si todo falla, usar heurística
                        is_dir = not item.filename.contains('.')
                
                # Modificar rutas para que sean absolutas
                item_path = os.path.join(directory, item.filename)
                
                # Determinar el tipo y agregar a la lista correspondiente
                if is_dir:
                    folder_list.append({
                        "name": item.filename,
                        "path": item_path,
                        "creationDate": datetime.fromtimestamp(item.st_mtime).isoformat()
                    })
                else:
                    file_list.append({
                        "name": item.filename,
                        "path": item_path,
                        "size": item.st_size,
                        "lastModified": datetime.fromtimestamp(item.st_mtime).isoformat()
                    })
            
            # Determinar directorio padre
            parent_path = os.path.dirname(directory)
            if parent_path == directory:  # Si estamos en la raíz
                parent_path = ""
            
            sftp.close()
            ssh.close()
            
            return {
                "error": False,
                "path": directory,
                "parentPath": parent_path,
                "files": file_list,
                "folders": folder_list
            }
        except Exception as list_error:
            logger.error(f"Error al listar directorio: {list_error}")
            sftp.close()
            ssh.close()
            return {"error": True, "message": f"Error al listar directorio: {str(list_error)}"}
        
    except Exception as e:
        logger.error(f"Error en la conexión SFTP: {str(e)}")
        return {"error": True, "message": f"Error en la conexión SFTP: {str(e)}"}

# Parámetros desde argumentos de línea de comandos
hostname = "${credentials.host}"
port = ${credentials.port || 22}
username = "${credentials.user}"
password = "${credentials.password || ''}"
key_path = ${credentials.key_path ? `"${credentials.key_path}"` : "None"}
directory = "${directory}"

# Importar librería para directorios
import stat

result = list_directory(hostname, port, username, password, key_path, directory)
print(json.dumps(result))
`;

    // Guardar el script en un archivo temporal
    const fs = require('fs');
    const tempScriptPath = './temp_sftp_lister.py';
    
    fs.writeFile(tempScriptPath, pythonScript, (writeErr) => {
      if (writeErr) {
        console.error('[SFTP Server] Error al escribir script temporal:', writeErr);
        return reject(new Error(`Error al preparar script para listar directorio: ${writeErr.message}`));
      }
      
      console.log(`[SFTP Server] Ejecutando script Python para listar directorio '${directory || "~"}' en ${credentials.host}:${port}`);
      
      // Ejecutar el script con un timeout para todo el proceso
      const pythonProcess = spawn('python', [tempScriptPath]);
      
      // Configurar timeout global para todo el proceso (aumentado a 30 segundos)
      const timeoutId = setTimeout(() => {
        pythonProcess.kill();
        console.error(`[SFTP Server] Timeout al listar directorio SFTP después de 30 segundos`);
        fs.unlink(tempScriptPath, () => {});
        reject(new Error('Tiempo de espera agotado al listar directorio SFTP'));
      }, 30000); // 30 segundos de timeout total
      
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
        clearTimeout(timeoutId);
        
        // Eliminar el archivo temporal
        fs.unlink(tempScriptPath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('[SFTP Server] Error al eliminar script temporal:', unlinkErr);
          }
        });
        
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
          
          const responseData = {
            error: false,
            path: result.path,
            parentPath: result.parentPath,
            files: result.files || [],
            folders: result.folders || [],
            message: result.message || '',
            service: 'sftp'
          };
          
          // Guardar en caché
          directoryCache.set(cacheKey, {
            timestamp: Date.now(),
            data: responseData
          });
          
          resolve(responseData);
        } catch (parseError) {
          console.error('[SFTP Server] Error al parsear la salida JSON:', parseError);
          console.error('[SFTP Server] Salida del script:', dataString);
          reject(new Error(`Error al parsear la respuesta: ${parseError.message}`));
        }
      });
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
    // Intentamos listar el directorio home del usuario como test de conexión
    const result = await listDirectory(credentials, '~');
    
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

/**
 * Crea un directorio en el servidor SFTP
 * @param {Object} credentials Credenciales completas
 * @param {string} directoryName Nombre del directorio a crear
 * @returns {Promise<Object>} Resultado de la operación
 */
async function createDirectory(credentials, directoryName) {
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
    
    if (!directoryName) {
      return reject(new Error('Se requiere un nombre para el directorio a crear'));
    }
    
    const port = credentials.port || 22;
    
    // Crear un script Python temporal para crear el directorio
    const pythonScript = `
import paramiko
import json
import sys
import os
import logging
from datetime import datetime

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SFTP_Creator')

def create_directory(hostname, port, username, password, key_path, directory_name):
    try:
        logger.info(f"Conectando a {hostname}:{port} como {username}")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Conectar con contraseña o clave (timeout extendido a 20 segundos)
        if key_path:
            privkey = paramiko.RSAKey.from_private_key_file(key_path)
            ssh.connect(hostname=hostname, port=port, username=username, pkey=privkey, timeout=20)
        else:
            ssh.connect(hostname=hostname, port=port, username=username, password=password, timeout=20)
        
        sftp = ssh.open_sftp()
        
        # Determinar directorio home
        home_dir = sftp.normalize('.')
        logger.info(f"Usando directorio home: {home_dir}")
        
        # Construir ruta completa del nuevo directorio
        new_dir_path = os.path.join(home_dir, directory_name)
        logger.info(f"Creando directorio: {new_dir_path}")
        
        # Verificar si ya existe
        try:
            sftp.stat(new_dir_path)
            logger.info(f"El directorio {new_dir_path} ya existe")
            already_exists = True
        except IOError:
            # El directorio no existe, crear
            logger.info(f"Creando directorio {new_dir_path}")
            sftp.mkdir(new_dir_path)
            already_exists = False
        
        # Obtener información del directorio creado
        stat = sftp.stat(new_dir_path)
        creation_time = datetime.fromtimestamp(stat.st_mtime)
        
        sftp.close()
        ssh.close()
        
        return {
            "success": True,
            "message": "Directorio creado exitosamente" if not already_exists else "El directorio ya existía",
            "already_existed": already_exists,
            "name": directory_name,
            "path": new_dir_path,
            "creationDate": creation_time.isoformat()
        }
    except Exception as e:
        logger.error(f"Error al crear directorio SFTP: {str(e)}")
        return {"success": False, "error": str(e)}

# Parámetros de la línea de comandos
hostname = "${credentials.host}"
port = ${credentials.port || 22}
username = "${credentials.user}"
password = "${credentials.password || ''}"
key_path = ${credentials.key_path ? `"${credentials.key_path}"` : "None"}
directory_name = "${directoryName}"

result = create_directory(hostname, port, username, password, key_path, directory_name)
print(json.dumps(result))
`;

    // Guardar el script en un archivo temporal
    const fs = require('fs');
    const tempScriptPath = './temp_sftp_mkdir.py';
    
    fs.writeFile(tempScriptPath, pythonScript, (writeErr) => {
      if (writeErr) {
        console.error('[SFTP Server] Error al escribir script temporal:', writeErr);
        return reject(new Error(`Error al preparar script para crear directorio: ${writeErr.message}`));
      }
      
      console.log(`[SFTP Server] Ejecutando script Python para crear directorio '${directoryName}' en ${credentials.host}:${port}`);
      
      // Ejecutar el script
      const pythonProcess = spawn('python', [tempScriptPath]);
      
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
        // Eliminar el archivo temporal
        fs.unlink(tempScriptPath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('[SFTP Server] Error al eliminar script temporal:', unlinkErr);
          }
        });
        
        if (code !== 0) {
          console.error(`[SFTP Server] Script Python terminó con código ${code}`);
          console.error(`[SFTP Server] Error: ${errorString}`);
          return reject(new Error(errorString || 'Error desconocido al crear directorio SFTP'));
        }
        
        try {
          // Parsear la salida JSON del script
          const result = JSON.parse(dataString);
          
          if (!result.success) {
            return reject(new Error(result.error || 'Error al crear directorio SFTP'));
          }
          
          resolve({
            name: result.name,
            path: result.path,
            creationDate: result.creationDate,
            alreadyExisted: result.already_existed
          });
        } catch (parseError) {
          console.error('[SFTP Server] Error al parsear la salida JSON:', parseError);
          console.error('[SFTP Server] Salida del script:', dataString);
          reject(new Error(`Error al parsear la respuesta: ${parseError.message}`));
        }
      });
    });
  });
}

module.exports = {
  listDirectory,
  testConnection,
  createDirectory
};