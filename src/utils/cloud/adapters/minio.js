/**
 * Adaptador para MinIO
 * 
 * Implementa las operaciones básicas para interactuar con servidores MinIO
 * implementando las funciones necesarias directamente sin depender de otros adaptadores.
 */

/**
 * Calcula el hash SHA-256 de una cadena
 * @param {string} message - El mensaje a hashear
 * @returns {Promise<string>} - El hash en formato hexadecimal
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Devuelve la fecha actual en formato ISO 8601 para el encabezado x-amz-date
 * @returns {string} Fecha en formato yyyyMMddTHHmmssZ
 */
function getAmzDate() {
  const date = new Date();
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Devuelve la fecha actual en formato yyyyMMdd para el ámbito de credenciales
 * @returns {string} Fecha en formato yyyyMMdd
 */
function getDateStamp() {
  const date = new Date();
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * Prueba la conexión a MinIO verificando si se puede acceder a un bucket
 * 
 * @param {object} credentials - Credenciales MinIO (access_key, secret_key, bucket, etc.)
 * @param {object} config - Configuración para el bucket (endpoint, secure, etc.)
 * @returns {Promise<object>} - Resultado de la prueba con estado y mensaje
 */
async function testConnection(credentials, config = {}) {
  // Validar credenciales mínimas requeridas
  if (!credentials.access_key || !credentials.secret_key || !credentials.bucket) {
    return {
      success: false,
      message: 'Faltan credenciales requeridas (access_key, secret_key, bucket)'
    };
  }
  
  // Verificar si el endpoint está en credenciales en lugar de config
  if (!config.endpoint) {
    if (credentials.endpoint) {
      // Mover el endpoint a la configuración
      config.endpoint = credentials.endpoint;
      console.log("MinIO: Se encontró endpoint en credenciales, movido a config:", config.endpoint);
    } else {
      return {
        success: false,
        message: 'Falta la configuración del endpoint para MinIO. Por favor, verifica que el campo "Endpoint" esté completo.'
      };
    }
  }
  
  try {
    console.log('Configuración recibida en MinIO adapter:', JSON.stringify(config, null, 2));
    
    // Determinar si el endpoint incluye el protocolo
    let endpoint = config.endpoint;
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      // Agregar el protocolo según la configuración de secure
      const protocol = config.secure !== false ? 'https://' : 'http://';
      endpoint = protocol + endpoint;
    }
    
    // Extraer el host sin el protocolo
    const host = endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Utilizar la opción de puerto si está especificada
    const port = config.port ? `:${config.port}` : '';
    const baseUrl = `${endpoint}${port}`;
    
    // Construir URL del bucket 
    const url = `${baseUrl}/${credentials.bucket}?max-keys=1`;
    
    // Fecha y timestamp para la firma
    const amzDate = getAmzDate();
    const dateStamp = getDateStamp();
    
    // Headers a firmar
    const headers = {
      'host': host + port,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // hash de cadena vacía
    };
    
    // Paso 1: Crear solicitud canónica
    const canonicalUri = `/${credentials.bucket}`;
    const canonicalQueryString = 'max-keys=1';
    
    // Construir los headers canónicos
    const sortedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaders.map(key => `${key}:${headers[key]}\n`).join('');
    const signedHeaders = sortedHeaders.join(';');
    
    const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // hash de cuerpo vacío
    
    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    
    // Paso 2: Crear el string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const region = 'us-east-1'; // MinIO suele usar esto como valor predeterminado
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      scope,
      await sha256(canonicalRequest)
    ].join('\n');
    
    // Paso 3: Calcular la firma
    async function sign(key, msg) {
      const msgBuffer = new TextEncoder().encode(msg);
      const keyBuffer = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign']
      );
      const signBuffer = await crypto.subtle.sign(
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        keyBuffer,
        msgBuffer
      );
      return new Uint8Array(signBuffer);
    }
    
    const kSecret = new TextEncoder().encode(`AWS4${credentials.secret_key}`);
    const kDate = await sign(kSecret, dateStamp);
    const kRegion = await sign(kDate, region);
    const kService = await sign(kRegion, 's3');
    const kSigning = await sign(kService, 'aws4_request');
    
    const signature = await sign(kSigning, stringToSign);
    const signatureHex = Array.from(signature)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Paso 4: Crear el header de autorización
    const authorizationHeader = `${algorithm} Credential=${credentials.access_key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
    
    // Hacer la solicitud
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Authorization': authorizationHeader
      }
    });
    
    // Verificar respuesta
    if (!response.ok) {
      // Extraer mensaje de error para más detalles
      const errorText = await response.text();
      
      // Intentar extraer el mensaje de error del XML
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      // Buscar el mensaje de error en la respuesta XML
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      if (codeMatch && messageMatch) {
        const errorCode = codeMatch[1];
        const errorDetail = messageMatch[1];
        
        if (errorCode === 'AccessDenied') {
          return {
            success: false,
            message: `Las credenciales no tienen permisos para acceder al bucket "${credentials.bucket}". Verifica los permisos.`
          };
        } else if (errorCode === 'NoSuchBucket') {
          return {
            success: false,
            message: `El bucket "${credentials.bucket}" no existe o no es accesible.`
          };
        } else if (errorCode === 'InvalidAccessKeyId') {
          return {
            success: false,
            message: `La clave de acceso proporcionada no existe. Verifica que la clave sea correcta.`
          };
        } else if (errorCode === 'SignatureDoesNotMatch') {
          return {
            success: false,
            message: `Error de autenticación: La firma generada no coincide. Verifica que la clave secreta sea correcta.`
          };
        } else {
          return {
            success: false,
            message: `Error MinIO (${errorCode}): ${errorDetail}`
          };
        }
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
    
    // En caso de éxito
    return {
      success: true,
      message: `Conexión exitosa al bucket ${credentials.bucket}`,
      details: {
        bucketName: credentials.bucket,
        endpoint: endpoint
      }
    };
  } catch (error) {
    console.error('Error al probar conexión con MinIO:', error);
    return {
      success: false,
      message: `Error al conectar con MinIO: ${error.message}`
    };
  }
}

/**
 * Lista el contenido de un bucket o carpeta dentro de un bucket
 * 
 * @param {object} credentials - Credenciales MinIO (access_key, secret_key, bucket, etc.)
 * @param {object} config - Configuración para el bucket (endpoint, secure, etc.)
 * @param {string} path - Ruta dentro del bucket (prefijo)
 * @returns {Promise<object>} - Resultado con carpetas y archivos
 */
async function listContents(credentials, config = {}, path = '') {
  try {
    // Validar credenciales
    if (!credentials.access_key || !credentials.secret_key || !credentials.bucket) {
      throw new Error('Faltan credenciales requeridas para MinIO');
    }

    // Verificar si el endpoint está en credenciales en lugar de config
    if (!config.endpoint) {
      if (credentials.endpoint) {
        // Mover el endpoint a la configuración
        config.endpoint = credentials.endpoint;
        console.log("[MinIO] listContents: Se encontró endpoint en credenciales, movido a config:", config.endpoint);
      } else {
        throw new Error('Falta la configuración del endpoint para MinIO. Por favor, verifica que el campo "Endpoint" esté completo.');
      }
    }

    // Determinar si el endpoint incluye el protocolo
    let endpoint = config.endpoint;
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      // Agregar el protocolo según la configuración de secure
      const protocol = config.secure !== false ? 'https://' : 'http://';
      endpoint = protocol + endpoint;
    }

    // Si path tiene barra al inicio, la quitamos
    if (path.startsWith('/')) {
      path = path.substring(1);
    }

    // Extraer el host sin el protocolo
    const host = endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Utilizar la opción de puerto si está especificada
    const port = config.port ? `:${config.port}` : '';
    const baseUrl = `${endpoint}${port}`;
    
    const bucket = credentials.bucket;
    const prefix = path ? encodeURIComponent(path + (path.endsWith('/') ? '' : '/')) : '';
    const url = `${baseUrl}/${bucket}?delimiter=%2F&list-type=2&max-keys=100&prefix=${prefix}`;
    
    // Fecha y timestamp para la firma
    const amzDate = getAmzDate();
    const dateStamp = getDateStamp();
    
    // Headers a firmar
    const headers = {
      'host': host + port,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // hash de cadena vacía
    };
    
    // Construir la solicitud canónica
    const canonicalUri = `/${bucket}`;
    const canonicalQueryString = `delimiter=%2F&list-type=2&max-keys=100&prefix=${prefix}`;
    
    const sortedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaders.map(key => `${key}:${headers[key]}\n`).join('');
    const signedHeaders = sortedHeaders.join(';');
    
    const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // hash de cuerpo vacío
    
    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    
    console.log('[MinIO] Listando bucket:', bucket, 'con endpoint:', endpoint);
    
    // Calcular la firma
    const canonicalRequestHash = await sha256(canonicalRequest);
    
    const algorithm = 'AWS4-HMAC-SHA256';
    const region = 'us-east-1';
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    
    const stringToSign = [
      algorithm,
      amzDate,
      scope,
      canonicalRequestHash
    ].join('\n');
    
    // Función para firmar
    async function sign(key, msg) {
      const msgBuffer = new TextEncoder().encode(msg);
      const keyBuffer = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign']
      );
      const signBuffer = await crypto.subtle.sign(
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        keyBuffer,
        msgBuffer
      );
      return new Uint8Array(signBuffer);
    }
    
    // Derivar la clave de firma
    const kSecret = new TextEncoder().encode(`AWS4${credentials.secret_key}`);
    const kDate = await sign(kSecret, dateStamp);
    const kRegion = await sign(kDate, region);
    const kService = await sign(kRegion, 's3');
    const kSigning = await sign(kService, 'aws4_request');
    
    // Obtener la firma
    const signature = await sign(kSigning, stringToSign);
    const signatureHex = Array.from(signature)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Crear el header de autorización
    const authorizationHeader = `${algorithm} Credential=${credentials.access_key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
    
    // Realizar la petición
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Authorization': authorizationHeader
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('[MinIO] Error en respuesta del bucket:', errorText);
      
      // Intentar extraer el mensaje de error del XML
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      // Buscar el mensaje de error en la respuesta XML
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      if (codeMatch && messageMatch) {
        const errorCode = codeMatch[1];
        const errorDetail = messageMatch[1];
        errorMessage = `Error MinIO (${errorCode}): ${errorDetail}`;
      }
      
      throw new Error(errorMessage);
    }
    
    // Procesar la respuesta para extraer carpetas y archivos
    const responseText = await response.text();
    console.log('[MinIO] Respuesta:', responseText.substring(0, 150) + '...');
    
    // Extraer información de carpetas
    const commonPrefixes = Array.from(responseText.matchAll(/<CommonPrefix><Prefix>(.*?)<\/Prefix><\/CommonPrefix>/g))
      .map(match => {
        const fullPath = match[1];
        // Eliminar el prefijo actual y la barra final para obtener solo el nombre
        const name = fullPath.replace(path ? path + '/' : '', '').replace(/\/$/, '');
        return {
          name,
          path: fullPath.replace(/\/$/, ''),
          type: 'folder'
        };
      });
    
    // Extraer información de archivos
    const contents = Array.from(responseText.matchAll(/<Contents>(.*?)<\/Contents>/gs))
      .filter(match => {
        // Filtrar el Content que represente el directorio actual
        const keyMatch = match[1].match(/<Key>(.*?)<\/Key>/);
        if (!keyMatch) return false;
        const key = keyMatch[1];
        // Excluir el directorio actual (que tiene el mismo nombre que el prefijo) y directorios
        return path !== key && !key.endsWith('/');
      })
      .map(match => {
        const keyMatch = match[1].match(/<Key>(.*?)<\/Key>/);
        const sizeMatch = match[1].match(/<Size>(.*?)<\/Size>/);
        const lastModifiedMatch = match[1].match(/<LastModified>(.*?)<\/LastModified>/);
        
        // Extraer nombre desde la ruta completa eliminando el prefijo
        const fullPath = keyMatch ? keyMatch[1] : 'unknown';
        const name = fullPath.replace(path ? path + '/' : '', '');
        
        const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
        const lastModified = lastModifiedMatch ? new Date(lastModifiedMatch[1]) : new Date();
        
        // Extraer la extensión del archivo
        const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
        
        return {
          name,
          path: fullPath,
          size,
          lastModified,
          extension,
          type: 'file'
        };
      });
    
    // Devolver el resultado en el formato esperado por la interfaz
    return {
      path: path || '/',
      bucket: bucket,
      endpoint: endpoint,
      parentPath: path.includes('/') ? path.split('/').slice(0, -1).join('/') : '',
      folders: commonPrefixes,
      files: contents
    };
  } catch (error) {
    console.error('Error al listar contenido de MinIO:', error);
    // En caso de error, devolver un objeto con el error para mostrar en la interfaz
    return {
      error: true,
      errorMessage: error.message || 'Error desconocido al listar contenido',
      path: path || '/',
      bucket: credentials.bucket || 'unknown',
      folders: [],
      files: []
    };
  }
}

/**
 * Crea un cliente para MinIO (función que devuelve credenciales y configuración con validaciones)
 * 
 * @param {object} credentials - Credenciales MinIO
 * @param {object} config - Configuración para MinIO
 * @returns {Promise<object>} - Cliente MinIO configurado
 */
async function createClient(credentials, config = {}) {
  // Verificar credenciales mínimas requeridas
  if (!credentials.access_key || !credentials.secret_key || !credentials.bucket) {
    throw new Error('Faltan credenciales requeridas para MinIO (access_key, secret_key, bucket)');
  }
  
  // Verificar si el endpoint está en credenciales en lugar de config
  if (!config.endpoint) {
    if (credentials.endpoint) {
      // Mover el endpoint a la configuración
      config.endpoint = credentials.endpoint;
      console.log("[MinIO] createClient: Se encontró endpoint en credenciales, movido a config:", config.endpoint);
    } else {
      throw new Error('Falta la configuración del endpoint para MinIO');
    }
  }
  
  // Verificar y normalizar el endpoint
  const endpoint = config.endpoint.startsWith('http') 
    ? config.endpoint 
    : `${config.secure !== false ? 'https' : 'http'}://${config.endpoint}`;
  
  // Crear cliente con la configuración normalizada
  return { 
    credentials, 
    config: { 
      ...config, 
      endpoint,
      // Asegurar que otras propiedades estén establecidas con valores por defecto
      port: config.port || null,
      secure: config.secure !== false
    } 
  };
}

/**
 * Firma y prepara una petición a la API de MinIO
 * @param {object} credentials - Credenciales MinIO
 * @param {object} config - Configuración para MinIO
 * @param {string} method - Método HTTP (GET, PUT, HEAD, DELETE)
 * @param {string} path - Ruta dentro del bucket
 * @param {object} queryParams - Parámetros de consulta
 * @param {object} headers - Headers HTTP adicionales
 * @returns {object} - Objeto con URL y headers para la petición
 */
async function prepareRequest(credentials, config, method, path, queryParams = {}, headers = {}) {
  // Normalizar el endpoint
  let endpoint = config.endpoint;
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    const protocol = config.secure !== false ? 'https://' : 'http://';
    endpoint = protocol + endpoint;
  }
  
  // Normalizar la ruta quitando / inicial si existe
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  // Extraer el host sin el protocolo
  const host = endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  // Utilizar la opción de puerto si está especificada
  const port = config.port ? `:${config.port}` : '';
  const baseUrl = `${endpoint}${port}`;
  
  // Construir URL completa con query params
  const queryString = Object.keys(queryParams).length > 0
    ? '?' + Object.entries(queryParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')
    : '';
  
  const url = `${baseUrl}/${credentials.bucket}/${path}${queryString}`;
  
  // Fecha y timestamp para la firma
  const amzDate = getAmzDate();
  const dateStamp = getDateStamp();
  
  // Headers básicos
  const requestHeaders = {
    'host': host + port,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // hash de cadena vacía
    ...headers
  };
  
  // Construir la solicitud canónica
  const canonicalUri = `/${credentials.bucket}/${path}`;
  
  // Construir query string canónico
  const canonicalQueryString = Object.entries(queryParams)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  
  // Ordenar y formatear los headers canónicos
  const sortedHeaderKeys = Object.keys(requestHeaders).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map(key => `${key.toLowerCase()}:${requestHeaders[key]}\n`)
    .join('');
  const signedHeaders = sortedHeaderKeys.join(';').toLowerCase();
  
  // Hash del payload (cuerpo vacío)
  const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  
  // Combinar todo en la solicitud canónica
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Crear el string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const region = 'us-east-1';  // MinIO suele usar us-east-1 por defecto
  const service = 's3';
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    scope,
    await sha256(canonicalRequest)
  ].join('\n');
  
  // Función para firmar utilizando HMAC-SHA256
  async function sign(key, msg) {
    const msgBuffer = new TextEncoder().encode(msg);
    const keyBuffer = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );
    const signBuffer = await crypto.subtle.sign(
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      keyBuffer,
      msgBuffer
    );
    return new Uint8Array(signBuffer);
  }
  
  // Generar la clave de firma
  const kSecret = new TextEncoder().encode(`AWS4${credentials.secret_key}`);
  const kDate = await sign(kSecret, dateStamp);
  const kRegion = await sign(kDate, region);
  const kService = await sign(kRegion, service);
  const kSigning = await sign(kService, 'aws4_request');
  
  // Generar la firma final
  const signature = await sign(kSigning, stringToSign);
  const signatureHex = Array.from(signature)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Crear el header de autorización completo
  const authorizationHeader = `${algorithm} Credential=${credentials.access_key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
  
  // Devolver la URL y los headers firmados
  return {
    url,
    headers: {
      ...requestHeaders,
      'Authorization': authorizationHeader
    }
  };
}

/**
 * Sube un archivo a MinIO
 * 
 * @param {object} client - Cliente MinIO
 * @param {string} localPath - Ruta local del archivo a subir
 * @param {string} remotePath - Ruta en el bucket donde subir el archivo
 * @returns {Promise<object>} - Resultado de la operación
 */
async function uploadFile(client, localPath, remotePath) {
  try {
    // Extraer credenciales y configuración del cliente
    const { credentials, config } = client;
    
    // Verificar argumentos
    if (!localPath) throw new Error('La ruta local es requerida');
    if (!remotePath) throw new Error('La ruta remota es requerida');
    
    console.log(`[MinIO] Iniciando subida de archivo: ${localPath} -> ${remotePath}`);
    
    // Leer el archivo como un array buffer
    const fileContent = await fetch(`file://${localPath}`).then(r => r.arrayBuffer());
    if (!fileContent) {
      throw new Error(`No se pudo leer el archivo: ${localPath}`);
    }
    
    // Calcular hash SHA-256 del contenido del archivo
    const fileContentHash = await crypto.subtle.digest('SHA-256', fileContent);
    const fileContentHashHex = Array.from(new Uint8Array(fileContentHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Preparar los headers específicos para subida
    const uploadHeaders = {
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileContent.byteLength.toString(),
      'x-amz-content-sha256': fileContentHashHex
    };
    
    // Preparar la petición con firma
    const { url, headers } = await prepareRequest(
      credentials,
      config,
      'PUT',
      remotePath,
      {},  // Sin query params
      uploadHeaders
    );
    
    console.log(`[MinIO] Realizando PUT a: ${url}`);
    
    // Realizar la petición PUT para subir el archivo
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: fileContent
    });
    
    // Verificar la respuesta
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MinIO] Error al subir archivo: ${response.status} - ${response.statusText}`);
      console.error(`[MinIO] Respuesta: ${errorText}`);
      
      throw new Error(`Error al subir archivo a MinIO: ${response.status} ${response.statusText}`);
    }
    
    console.log(`[MinIO] Archivo subido exitosamente: ${remotePath}`);
    
    // Devolver resultado exitoso
    return {
      success: true,
      path: remotePath,
      size: fileContent.byteLength,
      url: `${config.endpoint}/${credentials.bucket}/${remotePath}`
    };
  } catch (error) {
    console.error(`[MinIO] Error al subir archivo: ${error.message}`, error);
    throw new Error(`Error al subir archivo a MinIO: ${error.message}`);
  }
}

/**
 * Descarga un archivo de MinIO
 * 
 * @param {object} client - Cliente MinIO
 * @param {string} remotePath - Ruta del archivo en el bucket
 * @param {string} localPath - Ruta local donde guardar el archivo
 * @returns {Promise<object>} - Resultado de la operación
 */
async function downloadFile(client, remotePath, localPath) {
  try {
    // Extraer credenciales y configuración del cliente
    const { credentials, config } = client;
    
    // Verificar argumentos
    if (!remotePath) throw new Error('La ruta remota es requerida');
    if (!localPath) throw new Error('La ruta local es requerida');
    
    console.log(`[MinIO] Iniciando descarga de archivo: ${remotePath} -> ${localPath}`);
    
    // Preparar la petición con firma
    const { url, headers } = await prepareRequest(
      credentials,
      config,
      'GET',
      remotePath,
      {}, // Sin query params
      {}  // Sin headers adicionales
    );
    
    console.log(`[MinIO] Realizando GET a: ${url}`);
    
    // Realizar la petición GET para descargar el archivo
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    // Verificar la respuesta
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MinIO] Error al descargar archivo: ${response.status} - ${response.statusText}`);
      console.error(`[MinIO] Respuesta: ${errorText}`);
      
      // Analizar error XML si existe
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      if (codeMatch && messageMatch) {
        const errorCode = codeMatch[1];
        const errorDetail = messageMatch[1];
        
        if (errorCode === 'NoSuchKey') {
          throw new Error(`El archivo "${remotePath}" no existe en el bucket ${credentials.bucket}`);
        } else {
          throw new Error(`Error MinIO (${errorCode}): ${errorDetail}`);
        }
      }
      
      throw new Error(errorMessage);
    }
    
    // Obtener el contenido del archivo como array buffer
    const fileContent = await response.arrayBuffer();
    
    // Guardar el archivo localmente usando Node.js
    await fetch(`file://${localPath}`, {
      method: 'PUT',
      body: new Uint8Array(fileContent)
    });
    
    console.log(`[MinIO] Archivo descargado exitosamente: ${localPath}`);
    
    // Devolver resultado exitoso
    return {
      success: true,
      path: localPath,
      size: fileContent.byteLength,
      sourceUrl: url
    };
  } catch (error) {
    console.error(`[MinIO] Error al descargar archivo: ${error.message}`, error);
    throw new Error(`Error al descargar archivo de MinIO: ${error.message}`);
  }
}

/**
 * Elimina un archivo de MinIO
 * 
 * @param {object} client - Cliente MinIO
 * @param {string} remotePath - Ruta del archivo en el bucket
 * @returns {Promise<object>} - Resultado de la operación
 */
async function deleteFile(client, remotePath) {
  try {
    // Extraer credenciales y configuración del cliente
    const { credentials, config } = client;
    
    // Verificar argumentos
    if (!remotePath) throw new Error('La ruta remota es requerida');
    
    console.log(`[MinIO] Eliminando archivo: ${remotePath}`);
    
    // Preparar la petición con firma
    const { url, headers } = await prepareRequest(
      credentials,
      config,
      'DELETE',
      remotePath,
      {}, // Sin query params
      {}  // Sin headers adicionales
    );
    
    console.log(`[MinIO] Realizando DELETE a: ${url}`);
    
    // Realizar la petición DELETE
    const response = await fetch(url, {
      method: 'DELETE',
      headers
    });
    
    // Verificar la respuesta
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MinIO] Error al eliminar archivo: ${response.status} - ${response.statusText}`);
      console.error(`[MinIO] Respuesta: ${errorText}`);
      
      // Analizar error XML si existe
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      if (codeMatch && messageMatch) {
        const errorCode = codeMatch[1];
        const errorDetail = messageMatch[1];
        
        if (errorCode === 'NoSuchKey') {
          // No es error si el archivo no existe - considerarlo como eliminado
          console.log(`[MinIO] El archivo ${remotePath} no existía para ser eliminado`);
          return {
            success: true,
            path: remotePath,
            message: 'El archivo no existía, se considera eliminado'
          };
        } else {
          throw new Error(`Error MinIO (${errorCode}): ${errorDetail}`);
        }
      }
      
      throw new Error(errorMessage);
    }
    
    console.log(`[MinIO] Archivo eliminado exitosamente: ${remotePath}`);
    
    // Devolver resultado exitoso
    return {
      success: true,
      path: remotePath
    };
  } catch (error) {
    console.error(`[MinIO] Error al eliminar archivo: ${error.message}`, error);
    throw new Error(`Error al eliminar archivo de MinIO: ${error.message}`);
  }
}

/**
 * Verifica si un archivo existe en MinIO
 * 
 * @param {object} client - Cliente MinIO
 * @param {string} remotePath - Ruta del archivo en el bucket
 * @returns {Promise<boolean>} - Verdadero si el archivo existe
 */
async function fileExists(client, remotePath) {
  try {
    // Extraer credenciales y configuración del cliente
    const { credentials, config } = client;
    
    // Verificar argumentos
    if (!remotePath) throw new Error('La ruta remota es requerida');
    
    console.log(`[MinIO] Verificando existencia de archivo: ${remotePath}`);
    
    // Preparar la petición con firma
    const { url, headers } = await prepareRequest(
      credentials,
      config,
      'HEAD',
      remotePath,
      {}, // Sin query params
      {}  // Sin headers adicionales
    );
    
    console.log(`[MinIO] Realizando HEAD a: ${url}`);
    
    // Realizar la petición HEAD
    const response = await fetch(url, {
      method: 'HEAD',
      headers
    });
    
    // Si la respuesta es exitosa, el archivo existe
    if (response.ok) {
      console.log(`[MinIO] Archivo existe: ${remotePath}`);
      return true;
    }
    
    // Si el error es 404, el archivo no existe
    if (response.status === 404) {
      console.log(`[MinIO] Archivo no existe: ${remotePath}`);
      return false;
    }
    
    // Para otros errores, lanzar excepción
    const errorMessage = `Error al verificar existencia del archivo: ${response.status} ${response.statusText}`;
    console.error(`[MinIO] ${errorMessage}`);
    throw new Error(errorMessage);
  } catch (error) {
    // Si la excepción indica que el archivo no existe, devolver false
    if (error.message.includes('no existe') || error.message.includes('NoSuchKey')) {
      return false;
    }
    
    console.error(`[MinIO] Error al verificar existencia: ${error.message}`, error);
    throw new Error(`Error al verificar existencia en MinIO: ${error.message}`);
  }
}

// Exportar el adaptador para MinIO
export default {
  testConnection,
  listContents,
  uploadFile,
  downloadFile,
  deleteFile,
  fileExists,
  createClient
};