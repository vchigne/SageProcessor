/**
 * Adaptador para MinIO (versión corregida)
 * 
 * Esta versión incluye la corrección de la expresión regular para extraer
 * correctamente los nombres de buckets de la respuesta XML.
 */

// Reexportar las funciones del archivo original con la corrección
const minioModule = require('./minio.js');

// Sobrescribir la función listBuckets con la versión corregida
exports.listBuckets = async function(credentials, config = {}) {
  try {
    // Validar credenciales
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
        throw new Error('Falta la configuración del endpoint para MinIO');
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
    
    console.log('[MinIO] Listando buckets con endpoint:', endpoint);
    
    // Construir URL para listar buckets
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
      
      // Buscar el mensaje de error en la respuesta XML
      const codeMatch = errorText.match(/<Code>(.*?)<\/Code>/);
      const messageMatch = errorText.match(/<Message>(.*?)<\/Message>/);
      
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      if (codeMatch && messageMatch) {
        errorMessage = `Error MinIO (${codeMatch[1]}): ${messageMatch[1]}`;
      }
      
      console.log('[MinIO] Error al listar buckets:', errorMessage);
      console.log('[MinIO] Respuesta completa:', errorText);
      
      throw new Error(errorMessage);
    }
    
    // Procesar la respuesta XML para extraer los buckets
    const responseText = await response.text();
    
    console.log('[MinIO] Respuesta de buckets:', responseText.substring(0, 100) + '...');
    
    // Extraer nombres de buckets - CORRECCIÓN AQUÍ: se cambió <n> por <Name>
    const bucketMatches = Array.from(responseText.matchAll(/<Name>(.*?)<\/Name>/g));
    
    // Extraer información adicional si está disponible
    const buckets = bucketMatches.map(match => {
      const name = match[1];
      
      // Intentar extraer información adicional
      const creationDateMatch = responseText.match(new RegExp(`<CreationDate>(.*?)<\\/CreationDate>`, 'g'));
      
      return {
        name,
        // añadir información adicional si está disponible
        creationDate: creationDateMatch ? new Date(creationDateMatch[0].replace(/<\/?CreationDate>/g, '')) : null
      };
    });
    
    return buckets;
  } catch (error) {
    console.error('Error al listar buckets MinIO:', error);
    throw error;
  }
};

// Funciones auxiliares
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getAmzDate() {
  const date = new Date();
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function getDateStamp() {
  const date = new Date();
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

// Reexportar todas las demás funciones del módulo original
Object.keys(minioModule).forEach(key => {
  if (key !== 'listBuckets') {
    exports[key] = minioModule[key];
  }
});