/**
 * Adaptador para Azure Blob Storage
 * 
 * Este adaptador implementa las operaciones necesarias para trabajar
 * con el almacenamiento Azure Blob Storage, permitiendo operaciones como
 * subir, descargar y listar archivos.
 */

/**
 * Crea un cliente para interactuar con Azure Blob Storage
 * @param {Object} credentials Credenciales (connection_string o account_name+account_key)
 * @param {Object} config Configuración adicional
 * @returns {Object} Cliente configurado
 */
export function createClient(credentials, config = {}) {
  return {
    type: 'azure',
    credentials,
    config,
    containerName: credentials.container_name
  };
}

/**
 * Sube un archivo a Azure Blob Storage
 * @param {Object} client Cliente Azure
 * @param {string} localPath Ruta local del archivo
 * @param {string} remotePath Ruta remota (blob name)
 * @returns {Promise<Object>} Información sobre la subida
 */
export async function uploadFile(client, localPath, remotePath) {
  console.log(`[Azure] Simulando subida de ${localPath} a ${client.containerName}/${remotePath}`);
  
  // Simulamos respuesta exitosa
  return {
    success: true,
    path: `https://${client.credentials.account_name || 'account'}.blob.core.windows.net/${client.containerName}/${remotePath}`,
    size: 1024, // Tamaño simulado
    etag: '12345678abcdef' // ETag simulado
  };
}

/**
 * Descarga un archivo desde Azure Blob Storage
 * @param {Object} client Cliente Azure
 * @param {string} remotePath Ruta remota (blob name)
 * @param {string} localPath Ruta local donde guardar
 * @returns {Promise<Object>} Información sobre la descarga
 */
export async function downloadFile(client, remotePath, localPath) {
  console.log(`[Azure] Simulando descarga de ${client.containerName}/${remotePath} a ${localPath}`);
  
  // Simulamos respuesta exitosa
  return {
    success: true,
    path: localPath,
    size: 1024 // Tamaño simulado
  };
}

/**
 * Lista archivos en un directorio de Azure Blob Storage
 * @param {Object} client Cliente Azure
 * @param {string} remotePath Prefijo para listar
 * @returns {Promise<Array<Object>>} Lista de objetos
 */
export async function listFiles(client, remotePath) {
  console.log(`[Azure] Simulando listado de ${client.containerName}/${remotePath}`);
  
  // Devolvemos una lista simulada
  return [
    {
      name: `${remotePath}/archivo1.txt`,
      contentLength: 1024,
      lastModified: new Date(),
      etag: '"abcdef1234567890"'
    },
    {
      name: `${remotePath}/archivo2.csv`,
      contentLength: 2048,
      lastModified: new Date(),
      etag: '"1234567890abcdef"'
    }
  ];
}

/**
 * Genera una URL firmada (SAS) para acceder a un objeto en Azure
 * @param {Object} client Cliente Azure
 * @param {string} remotePath Ruta del objeto
 * @param {Object} options Opciones (expiración, etc.)
 * @returns {Promise<string>} URL con SAS
 */
export async function getSignedUrl(client, remotePath, options = {}) {
  console.log(`[Azure] Simulando generación de URL SAS para ${client.containerName}/${remotePath}`);
  
  // Devolvemos una URL simulada
  const expiresIn = options.expiresIn || 3600;
  const expiry = new Date(Date.now() + expiresIn * 1000).toISOString();
  return `https://${client.credentials.account_name || 'account'}.blob.core.windows.net/${client.containerName}/${remotePath}?sv=2020-08-04&ss=b&srt=sco&sp=r&se=${expiry}&skoid=abc&sktid=123&skt=${Date.now()}`;
}

/**
 * Prueba la conexión a Azure Blob Storage utilizando la API REST
 * @param {Object} credentials Credenciales
 * @param {Object} config Configuración
 * @returns {Promise<Object>} Resultado de la prueba
 */
export async function testConnection(credentials, config = {}) {
  try {
    console.log('[Azure] Probando conexión a Azure Blob Storage');
    
    // Validar credenciales
    if (!credentials.connection_string && !(credentials.account_name && credentials.account_key)) {
      throw new Error('Credenciales incompletas: Se requiere connection_string o account_name+account_key');
    }
    
    if (!credentials.container_name) {
      throw new Error('Configuración incompleta: Se requiere un nombre de contenedor');
    }

    // Extracción de credenciales de connection_string si está disponible
    let accountName = credentials.account_name;
    let accountKey = credentials.account_key;
    
    if (credentials.connection_string) {
      try {
        console.log('[Azure] Usando connection string para extraer credenciales');
        const connectionParts = credentials.connection_string.split(';');
        for (const part of connectionParts) {
          if (part.startsWith('AccountName=')) {
            accountName = part.split('=')[1];
          } else if (part.startsWith('AccountKey=')) {
            accountKey = part.split('=')[1];
          }
        }
      } catch (error) {
        console.error('[Azure] Error al parsear connection string:', error);
        throw new Error('Error al procesar connection string. Formato incorrecto.');
      }
    }
    
    if (!accountName || !accountKey) {
      throw new Error('No se pudieron extraer las credenciales necesarias. Verifique la connection string o proporcione account_name y account_key directamente.');
    }

    // Construir la URL para listar el contenedor
    const container = credentials.container_name;
    const url = `https://${accountName}.blob.core.windows.net/${container}?restype=container&comp=list&maxresults=1`;
    
    console.log(`[Azure] Intentando listar contenedor: ${container} en cuenta: ${accountName}`);
    
    // Obtener la fecha y hora actuales en formato RFC 7231
    const date = new Date().toUTCString();
    
    // Crear la cadena a firmar para la autenticación SharedKey
    const stringToSign = [
      'GET', // Método
      '', // Content-Encoding
      '', // Content-Language
      '', // Content-Length
      '', // Content-MD5
      '', // Content-Type
      '', // Date (vacío porque usamos x-ms-date)
      '', // If-Modified-Since
      '', // If-Match
      '', // If-None-Match
      '', // If-Unmodified-Since
      '', // Range
      `x-ms-date:${date}`, // Encabezados canónicos
      `x-ms-version:2020-04-08`,
      `/${accountName}/${container}?comp=list&maxresults=1&restype=container` // Recurso canónico
    ].join('\n');
    
    // Función para calcular HMAC-SHA256
    async function hmacSha256(key, message) {
      const keyBytes = new TextEncoder().encode(key);
      const messageBytes = new TextEncoder().encode(message);
      
      // Importar la clave
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign']
      );
      
      // Firmar el mensaje
      const signature = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageBytes
      );
      
      // Convertir a base64
      return btoa(String.fromCharCode(...new Uint8Array(signature)));
    }
    
    // Decodificar la clave de cuenta desde base64
    function base64Decode(str) {
      try {
        return atob(str);
      } catch (e) {
        throw new Error('La clave de la cuenta no es un string base64 válido');
      }
    }
    
    // Calcular la firma
    const signature = await hmacSha256(
      base64Decode(accountKey),
      stringToSign
    );
    
    // Crear la cabecera de autorización
    const authHeader = `SharedKey ${accountName}:${signature}`;
    
    // Realizar la solicitud
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-ms-date': date,
        'x-ms-version': '2020-04-08',
        'Authorization': authHeader
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Azure] Error en respuesta:', errorText);
      
      // Analizar el error XML para proporcionar información más útil
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      if (errorText.includes('<Code>AuthenticationFailed</Code>')) {
        errorMessage = 'Error de autenticación: Las credenciales proporcionadas no son válidas o no tienen permisos suficientes.';
      } else if (errorText.includes('<Code>ContainerNotFound</Code>')) {
        errorMessage = `El contenedor '${container}' no existe en la cuenta de almacenamiento.`;
      } else if (errorText.includes('<Code>ResourceNotFound</Code>')) {
        errorMessage = `El recurso no existe. Verifique que el nombre del contenedor sea correcto.`;
      } else if (errorText.includes('<Code>AccountNameInvalid</Code>')) {
        errorMessage = `El nombre de la cuenta de almacenamiento '${accountName}' no es válido.`;
      }
      
      throw new Error(errorMessage);
    }
    
    // Procesamiento exitoso
    const xmlResponse = await response.text();
    console.log('[Azure] Respuesta exitosa al listar contenedor:', xmlResponse.substring(0, 150) + '...');
    
    return {
      success: true,
      message: 'Conexión a Azure Blob Storage exitosa',
      details: {
        container: credentials.container_name,
        account: accountName
      }
    };
  } catch (error) {
    console.error('[Azure] Error al probar conexión:', error);
    return {
      success: false,
      message: `Error al conectar con Azure Blob Storage: ${error.message}`,
      details: error
    };
  }
}

/**
 * Lista contenido de un contenedor de Azure Blob Storage con más detalles
 * @param {Object} credentials Credenciales
 * @param {Object} config Configuración
 * @param {string} path Prefijo para listar
 * @param {number} limit Límite de objetos a devolver
 * @returns {Promise<Object>} Estructura organizada del contenido
 */
export async function listContents(credentials, config = {}, path = '', limit = 50) {
  try {
    const containerName = credentials.container_name;
    console.log(`[Azure] Listando contenido en contenedor ${containerName}${path ? '/' + path : ''}`);
    
    // Extracción de credenciales de connection_string si está disponible
    let accountName = credentials.account_name;
    let accountKey = credentials.account_key;
    
    if (credentials.connection_string) {
      try {
        console.log('[Azure] Usando connection string para extraer credenciales');
        const connectionParts = credentials.connection_string.split(';');
        for (const part of connectionParts) {
          if (part.startsWith('AccountName=')) {
            accountName = part.split('=')[1];
          } else if (part.startsWith('AccountKey=')) {
            accountKey = part.split('=')[1];
          }
        }
      } catch (error) {
        console.error('[Azure] Error al parsear connection string:', error);
        throw new Error('Error al procesar connection string. Formato incorrecto.');
      }
    }
    
    if (!accountName || !accountKey) {
      throw new Error('No se pudieron extraer las credenciales necesarias. Verifique la connection string o proporcione account_name y account_key directamente.');
    }

    // Construir la URL para listar el contenedor
    const prefix = path ? `${path}${path.endsWith('/') ? '' : '/'}` : '';
    const delimiter = '/';
    const url = `https://${accountName}.blob.core.windows.net/${containerName}?restype=container&comp=list&delimiter=${delimiter}&prefix=${encodeURIComponent(prefix)}&maxresults=${limit}`;
    
    // Obtener la fecha y hora actuales en formato RFC 7231
    const date = new Date().toUTCString();
    
    // Crear la cadena a firmar para la autenticación SharedKey
    const stringToSign = [
      'GET', // Método
      '', // Content-Encoding
      '', // Content-Language
      '', // Content-Length
      '', // Content-MD5
      '', // Content-Type
      '', // Date (vacío porque usamos x-ms-date)
      '', // If-Modified-Since
      '', // If-Match
      '', // If-None-Match
      '', // If-Unmodified-Since
      '', // Range
      `x-ms-date:${date}`, // Encabezados canónicos
      `x-ms-version:2020-04-08`,
      `/${accountName}/${containerName}?comp=list&delimiter=${delimiter}&maxresults=${limit}&prefix=${encodeURIComponent(prefix)}&restype=container` // Recurso canónico
    ].join('\n');
    
    // Función para calcular HMAC-SHA256
    async function hmacSha256(key, message) {
      const keyBytes = new TextEncoder().encode(key);
      const messageBytes = new TextEncoder().encode(message);
      
      // Importar la clave
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign']
      );
      
      // Firmar el mensaje
      const signature = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageBytes
      );
      
      // Convertir a base64
      return btoa(String.fromCharCode(...new Uint8Array(signature)));
    }
    
    // Decodificar la clave de cuenta desde base64
    function base64Decode(str) {
      try {
        return atob(str);
      } catch (e) {
        throw new Error('La clave de la cuenta no es un string base64 válido');
      }
    }
    
    // Calcular la firma
    const signature = await hmacSha256(
      base64Decode(accountKey),
      stringToSign
    );
    
    // Crear la cabecera de autorización
    const authHeader = `SharedKey ${accountName}:${signature}`;
    
    // Realizar la solicitud
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-ms-date': date,
        'x-ms-version': '2020-04-08',
        'Authorization': authHeader
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Azure] Error en respuesta:', errorText);
      
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      if (errorText.includes('<Code>AuthenticationFailed</Code>')) {
        errorMessage = 'Error de autenticación: Las credenciales proporcionadas no son válidas o no tienen permisos suficientes.';
      } else if (errorText.includes('<Code>ContainerNotFound</Code>')) {
        errorMessage = `El contenedor '${containerName}' no existe en la cuenta de almacenamiento.`;
      }
      
      throw new Error(errorMessage);
    }
    
    // Procesamiento exitoso de la respuesta XML
    const xmlResponse = await response.text();
    console.log('[Azure] Respuesta XML completa:', xmlResponse);
    
    // Parsear el XML para extraer archivos y directorios (prefijos comunes)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlResponse, "text/xml");
    
    const files = [];
    const folders = [];
    
    // Procesar los blobs (archivos)
    const blobs = xmlDoc.getElementsByTagName('Blob');
    for (let i = 0; i < blobs.length; i++) {
      const name = blobs[i].getElementsByTagName('Name')[0].textContent;
      const properties = blobs[i].getElementsByTagName('Properties')[0];
      const size = parseInt(properties.getElementsByTagName('Content-Length')[0].textContent, 10);
      const lastModified = new Date(properties.getElementsByTagName('Last-Modified')[0].textContent);
      
      // Extraer solo el nombre del archivo sin la ruta
      const fileName = name.startsWith(prefix) ? name.substring(prefix.length) : name;
      
      files.push({
        name: fileName,
        path: name,
        size,
        lastModified,
        type: 'file'
      });
    }
    
    // Procesar los prefijos (carpetas)
    const blobPrefixes = xmlDoc.getElementsByTagName('BlobPrefix');
    for (let i = 0; i < blobPrefixes.length; i++) {
      const prefixPath = blobPrefixes[i].getElementsByTagName('Name')[0].textContent;
      
      // Extraer solo el nombre de la carpeta
      const folderName = prefixPath.startsWith(prefix) 
        ? prefixPath.substring(prefix.length) 
        : prefixPath;
      
      const folderNameNoSlash = folderName.endsWith('/') 
        ? folderName.substring(0, folderName.length - 1) 
        : folderName;
      
      folders.push({
        name: folderNameNoSlash,
        path: prefixPath,
        type: 'folder'
      });
    }
    
    return {
      bucket: containerName,
      path: path || '/',
      files,
      folders,
      service: 'azure'
    };
  } catch (error) {
    console.error('[Azure] Error al listar contenido:', error);
    return {
      error: true,
      errorMessage: error.message,
      bucket: credentials.container_name,
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