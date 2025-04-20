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
    
    // El container_name ya no es requerido para probar la conexión
    // Se podrá usar la API para listar los containers disponibles

    // Variables para almacenar los datos de conexión extraídos
    let accountName = credentials.account_name;
    let accountKey = credentials.account_key;
    let sasToken = null;
    let blobEndpoint = null;
    let useSasToken = false;
    
    if (credentials.connection_string) {
      try {
        console.log('[Azure] Usando connection string para extraer credenciales');
        // Normalizar la cadena de conexión (eliminar espacios, tabs, etc.)
        const normalizedConnString = credentials.connection_string.trim();
        console.log('[Azure] Connection string normalizada (primeros 30 chars):', 
          normalizedConnString.substring(0, 30) + '...');
        
        // Validar que tenga formato de ConnectionString (tiene múltiples partes con ;)
        if (!normalizedConnString.includes(';')) {
          throw new Error('El formato de la ConnectionString no es válido. Debe contener múltiples partes separadas por punto y coma (;)');
        }

        const connectionParts = normalizedConnString.split(';');
        console.log('[Azure] Número de partes en connection string:', connectionParts.length);
        
        // Mostrar partes para debugging (primeros caracteres)
        connectionParts.forEach((part, idx) => {
          if (part.trim()) {  // Solo si no está vacío
            console.log(`[Azure] Parte ${idx}: ${part.substring(0, Math.min(20, part.length))}...`);
          }
        });
        
        let hasBlobEndpoint = false;
        let hasSharedAccessSignature = false;
        
        for (const part of connectionParts) {
          // Normalizar las claves a minúsculas para hacer la comparación insensible a mayúsculas/minúsculas
          const normalizedPart = part.trim();
          if (!normalizedPart) continue;  // Saltar partes vacías
          
          const normalizedPartLower = normalizedPart.toLowerCase();
          
          // Buscar AccountName= o accountname= (insensible a mayúsculas/minúsculas)
          if (normalizedPartLower.startsWith('accountname=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              accountName = normalizedPart.substring(equalPos + 1);
              console.log('[Azure] AccountName extraído:', 
                accountName.length > 5 ? accountName.substring(0, 5) + '...' : 'vacío o muy corto');
            }
          } 
          // Buscar AccountKey= o accountkey= (insensible a mayúsculas/minúsculas)
          else if (normalizedPartLower.startsWith('accountkey=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              accountKey = normalizedPart.substring(equalPos + 1);
              console.log('[Azure] AccountKey extraído (longitud):', accountKey ? accountKey.length : 0);
            }
          }
          // Buscar SharedAccessSignature= (SAS Token)
          else if (normalizedPartLower.startsWith('sharedaccesssignature=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              sasToken = normalizedPart.substring(equalPos + 1);
              console.log('[Azure] SAS Token encontrado (longitud):', sasToken ? sasToken.length : 0);
              hasSharedAccessSignature = true;
            }
          }
          // Buscar BlobEndpoint= (para conexiones SAS principalmente)
          else if (normalizedPartLower.startsWith('blobendpoint=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              blobEndpoint = normalizedPart.substring(equalPos + 1);
              console.log('[Azure] BlobEndpoint extraído:', blobEndpoint);
              hasBlobEndpoint = true;
              
              // Intentar extraer el nombre de cuenta del BlobEndpoint
              try {
                const url = new URL(blobEndpoint);
                const hostParts = url.hostname.split('.');
                if (hostParts[0] && !accountName) {
                  accountName = hostParts[0];
                  console.log('[Azure] AccountName extraído del BlobEndpoint:', accountName);
                }
              } catch (err) {
                console.warn('[Azure] No se pudo extraer el nombre de cuenta del BlobEndpoint:', err);
              }
            }
          }
        }
        
        // Determinar si estamos usando una SAS
        if (hasBlobEndpoint && hasSharedAccessSignature) {
          console.log('[Azure] Detectada connection string con SAS Token');
          useSasToken = true;
        }
      } catch (error) {
        console.error('[Azure] Error al parsear connection string:', error);
        throw new Error(`Error al procesar connection string: ${error.message}. Por favor proporcione una connection string válida. Formatos soportados: 
        1. Conexión tradicional: DefaultEndpointsProtocol=https;AccountName=nombredelacuenta;AccountKey=clavedelacuenta;EndpointSuffix=core.windows.net
        2. Conexión SAS: BlobEndpoint=https://cuenta.blob.core.windows.net;SharedAccessSignature=sastoken`);
      }
    }
    
    const container = credentials.container_name;
    
    // Probar la conexión de acuerdo al tipo (SAS o Shared Key)
    if (useSasToken) {
      // Validar que tenemos la información mínima necesaria para SAS
      if (!accountName || !sasToken) {
        console.error('[Azure] Credenciales SAS incompletas. AccountName:', !!accountName, 'SAS Token:', !!sasToken);
        throw new Error('Faltan parámetros para la conexión con SAS Token. Se requiere BlobEndpoint y SharedAccessSignature en la connection string.');
      }
      
      console.log(`[Azure] Intentando listar contenedor usando SAS: ${container} en cuenta: ${accountName}`);
      
      // Para SAS no necesitamos firmar, el token ya tiene todos los permisos necesarios
      // Construir la URL completa incluyendo el SAS token
      let urlBase = '';
      if (blobEndpoint) {
        // Usar el BlobEndpoint proporcionado
        urlBase = blobEndpoint.endsWith('/') ? blobEndpoint : `${blobEndpoint}/`;
      } else {
        // Construir el endpoint usando el nombre de cuenta
        urlBase = `https://${accountName}.blob.core.windows.net/`;
      }
      
      // Construir URL con SAS para listar contenedor
      const url = `${urlBase}${container}?restype=container&comp=list&maxresults=1&${sasToken.startsWith('?') ? sasToken.substring(1) : sasToken}`;
      console.log(`[Azure SAS] URL generada (trunc): ${url.substring(0, 60)}...`);
      
      // Realizar la solicitud con SAS
      const response = await fetch(url, {
        method: 'GET'
        // No necesitamos encabezados adicionales con SAS, ya que toda la auth está en la URL
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Azure SAS] Error en respuesta:', errorText);
        
        // Analizar el error XML para proporcionar información más útil
        let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
        
        if (errorText.includes('<Code>AuthenticationFailed</Code>')) {
          errorMessage = 'Error de autenticación: El token SAS proporcionado no es válido o ha expirado.';
        } else if (errorText.includes('<Code>ContainerNotFound</Code>')) {
          errorMessage = `El contenedor '${container}' no existe en la cuenta de almacenamiento.`;
        } else if (errorText.includes('<Code>ResourceNotFound</Code>')) {
          errorMessage = `El recurso no existe. Verifique que el nombre del contenedor sea correcto.`;
        } else if (errorText.includes('<Code>AccountNameInvalid</Code>')) {
          errorMessage = `El nombre de la cuenta de almacenamiento '${accountName}' no es válido.`;
        }
        
        throw new Error(errorMessage);
      }
      
      // Procesamiento exitoso con SAS
      const xmlResponse = await response.text();
      console.log('[Azure SAS] Respuesta exitosa al listar contenedor:', xmlResponse.substring(0, 150) + '...');
      
      return {
        success: true,
        message: 'Conexión a Azure Blob Storage exitosa (usando SAS Token)',
        details: {
          container: credentials.container_name,
          account: accountName,
          authMethod: 'SAS'
        }
      };
    } else {
      // Autenticación tradicional con Shared Key
      if (!accountName || !accountKey) {
        console.error('[Azure] No se pudieron extraer credenciales. AccountName presente:', !!accountName, 'AccountKey presente:', !!accountKey);
        throw new Error('No se pudieron extraer las credenciales necesarias. Asegúrese de que la connection string incluya AccountName= y AccountKey=, o proporcione account_name y account_key directamente. El formato correcto es: DefaultEndpointsProtocol=https;AccountName=nombredelacuenta;AccountKey=clavedelacuenta;EndpointSuffix=core.windows.net');
      }

      // Construir la URL para listar el contenedor
      const url = `https://${accountName}.blob.core.windows.net/${container}?restype=container&comp=list&maxresults=1`;
      
      console.log(`[Azure] Intentando listar contenedor usando Shared Key: ${container} en cuenta: ${accountName}`);
      
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
        message: 'Conexión a Azure Blob Storage exitosa (usando Shared Key)',
        details: {
          container: credentials.container_name,
          account: accountName,
          authMethod: 'SharedKey'
        }
      };
    }
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
    
    // Variables para almacenar los datos de conexión extraídos
    let accountName = credentials.account_name;
    let accountKey = credentials.account_key;
    let sasToken = null;
    let blobEndpoint = null;
    let useSasToken = false;
    
    if (credentials.connection_string) {
      try {
        console.log('[Azure] Usando connection string para extraer credenciales');
        // Normalizar la cadena de conexión (eliminar espacios, tabs, etc.)
        const normalizedConnString = credentials.connection_string.trim();
        console.log('[Azure] Connection string normalizada (primeros 30 chars):', 
          normalizedConnString.substring(0, 30) + '...');
        
        // Validar que tenga formato de ConnectionString (tiene múltiples partes con ;)
        if (!normalizedConnString.includes(';')) {
          throw new Error('El formato de la ConnectionString no es válido. Debe contener múltiples partes separadas por punto y coma (;)');
        }

        const connectionParts = normalizedConnString.split(';');
        console.log('[Azure] Número de partes en connection string:', connectionParts.length);
        
        // Mostrar partes para debugging (primeros caracteres)
        connectionParts.forEach((part, idx) => {
          if (part.trim()) {  // Solo si no está vacío
            console.log(`[Azure] Parte ${idx}: ${part.substring(0, Math.min(20, part.length))}...`);
          }
        });
        
        let hasBlobEndpoint = false;
        let hasSharedAccessSignature = false;
        
        for (const part of connectionParts) {
          // Normalizar las claves a minúsculas para hacer la comparación insensible a mayúsculas/minúsculas
          const normalizedPart = part.trim();
          if (!normalizedPart) continue;  // Saltar partes vacías
          
          const normalizedPartLower = normalizedPart.toLowerCase();
          
          // Buscar AccountName= o accountname= (insensible a mayúsculas/minúsculas)
          if (normalizedPartLower.startsWith('accountname=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              accountName = normalizedPart.substring(equalPos + 1);
              console.log('[Azure] AccountName extraído:', 
                accountName.length > 5 ? accountName.substring(0, 5) + '...' : 'vacío o muy corto');
            }
          } 
          // Buscar AccountKey= o accountkey= (insensible a mayúsculas/minúsculas)
          else if (normalizedPartLower.startsWith('accountkey=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              accountKey = normalizedPart.substring(equalPos + 1);
              console.log('[Azure] AccountKey extraído (longitud):', accountKey ? accountKey.length : 0);
            }
          }
          // Buscar SharedAccessSignature= (SAS Token)
          else if (normalizedPartLower.startsWith('sharedaccesssignature=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              sasToken = normalizedPart.substring(equalPos + 1);
              console.log('[Azure] SAS Token encontrado (longitud):', sasToken ? sasToken.length : 0);
              hasSharedAccessSignature = true;
            }
          }
          // Buscar BlobEndpoint= (para conexiones SAS principalmente)
          else if (normalizedPartLower.startsWith('blobendpoint=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              blobEndpoint = normalizedPart.substring(equalPos + 1);
              console.log('[Azure] BlobEndpoint extraído:', blobEndpoint);
              hasBlobEndpoint = true;
              
              // Intentar extraer el nombre de cuenta del BlobEndpoint
              try {
                const url = new URL(blobEndpoint);
                const hostParts = url.hostname.split('.');
                if (hostParts[0] && !accountName) {
                  accountName = hostParts[0];
                  console.log('[Azure] AccountName extraído del BlobEndpoint:', accountName);
                }
              } catch (err) {
                console.warn('[Azure] No se pudo extraer el nombre de cuenta del BlobEndpoint:', err);
              }
            }
          }
        }
        
        // Determinar si estamos usando una SAS
        if (hasBlobEndpoint && hasSharedAccessSignature) {
          console.log('[Azure] Detectada connection string con SAS Token');
          useSasToken = true;
        }
      } catch (error) {
        console.error('[Azure] Error al parsear connection string:', error);
        throw new Error(`Error al procesar connection string: ${error.message}. Por favor proporcione una connection string válida. Formatos soportados: 
        1. Conexión tradicional: DefaultEndpointsProtocol=https;AccountName=nombredelacuenta;AccountKey=clavedelacuenta;EndpointSuffix=core.windows.net
        2. Conexión SAS: BlobEndpoint=https://cuenta.blob.core.windows.net;SharedAccessSignature=sastoken`);
      }
    }
    
    const prefix = path ? `${path}${path.endsWith('/') ? '' : '/'}` : '';
    const delimiter = '/';
    
    // Si usa SAS token, asegurarse de que tenemos lo necesario
    if (useSasToken) {
      // Validar que tenemos la información mínima necesaria para SAS
      if (!accountName || !sasToken || !blobEndpoint) {
        console.error('[Azure] Credenciales SAS incompletas. AccountName:', !!accountName, 'SAS Token:', !!sasToken, 'BlobEndpoint:', !!blobEndpoint);
        throw new Error('Faltan parámetros para la conexión con SAS Token. Se requiere BlobEndpoint y SharedAccessSignature en la connection string.');
      }
      
      console.log('[Azure] Listando contenedor usando SAS Token para la cuenta:', accountName);
      
      // Construir la URL con SAS token
      let urlBase = '';
      if (blobEndpoint) {
        // Usar el BlobEndpoint proporcionado
        urlBase = blobEndpoint.endsWith('/') ? blobEndpoint : `${blobEndpoint}/`;
      } else {
        // Construir el endpoint usando el nombre de cuenta
        urlBase = `https://${accountName}.blob.core.windows.net/`;
      }
      
      // Construir URL con SAS para listar contenedor con los parámetros de listado
      const url = `${urlBase}${containerName}?restype=container&comp=list&delimiter=${delimiter}&prefix=${encodeURIComponent(prefix)}&maxresults=${limit}&${sasToken.startsWith('?') ? sasToken.substring(1) : sasToken}`;
      console.log(`[Azure SAS] URL generada para listar contenido (trunc): ${url.substring(0, 60)}...`);
      
      // Realizar la solicitud con SAS
      const response = await fetch(url, {
        method: 'GET'
        // No necesitamos encabezados adicionales con SAS, ya que toda la auth está en la URL
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Azure SAS] Error en respuesta:', errorText);
        
        // Analizar el error XML para proporcionar información más útil
        let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
        
        if (errorText.includes('<Code>AuthenticationFailed</Code>')) {
          errorMessage = 'Error de autenticación: El token SAS proporcionado no es válido o ha expirado.';
        } else if (errorText.includes('<Code>ContainerNotFound</Code>')) {
          errorMessage = `El contenedor '${containerName}' no existe en la cuenta de almacenamiento.`;
        } else if (errorText.includes('<Code>ResourceNotFound</Code>')) {
          errorMessage = `El recurso no existe. Verifique que el nombre del contenedor sea correcto.`;
        } else if (errorText.includes('<Code>AccountNameInvalid</Code>')) {
          errorMessage = `El nombre de la cuenta de almacenamiento '${accountName}' no es válido.`;
        }
        
        throw new Error(errorMessage);
      }
      
      // Procesamiento exitoso con SAS
      const xmlResponse = await response.text();
      console.log('[Azure SAS] Respuesta XML recibida (primeros 150 caracteres):', xmlResponse.substring(0, 150) + '...');
      
      // Parsear XML manualmente para evitar problemas con DOMParser en Node.js
      const files = [];
      const folders = [];
      
      // Función para extraer el valor de una etiqueta
      function extractTagValue(xml, tag) {
        const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's');
        const match = regex.exec(xml);
        return match ? match[1] : '';
      }
      
      // Extraer blobs (archivos)
      const blobsRegex = /<Blob>([\s\S]*?)<\/Blob>/g;
      let blobMatch;
      while ((blobMatch = blobsRegex.exec(xmlResponse)) !== null) {
        const blobContent = blobMatch[1];
        const name = extractTagValue(blobContent, 'Name');
        const propertiesContent = blobContent.match(/<Properties>([\s\S]*?)<\/Properties>/)?.[1] || '';
        const size = parseInt(extractTagValue(propertiesContent, 'Content-Length'), 10) || 0;
        const lastModifiedStr = extractTagValue(propertiesContent, 'Last-Modified');
        const lastModified = lastModifiedStr ? new Date(lastModifiedStr) : new Date();
        
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
      
      // Extraer prefijos (carpetas)
      const prefixesRegex = /<BlobPrefix>([\s\S]*?)<\/BlobPrefix>/g;
      let prefixMatch;
      while ((prefixMatch = prefixesRegex.exec(xmlResponse)) !== null) {
        const prefixContent = prefixMatch[1];
        const prefixPath = extractTagValue(prefixContent, 'Name');
        
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
        service: 'azure',
        authMethod: 'SAS'
      };
    } else {
      // Autenticación tradicional con Shared Key
      if (!accountName || !accountKey) {
        console.error('[Azure] No se pudieron extraer credenciales para Shared Key. AccountName presente:', !!accountName, 'AccountKey presente:', !!accountKey);
        throw new Error('No se pudieron extraer las credenciales necesarias. Asegúrese de que la connection string incluya AccountName= y AccountKey=, o proporcione account_name y account_key directamente. El formato correcto es: DefaultEndpointsProtocol=https;AccountName=nombredelacuenta;AccountKey=clavedelacuenta;EndpointSuffix=core.windows.net');
      }

      console.log('[Azure] Listando contenedor usando Shared Key para la cuenta:', accountName);
    
      // Construir la URL para listar el contenedor con Shared Key
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
      console.log('[Azure] Respuesta XML completa (primeros 150 caracteres):', xmlResponse.substring(0, 150) + '...');
      
      // Parsear XML manualmente para evitar problemas con DOMParser en Node.js
      const files = [];
      const folders = [];
      
      // Función para extraer el valor de una etiqueta
      function extractTagValue(xml, tag) {
        const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's');
        const match = regex.exec(xml);
        return match ? match[1] : '';
      }
      
      // Extraer blobs (archivos)
      const blobsRegex = /<Blob>([\s\S]*?)<\/Blob>/g;
      let blobMatch;
      while ((blobMatch = blobsRegex.exec(xmlResponse)) !== null) {
        const blobContent = blobMatch[1];
        const name = extractTagValue(blobContent, 'Name');
        const propertiesContent = blobContent.match(/<Properties>([\s\S]*?)<\/Properties>/)?.[1] || '';
        const size = parseInt(extractTagValue(propertiesContent, 'Content-Length'), 10) || 0;
        const lastModifiedStr = extractTagValue(propertiesContent, 'Last-Modified');
        const lastModified = lastModifiedStr ? new Date(lastModifiedStr) : new Date();
        
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
      
      // Extraer prefijos (carpetas)
      const prefixesRegex = /<BlobPrefix>([\s\S]*?)<\/BlobPrefix>/g;
      let prefixMatch;
      while ((prefixMatch = prefixesRegex.exec(xmlResponse)) !== null) {
        const prefixContent = prefixMatch[1];
        const prefixPath = extractTagValue(prefixContent, 'Name');
        
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
        service: 'azure',
        authMethod: 'SharedKey'
      };
    }
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

// Exportar funciones del adaptador
/**
 * Lista todos los contenedores (buckets) disponibles en la cuenta de Azure
 * @param {Object} credentials Credenciales
 * @param {Object} config Configuración adicional
 * @returns {Promise<Array>} Lista de contenedores disponibles
 */
export async function listBuckets(credentials, config = {}) {
  try {
    console.log('[Azure] Listando contenedores disponibles');
    
    // Variables para almacenar los datos de conexión extraídos
    let accountName = credentials.account_name;
    let accountKey = credentials.account_key;
    let sasToken = null;
    let blobEndpoint = null;
    let useSasToken = false;
    
    if (credentials.connection_string) {
      try {
        console.log('[Azure] Usando connection string para extraer credenciales');
        const normalizedConnString = credentials.connection_string.trim();
        
        // Extraer parámetros de la connection string
        const connectionParts = normalizedConnString.split(';');
        
        for (const part of connectionParts) {
          const normalizedPart = part.trim();
          if (!normalizedPart) continue;
          
          const normalizedPartLower = normalizedPart.toLowerCase();
          
          if (normalizedPartLower.startsWith('accountname=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              accountName = normalizedPart.substring(equalPos + 1);
            }
          } 
          else if (normalizedPartLower.startsWith('accountkey=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              accountKey = normalizedPart.substring(equalPos + 1);
            }
          }
          else if (normalizedPartLower.startsWith('sharedaccesssignature=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              sasToken = normalizedPart.substring(equalPos + 1);
              useSasToken = true;
            }
          }
          else if (normalizedPartLower.startsWith('blobendpoint=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1 && equalPos < normalizedPart.length - 1) {
              blobEndpoint = normalizedPart.substring(equalPos + 1);
              
              // Intentar extraer el nombre de cuenta del BlobEndpoint
              try {
                const url = new URL(blobEndpoint);
                const hostParts = url.hostname.split('.');
                if (hostParts[0] && !accountName) {
                  accountName = hostParts[0];
                }
              } catch (err) {
                console.warn('[Azure] No se pudo extraer el nombre de cuenta del BlobEndpoint:', err);
              }
            }
          }
        }
      } catch (error) {
        console.error('[Azure] Error al parsear connection string:', error);
        throw new Error('Error al procesar connection string. Por favor proporcione una connection string válida.');
      }
    }
    
    // Validar que tengamos las credenciales necesarias
    if (!accountName) {
      throw new Error('No se pudo determinar el nombre de la cuenta de Azure. Verifique las credenciales proporcionadas.');
    }
    
    // Construir URL para listar contenedores
    let url;
    let headers = {};
    
    if (useSasToken) {
      // Usar SAS Token para autenticación
      let urlBase = '';
      if (blobEndpoint) {
        urlBase = blobEndpoint.endsWith('/') ? blobEndpoint : `${blobEndpoint}/`;
      } else {
        urlBase = `https://${accountName}.blob.core.windows.net/`;
      }
      
      // URL para listar contenedores con SAS
      url = `${urlBase}?comp=list&${sasToken.startsWith('?') ? sasToken.substring(1) : sasToken}`;
      
      console.log(`[Azure] Listando contenedores con SAS: ${url.substring(0, 50)}...`);
    } else {
      // Usar Shared Key para autenticación
      url = `https://${accountName}.blob.core.windows.net/?comp=list`;
      
      // Obtener la fecha actual en formato RFC 7231
      const date = new Date().toUTCString();
      
      // Crear la cadena a firmar
      const stringToSign = [
        'GET',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        `x-ms-date:${date}`,
        `x-ms-version:2020-04-08`,
        `/${accountName}/?comp=list`
      ].join('\n');
      
      // Función para calcular HMAC-SHA256
      async function hmacSha256(key, message) {
        const keyBytes = new TextEncoder().encode(key);
        const messageBytes = new TextEncoder().encode(message);
        
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'HMAC', hash: { name: 'SHA-256' } },
          false,
          ['sign']
        );
        
        const signature = await crypto.subtle.sign(
          'HMAC',
          cryptoKey,
          messageBytes
        );
        
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
      }
      
      // Decodificar la clave de cuenta
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
      
      headers = {
        'x-ms-date': date,
        'x-ms-version': '2020-04-08',
        'Authorization': `SharedKey ${accountName}:${signature}`
      };
      
      console.log(`[Azure] Listando contenedores con SharedKey: ${url}`);
    }
    
    // Realizar la solicitud HTTP
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Azure] Error al listar contenedores:', errorText);
      
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      if (errorText.includes('<Code>AuthenticationFailed</Code>')) {
        errorMessage = 'Error de autenticación: Las credenciales proporcionadas no son válidas.';
      } else if (errorText.includes('<Code>AccountNameInvalid</Code>')) {
        errorMessage = `El nombre de la cuenta de almacenamiento '${accountName}' no es válido.`;
      }
      
      throw new Error(errorMessage);
    }
    
    // Procesar la respuesta XML
    const xmlResponse = await response.text();
    console.log('[Azure] Respuesta XML:', xmlResponse.substring(0, 150) + '...');
    
    // Función para extraer el valor de una etiqueta
    function extractTagValue(xml, tag) {
      const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's');
      const match = regex.exec(xml);
      return match ? match[1] : '';
    }
    
    // Extraer contenedores del XML
    const containers = [];
    const containersRegex = /<Container>([\s\S]*?)<\/Container>/g;
    let containerMatch;
    
    while ((containerMatch = containersRegex.exec(xmlResponse)) !== null) {
      const containerContent = containerMatch[1];
      const name = extractTagValue(containerContent, 'Name');
      
      containers.push({
        name,
        type: 'container',
        created: new Date().toISOString() // Azure no proporciona fecha de creación en la respuesta de lista
      });
    }
    
    console.log(`[Azure] Se encontraron ${containers.length} contenedores`);
    return containers;
  } catch (error) {
    console.error('[Azure] Error al listar contenedores:', error);
    throw error;
  }
}

/**
 * Crea un nuevo contenedor (bucket) en Azure
 * @param {Object} credentials Credenciales
 * @param {Object} config Configuración
 * @param {string} bucketName Nombre del contenedor a crear
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function createBucket(credentials, config = {}, bucketName) {
  try {
    console.log(`[Azure] Creando contenedor "${bucketName}"`);
    
    if (!bucketName) {
      throw new Error('El nombre del contenedor es requerido');
    }
    
    // Validar el nombre del contenedor (reglas de Azure)
    if (!/^[a-z0-9][-a-z0-9]{1,61}[a-z0-9]$/.test(bucketName)) {
      throw new Error('El nombre del contenedor debe tener entre 3 y 63 caracteres, contener solo letras minúsculas, números y guiones, y comenzar y terminar con una letra o número.');
    }
    
    // Variables para almacenar los datos de conexión
    let accountName = credentials.account_name;
    let accountKey = credentials.account_key;
    let sasToken = null;
    let blobEndpoint = null;
    let useSasToken = false;
    
    if (credentials.connection_string) {
      // Extraer credenciales de la connection string
      try {
        const normalizedConnString = credentials.connection_string.trim();
        const connectionParts = normalizedConnString.split(';');
        
        for (const part of connectionParts) {
          const normalizedPart = part.trim();
          if (!normalizedPart) continue;
          
          const normalizedPartLower = normalizedPart.toLowerCase();
          
          if (normalizedPartLower.startsWith('accountname=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1) {
              accountName = normalizedPart.substring(equalPos + 1);
            }
          } 
          else if (normalizedPartLower.startsWith('accountkey=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1) {
              accountKey = normalizedPart.substring(equalPos + 1);
            }
          }
          else if (normalizedPartLower.startsWith('sharedaccesssignature=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1) {
              sasToken = normalizedPart.substring(equalPos + 1);
              useSasToken = true;
            }
          }
          else if (normalizedPartLower.startsWith('blobendpoint=')) {
            const equalPos = normalizedPart.indexOf('=');
            if (equalPos !== -1) {
              blobEndpoint = normalizedPart.substring(equalPos + 1);
              
              // Extraer el nombre de cuenta del BlobEndpoint
              try {
                const url = new URL(blobEndpoint);
                const hostParts = url.hostname.split('.');
                if (hostParts[0] && !accountName) {
                  accountName = hostParts[0];
                }
              } catch (err) {
                console.warn('[Azure] No se pudo extraer el nombre de cuenta del BlobEndpoint');
              }
            }
          }
        }
      } catch (error) {
        console.error('[Azure] Error al parsear connection string:', error);
        throw new Error('Error al procesar connection string. Por favor proporcione una connection string válida.');
      }
    }
    
    // Validar que tengamos las credenciales necesarias
    if (!accountName) {
      throw new Error('No se pudo determinar el nombre de la cuenta de Azure. Verifique las credenciales proporcionadas.');
    }
    
    // Construir URL y headers para crear el contenedor
    let url;
    let headers = {
      'Content-Length': '0'
    };
    
    if (useSasToken) {
      // Usar SAS Token para autenticación
      let urlBase = '';
      if (blobEndpoint) {
        urlBase = blobEndpoint.endsWith('/') ? blobEndpoint : `${blobEndpoint}/`;
      } else {
        urlBase = `https://${accountName}.blob.core.windows.net/`;
      }
      
      // URL para crear contenedor con SAS
      url = `${urlBase}${bucketName}?restype=container&${sasToken.startsWith('?') ? sasToken.substring(1) : sasToken}`;
      
      console.log(`[Azure] Creando contenedor con SAS: ${url.substring(0, 50)}...`);
    } else {
      // Usar Shared Key para autenticación
      url = `https://${accountName}.blob.core.windows.net/${bucketName}?restype=container`;
      
      // Obtener la fecha actual en formato RFC 7231
      const date = new Date().toUTCString();
      
      // Crear la cadena a firmar
      const stringToSign = [
        'PUT',
        '',
        '',
        '0',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        `x-ms-date:${date}`,
        `x-ms-version:2020-04-08`,
        `/${accountName}/${bucketName}?restype=container`
      ].join('\n');
      
      // Función para calcular HMAC-SHA256
      async function hmacSha256(key, message) {
        const keyBytes = new TextEncoder().encode(key);
        const messageBytes = new TextEncoder().encode(message);
        
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'HMAC', hash: { name: 'SHA-256' } },
          false,
          ['sign']
        );
        
        const signature = await crypto.subtle.sign(
          'HMAC',
          cryptoKey,
          messageBytes
        );
        
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
      }
      
      // Decodificar la clave de cuenta
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
      
      headers = {
        ...headers,
        'x-ms-date': date,
        'x-ms-version': '2020-04-08',
        'Authorization': `SharedKey ${accountName}:${signature}`
      };
      
      console.log(`[Azure] Creando contenedor con SharedKey: ${url}`);
    }
    
    // Realizar la solicitud HTTP
    const response = await fetch(url, {
      method: 'PUT',
      headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Azure] Error al crear contenedor:', errorText);
      
      let errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
      
      if (errorText.includes('<Code>AuthenticationFailed</Code>')) {
        errorMessage = 'Error de autenticación: Las credenciales proporcionadas no son válidas.';
      } else if (errorText.includes('<Code>ContainerAlreadyExists</Code>')) {
        errorMessage = `El contenedor '${bucketName}' ya existe.`;
      } else if (errorText.includes('<Code>AccountNameInvalid</Code>')) {
        errorMessage = `El nombre de la cuenta de almacenamiento '${accountName}' no es válido.`;
      } else if (errorText.includes('<Code>InvalidResourceName</Code>')) {
        errorMessage = `El nombre del contenedor '${bucketName}' no es válido. Debe tener entre 3 y 63 caracteres, contener solo letras minúsculas, números y guiones.`;
      }
      
      throw new Error(errorMessage);
    }
    
    console.log(`[Azure] Contenedor "${bucketName}" creado con éxito`);
    
    return {
      success: true,
      message: `Contenedor "${bucketName}" creado con éxito`,
      bucketName
    };
  } catch (error) {
    console.error('[Azure] Error al crear contenedor:', error);
    return {
      success: false,
      message: error.message
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
  listContents,
  listBuckets,
  createBucket
};