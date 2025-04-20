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
 * Prueba la conexión a S3 verificando si se pueden obtener los buckets o acceder a un bucket específico
 * 
 * @param {object} credentials - Credenciales S3 (access_key, secret_key, bucket opcional)
 * @param {object} config - Configuración opcional para el bucket (región, etc.)
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
  
  if (USE_MOCK_DATA) {
    // Para pruebas, simulamos una respuesta positiva
    await new Promise(resolve => setTimeout(resolve, 800)); // Simular demora
    const bucketInfo = credentials.bucket ? 
      { bucketName: credentials.bucket } : 
      { message: 'Conexión establecida, pero no se especificó bucket' };
    
    return {
      success: true,
      message: credentials.bucket ? 
        `Conexión exitosa al bucket ${credentials.bucket}` : 
        'Credenciales de AWS válidas',
      details: {
        ...bucketInfo,
        region: config.region || credentials.region || 'us-east-1'
      }
    };
  }
  
  try {
    console.log('[S3] Probando conexión con credenciales:', 
      `access_key=${credentials.access_key?.substring(0, 4)}***, ` +
      `secret_key=*****, ` + 
      `bucket=${credentials.bucket || 'no especificado'}`
    );
    
    // Asegurarnos de tomar la región de las credenciales si no está en config
    const region = config.region || credentials.region || 'us-east-1';
    console.log('[S3] Usando región:', region);
    
    // Si no hay bucket, probamos listando los buckets en su lugar
    if (!credentials.bucket) {
      try {
        console.log('[S3] No se especificó bucket, probando listar buckets');
        const buckets = await listBuckets(credentials, config);
        return {
          success: true,
          message: `Conexión exitosa. Se encontraron ${buckets.length} buckets.`,
          details: {
            bucketCount: buckets.length,
            region,
            buckets: buckets.slice(0, 5).map(b => b.name) // Solo mostramos los primeros 5 para no saturar
          }
        };
      } catch (error) {
        console.error('[S3] Error al listar buckets:', error);
        return {
          success: false,
          message: `Error al listar buckets: ${error.message}`
        };
      }
    }
    
    // Si hay bucket especificado, continuamos con la prueba de acceso al bucket
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
        }
      }
      
      throw new Error(errorMessage);
    }
    
    // Procesar respuesta XML
    const text = await response.text();
    console.log(`[S3] Respuesta de buckets (${text.length} bytes)`);
    
    // Extraer prefijos comunes (carpetas) y contenidos (archivos)
    const prefixMatches = text.match(/<CommonPrefix><Prefix>(.*?)<\/Prefix><\/CommonPrefix>/g) || [];
    const contentMatches = text.match(/<Contents>.*?<\/Contents>/gs) || [];
    
    // Procesar carpetas
    const folders = prefixMatches.map(match => {
      const prefix = match.replace(/<CommonPrefix><Prefix>(.*?)<\/Prefix><\/CommonPrefix>/, '$1');
      const name = prefix.split('/').filter(p => p).pop() || '';
      
      return {
        name,
        path: prefix,
        type: 'folder'
      };
    });
    
    // Procesar archivos
    const files = contentMatches.map(match => {
      const key = match.match(/<Key>(.*?)<\/Key>/)?.[1] || '';
      const size = parseInt(match.match(/<Size>(.*?)<\/Size>/)?.[1] || '0', 10);
      const lastModified = new Date(match.match(/<LastModified>(.*?)<\/LastModified>/)?.[1] || '');
      const name = key.split('/').pop() || '';
      const extension = name.includes('.') ? name.split('.').pop() : '';
      
      return {
        name,
        path: key,
        size,
        lastModified,
        extension,
        type: 'file'
      };
    }).filter(file => {
      const filePath = file.path;
      // Filtrar archivos que están en subcarpetas excepto los que están exactamente en la carpeta actual
      return filePath !== prefix && !filePath.slice(prefix.length).includes('/');
    });
    
    // Construir y devolver resultado
    const result = {
      path: path || '/',
      bucket,
      region,
      parentPath: path.includes('/') ? path.split('/').slice(0, -1).join('/') : '',
      folders,
      files
    };
    
    console.log(`[S3] Resultado: ${folders.length} carpetas, ${files.length} archivos`);
    return result;
  } catch (error) {
    console.error(`[S3] Error al listar contenido:`, error);
    throw error;
  }
}

/**
 * Crea un cliente para interactuar con Amazon S3
 * @param {Object} credentials Credenciales (access_key, secret_key)
 * @param {Object} config Configuración adicional (region, etc.)
 * @returns {Object} Cliente configurado para Amazon S3
 */
export function createClient(credentials, config = {}) {
  // En una implementación real, crearíamos un cliente S3 real
  // const client = new S3Client({
  //   region: config.region || 'us-east-1',
  //   credentials: {
  //     accessKeyId: credentials.access_key,
  //     secretAccessKey: credentials.secret_key
  //   }
  // });
  
  // Por ahora, devolvemos un objeto simulado para desarrollo
  return {
    type: 's3',
    credentials,
    config,
    bucket: credentials.bucket,
    region: config.region || 'us-east-1'
  };
}

/**
 * Sube un archivo a Amazon S3
 * @param {Object} client Cliente S3
 * @param {string} localPath Ruta local del archivo
 * @param {string} remotePath Ruta remota en S3
 * @returns {Promise<Object>} Información sobre la subida
 */
export async function uploadFile(client, localPath, remotePath) {
  console.log(`[S3] Simulando subida de ${localPath} a s3://${client.bucket}/${remotePath}`);
  
  // En implementación real:
  // const command = new PutObjectCommand({
  //   Bucket: client.bucket,
  //   Key: remotePath,
  //   Body: fs.createReadStream(localPath)
  // });
  // const response = await client.send(command);
  
  // Simulamos respuesta exitosa
  return {
    success: true,
    path: `s3://${client.bucket}/${remotePath}`,
    size: 1024, // Tamaño simulado
    etag: '12345678abcdef' // ETag simulado
  };
}

/**
 * Descarga un archivo desde Amazon S3
 * @param {Object} client Cliente S3
 * @param {string} remotePath Ruta remota en S3
 * @param {string} localPath Ruta local donde guardar
 * @returns {Promise<Object>} Información sobre la descarga
 */
export async function downloadFile(client, remotePath, localPath) {
  console.log(`[S3] Descargando s3://${client.bucket}/${remotePath} a ${localPath}`);
  
  try {
    // Extraer el bucket y la clave del cliente
    const bucket = client.bucket || client.config?.bucket;
    if (!bucket) {
      throw new Error('Bucket no especificado en la configuración');
    }
    
    // Asegurarse de que tenemos todas las credenciales necesarias
    if (!client.credentials?.access_key || !client.credentials?.secret_key) {
      throw new Error('Credenciales incompletas para AWS S3');
    }
    
    // Extraer la región o usar el valor por defecto
    const region = client.region || client.config?.region || 'us-east-1';
    
    // Construir la URL para acceder al objeto
    const objectUrl = `https://${bucket}.s3.${region}.amazonaws.com/${remotePath}`;
    
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
    const canonicalUri = `/${remotePath}`;
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
    
    // Función para crear un hash SHA-256
    async function sha256(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    
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
    const kSecret = new TextEncoder().encode(`AWS4${client.credentials.secret_key}`);
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
    const authorizationHeader = `${algorithm} Credential=${client.credentials.access_key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
    
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
    
    // Obtener el contenido del objeto
    const fileBuffer = await response.arrayBuffer();
    const fs = require('fs');
    const path = require('path');
    
    // Asegurar que el directorio existe
    const directory = path.dirname(localPath);
    fs.mkdirSync(directory, { recursive: true });
    
    // Escribir el archivo en disco
    fs.writeFileSync(localPath, Buffer.from(fileBuffer));
    
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
export async function listFiles(client, remotePath) {
  console.log(`[S3] Simulando listado de s3://${client.bucket}/${remotePath}`);
  
  // En implementación real:
  // const command = new ListObjectsV2Command({
  //   Bucket: client.bucket,
  //   Prefix: remotePath
  // });
  // const response = await client.send(command);
  // return response.Contents;
  
  // Devolvemos una lista simulada
  return [
    {
      Key: `${remotePath}/archivo1.txt`,
      Size: 1024,
      LastModified: new Date(),
      ETag: '"abcdef1234567890"'
    },
    {
      Key: `${remotePath}/archivo2.csv`,
      Size: 2048,
      LastModified: new Date(),
      ETag: '"1234567890abcdef"'
    }
  ];
}

/**
 * Lista los buckets disponibles en la cuenta de AWS S3
 * @param {object} credentials - Credenciales S3 (access_key, secret_key)
 * @param {object} config - Configuración opcional para la conexión (región, etc.)
 * @returns {Promise<Array>} - Lista de buckets disponibles
 */
async function listBuckets(credentials, config = {}) {
  console.log('[S3] Listando buckets disponibles');
  
  // Validar credenciales mínimas requeridas
  if (!credentials.access_key || !credentials.secret_key) {
    throw new Error('Faltan credenciales requeridas (access_key, secret_key)');
  }
  
  if (USE_MOCK_DATA) {
    // Para pruebas, simulamos una respuesta
    await new Promise(resolve => setTimeout(resolve, 800)); // Simular demora
    return [
      {
        name: 'mybucket1',
        path: 'mybucket1'
      },
      {
        name: 'mybucket2',
        path: 'mybucket2'
      },
      {
        name: 'logs-backup',
        path: 'logs-backup'
      }
    ];
  }
  
  try {
    // Asegurarnos de tomar la región de las credenciales si no está en config
    const region = config.region || credentials.region || 'us-east-1';
    console.log('[S3] Usando región:', region);
    
    // Construir URL del servicio S3 usando el formato de servicio
    const host = `s3.${region}.amazonaws.com`;
    const url = `https://${host}/`;
    
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
    const canonicalUri = '/';
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
    
    // Procesar la respuesta
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[S3] Error obteniendo buckets:', errorText);
      
      // Intentar extraer el mensaje de error del XML
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      // Buscar el mensaje de error en la respuesta XML
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      if (codeMatch && messageMatch) {
        errorMessage = `Error AWS S3 (${codeMatch[1]}): ${messageMatch[1]}`;
      }
      
      throw new Error(errorMessage);
    }
    
    // Parsear la respuesta XML para extraer los buckets
    const text = await response.text();
    console.log('[S3] Respuesta de listado de buckets:', text.substring(0, 100) + '...');
    
    // Extraer los nombres de bucket del XML
    const bucketNameMatches = text.match(/<Name>(.*?)<\/Name>/g);
    
    if (!bucketNameMatches) {
      console.log('[S3] No se encontraron buckets en la respuesta');
      return [];
    }
    
    // Extraer los nombres limpios y crear objetos de bucket
    const buckets = bucketNameMatches.map(match => {
      const name = match.replace(/<Name>(.*?)<\/Name>/, '$1');
      return {
        name,
        path: name
      };
    });
    
    console.log(`[S3] Se encontraron ${buckets.length} buckets:`, buckets.map(b => b.name).join(', '));
    return buckets;
  } catch (error) {
    console.error('[S3] Error al listar buckets:', error);
    throw error;
  }
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

/**
 * Crea un nuevo bucket en S3
 * @param {object} credentials - Credenciales S3 (access_key, secret_key)
 * @param {object} config - Configuración opcional (región, etc.)
 * @param {string} bucketName - Nombre del bucket a crear
 * @returns {Promise<object>} - Resultado de la operación
 */
async function createBucket(credentials, config = {}, bucketName) {
  console.log(`[S3] Creando bucket: ${bucketName}`);
  
  // Validar credenciales mínimas requeridas
  if (!credentials.access_key || !credentials.secret_key) {
    return {
      success: false,
      message: 'Faltan credenciales requeridas (access_key, secret_key)'
    };
  }
  
  if (!bucketName) {
    return {
      success: false,
      message: 'El nombre del bucket es requerido'
    };
  }
  
  if (USE_MOCK_DATA) {
    // Para pruebas, simulamos una respuesta exitosa
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simular demora
    return {
      success: true,
      message: `Bucket ${bucketName} creado con éxito`,
      details: {
        bucketName,
        region: config.region || credentials.region || 'us-east-1'
      }
    };
  }
  
  try {
    // Asegurarnos de tomar la región de las credenciales si no está en config
    const region = config.region || credentials.region || 'us-east-1';
    console.log('[S3] Usando región:', region);
    
    // Construir URL para crear el bucket
    const host = `s3.${region}.amazonaws.com`;
    const url = `https://${host}/${bucketName}`;
    
    // Fecha y timestamp para la firma
    const amzDate = getAmzDate();
    const dateStamp = getDateStamp();
    
    // Headers a firmar
    const headers = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // hash de cadena vacía
    };
    
    // Añadir región si no es us-east-1 (la predeterminada)
    if (region !== 'us-east-1') {
      headers['x-amz-bucket-region'] = region;
    }
    
    // Paso 1: Crear solicitud canónica
    const canonicalUri = `/${bucketName}`;
    const canonicalQueryString = '';
    
    // Construir los headers canónicos
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
      method: 'PUT',
      headers: {
        ...headers,
        'Authorization': authorizationHeader
      }
    });
    
    // Procesar la respuesta
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[S3] Error creando bucket:', errorText);
      
      // Intentar extraer el mensaje de error del XML
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      // Buscar el mensaje de error en la respuesta XML
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      if (codeMatch && messageMatch) {
        errorMessage = `Error AWS S3 (${codeMatch[1]}): ${messageMatch[1]}`;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
    
    // Éxito al crear el bucket
    return {
      success: true,
      message: `Bucket ${bucketName} creado con éxito`,
      details: {
        bucketName,
        region
      }
    };
  } catch (error) {
    console.error('[S3] Error al crear bucket:', error);
    return {
      success: false,
      message: `Error al crear bucket: ${error.message}`
    };
  }
}

// Exportar funciones del adaptador
export default {
  createClient,
  testConnection,
  uploadFile,
  downloadFile,
  listFiles,
  listContents,
  getSignedUrl,
  listBuckets,   // Agregamos la nueva función para listar buckets
  createBucket   // Agregamos la función para crear buckets
};