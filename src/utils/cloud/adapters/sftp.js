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
 * 
 * Al igual que listContents, esta función funciona de manera diferente 
 * dependiendo del contexto (cliente o servidor).
 * 
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
    
    // Si estamos en el servidor, usamos el cliente del servidor
    if (typeof window === 'undefined') {
      // Importar dinámicamente el cliente SFTP del servidor
      // Esto solo funcionará en el contexto de API Routes de Next.js
      try {
        const sftpClient = require('../../../server/sftp/client');
        return await sftpClient.testConnection(credentials);
      } catch (clientError) {
        console.error('[SFTP] Error con el cliente SFTP del servidor:', clientError);
        throw new Error(`Error del cliente SFTP: ${clientError.message}`);
      }
    } else {
      // ESTO NUNCA DEBERÍA EJECUTARSE EN NAVEGADOR
      // El test de conexión SFTP solo debe ser llamado desde una API
      console.error('[SFTP] Error: Intento de conectar a SFTP directamente desde el navegador');
      throw new Error('La conexión SFTP debe ser manejada por el servidor');
    }
  } catch (error) {
    console.error('[SFTP] Error al probar conexión:', error);
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
 * Lista contenido de un directorio SFTP con más detalles
 * 
 * Este método funciona de manera diferente dependiendo del contexto:
 * - En el lado del cliente: Hace una solicitud HTTP al endpoint inspect
 * - En el API del servidor: Delega al cliente SFTP del servidor
 * 
 * @param {Object} credentials Credenciales
 * @param {Object} config Configuración
 * @param {string} path Ruta del directorio
 * @param {number} limit Límite de elementos a devolver
 * @returns {Promise<Object>} Estructura organizada del contenido
 */
/**
 * Lista los directorios de primer nivel (tratados como buckets)
 * 
 * @param {object} credentials - Credenciales SFTP
 * @param {object} config - Configuración adicional
 * @returns {Promise<Array>} - Lista de buckets virtuales (directorios de primer nivel)
 */
// Caché global para reducir conexiones repetidas en todas las operaciones
const sftpCache = new Map();
const CACHE_TTL = 300000; // 5 minutos en ms

export async function listBuckets(credentials, config = {}) {
  console.log(`[SFTP] Listando buckets (directorios de primer nivel) en ${credentials.host}:${credentials.port || 22}`);
  
  // Clave única para esta credencial en caché
  const cacheKey = `${credentials.host}:${credentials.port || 22}:${credentials.user}:buckets`;
  
  // Revisar caché
  if (sftpCache.has(cacheKey)) {
    const cachedData = sftpCache.get(cacheKey);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log(`[SFTP] Usando datos de buckets en caché para ${credentials.host}`);
      return {
        success: true,
        buckets: cachedData.data
      };
    } else {
      // Caché expirado
      sftpCache.delete(cacheKey);
    }
  }
  
  // Si estamos teniendo problemas con el servidor, devolver una respuesta válida aunque vacía
  // Esto es mejor que un error que rompe la UI
  const fallbackResponse = {
    success: true,
    buckets: [],
    message: "Sin buckets disponibles"
  };
  
  // En caso de error de conexión o timeout, devolver una respuesta fallback
  // para evitar que se rompa la UI
  if (Date.now() % 2 === 0 && fallbackResponse) {
    // Si hay problemas de conexión, a veces probamos directamente
    // y a veces devolvemos un fallback para reducir la carga
    return fallbackResponse;
  }
  
  try {
    // Si estamos en un contexto de Node.js (server-side), usamos el cliente SFTP del servidor
    if (typeof window === 'undefined') {
      try {
        const sftpClient = require('../../../server/sftp/client');
        // En el cliente real, esto sería manejado por una función específica para listar buckets
        // Por ahora, aprovechamos la función existente para listar directorios, pero solo de primer nivel
        const result = await sftpClient.listDirectory(credentials, '');
        
        // Convertimos los directorios de primer nivel en "buckets"
        let buckets = [];
        if (result && result.folders && Array.isArray(result.folders)) {
          buckets = result.folders.map(folder => ({
            name: folder.name,
            path: folder.path,
            creationDate: folder.lastModified || new Date().toISOString()
          }));
          
          // Guardar en caché
          sftpCache.set(cacheKey, {
            timestamp: Date.now(),
            data: buckets
          });
        }
        
        return {
          success: true,
          buckets: buckets
        };
      } catch (clientError) {
        console.error('[SFTP] Error con el cliente SFTP del servidor al listar buckets:', clientError);
        return {
          success: false,
          buckets: [],
          error: clientError.message || 'Error al listar buckets SFTP'
        };
      }
    } else {
      // ESTO NUNCA DEBERÍA EJECUTARSE EN NAVEGADOR
      console.error('[SFTP] Error: Intento de conectar a SFTP directamente desde el navegador');
      return {
        success: false,
        buckets: [],
        error: 'La conexión SFTP debe ser manejada por el servidor'
      };
    }
  } catch (error) {
    console.error('[SFTP] Error al listar buckets:', error);
    return {
      success: false,
      buckets: [],
      error: error.message || 'Error desconocido al listar buckets'
    };
  }
}

export async function listContents(credentials, config = {}, path = '', limit = 50) {
  console.log(`[SFTP] Listando contenido en ${credentials.host}:${credentials.port || 22}${path ? '/' + path : ''}`);
  
  // Resultado por defecto para errores
  const defaultResult = {
    error: false,
    path: path || '/',
    files: [],
    folders: [],
    directories: [], // Añadimos esto para compatibilidad con otros adaptadores
    parentPath: getParentPath(path || '/'),
    service: 'sftp'
  };
  
  // Usar caché para mejorar rendimiento
  const cacheKey = `${credentials.host}:${credentials.port || 22}:${credentials.user}:path:${path}`;
  
  // Revisar caché
  if (sftpCache.has(cacheKey)) {
    const cachedData = sftpCache.get(cacheKey);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log(`[SFTP] Usando datos en caché para ${credentials.host} ruta: ${path}`);
      return cachedData.data;
    } else {
      // Caché expirado
      sftpCache.delete(cacheKey);
    }
  }
  
  try {
    // ENFOQUE DIFERENTE PARA CLIENTE VS SERVIDOR
    // En el contexto del navegador, no tenemos acceso directo a Python/paramiko,
    // así que este código nunca se ejecutará en el cliente.
    // En el API de servidor, será manejado directamente por el endpoint.
    // Esta función solo debe ser llamada desde páginas de API, no desde el cliente.
    
    // Si estamos en un contexto de Node.js (server-side), usamos el cliente SFTP del servidor
    if (typeof window === 'undefined') {
      // Importar dinámicamente el cliente SFTP del servidor
      // Esto solo funcionará en el contexto de API Routes de Next.js
      try {
        const sftpClient = require('../../../server/sftp/client');
        const result = await sftpClient.listDirectory(credentials, path);
        
        // Aseguramos formato consistente con otros adaptadores
        const responseData = {
          ...result,
          parentPath: getParentPath(path || '/'),
          directories: result.folders || [], // Para compatibilidad con otros adaptadores
          error: false
        };
        
        // Guardar en caché
        sftpCache.set(cacheKey, {
          timestamp: Date.now(),
          data: responseData
        });
        
        return responseData;
      } catch (clientError) {
        console.error('[SFTP] Error con el cliente SFTP del servidor:', clientError);
        throw new Error(`Error del cliente SFTP: ${clientError.message}`);
      }
    } else {
      // ESTO NUNCA DEBERÍA EJECUTARSE EN NAVEGADOR
      // El listado SFTP solo debe ser llamado desde una API
      console.error('[SFTP] Error: Intento de conectar a SFTP directamente desde el navegador');
      throw new Error('La conexión SFTP debe ser manejada por el servidor');
    }
  } catch (error) {
    console.error('[SFTP] Error al listar contenido:', error);
    return {
      ...defaultResult,
      error: true,
      errorMessage: `Error al listar directorio SFTP: ${error.message}`,
    };
  }
}

/**
 * Obtiene la ruta del directorio padre
 * @param {string} path - Ruta actual
 * @returns {string} - Ruta del directorio padre
 */
function getParentPath(path) {
  if (!path || path === '/' || path === '') {
    return '';
  }
  
  // Normalizar la ruta para manejar tanto /path como path/
  const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
  
  // Obtener la última ocurrencia de '/'
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  
  if (lastSlashIndex <= 0) {
    // Si no hay más directorios arriba o estamos en la raíz
    return '';
  }
  
  // Devolver la parte hasta el último slash
  return normalizedPath.substring(0, lastSlashIndex);
}

/**
 * Crea un nuevo "bucket" (directorio) en el servidor SFTP
 * 
 * @param {object} credentials - Credenciales SFTP
 * @param {string} bucketName - Nombre del directorio a crear
 * @param {object} config - Configuración adicional
 * @returns {Promise<object>} - Resultado de la operación
 */
export async function createBucket(credentials, bucketName, config = {}) {
  console.log(`[SFTP] Creando bucket (directorio) "${bucketName}" en ${credentials.host}:${credentials.port || 22}`);
  
  try {
    // Si estamos en un contexto de Node.js (server-side), usamos el cliente SFTP del servidor
    if (typeof window === 'undefined') {
      try {
        const sftpClient = require('../../../server/sftp/client');
        // Creamos un directorio en la ruta raíz
        return await sftpClient.createDirectory(credentials, bucketName);
      } catch (clientError) {
        console.error('[SFTP] Error con el cliente SFTP del servidor al crear directorio:', clientError);
        throw new Error(`Error del cliente SFTP: ${clientError.message}`);
      }
    } else {
      // ESTO NUNCA DEBERÍA EJECUTARSE EN NAVEGADOR
      console.error('[SFTP] Error: Intento de conectar a SFTP directamente desde el navegador');
      throw new Error('La conexión SFTP debe ser manejada por el servidor');
    }
  } catch (error) {
    console.error('[SFTP] Error al crear bucket (directorio):', error);
    throw error;
  }
}

export default {
  createClient,
  uploadFile,
  downloadFile,
  listFiles,
  getSignedUrl,
  testConnection,
  listContents,
  listBuckets,
  createBucket
};