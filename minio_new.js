/**
 * Adaptador para MinIO
 * 
 * Implementa las operaciones básicas para interactuar con servidores MinIO
 * implementando las funciones necesarias directamente sin depender de otros adaptadores.
 * 
 * Incluye funciones para:
 * - Probar conexión (testConnection)
 * - Listar contenidos (listContents)
 * - Listar buckets (listBuckets)
 * - Crear buckets (createBucket)
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
 * Prueba la conexión a MinIO verificando si es posible la autenticación
 * 
 * @param {object} credentials - Credenciales MinIO (access_key, secret_key, etc.)
 * @param {object} config - Configuración para el bucket (endpoint, secure, etc.)
 * @returns {Promise<object>} - Resultado de la prueba con estado y mensaje
 */
async function testConnection(credentials, config = {}) {
  // Validar credenciales mínimas requeridas
  if (!credentials.access_key || !credentials.secret_key) {
    return {
      success: false,
      message: 'Faltan credenciales requeridas (access_key, secret_key)'
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
    
    // Construir URL para listar buckets en lugar de acceder a uno específico
    const url = `${baseUrl}`;
    
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
    const canonicalUri = "/";
    const canonicalQueryString = '';
    
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
    // Intentar extraer información de buckets disponibles del XML si existe
    const responseText = await response.text();
    const bucketMatches = Array.from(responseText.matchAll(/<Name>(.*?)<\/Name>/g));
    const buckets = bucketMatches.map(match => match[1]);
    
    return {
      success: true,
      message: `Conexión exitosa a MinIO (${endpoint})`,
      details: {
        endpoint: endpoint,
        buckets: buckets.length > 0 ? buckets : 'Buckets disponibles no detectados'
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
    
    // Extraer información de carpetas (compatibilidad con diferentes formatos XML)
    // Intentar primero con etiquetas CommonPrefix y luego con Prefix dentro de CommonPrefixes
    let commonPrefixMatches = Array.from(responseText.matchAll(/<CommonPrefix><Prefix>(.*?)<\/Prefix><\/CommonPrefix>/g));
    
    // Si no hay coincidencias, intentar con formato alternativo
    if (commonPrefixMatches.length === 0) {
      commonPrefixMatches = Array.from(responseText.matchAll(/<CommonPrefixes><Prefix>(.*?)<\/Prefix><\/CommonPrefixes>/g));
    }
    
    // Si aún no hay resultados, buscar patrón con todas las carpetas (executions/ por ejemplo)
    if (commonPrefixMatches.length === 0 && path === '') {
      commonPrefixMatches = Array.from(responseText.matchAll(/<Key>(.*?)\/<\/Key>/g))
        .filter(match => {
          const dirPath = match[1];
          // Obtener solo el directorio de primer nivel
          return !dirPath.includes('/') || dirPath.lastIndexOf('/') === dirPath.indexOf('/');
        })
        .map(match => {
          const dirPath = match[1];
          // Si contiene /, obtener solo el directorio principal
          if (dirPath.includes('/')) {
            return [match[0], dirPath.substring(0, dirPath.indexOf('/') + 1)];
          }
          return [match[0], dirPath + '/'];
        });
      
      // Eliminar duplicados
      const uniqueDirs = new Set();
      commonPrefixMatches = commonPrefixMatches.filter(match => {
        const dir = match[1];
        if (uniqueDirs.has(dir)) {
          return false;
        }
        uniqueDirs.add(dir);
        return true;
      });
    }
    
    const folders = commonPrefixMatches.map(match => {
      const folderPath = match[1];
      // Quitar la parte del path actual para mostrar solo el nombre de la carpeta
      const folderName = folderPath.startsWith(path) 
        ? folderPath.substring(path.length) 
        : folderPath;
      return {
        name: folderName.replace(/\/$/, ''),  // Quitar barra final
        path: folderPath,
        type: 'directory'
      };
    });
    
    // Extraer archivos
    let contentMatches = Array.from(responseText.matchAll(/<Contents>[\s\S]*?<Key>(.*?)<\/Key>[\s\S]*?<Size>(.*?)<\/Size>[\s\S]*?<LastModified>(.*?)<\/LastModified>[\s\S]*?<\/Contents>/g));
    
    // Si no hay coincidencias con el patrón completo, intentar extraer solo las claves
    if (contentMatches.length === 0) {
      contentMatches = Array.from(responseText.matchAll(/<Key>(.*?)<\/Key>/g))
        .filter(match => {
          const filePath = match[1];
          // Filtrar directorios (terminan en /) y quedarse con los archivos del nivel actual
          return !filePath.endsWith('/') && 
            (path === '' || filePath.startsWith(path)) &&
            (path === '' || filePath.split('/').length === path.split('/').length + (path.endsWith('/') ? 0 : 1));
        })
        .map(match => [match[0], match[1], '0', new Date().toISOString()]); // Valores predeterminados para tamaño y fecha
    }
    
    const files = contentMatches
      .filter(match => {
        const filePath = match[1];
        // Solo incluir archivos en el nivel actual (no subcarpetas)
        if (filePath.endsWith('/')) return false; // Es un directorio
        if (path && !filePath.startsWith(path)) return false; // No está en la ruta actual
        
        // Si estamos en una carpeta, solo mostrar archivos de ese nivel (no de subcarpetas)
        if (path) {
          const relativePath = filePath.substring(path.length);
          return !relativePath.includes('/');
        }
        
        return !filePath.includes('/'); // En la raíz, solo mostrar archivos de la raíz
      })
      .map(match => {
        const filePath = match[1];
        const size = parseInt(match[2] || '0', 10);
        const lastModified = match[3] ? new Date(match[3]) : new Date();
        
        // Obtener solo el nombre del archivo (sin la ruta)
        const fileName = filePath.includes('/') 
          ? filePath.substring(filePath.lastIndexOf('/') + 1) 
          : filePath;
        
        return {
          name: fileName,
          path: filePath,
          size,
          lastModified,
          type: 'file'
        };
      });
    
    // Ordenar: primero carpetas, luego archivos (ambos alfabéticamente)
    const sortedFolders = folders.sort((a, b) => a.name.localeCompare(b.name));
    const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      folders: sortedFolders,
      files: sortedFiles,
      path: path
    };
  } catch (error) {
    console.error('[MinIO] Error al listar contenido:', error);
    throw error;
  }
}

/**
 * Lista todos los buckets disponibles
 * 
 * @param {object} credentials - Credenciales MinIO (access_key, secret_key)
 * @param {object} config - Configuración para la conexión (endpoint, secure, etc.)
 * @returns {Promise<Array>} - Lista de buckets disponibles
 */
async function listBuckets(credentials, config = {}) {
  try {
    // Validar credenciales mínimas requeridas
    if (!credentials.access_key || !credentials.secret_key) {
      throw new Error('Faltan credenciales requeridas (access_key, secret_key)');
    }
    
    // Verificar si el endpoint está en credenciales en lugar de config
    if (!config.endpoint) {
      if (credentials.endpoint) {
        // Mover el endpoint a la configuración
        config.endpoint = credentials.endpoint;
        console.log("[MinIO] listBuckets: Se encontró endpoint en credenciales, movido a config:", config.endpoint);
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
    
    // Extraer el host sin el protocolo
    const host = endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Utilizar la opción de puerto si está especificada
    const port = config.port ? `:${config.port}` : '';
    const baseUrl = `${endpoint}${port}`;
    
    // URL para listar todos los buckets
    const url = `${baseUrl}`;
    
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
    const canonicalUri = '/';
    const canonicalQueryString = '';
    
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
    
    console.log('[MinIO] Listando buckets con endpoint:', endpoint);
    
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
      console.log('[MinIO] Error en respuesta al listar buckets:', errorText);
      
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
    
    // Procesar la respuesta para extraer los buckets
    const responseText = await response.text();
    console.log('[MinIO] Respuesta de buckets:', responseText.substring(0, 150) + '...');
    
    // Extraer nombres de buckets
    const bucketMatches = Array.from(responseText.matchAll(/<Name>(.*?)<\/Name>/g));
    
    if (bucketMatches.length === 0) {
      console.log('[MinIO] No se encontraron buckets en la respuesta');
      return [];
    }
    
    const buckets = bucketMatches.map(match => {
      return {
        name: match[1],
        path: match[1]
      };
    });
    
    return buckets;
  } catch (error) {
    console.error('[MinIO] Error al listar buckets:', error);
    throw error;
  }
}

/**
 * Crea un nuevo bucket en MinIO
 * 
 * @param {object} credentials - Credenciales MinIO (access_key, secret_key)
 * @param {object} config - Configuración (endpoint, secure, etc.)
 * @param {string} bucketName - Nombre del bucket a crear
 * @returns {Promise<object>} - Resultado de la operación
 */
async function createBucket(credentials, config = {}, bucketName) {
  try {
    if (!bucketName) {
      throw new Error('El nombre del bucket es requerido');
    }
    
    // Validar credenciales mínimas requeridas
    if (!credentials.access_key || !credentials.secret_key) {
      throw new Error('Faltan credenciales requeridas (access_key, secret_key)');
    }
    
    // Verificar si el endpoint está en credenciales en lugar de config
    if (!config.endpoint) {
      if (credentials.endpoint) {
        // Mover el endpoint a la configuración
        config.endpoint = credentials.endpoint;
        console.log("[MinIO] createBucket: Se encontró endpoint en credenciales, movido a config:", config.endpoint);
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
    
    // Extraer el host sin el protocolo
    const host = endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Utilizar la opción de puerto si está especificada
    const port = config.port ? `:${config.port}` : '';
    const baseUrl = `${endpoint}${port}`;
    
    // URL para crear el bucket
    const url = `${baseUrl}/${bucketName}`;
    
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
    const canonicalUri = `/${bucketName}`;
    const canonicalQueryString = '';
    
    const sortedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaders.map(key => `${key}:${headers[key]}\n`).join('');
    const signedHeaders = sortedHeaders.join(';');
    
    const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // hash de cuerpo vacío
    
    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    
    console.log(`[MinIO] Creando bucket "${bucketName}" con endpoint:`, endpoint);
    
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
      method: 'PUT',
      headers: {
        ...headers,
        'Authorization': authorizationHeader
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('[MinIO] Error al crear bucket:', errorText);
      
      // Intentar extraer el mensaje de error del XML
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      // Buscar el mensaje de error en la respuesta XML
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      if (codeMatch && messageMatch) {
        const errorCode = codeMatch[1];
        const errorDetail = messageMatch[1];
        
        if (errorCode === 'BucketAlreadyExists') {
          return {
            success: false,
            message: `El bucket "${bucketName}" ya existe.`,
            details: {
              errorCode,
              errorDetail
            }
          };
        } else if (errorCode === 'BucketAlreadyOwnedByYou') {
          return {
            success: true,
            message: `El bucket "${bucketName}" ya existe y es de su propiedad.`,
            details: {
              bucketName,
              exists: true
            }
          };
        } else {
          return {
            success: false,
            message: `Error al crear bucket MinIO (${errorCode}): ${errorDetail}`,
            details: {
              errorCode,
              errorDetail
            }
          };
        }
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
    
    // Crear exitoso
    return {
      success: true,
      message: `Bucket "${bucketName}" creado con éxito`,
      details: {
        bucketName
      }
    };
  } catch (error) {
    console.error('[MinIO] Error al crear bucket:', error);
    return {
      success: false,
      message: `Error al crear bucket: ${error.message}`
    };
  }
}

module.exports = {
  testConnection,
  listContents,
  listBuckets,
  createBucket
};
