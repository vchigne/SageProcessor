import { pool } from '../../../../lib/db';

/**
 * API para listar buckets MinIO con debug adicional
 * 
 * Este endpoint lista los buckets disponibles en el servicio MinIO
 * y proporciona información adicional para depuración.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id: secretId } = req.query;
  
  if (!secretId) {
    return res.status(400).json({ error: 'Se requiere ID del secreto' });
  }

  try {
    // Obtener el secreto de MinIO
    const secretResult = await pool.query(`
      SELECT id, nombre, tipo, secretos
      FROM cloud_secrets
      WHERE id = $1
    `, [secretId]);
    
    if (secretResult.rows.length === 0) {
      return res.status(404).json({ error: 'Secreto no encontrado' });
    }
    
    const secret = secretResult.rows[0];
    
    // Parsear credenciales
    const credentials = typeof secret.secretos === 'string'
      ? JSON.parse(secret.secretos)
      : secret.secretos;
      
    // Verificar que sea MinIO
    if (secret.tipo !== 'minio') {
      return res.status(400).json({ error: 'Este endpoint solo funciona con secretos de tipo MinIO' });
    }
    
    // Configuración de MinIO
    const config = {};
    
    // Verificar si el endpoint está en credenciales en lugar de config
    if (credentials.endpoint) {
      // Mover el endpoint a la configuración
      config.endpoint = credentials.endpoint;
      console.log("[API] list-buckets-debug: Endpoint encontrado en credenciales:", config.endpoint);
    }

    // Definimos la función para listar buckets de forma manual
    async function listBucketsManual(credentials, config) {
      console.log('[API] Ejecutando listBucketsManual con config:', JSON.stringify(config));
      
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
        
        return {
          success: false,
          status: response.status,
          statusText: response.statusText,
          raw: errorText
        };
      }
      
      // Procesar la respuesta XML para extraer los buckets
      const responseText = await response.text();
      
      // Mostrar el XML completo para depuración
      console.log('[API] Respuesta XML completa:', responseText);
      
      // Extraer nombres de buckets con ambas expresiones para comparar
      const bucketMatches1 = Array.from(responseText.matchAll(/<n>(.*?)<\/Name>/g));
      const bucketMatches2 = Array.from(responseText.matchAll(/<Name>(.*?)<\/Name>/g));
      
      return {
        success: true,
        status: response.status,
        raw: responseText,
        bucketsN: bucketMatches1.map(match => match[1]),
        bucketsName: bucketMatches2.map(match => match[1])
      };
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
    
    // Ejecutar la versión de depuración
    const result = await listBucketsManual(credentials, config);
    
    return res.status(200).json({
      success: true,
      result
    });
  } catch (error) {
    console.error('[API] Error en endpoint list-buckets-debug:', error);
    return res.status(500).json({ error: `Error interno: ${error.message}` });
  }
}