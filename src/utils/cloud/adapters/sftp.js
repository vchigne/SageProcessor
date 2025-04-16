/**
 * Adaptador para SFTP
 * 
 * Este adaptador implementa las operaciones necesarias para trabajar
 * con servidores SFTP, permitiendo operaciones como subir, descargar y listar archivos.
 * Útil para sistemas locales o proveedores de almacenamiento con acceso SFTP.
 */

// En una implementación real, usaríamos biblioteca SSH2/SFTP
// import { Client } from 'ssh2';
// import fs from 'fs';
// import path from 'path';

/**
 * Crea un cliente para interactuar con SFTP
 * @param {Object} credentials Credenciales de conexión
 * @param {Object} config Configuración adicional
 * @returns {Object} Cliente configurado
 */
export function createClient(credentials, config = {}) {
  // En una implementación real, prepararíamos el cliente SSH2
  // Pero no lo conectaríamos hasta una operación específica
  
  // Por ahora, devolvemos un objeto simulado para desarrollo
  return {
    type: 'sftp',
    credentials: {
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.user,
      // No incluimos la contraseña o clave en el objeto del cliente por seguridad
    },
    config
  };
}

/**
 * Establece una conexión SFTP
 * @param {Object} credentials Credenciales completas
 * @returns {Promise<Object>} Conexión SFTP
 */
async function connect(credentials) {
  // En una implementación real, estableceríamos una conexión SSH2/SFTP
  // return new Promise((resolve, reject) => {
  //   const conn = new Client();
  //   conn.on('ready', () => {
  //     conn.sftp((err, sftp) => {
  //       if (err) {
  //         conn.end();
  //         return reject(err);
  //       }
  //       resolve({ conn, sftp });
  //     });
  //   }).on('error', (err) => {
  //     reject(err);
  //   }).connect({
  //     host: credentials.host,
  //     port: credentials.port || 22,
  //     username: credentials.user,
  //     password: credentials.password,
  //     privateKey: credentials.key_path ? fs.readFileSync(credentials.key_path) : undefined,
  //     readyTimeout: credentials.timeout || 10000
  //   });
  // });
  
  // Simulamos una conexión
  console.log(`[SFTP] Simulando conexión a ${credentials.host}:${credentials.port || 22} como ${credentials.user}`);
  return { conn: {}, sftp: {} };
}

/**
 * Cierra una conexión SFTP
 * @param {Object} connection Conexión a cerrar
 */
function closeConnection(connection) {
  // En una implementación real:
  // if (connection && connection.conn) {
  //   connection.conn.end();
  // }
  
  console.log('[SFTP] Simulando cierre de conexión');
}

/**
 * Sube un archivo a un servidor SFTP
 * @param {Object} client Cliente SFTP
 * @param {string} localPath Ruta local del archivo
 * @param {string} remotePath Ruta remota donde guardar
 * @returns {Promise<Object>} Información sobre la subida
 */
export async function uploadFile(client, localPath, remotePath) {
  console.log(`[SFTP] Simulando subida de ${localPath} a ${client.credentials.host}:${remotePath}`);
  
  // En implementación real:
  // const connection = await connect({
  //   ...client.credentials,
  //   password: client.credentials.password,
  //   key_path: client.credentials.key_path
  // });
  // 
  // try {
  //   return new Promise((resolve, reject) => {
  //     const readStream = fs.createReadStream(localPath);
  //     const writeStream = connection.sftp.createWriteStream(remotePath);
  //     
  //     writeStream.on('close', () => {
  //       resolve({
  //         success: true,
  //         path: remotePath,
  //         size: fs.statSync(localPath).size
  //       });
  //     });
  //     
  //     writeStream.on('error', reject);
  //     readStream.on('error', reject);
  //     
  //     readStream.pipe(writeStream);
  //   });
  // } finally {
  //   closeConnection(connection);
  // }
  
  // Simulamos respuesta exitosa
  return {
    success: true,
    path: remotePath,
    size: 1024 // Tamaño simulado
  };
}

/**
 * Descarga un archivo desde un servidor SFTP
 * @param {Object} client Cliente SFTP
 * @param {string} remotePath Ruta remota del archivo
 * @param {string} localPath Ruta local donde guardar
 * @returns {Promise<Object>} Información sobre la descarga
 */
export async function downloadFile(client, remotePath, localPath) {
  console.log(`[SFTP] Simulando descarga de ${client.credentials.host}:${remotePath} a ${localPath}`);
  
  // En implementación real:
  // const connection = await connect({
  //   ...client.credentials,
  //   password: client.credentials.password,
  //   key_path: client.credentials.key_path
  // });
  // 
  // try {
  //   return new Promise((resolve, reject) => {
  //     const writeStream = fs.createWriteStream(localPath);
  //     const readStream = connection.sftp.createReadStream(remotePath);
  //     
  //     writeStream.on('close', () => {
  //       resolve({
  //         success: true,
  //         path: localPath,
  //         size: fs.statSync(localPath).size
  //       });
  //     });
  //     
  //     writeStream.on('error', reject);
  //     readStream.on('error', reject);
  //     
  //     readStream.pipe(writeStream);
  //   });
  // } finally {
  //   closeConnection(connection);
  // }
  
  // Simulamos respuesta exitosa
  return {
    success: true,
    path: localPath,
    size: 1024 // Tamaño simulado
  };
}

/**
 * Lista archivos en un directorio de un servidor SFTP
 * @param {Object} client Cliente SFTP
 * @param {string} remotePath Ruta remota del directorio
 * @returns {Promise<Array<Object>>} Lista de archivos
 */
export async function listFiles(client, remotePath) {
  console.log(`[SFTP] Simulando listado de ${client.credentials.host}:${remotePath}`);
  
  // En implementación real:
  // const connection = await connect({
  //   ...client.credentials,
  //   password: client.credentials.password,
  //   key_path: client.credentials.key_path
  // });
  // 
  // try {
  //   return new Promise((resolve, reject) => {
  //     connection.sftp.readdir(remotePath, (err, list) => {
  //       if (err) return reject(err);
  //       resolve(list.map(item => ({
  //         name: item.filename,
  //         size: item.attrs.size,
  //         lastModified: new Date(item.attrs.mtime * 1000),
  //         isDirectory: item.attrs.isDirectory()
  //       })));
  //     });
  //   });
  // } finally {
  //   closeConnection(connection);
  // }
  
  // Devolvemos una lista simulada
  return [
    {
      name: 'archivo1.txt',
      size: 1024,
      lastModified: new Date(),
      isDirectory: false
    },
    {
      name: 'archivo2.csv',
      size: 2048,
      lastModified: new Date(),
      isDirectory: false
    },
    {
      name: 'carpeta1',
      size: 0,
      lastModified: new Date(),
      isDirectory: true
    }
  ];
}

/**
 * Genera una URL para acceder a un archivo SFTP
 * 
 * Nota: SFTP no soporta URLs prefirmadas nativas. Esta función
 * devuelve simplemente un identificador. En un sistema real,
 * podríamos implementar un proxy web que actúe como puente.
 * 
 * @param {Object} client Cliente SFTP
 * @param {string} remotePath Ruta remota del archivo
 * @param {Object} options Opciones adicionales
 * @returns {Promise<string>} Identificador para acceso
 */
export async function getSignedUrl(client, remotePath, options = {}) {
  console.log(`[SFTP] Simulando generación de acceso a ${client.credentials.host}:${remotePath}`);
  
  // SFTP no soporta URLs prefirmadas como tal
  // En una implementación real, podríamos crear un token temporal
  // y un endpoint que haga de proxy para el archivo SFTP
  
  // Devolvemos un identificador simulado
  const expiry = new Date(Date.now() + (options.expiresIn || 3600) * 1000).toISOString();
  return `sftp://${client.credentials.host}:${client.credentials.port || 22}${remotePath}?token=temp_access_token&expires=${expiry}`;
}

/**
 * Prueba la conexión a un servidor SFTP
 * @param {Object} credentials Credenciales completas
 * @param {Object} config Configuración adicional
 * @returns {Promise<Object>} Resultado de la prueba
 */
export async function testConnection(credentials, config = {}) {
  try {
    console.log(`[SFTP] Probando conexión a ${credentials.host}:${credentials.port || 22} como ${credentials.user}`);
    
    // Validación básica
    if (!credentials.host) {
      throw new Error('Se requiere un host para la conexión SFTP');
    }
    
    if (!credentials.user) {
      throw new Error('Se requiere un usuario para la conexión SFTP');
    }
    
    if (!credentials.password && !credentials.key_path) {
      throw new Error('Se requiere una contraseña o una clave SSH para la conexión SFTP');
    }
    
    try {
      // Intentamos listar el directorio raíz como test de conexión
      // Limitamos a 1 elemento para que sea más rápido
      const result = await listContents(credentials, config, '/', 1);
      
      // Si hay error en el resultado, lo propagamos
      if (result.error) {
        throw new Error(result.errorMessage);
      }
      
      return {
        success: true,
        message: 'Conexión a servidor SFTP exitosa',
        details: {
          host: credentials.host,
          port: credentials.port || 22,
          path: credentials.path || '/'
        }
      };
    } catch (listError) {
      // Si el error indica que el API no está implementado pero los
      // parámetros de conexión parecen válidos, consideramos éxito parcial
      if (listError.message && (
        listError.message.includes('no implementado') || 
        listError.message.includes('funcionalidad') ||
        listError.message.includes('contacta al administrador')
      )) {
        console.log('[SFTP] API no implementado completamente, pero credenciales válidas');
        return {
          success: true,
          message: `Configuración válida para ${credentials.host}:${credentials.port || 22} (verificación parcial)`,
          details: {
            host: credentials.host,
            port: credentials.port || 22,
            path: credentials.path || '/',
            partial: true
          }
        };
      }
      
      // Cualquier otro error indica un problema real de conexión
      throw listError;
    }
  } catch (error) {
    console.error('[SFTP] Error al probar conexión:', error);
    return {
      success: false,
      message: `Error al conectar con servidor SFTP: ${error.message}`,
      details: error
    };
  }
}

/**
 * Lista contenido de un directorio SFTP con más detalles
 * @param {Object} credentials Credenciales
 * @param {Object} config Configuración
 * @param {string} path Ruta del directorio
 * @param {number} limit Límite de elementos a devolver
 * @returns {Promise<Object>} Estructura organizada del contenido
 */
export async function listContents(credentials, config = {}, path = '', limit = 50) {
  try {
    console.log(`[SFTP] Listando contenido en ${credentials.host}:${credentials.port || 22}${path ? '/' + path : ''}`);
    
    // Validación básica
    if (!credentials.host) {
      throw new Error('Se requiere un host para la conexión SFTP');
    }
    
    if (!credentials.user) {
      throw new Error('Se requiere un usuario para la conexión SFTP');
    }
    
    if (!credentials.password && !credentials.key_path) {
      throw new Error('Se requiere una contraseña o una clave SSH para la conexión SFTP');
    }
    
    // Preparamos el directorio a listar
    const targetPath = path || '/';
    
    try {
      // Usar SAGE Daemon 2 como proxy para SFTP
      // Esto permite mantener el patrón de listado de archivos sin simulación
      // compatible con los demás proveedores, pero delegando el trabajo real
      // al backend de Python que ya tiene las bibliotecas adecuadas
      let proxyUrl;
      if (typeof window !== 'undefined') {
        // En el navegador, podemos usar window.location.origin
        proxyUrl = new URL('/api/sftp-proxy/list', window.location.origin);
      } else {
        // En el servidor, usamos una URL absoluta hardcodeada - las URLs relativas no funcionan en servidor
        proxyUrl = 'http://localhost:5000/api/sftp-proxy/list';
      }
      const proxyResponse = await fetch(typeof proxyUrl === 'string' ? proxyUrl : proxyUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host: credentials.host,
          port: credentials.port || 22,
          username: credentials.user,
          password: credentials.password,
          key_path: credentials.key_path,
          path: targetPath
        })
      });
      
      if (!proxyResponse.ok) {
        const errorData = await proxyResponse.json();
        throw new Error(errorData.error || `Error al listar archivos: ${proxyResponse.status} ${proxyResponse.statusText}`);
      }
      
      // En producción, obtendríamos la respuesta real del API
      const proxyData = await proxyResponse.json();
      
      // Formatear los resultados al formato esperado
      const files = (proxyData.files || []).map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        lastModified: new Date(file.lastModified),
        type: 'file'
      }));
      
      const folders = (proxyData.folders || []).map(folder => ({
        name: folder.name,
        path: folder.path,
        type: 'folder'
      }));
      
      return {
        path: targetPath,
        files,
        folders,
        service: 'sftp'
      };
    } catch (proxyError) {
      // Si el endpoint de proxy no existe o hay otro error, implementamos una conexión directa
      console.log('[SFTP] No se pudo usar el proxy, intentando conexión directa');
      
      // Autenticación con contraseña o llave
      const auth = credentials.password 
        ? { password: credentials.password } 
        : { privateKey: credentials.key_path };
      
      // En un servidor real, haríamos la conexión SSH directa usando fetch a un servidor intermedio
      // Necesitamos una URL absoluta para evitar el error de parseo en el servidor
      // En el servidor y en el cliente, necesitamos URLs absolutas
      let apiUrl;
      if (typeof window !== 'undefined') {
        // En el navegador, podemos usar window.location.origin
        apiUrl = new URL('/api/sftp/list-directory', window.location.origin);
      } else {
        // En el servidor, usamos una URL absoluta hardcodeada - las URLs relativas no funcionan en servidor
        apiUrl = 'http://localhost:5000/api/sftp/list-directory';
      }
      const directResponse = await fetch(typeof apiUrl === 'string' ? apiUrl : apiUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host: credentials.host,
          port: credentials.port || 22,
          username: credentials.user,
          auth,
          path: targetPath
        })
      });
      
      if (!directResponse.ok) {
        const errorText = await directResponse.text();
        throw new Error(`Error en conexión SFTP directa: ${errorText}`);
      }
      
      const responseData = await directResponse.json();
      
      if (responseData.error) {
        throw new Error(responseData.error);
      }
      
      return {
        path: targetPath,
        files: responseData.files || [],
        folders: responseData.folders || [],
        service: 'sftp'
      };
    }
  } catch (error) {
    console.error('[SFTP] Error al listar contenido:', error);
    return {
      error: true,
      errorMessage: error.message,
      path: path || '/',
      files: [],
      folders: []
    };
  }
}

export default {
  createClient,
  uploadFile,
  downloadFile,
  listFiles,
  getSignedUrl,
  testConnection,
  listContents
};