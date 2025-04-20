import { pool } from '../../../lib/db';

/**
 * Endpoint de depuración para examinar la respuesta XML de MinIO
 * 
 * Este endpoint obtiene y muestra la respuesta XML sin procesar del servicio MinIO
 * para analizar su estructura y entender las etiquetas que contiene.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id } = req.query;
  const secretId = id || '1'; // Por defecto usa el ID 1 si no se especifica

  try {
    // Obtener el secreto de MinIO
    const secretResult = await pool.query(`
      SELECT id, nombre, tipo, secretos
      FROM cloud_secrets
      WHERE id = $1 AND tipo = 'minio'
    `, [secretId]);
    
    if (secretResult.rows.length === 0) {
      return res.status(404).json({ error: 'Secreto MinIO no encontrado' });
    }
    
    const secret = secretResult.rows[0];
    console.log(`[API] debug/minio-xml: Depurando secreto ID ${secret.id} (${secret.nombre})`);
    
    // Parsear credenciales
    const credentials = typeof secret.secretos === 'string'
      ? JSON.parse(secret.secretos)
      : secret.secretos;
    
    // Configuración
    const config = {};
    if (credentials.endpoint) {
      config.endpoint = credentials.endpoint;
    }
    
    // Preparar la solicitud
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
    console.log('[API] debug/minio-xml: Enviando solicitud a', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'Authorization': authorizationHeader
      }
    });
    
    // Verificar respuesta
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] debug/minio-xml: Error en respuesta HTTP', response.status, response.statusText);
      console.error('[API] debug/minio-xml: Respuesta completa:', errorText);
      
      return res.status(500).json({ 
        error: `Error HTTP ${response.status}: ${response.statusText}`,
        response: errorText 
      });
    }
    
    // Obtener la respuesta XML sin procesar
    const responseText = await response.text();
    console.log('[API] debug/minio-xml: Respuesta XML recibida:', responseText.substring(0, 500) + '...');
    
    // Buscar diferentes patrones de etiquetas
    const patterns = [
      { name: "name1", pattern: /<n>(.*?)<\/Name>/g },
      { name: "name2", pattern: /<Name>(.*?)<\/Name>/g },
      { name: "bucket1", pattern: /<Bucket>(.*?)<\/Bucket>/g },
      { name: "bucket2", pattern: /<Bucket>(.*)/g }
    ];
    
    const results = {};
    patterns.forEach(p => {
      const matches = Array.from(responseText.matchAll(p.pattern) || []);
      results[p.name] = matches.map(m => m[1]);
    });
    
    // Devolver la respuesta XML completa y los resultados del análisis
    return res.status(200).json({
      success: true,
      contentType: response.headers.get('content-type'),
      xmlSize: responseText.length,
      xml: responseText,
      patternResults: results
    });
  } catch (error) {
    console.error('[API] Error en debug/minio-xml:', error);
    return res.status(500).json({ error: `Error: ${error.message}` });
  }
}

// Funciones auxiliares
function getAmzDate() {
  const date = new Date();
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function getDateStamp() {
  const date = new Date();
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}