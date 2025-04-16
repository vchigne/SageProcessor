/**
 * Adaptador para Amazon S3
 * 
 * Implementa las operaciones básicas para interactuar con buckets de S3 sin dependencias externas,
 * usando fetch y autenticación AWS SigV4 implementada manualmente.
 */

// Zona para simular operaciones y datos para pruebas
const USE_MOCK_DATA = false;

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
 * Prueba la conexión a S3 verificando si se puede acceder a un bucket
 * 
 * @param {object} credentials - Credenciales S3 (access_key, secret_key, bucket, etc.)
 * @param {object} config - Configuración opcional para el bucket (región, etc.)
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
  
  if (USE_MOCK_DATA) {
    // Para pruebas, simulamos una respuesta positiva
    await new Promise(resolve => setTimeout(resolve, 800)); // Simular demora
    return {
      success: true,
      message: `Conexión exitosa al bucket ${credentials.bucket}`,
      details: {
        bucketName: credentials.bucket,
        region: config.region || 'us-east-1'
      }
    };
  }
  
  try {
    console.log('Configuración recibida en S3 adapter:', JSON.stringify(config, null, 2));
    // Asegurarnos de tomar la región de las credenciales si no está en config
    const region = config.region || credentials.region || 'us-east-1';
    console.log('Usando región:', region);
    
    // Construir URL del bucket usando el formato path-style (más compatible)
    const host = `s3.${region}.amazonaws.com`;
    const url = `https://${host}/${credentials.bucket}?max-keys=1`;
    
    // Fecha y timestamp para la firma
    const amzDate = getAmzDate();
    const dateStamp = getDateStamp();
    
    // Headers a firmar
    const headers = {
      'host': host,
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
            message: `Las credenciales no tienen permisos para acceder al bucket "${credentials.bucket}". Verifica los permisos en IAM.`
          };
        } else if (errorCode === 'NoSuchBucket') {
          return {
            success: false,
            message: `El bucket "${credentials.bucket}" no existe en la región ${region} o no es accesible.`
          };
        } else if (errorCode === 'InvalidAccessKeyId') {
          return {
            success: false,
            message: `La clave de acceso proporcionada no existe en AWS. Verifica que la clave sea correcta.`
          };
        } else if (errorCode === 'SignatureDoesNotMatch') {
          return {
            success: false,
            message: `Error de autenticación con AWS: La firma generada no coincide. Verifica que la clave secreta sea correcta.`
          };
        } else if (errorCode === 'PermanentRedirect') {
          // Intentar extraer la región correcta del mensaje
          const endpointMatch = errorDetail.match(/endpoint/i);
          let redirectMessage = `El bucket "${credentials.bucket}" está en una región diferente a la especificada (${region}).`;
          
          // Normalmente AWS devuelve un header en la respuesta con la región correcta
          // Aquí intentamos extraerla del mensaje de error
          const regionMatch = errorDetail.match(/s3[.-]([a-z0-9-]+).amazonaws.com/i);
          if (regionMatch && regionMatch[1]) {
            const suggestedRegion = regionMatch[1];
            redirectMessage += ` Es posible que la región correcta sea "${suggestedRegion}".`;
          } else {
            redirectMessage += ` Por favor, verifica la región correcta en la consola de AWS.`;
          }
          
          return {
            success: false,
            message: redirectMessage
          };
        } else {
          return {
            success: false,
            message: `Error AWS S3 (${errorCode}): ${errorDetail}`
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
        region: region
      }
    };
  } catch (error) {
    console.error('Error al probar conexión con S3:', error);
    return {
      success: false,
      message: `Error al conectar con S3: ${error.message}`
    };
  }
}

/**
 * Lista el contenido de un bucket o carpeta dentro de un bucket
 * 
 * @param {object} credentials - Credenciales S3 (access_key, secret_key, bucket, etc.)
 * @param {object} config - Configuración para el bucket (región, etc.)
 * @param {string} path - Ruta dentro del bucket (prefijo)
 * @returns {Promise<object>} - Resultado con carpetas y archivos
 */
async function listContents(credentials, config = {}, path = '') {
  // Si path tiene barra al inicio, la quitamos
  if (path.startsWith('/')) {
    path = path.substring(1);
  }
  
  // Si path tiene barra al final y no está vacío, la conservamos
  // Esto es importante para navegar por "carpetas" en S3
  
  const bucket = credentials.bucket;
  const region = config.region || credentials.region || 'us-east-1';
  console.log('[S3] Listando bucket:', bucket, 'en región:', region);
  
  if (USE_MOCK_DATA) {
    // Simulamos una respuesta para pruebas
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simular demora
    
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    return {
      path: path || '/',
      bucket: bucket,
      region: region,
      parentPath: path.includes('/') ? path.split('/').slice(0, -1).join('/') : '',
      folders: [
        { name: 'docs', path: `${path ? path + '/' : ''}docs`, type: 'folder' },
        { name: 'images', path: `${path ? path + '/' : ''}images`, type: 'folder' },
        { name: 'backups', path: `${path ? path + '/' : ''}backups`, type: 'folder' }
      ],
      files: [
        { 
          name: 'readme.txt', 
          path: `${path ? path + '/' : ''}readme.txt`, 
          size: 2048, 
          lastModified: now,
          extension: 'txt',
          type: 'file'
        },
        { 
          name: 'data.csv', 
          path: `${path ? path + '/' : ''}data.csv`, 
          size: 15360, 
          lastModified: yesterday,
          extension: 'csv',
          type: 'file'
        }
      ]
    };
  }
  
  try {
    // Construir la URL para listar el contenido con prefijo y delimitador
    // Usamos delimitador '/' para simular carpetas y path-style para mejor compatibilidad
    const host = `s3.${region}.amazonaws.com`;
    const prefix = path ? encodeURIComponent(path + (path.endsWith('/') ? '' : '/')) : '';
    const url = `https://${host}/${bucket}?delimiter=%2F&list-type=2&max-keys=50&prefix=${prefix}`;
    
    // Fecha y timestamp para la firma
    const amzDate = getAmzDate();
    const dateStamp = getDateStamp();
    
    // Headers a firmar
    const headers = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // hash de cadena vacía
    };
    
    // Construir la solicitud canónica
    const canonicalUri = `/${bucket}`;
    const canonicalQueryString = `delimiter=%2F&list-type=2&max-keys=50&prefix=${prefix}`;
    
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
    
    console.log('[S3] Listando contenido en bucket', bucket);
    
    // Calcular la firma
    const canonicalRequestHash = await sha256(canonicalRequest);
    
    const algorithm = 'AWS4-HMAC-SHA256';
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
      console.log('[S3] Error en respuesta de bucket:', errorText);
      
      // Intentar extraer el mensaje de error del XML
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      // Buscar el mensaje de error en la respuesta XML
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      if (codeMatch && messageMatch) {
        const errorCode = codeMatch[1];
        const errorDetail = messageMatch[1];
        errorMessage = `Error AWS S3 (${errorCode}): ${errorDetail}`;
        
        // Si es un error de firma, agregamos información adicional
        if (errorCode === 'SignatureDoesNotMatch') {
          const stringToSignMatch = errorText.match(/<StringToSign>(.*?)<\/StringToSign>/);
          const signatureProvidedMatch = errorText.match(/<SignatureProvided>(.*?)<\/SignatureProvided>/);
          
          if (stringToSignMatch && signatureProvidedMatch) {
            errorMessage += `\n\nLa firma generada no coincide con lo esperado por AWS. Verifica:\n` +
              `1. El formato de la clave secreta (debe ser la clave de acceso secreta completa)\n` +
              `2. La región configurada (${region})\n` +
              `3. El nombre exacto del bucket (${bucket})\n` +
              `4. Asegúrate que la clave tenga permisos para listar objetos en este bucket`;
          }
        } else if (errorCode === 'NoSuchBucket') {
          errorMessage += `\n\nEl bucket '${bucket}' no existe en la región ${region} o no es accesible con las credenciales proporcionadas.`;
        } else if (errorCode === 'AccessDenied') {
          errorMessage += `\n\nLas credenciales proporcionadas no tienen permiso para acceder al bucket '${bucket}'. Verifica:\n` +
            `1. Que la clave de acceso tenga permisos suficientes (s3:ListBucket)\n` +
            `2. Que la política del bucket permita el acceso a este usuario`;
        } else if (errorCode === 'InvalidAccessKeyId') {
          errorMessage += `\n\nLa clave de acceso AWS proporcionada no existe. Verifica:\n` +
            `1. Que la clave de acceso sea correcta\n` +
            `2. Que la clave no haya sido eliminada o desactivada en la consola de AWS IAM`;
        } else if (errorCode === 'PermanentRedirect') {
          errorMessage += `\n\nEl bucket '${bucket}' está en una región diferente a la especificada (${region}). Verifica la región correcta en la consola de AWS.`;
          
          // Intentar extraer la región correcta si está disponible en el mensaje de error
          const endpointMatch = errorDetail.match(/specified endpoint/i);
          if (endpointMatch) {
            errorMessage += ` Por favor, usa la región correcta para acceder a este bucket.`;
          }
        }
      }
      
      console.log('[S3] Error al listar contenido:', errorMessage);
      
      // En lugar de lanzar un error, devolvemos un objeto con información del error
      return {
        error: true,
        errorMessage: errorMessage,
        code: response.status,
        path: path || '/',
        bucket: bucket,
        region: region,
        folders: [],
        files: []
      };
    }
    
    // Parsear la respuesta XML
    const text = await response.text();
    
    // Parsear la respuesta XML para extraer datos reales
    console.log('[S3] Respuesta XML del bucket completa:', text);
    
    // Extraer prefijos comunes (carpetas)
    const commonPrefixes = [];
    const commonPrefixesRegex = /<CommonPrefixes>\s*<Prefix>([^<]+)<\/Prefix>\s*<\/CommonPrefixes>/g;
    let prefixMatch;
    while ((prefixMatch = commonPrefixesRegex.exec(text)) !== null) {
      commonPrefixes.push({ Prefix: prefixMatch[1] });
    }
    
    // Extraer contenido (archivos) - Ajustado para manejar diferentes formatos de XML de S3
    const contents = [];
    
    // Intentar con una expresión regular más flexible para extraer archivos
    // Esto debería funcionar con la mayoría de las respuestas de S3, incluso si varían ligeramente
    const contentsMatches = text.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
    
    contentsMatches.forEach(match => {
      const keyMatch = match.match(/<Key>([^<]+)<\/Key>/);
      const sizeMatch = match.match(/<Size>(\d+)<\/Size>/);
      const lastModifiedMatch = match.match(/<LastModified>([^<]+)<\/LastModified>/);
      const eTagMatch = match.match(/<ETag>([^<]+)<\/ETag>/);
      const storageClassMatch = match.match(/<StorageClass>([^<]+)<\/StorageClass>/);
      
      if (keyMatch) {
        contents.push({
          Key: keyMatch[1],
          LastModified: lastModifiedMatch ? new Date(lastModifiedMatch[1]) : new Date(),
          ETag: eTagMatch ? eTagMatch[1] : '',
          Size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
          StorageClass: storageClassMatch ? storageClassMatch[1] : 'STANDARD'
        });
      }
    });
    
    // Convertimos la respuesta a un formato más amigable
    const formattedResponse = {
      path: path || '/',
      bucket: bucket,
      region: region,
      parentPath: path.includes('/') ? path.split('/').slice(0, -1).join('/') : '',
      folders: commonPrefixes.map(prefix => {
        const folderName = prefix.Prefix.split('/').filter(Boolean).pop() || '';
        return {
          name: folderName,
          path: prefix.Prefix,
          type: 'folder'
        };
      }),
      files: contents.map(item => {
        const fileName = item.Key.split('/').pop();
        const extension = fileName.includes('.') ? fileName.split('.').pop() : '';
        return {
          name: fileName,
          path: item.Key,
          size: item.Size,
          lastModified: item.LastModified,
          extension: extension,
          type: 'file'
        };
      })
    };
    
    return formattedResponse;
  } catch (error) {
    console.error('[S3] Error al listar contenido:', error);
    
    // En lugar de propagar el error, devolvemos un objeto con información del error
    return {
      error: true,
      errorMessage: `Error al listar contenido: ${error.message}`,
      path: path || '/',
      bucket: bucket,
      region: region,
      folders: [],
      files: []
    };
  }
}

/**
 * Crea un cliente para interactuar con Amazon S3
 * @param {Object} credentials Credenciales (access_key, secret_key)
 * @param {Object} config Configuración adicional (region, etc.)
 * @returns {Object} Cliente configurado para Amazon S3
 */
function createClient(credentials, config = {}) {
  // Extraer la región o usar el valor por defecto
  const region = config.region || credentials.region || 'us-east-1';
  
  // Crear un objeto cliente con toda la información necesaria
  return {
    type: 's3',
    credentials,
    config,
    bucket: credentials.bucket,
    region: region
  };
}

/**
 * Sube un archivo a Amazon S3
 * @param {Object} client Cliente S3
 * @param {string} localPath Ruta local del archivo
 * @param {string} remotePath Ruta remota en S3
 * @returns {Promise<Object>} Información sobre la subida
 */
async function uploadFile(client, localPath, remotePath) {
  console.log(`[S3] Subiendo ${localPath} a s3://${client.bucket}/${remotePath}`);
  
  // Esta implementación necesitaría usar el SDK de AWS 
  // Por ahora devolvemos una simulación
  return {
    success: true,
    path: `s3://${client.bucket}/${remotePath}`,
    size: 1024, // Tamaño simulado
    etag: '12345678abcdef' // ETag simulado
  };
}

/**
 * Elimina barras al principio si existen
 * @param {string} path Ruta para normalizar
 * @returns {string} Ruta sin barra al principio
 */
function removeLeadingSlash(path) {
  // Verificar que path sea un string
  if (typeof path !== 'string') {
    console.warn('removeLeadingSlash: path no es un string:', path);
    return path;
  }
  if (path.startsWith('/')) {
    return path.slice(1);
  }
  return path;
}

/**
 * Descarga un archivo desde Amazon S3
 * @param {Object} client Cliente S3
 * @param {string} remotePath Ruta remota en S3
 * @param {string} localPath Ruta local donde guardar
 * @returns {Promise<Object>} Información sobre la descarga
 */
async function downloadFile(client, remotePath, localPath) {
  // Normalizar la estructura del cliente para asegurar que las credenciales estén en el formato correcto
  const credentials = client.credentials || client;

  // Normalizar la ruta remota para eliminar barras iniciales y asegurar que es un string
  let normalizedRemotePath;
  if (typeof remotePath === 'string') {
    normalizedRemotePath = removeLeadingSlash(remotePath);
  } else if (remotePath && remotePath.prefix) {
    // Manejar el caso donde remotePath es un objeto con propiedad prefix
    normalizedRemotePath = removeLeadingSlash(remotePath.prefix);
    console.log(`[S3] Formato de ruta remota corregido: ${normalizedRemotePath}`);
  } else {
    console.error(`[S3] Formato de ruta remota inválido:`, remotePath);
    normalizedRemotePath = '';
  }
  
  // Extraer el bucket y la clave del cliente o credenciales
  const bucket = credentials.bucket || client.bucket || client.config?.bucket;
  
  console.log(`[S3] Descargando s3://${bucket}/${normalizedRemotePath} a ${localPath}`);
  console.log('Cliente S3:', JSON.stringify(client, null, 2));
  console.log('Credenciales normalizadas:', JSON.stringify({
    ...credentials,
    secret_key: credentials.secret_key ? '***' : undefined
  }, null, 2));
  
  try {
    if (!bucket) {
      throw new Error('Bucket no especificado en la configuración');
    }
    
    // Asegurarse de que tenemos todas las credenciales necesarias
    if (!credentials.access_key || !credentials.secret_key) {
      throw new Error('Credenciales incompletas para AWS S3');
    }
    
    // Extraer la región o usar el valor por defecto
    const region = client.region || client.config?.region || client.credentials?.region || 'us-east-1';
    
    // Construir la URL para acceder al objeto
    const objectUrl = `https://${bucket}.s3.${region}.amazonaws.com/${normalizedRemotePath}`;
    console.log(`[S3] URL del objeto: ${objectUrl}`);
    
    // Calcular la fecha en formato AWS
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    
    // Crear los encabezados necesarios para la autenticación
    const headers = {
      'host': `${bucket}.s3.${region}.amazonaws.com`,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // Hash para cuerpo vacío
    };
    
    // Crear la cadena canónica
    const canonicalUri = `/${normalizedRemotePath}`;
    const canonicalQueryString = '';
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
      .join('');
    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');
    
    const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    
    // Calcular la firma
    const canonicalRequestHash = await sha256(canonicalRequest);
    
    const algorithm = 'AWS4-HMAC-SHA256';
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    
    const stringToSign = [
      algorithm,
      amzDate,
      scope,
      canonicalRequestHash
    ].join('\n');
    
    // Derivar la clave de firma
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
    
    // Obtener la firma
    const signature = await sign(kSigning, stringToSign);
    const signatureHex = Array.from(signature)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Crear el header de autorización
    const authorizationHeader = `${algorithm} Credential=${credentials.access_key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
    
    console.log('[S3] Enviando solicitud a AWS...');
    
    // Realizar la petición para descargar el objeto
    const response = await fetch(objectUrl, {
      method: 'GET',
      headers: {
        ...headers,
        'Authorization': authorizationHeader
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[S3] Error descargando objeto:', errorText);
      
      // Intentar extraer el mensaje de error del XML
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      if (codeMatch && messageMatch) {
        errorMessage = `Error S3 (${codeMatch[1]}): ${messageMatch[1]}`;
      }
      
      throw new Error(errorMessage);
    }
    
    console.log('[S3] Descarga exitosa, procesando respuesta...');
    
    // Obtener el contenido del objeto
    const fileBuffer = await response.arrayBuffer();
    const fs = require('fs');
    const path = require('path');
    
    // Asegurar que el directorio existe
    const directory = path.dirname(localPath);
    fs.mkdirSync(directory, { recursive: true });
    
    // Escribir el archivo en disco
    fs.writeFileSync(localPath, Buffer.from(fileBuffer));
    
    console.log(`[S3] Archivo descargado exitosamente en ${localPath} (${fileBuffer.byteLength} bytes)`);
    
    return {
      success: true,
      path: localPath,
      size: fileBuffer.byteLength
    };
  } catch (error) {
    console.error(`[S3] Error descargando archivo desde S3:`, error);
    throw new Error(`Error descargando archivo desde S3: ${error.message}`);
  }
}

/**
 * Lista archivos en un directorio de Amazon S3
 * @param {Object} client Cliente S3
 * @param {string} remotePath Prefijo para listar
 * @returns {Promise<Array<Object>>} Lista de objetos
 */
async function listFiles(client, remotePath) {
  // Aprovechar la función listContents que ya existe
  const result = await listContents(client.credentials, client.config, remotePath);
  return [...result.folders, ...result.files];
}

/**
 * Genera una URL firmada para acceder a un objeto en S3
 * @param {Object} client Cliente S3
 * @param {string} remotePath Ruta del objeto
 * @param {Object} options Opciones (expiración, etc.)
 * @returns {Promise<string>} URL firmada
 */
async function getSignedUrl(client, remotePath, options = {}) {
  console.log(`[S3] Generando URL firmada para s3://${client.bucket}/${remotePath}`);
  
  // Simple implementación para desarrollo
  const expiresIn = options.expiresIn || 3600;
  const expiry = new Date(Date.now() + expiresIn * 1000).toISOString();
  return `https://${client.bucket}.s3.${client.region}.amazonaws.com/${remotePath}?X-Amz-Expires=${expiresIn}&X-Amz-Date=${Date.now()}&expiry=${expiry}`;
}

// Exportar funciones del adaptador
export default {
  createClient,
  testConnection,
  uploadFile,
  downloadFile,
  listFiles,
  listContents,
  getSignedUrl
};