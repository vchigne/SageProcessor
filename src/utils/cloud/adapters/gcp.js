/**
 * Adaptador para Google Cloud Storage
 * 
 * Este adaptador implementa las operaciones necesarias para trabajar
 * con Google Cloud Storage, permitiendo operaciones como
 * subir, descargar y listar archivos.
 */

/**
 * Crea un cliente para interactuar con Google Cloud Storage
 * @param {Object} credentials Credenciales (key_file, bucket_name)
 * @param {Object} config Configuración adicional
 * @returns {Object} Cliente configurado para Google Cloud Storage
 */
export function createClient(credentials, config = {}) {
  return {
    bucket: credentials.bucket_name,
    storage: {
      type: 'gcp',
      config
    }
  };
}

/**
 * Prueba la conexión con Google Cloud Storage utilizando la API REST y firmando
 * la petición con las credenciales proporcionadas
 * @param {Object} credentials Credenciales (key_file, bucket_name)
 * @param {Object} config Configuración adicional
 * @returns {Promise<Object>} Resultado de la prueba
 */
export async function testConnection(credentials, config = {}) {
  try {
    console.log('[GCP] Probando conexión a Google Cloud Storage');
    
    // Validar credenciales básicas
    if (!credentials.key_file) {
      throw new Error('No se proporcionó el archivo de clave JSON');
    }
    
    // Para la sección de cloud_secrets, no requerimos bucket_name durante la prueba de conexión
    // Ya que solo estamos validando las credenciales de acceso a GCP
    
    // Parsear el archivo de clave JSON
    let keyData;
    try {
      keyData = JSON.parse(credentials.key_file);
    } catch (e) {
      throw new Error('El archivo de clave proporcionado no es un JSON válido');
    }
    
    // Verificar que el archivo de clave tenga los campos necesarios
    if (!keyData.client_email || !keyData.private_key) {
      throw new Error('El archivo de clave JSON no contiene los campos requeridos (client_email, private_key)');
    }
    
    const clientEmail = keyData.client_email;
    const privateKey = keyData.private_key;
    const projectId = keyData.project_id;
    const bucketName = credentials.bucket_name;
    
    console.log(`[GCP] Usando cuenta de servicio: ${clientEmail}`);
    
    // Solo mostrar mensaje de acceso al bucket si se proporcionó un nombre de bucket
    if (bucketName) {
      console.log(`[GCP] Probando acceso al bucket: ${bucketName}`);
    } else {
      console.log('[GCP] Modo de validación de credenciales (sin bucket específico)');
    }
    
    // Preparar solicitud para la API de Google Cloud Storage 
    // Usaremos la API REST con autenticación OAuth 2.0
    
    // Paso 1: Generar un JWT para obtener un token de acceso
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hora
    
    const jwtHeader = {
      alg: 'RS256',
      typ: 'JWT'
    };
    
    const jwtClaimSet = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/devstorage.read_write',
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiry,
      iat: now
    };
    
    // Función para codificar a Base64URL
    function base64UrlEncode(str) {
      return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    
    // Crear la cadena JWT
    const headerB64 = base64UrlEncode(JSON.stringify(jwtHeader));
    const claimSetB64 = base64UrlEncode(JSON.stringify(jwtClaimSet));
    const toSign = `${headerB64}.${claimSetB64}`;
    
    // Firmar el JWT con la clave privada
    async function signJwt(privateKey, data) {
      // Función para convertir de formato PEM a formato para uso con Web Crypto API
      function pemToArrayBuffer(pem) {
        // Eliminar encabezados y pies de página y espacios en blanco
        const base64 = pem
          .replace(/-----BEGIN PRIVATE KEY-----/, '')
          .replace(/-----END PRIVATE KEY-----/, '')
          .replace(/\s+/g, '');
        
        // Decodificar de Base64 a ArrayBuffer
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
      
      try {
        // Convertir la clave privada PEM a formato para uso con Web Crypto API
        const privateKeyBuffer = pemToArrayBuffer(privateKey);
        
        // Importar la clave
        const cryptoKey = await crypto.subtle.importKey(
          'pkcs8',
          privateKeyBuffer,
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: { name: 'SHA-256' }
          },
          false,
          ['sign']
        );
        
        // Firmar los datos
        const dataBuffer = new TextEncoder().encode(data);
        const signatureBuffer = await crypto.subtle.sign(
          { name: 'RSASSA-PKCS1-v1_5' },
          cryptoKey,
          dataBuffer
        );
        
        // Convertir la firma a Base64URL
        const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        
        return signature;
      } catch (error) {
        console.error('[GCP] Error al firmar JWT:', error);
        throw new Error(`Error al firmar JWT: ${error.message}. Verifique que la clave privada tenga el formato correcto.`);
      }
    }
    
    const signature = await signJwt(privateKey, toSign);
    const jwt = `${toSign}.${signature}`;
    
    // Paso 2: Obtener un token de acceso usando el JWT
    console.log('[GCP] Solicitando token de acceso');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[GCP] Error al obtener token de acceso:', errorData);
      
      let errorMessage = `Error al obtener token de acceso: ${tokenResponse.status} ${tokenResponse.statusText}`;
      
      if (errorData.error) {
        if (errorData.error === 'invalid_grant') {
          errorMessage = 'Error de autenticación: La cuenta de servicio no tiene permisos suficientes o las credenciales son inválidas.';
        } else {
          errorMessage += ` - ${errorData.error}: ${errorData.error_description}`;
        }
      }
      
      throw new Error(errorMessage);
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // Si no se proporcionó un bucket específico (por ejemplo, en la sección cloud_secrets),
    // verificamos solo que tengamos un token válido
    if (!bucketName) {
      console.log('[GCP] No se proporcionó bucket para verificar - solo validando credenciales');
      
      // Paso 3 (alternativo): Listar buckets disponibles en el proyecto
      console.log('[GCP] Listando buckets disponibles en el proyecto');
      const listBucketsUrl = 'https://storage.googleapis.com/storage/v1/b';
      
      const listResponse = await fetch(listBucketsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error('[GCP] Error al listar buckets:', errorText);
        
        let errorMessage = `Error al listar buckets: ${listResponse.status} ${listResponse.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) {
            if (errorData.error.message.includes('Permission')) {
              errorMessage = `No tiene permisos suficientes para listar buckets. Verifique los roles asignados a la cuenta de servicio.`;
            } else {
              errorMessage = errorData.error.message;
            }
          }
        } catch (e) {
          // Si no podemos parsear el JSON, usamos el mensaje de error general
        }
        
        throw new Error(errorMessage);
      }
      
      console.log('[GCP] Acceso exitoso al servicio de Google Cloud Storage');
    } 
    // Si se proporcionó un bucket, verificamos el acceso a ese bucket específico
    else {
      // Paso 3: Usar el token de acceso para probar el acceso al bucket
      console.log('[GCP] Probando acceso al bucket');
      const bucketUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o?maxResults=1`;
      
      const bucketResponse = await fetch(bucketUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!bucketResponse.ok) {
        const errorText = await bucketResponse.text();
        console.error('[GCP] Error al acceder al bucket:', errorText);
        
        let errorMessage = `Error al acceder al bucket: ${bucketResponse.status} ${bucketResponse.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) {
            if (errorData.error.message.includes('The specified bucket does not exist')) {
              errorMessage = `El bucket '${bucketName}' no existe o no es accesible con las credenciales proporcionadas.`;
            } else if (errorData.error.message.includes('Permission')) {
              errorMessage = `No tiene permisos suficientes para acceder al bucket '${bucketName}'. Verifique los roles asignados a la cuenta de servicio.`;
            } else {
              errorMessage = errorData.error.message;
            }
          }
        } catch (e) {
          // Si no podemos parsear el JSON, usamos el mensaje de error general
        }
        
        throw new Error(errorMessage);
      }
      
      const bucketData = await bucketResponse.json();
      console.log(`[GCP] Acceso exitoso al bucket ${bucketName}`);
    }
    
    // Construir el objeto de respuesta, omitiendo el bucket si no se proporcionó
    const response = {
      success: true,
      message: 'Conexión exitosa con Google Cloud Storage',
      details: {
        project: projectId,
        serviceAccount: clientEmail
      }
    };
    
    // Solo incluir el bucket en la respuesta si se proporcionó
    if (bucketName) {
      response.details.bucket = bucketName;
    }
    
    return response;
  } catch (error) {
    console.error('[GCP] Error en prueba de conexión:', error);
    return {
      success: false,
      message: `Error al conectar con Google Cloud Storage: ${error.message}`,
      details: error
    };
  }
}

/**
 * Lista archivos en un directorio de Google Cloud Storage
 * @param {Object} client Cliente configurado
 * @param {string} remotePath Ruta remota a listar
 * @returns {Promise<Array<Object>>} Lista de archivos
 */
export async function listFiles(client, remotePath) {
  try {
    console.log(`[GCP] Simulando listado de gs://${client.bucket}/${remotePath}`);
    
    // Por ahora, devolvemos una lista simulada
    return [
      {
        name: `${remotePath}/ejemplo1.txt`,
        size: 1024,
        lastModified: new Date(),
        isDirectory: false
      },
      {
        name: `${remotePath}/ejemplo2.jpg`,
        size: 2048,
        lastModified: new Date(),
        isDirectory: false
      }
    ];
  } catch (error) {
    console.error('Error al listar archivos en GCS:', error);
    throw error;
  }
}

/**
 * Sube un archivo a Google Cloud Storage
 * @param {Object} client Cliente configurado
 * @param {string} localPath Ruta local del archivo
 * @param {string} remotePath Ruta remota donde guardar el archivo
 * @returns {Promise<Object>} Información sobre la subida
 */
export async function uploadFile(client, localPath, remotePath) {
  try {
    console.log(`[GCP] Simulando subida de ${localPath} a gs://${client.bucket}/${remotePath}`);
    
    // Por ahora, retornamos un resultado simulado
    return {
      success: true,
      path: remotePath,
      size: 1024, // Tamaño simulado
      message: 'Archivo subido correctamente'
    };
  } catch (error) {
    console.error('Error al subir archivo a GCS:', error);
    throw error;
  }
}

/**
 * Descarga un archivo desde Google Cloud Storage
 * @param {Object} client Cliente configurado
 * @param {string} remotePath Ruta remota del archivo
 * @param {string} localPath Ruta local donde guardar el archivo
 * @returns {Promise<Object>} Información sobre la descarga
 */
export async function downloadFile(client, remotePath, localPath) {
  try {
    console.log(`[GCP] Simulando descarga de gs://${client.bucket}/${remotePath} a ${localPath}`);
    
    // Por ahora, retornamos un resultado simulado
    return {
      success: true,
      path: localPath,
      size: 1024, // Tamaño simulado
      message: 'Archivo descargado correctamente'
    };
  } catch (error) {
    console.error('Error al descargar archivo de GCS:', error);
    throw error;
  }
}

/**
 * Genera una URL firmada para acceder a un archivo en Google Cloud Storage
 * @param {Object} client Cliente configurado
 * @param {string} remotePath Ruta remota del archivo
 * @param {Object} options Opciones adicionales
 * @returns {Promise<string>} URL firmada
 */
export async function getSignedUrl(client, remotePath, options = {}) {
  try {
    console.log(`[GCP] Simulando generación de URL firmada para gs://${client.bucket}/${remotePath}`);
    
    // Por ahora, retornamos una URL simulada
    return `https://storage.googleapis.com/${client.bucket}/${remotePath}?token=simulated-signed-url-token`;
  } catch (error) {
    console.error('Error al generar URL firmada en GCS:', error);
    throw error;
  }
}

/**
 * Lista contenido de un bucket de Google Cloud Storage con más detalles
 * @param {Object} credentials Credenciales
 * @param {Object} config Configuración
 * @param {string} path Prefijo para listar
 * @param {number} limit Límite de objetos a devolver
 * @returns {Promise<Object>} Estructura organizada del contenido
 */
export async function listContents(credentials, config = {}, path = '', limit = 50) {
  try {
    const bucketName = credentials.bucket_name;
    console.log(`[GCP] Listando contenido en bucket ${bucketName}${path ? '/' + path : ''}`);
    
    // Parsear el archivo de clave JSON
    let keyData;
    try {
      keyData = JSON.parse(credentials.key_file);
    } catch (e) {
      throw new Error('El archivo de clave proporcionado no es un JSON válido');
    }
    
    // Verificar que el archivo de clave tenga los campos necesarios
    if (!keyData.client_email || !keyData.private_key) {
      throw new Error('El archivo de clave JSON no contiene los campos requeridos (client_email, private_key)');
    }
    
    const clientEmail = keyData.client_email;
    const privateKey = keyData.private_key;
    
    // Obtener token de acceso OAuth 2.0
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hora
    
    const jwtHeader = {
      alg: 'RS256',
      typ: 'JWT'
    };
    
    const jwtClaimSet = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/devstorage.read_write',
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiry,
      iat: now
    };
    
    // Función para codificar a Base64URL
    function base64UrlEncode(str) {
      return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    
    // Crear la cadena JWT
    const headerB64 = base64UrlEncode(JSON.stringify(jwtHeader));
    const claimSetB64 = base64UrlEncode(JSON.stringify(jwtClaimSet));
    const toSign = `${headerB64}.${claimSetB64}`;
    
    // Firmar el JWT con la clave privada
    async function signJwt(privateKey, data) {
      // Función para convertir de formato PEM a formato para uso con Web Crypto API
      function pemToArrayBuffer(pem) {
        // Eliminar encabezados y pies de página y espacios en blanco
        const base64 = pem
          .replace(/-----BEGIN PRIVATE KEY-----/, '')
          .replace(/-----END PRIVATE KEY-----/, '')
          .replace(/\s+/g, '');
        
        // Decodificar de Base64 a ArrayBuffer
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
      
      try {
        // Convertir la clave privada PEM a formato para uso con Web Crypto API
        const privateKeyBuffer = pemToArrayBuffer(privateKey);
        
        // Importar la clave
        const cryptoKey = await crypto.subtle.importKey(
          'pkcs8',
          privateKeyBuffer,
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: { name: 'SHA-256' }
          },
          false,
          ['sign']
        );
        
        // Firmar los datos
        const dataBuffer = new TextEncoder().encode(data);
        const signatureBuffer = await crypto.subtle.sign(
          { name: 'RSASSA-PKCS1-v1_5' },
          cryptoKey,
          dataBuffer
        );
        
        // Convertir la firma a Base64URL
        const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        
        return signature;
      } catch (error) {
        console.error('[GCP] Error al firmar JWT:', error);
        throw new Error(`Error al firmar JWT: ${error.message}`);
      }
    }
    
    const signature = await signJwt(privateKey, toSign);
    const jwt = `${toSign}.${signature}`;
    
    // Obtener token de acceso
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[GCP] Error al obtener token de acceso:', errorData);
      throw new Error(`Error al obtener token de acceso: ${errorData.error_description || tokenResponse.statusText}`);
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // Construir la URL para listar objetos con delimiter para simular navegación de carpetas
    const prefix = path ? `${path}${path.endsWith('/') ? '' : '/'}` : '';
    const delimiter = '/';
    const bucketUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o?delimiter=${delimiter}&prefix=${encodeURIComponent(prefix)}&maxResults=${limit}`;
    
    // Listar objetos en el bucket
    const response = await fetch(bucketUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GCP] Error al listar objetos:', errorText);
      
      let errorMessage = `Error al listar objetos: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        // Si no podemos parsear el JSON, usamos el mensaje de error general
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('[GCP] Respuesta de API GCS:', data);
    
    // Procesar respuesta en formato estándar para nuestra aplicación
    const files = [];
    const folders = [];
    
    // Procesar archivos
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        // Solo incluir archivos que estén exactamente en esta "carpeta"
        // y no en subcarpetas más profundas
        if (item.name.startsWith(prefix)) {
          const relativePath = item.name.substring(prefix.length);
          
          // Si no hay '/' en la ruta relativa, está en este nivel
          if (!relativePath.includes('/')) {
            files.push({
              name: relativePath,
              path: item.name,
              size: parseInt(item.size, 10),
              lastModified: new Date(item.updated),
              type: 'file',
              contentType: item.contentType
            });
          }
        }
      }
    }
    
    // Procesar "carpetas" (prefijos comunes)
    if (data.prefixes && data.prefixes.length > 0) {
      for (const folderPath of data.prefixes) {
        // Extraer solo el nombre de la carpeta
        const folderName = folderPath.substring(prefix.length);
        const folderNameNoSlash = folderName.endsWith('/') 
          ? folderName.substring(0, folderName.length - 1) 
          : folderName;
        
        folders.push({
          name: folderNameNoSlash,
          path: folderPath,
          type: 'folder'
        });
      }
    }
    
    return {
      bucket: bucketName,
      path: path || '/',
      files,
      folders,
      service: 'gcp'
    };
  } catch (error) {
    console.error('[GCP] Error al listar contenido:', error);
    return {
      error: true,
      errorMessage: error.message,
      bucket: credentials.bucket_name,
      path: path || '/',
      files: [],
      folders: []
    };
  }
}

export default {
  createClient,
  testConnection,
  listFiles,
  uploadFile,
  downloadFile,
  getSignedUrl,
  listContents
};