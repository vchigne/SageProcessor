/**
 * Adaptador para Amazon S3
 * 
 * Este adaptador implementa las operaciones necesarias para trabajar
 * con el almacenamiento en Amazon S3, permitiendo operaciones como
 * subir, descargar y listar archivos.
 */

// En una implementación real, usaríamos AWS SDK
// import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
 * Genera una URL firmada para acceder a un objeto en S3
 * @param {Object} client Cliente S3
 * @param {string} remotePath Ruta del objeto
 * @param {Object} options Opciones (expiración, etc.)
 * @returns {Promise<string>} URL firmada
 */
export async function getSignedUrl(client, remotePath, options = {}) {
  console.log(`[S3] Simulando generación de URL firmada para s3://${client.bucket}/${remotePath}`);
  
  // En implementación real:
  // const command = new GetObjectCommand({
  //   Bucket: client.bucket,
  //   Key: remotePath
  // });
  // return await getSignedUrl(client, command, { expiresIn: options.expiresIn || 3600 });
  
  // Devolvemos una URL simulada
  const expiresIn = options.expiresIn || 3600;
  const expiry = new Date(Date.now() + expiresIn * 1000).toISOString();
  return `https://${client.bucket}.s3.${client.region}.amazonaws.com/${remotePath}?X-Amz-Expires=${expiresIn}&X-Amz-Date=${Date.now()}&expiry=${expiry}`;
}

/**
 * Prueba la conexión a Amazon S3 usando AWS REST API directamente
 * @param {Object} credentials Credenciales
 * @param {Object} config Configuración
 * @returns {Promise<Object>} Resultado de la prueba
 */
export async function testConnection(credentials, config = {}) {
  try {
    console.log(`[S3] Probando conexión a S3 con usuario ${credentials.access_key?.substring(0, 4)}...`);
    
    if (!credentials.access_key || !credentials.secret_key) {
      throw new Error('Credenciales incompletas: Se requiere access_key y secret_key');
    }
    
    if (!credentials.bucket) {
      throw new Error('Configuración incompleta: Se requiere un bucket');
    }
    
    const region = config.region || 'us-east-1';
    const bucket = credentials.bucket;
    
    // Construir la URL para listar objetos (con max-keys=1 para obtener sólo un objeto)
    const url = `https://${bucket}.s3.${region}.amazonaws.com/?list-type=2&max-keys=1`;
    
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
    const canonicalUri = '/';
    const canonicalQueryString = 'list-type=2&max-keys=1';
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
    
    console.log(`[S3] Probando conexión a bucket ${bucket} en región ${region}`);
    
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
      console.log('[S3] Error de respuesta:', errorText);
      
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
    
    // Parsear la respuesta XML
    const text = await response.text();
    console.log('[S3] Respuesta exitosa del bucket');
    
    return {
      success: true,
      message: 'Conexión a Amazon S3 exitosa',
      details: {
        bucket: credentials.bucket,
        region: config.region || 'us-east-1'
      }
    };
  } catch (error) {
    console.error('[S3] Error al probar conexión:', error);
    return {
      success: false,
      message: `Error al conectar con Amazon S3: ${error.message}`,
      details: error
    };
  }
}

/**
 * Lista contenido de un directorio de Amazon S3 con más detalles y organización
 * @param {Object} credentials Credenciales
 * @param {Object} config Configuración
 * @param {string} path Prefijo para listar
 * @param {number} limit Límite de objetos a devolver
 * @returns {Promise<Object>} Estructura organizada del contenido
 */
export async function listContents(credentials, config = {}, path = '', limit = 50) {
  try {
    console.log(`[S3] Listando contenido en bucket ${credentials.bucket}${path ? '/' + path : ''}`);
    
    const region = config.region || 'us-east-1';
    const bucket = credentials.bucket;
    
    // Construir la URL para listar objetos con delimiter para simular navegación de carpetas
    const prefix = path ? `${path}/` : '';
    const queryParams = `list-type=2&max-keys=${limit}&delimiter=/&prefix=${encodeURIComponent(prefix)}`;
    const url = `https://${bucket}.s3.${region}.amazonaws.com/?${queryParams}`;
    
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
    const canonicalUri = '/';
    const canonicalQueryString = queryParams;
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
    
    // Parsear la respuesta XML
    const text = await response.text();
    
    // En una implementación completa, parsearíamos el XML para extraer estos datos
    // Por ahora usamos una respuesta simulada para pruebas
    console.log('[S3] Respuesta XML del bucket:', text.substring(0, 200) + '...');
    
    // Simulamos respuesta con carpetas y archivos
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Simulamos obtener prefijos comunes (carpetas)
    const commonPrefixes = [
      { Prefix: `${path ? path + '/' : ''}carpeta1/` },
      { Prefix: `${path ? path + '/' : ''}carpeta2/` },
      { Prefix: `${path ? path + '/' : ''}2025-04-15/` }
    ];
    
    // Simulamos obtener objetos (archivos)
    const contents = [
      {
        Key: `${path ? path + '/' : ''}archivo1.txt`,
        Size: 1024,
        LastModified: now,
        ETag: '"abcdef1234567890"',
        StorageClass: 'STANDARD'
      },
      {
        Key: `${path ? path + '/' : ''}datos.xlsx`,
        Size: 15360,
        LastModified: yesterday,
        ETag: '"0987654321abcdef"',
        StorageClass: 'STANDARD'
      },
      {
        Key: `${path ? path + '/' : ''}config.json`,
        Size: 512,
        LastModified: yesterday,
        ETag: '"fedcba9876543210"',
        StorageClass: 'STANDARD'
      }
    ];
    
    // Convertimos la respuesta a un formato más amigable
    const formattedResponse = {
      path: path || '/',
      bucket: credentials.bucket,
      region: config.region || 'us-east-1',
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
        return {
          name: fileName,
          path: item.Key,
          size: item.Size,
          lastModified: item.LastModified,
          type: 'file',
          extension: fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '',
          storageClass: item.StorageClass
        };
      }),
      parentPath: path.split('/').slice(0, -1).join('/'),
      delimiter: '/',
      truncated: false, // Indica si hay más resultados
      totalSize: contents.reduce((acc, item) => acc + item.Size, 0)
    };
    
    return formattedResponse;
  } catch (error) {
    console.error('[S3] Error al listar contenido:', error);
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
  listContents
};