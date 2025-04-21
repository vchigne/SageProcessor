/**
 * API para listar buckets de un proveedor cloud usando un secreto de nube
 * 
 * GET: Lista todos los buckets disponibles para el secreto especificado por ID
 * POST: Crea un nuevo bucket utilizando las credenciales del secreto
 */

import { pool } from '../../../../../utils/db';
import { getCloudAdapter } from '../../../../../utils/cloud';

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    
    // Validar que id sea un número válido
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de secreto no válido' });
    }
    
    if (req.method === 'GET') {
      return await listBuckets(req, res, parseInt(id));
    } else if (req.method === 'POST') {
      return await createBucket(req, res, parseInt(id));
    } else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API de buckets de secreto:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error interno del servidor: ${error.message}` 
    });
  }
}

/**
 * Lista los buckets disponibles para un secreto cloud específico
 */
async function listBuckets(req, res, id) {
  try {
    const client = await pool.connect();
    
    try {
      // Obtener el secreto por ID
      const secretResult = await client.query(
        `SELECT id, nombre, tipo, secretos
         FROM cloud_secrets
         WHERE id = $1`,
        [id]
      );
      
      if (secretResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Secreto no encontrado' 
        });
      }
      
      const secret = secretResult.rows[0];
      
      // Crear un proveedor temporal para listar buckets
      // Parsear credenciales si es necesario
      let credenciales = typeof secret.secretos === 'string' 
        ? JSON.parse(secret.secretos) 
        : secret.secretos;
        
      // Para GCP, necesitamos asegurarnos de que el key_file esté parseado correctamente
      if (secret.tipo === 'gcp' && credenciales.key_file && typeof credenciales.key_file === 'string') {
        try {
          console.log('[Buckets API] Intentando parsear key_file de GCP');
          credenciales.key_file = JSON.parse(credenciales.key_file);
          console.log('[Buckets API] key_file parseado correctamente');
        } catch (error) {
          console.error('[Buckets API] Error al parsear key_file:', error);
          // Continuamos aunque haya error, el adaptador intentará manejarlo
        }
      }
      
      // Para Azure, verificar la estructura de connection_string
      if (secret.tipo === 'azure' && credenciales.connection_string) {
        console.log('[Buckets API] Verificando formato del connection_string de Azure');
        const connString = credenciales.connection_string;
        
        // Formato especial con URL + SharedAccessSignature
        if ((connString.includes('SharedAccessSignature=sv=') || connString.includes('SharedAccessSignature=')) && 
            connString.includes('blob.core.windows.net')) {
          console.log('[Buckets API] Detectado formato connection_string con SharedAccessSignature y URL');
        }
        
        // Mostrar información básica para diagnóstico
        console.log('[Buckets API] Información de connection_string de Azure:', {
          longitud: connString.length,
          contiene_sharedaccesssignature: connString.includes('SharedAccessSignature='),
          contiene_sv: connString.includes('sv='),
          contiene_blob: connString.includes('blob.core.windows.net'),
          empieza_con_http: connString.startsWith('http')
        });
        
        // Agregar configuración para activar modo SAS token en Azure
        if (connString.includes('blob.core.windows.net')) {
          console.log('[Buckets API] Connection string de Azure detectada, activando modo SAS');
          // Se manejará cuando creemos el tempProvider más adelante
        }
      }
      
      console.log('[Buckets API] Credenciales preparadas:', {
        tipo: secret.tipo,
        credenciales_type: typeof credenciales,
        key_file_type: credenciales.key_file ? typeof credenciales.key_file : 'undefined',
        tiene_connection_string: secret.tipo === 'azure' ? !!credenciales.connection_string : undefined
      });
      
      // Para Azure, configuración especial
      let configuracionAzure = {};
      if (secret.tipo === 'azure' && credenciales.connection_string && 
          credenciales.connection_string.includes('blob.core.windows.net')) {
        console.log('[Buckets API] Activando modo SAS para Azure en listBuckets');
        configuracionAzure.use_sas = true;
      }
      
      // Normalizar las credenciales según el tipo de proveedor para listBuckets
      let normalizedCredentials = { ...credenciales };
      
      // Asegurarnos de que todas las credenciales tengan formato uniforme
      if (secret.tipo === 's3' || secret.tipo === 'minio') {
        normalizedCredentials = {
          ...normalizedCredentials,
          access_key: normalizedCredentials.access_key || normalizedCredentials.accessKey,
          secret_key: normalizedCredentials.secret_key || normalizedCredentials.secretKey
        };
      } else if (secret.tipo === 'azure') {
        // Para Azure mantenemos el formato tal cual
      } else if (secret.tipo === 'gcp') {
        // Para GCP aseguramos que key_file esté correctamente formateado
        if (normalizedCredentials.key_file && typeof normalizedCredentials.key_file === 'string') {
          try {
            normalizedCredentials.key_file = JSON.parse(normalizedCredentials.key_file);
          } catch (e) {
            // Mantenemos el formato original si hay error en el parsing
          }
        }
      }
      
      const tempProvider = {
        id: 0,
        nombre: `Test de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: normalizedCredentials,
        configuracion: configuracionAzure
      };
      
      // Obtener adaptador y listar buckets
      try {
        const adapter = await getCloudAdapter(tempProvider.tipo);
        
        if (!adapter) {
          return res.status(400).json({ 
            success: false, 
            message: `Tipo de proveedor no soportado: ${secret.tipo}` 
          });
        }
        
        // Anteriormente se simulaba GCP, pero ahora usamos API real conforme a directiva NO USAR SIMULACIONES
        // No hay caso especial para GCP, usamos el mismo flujo para todos los proveedores
        
        // Verificamos que el adaptador tenga el método listBuckets
        if (!adapter.listBuckets) {
          return res.status(400).json({ 
            success: false, 
            message: `El proveedor ${secret.tipo} no implementa el método listBuckets` 
          });
        }
        
        // Listar buckets
        console.log(`[Buckets API] Listando buckets para proveedor tipo: ${secret.tipo}`);
        if (secret.tipo === 'gcp') {
          const keyData = typeof tempProvider.credenciales.key_file === 'string' 
            ? JSON.parse(tempProvider.credenciales.key_file) 
            : tempProvider.credenciales.key_file;
            
          console.log('[Buckets API] Project ID de GCP:', keyData.project_id);
        }
        
        const result = await adapter.listBuckets(tempProvider.credenciales, tempProvider.configuracion);
        
        // Actualizar fecha de última modificación
        await client.query(
          `UPDATE cloud_secrets 
           SET modificado_en = NOW()
           WHERE id = $1`,
          [id]
        );
        
        // Procesar los resultados y garantizar que cada bucket tenga name y path
        let buckets = [];
        if (result && Array.isArray(result)) {
          buckets = result;
        } else if (result && result.buckets && Array.isArray(result.buckets)) {
          buckets = result.buckets;
        }
        
        // Normalizar los resultados: garantizar que cada bucket tenga name y path
        // IMPORTANTE: Exactamente el mismo formato que SAGE Clouds original
        const normalizedBuckets = buckets.map(bucket => {
          // Si es un string simple
          if (typeof bucket === 'string') {
            return { name: bucket, path: bucket };
          }
          
          // Si ya es un objeto, asegurarse que tenga path
          const name = bucket.name || bucket.nombre || '';
          return {
            ...bucket,
            name: name,
            path: bucket.path || name // Si no tiene path, usar name
          };
        });
        
        console.log(`[Buckets API] Buckets normalizados (${normalizedBuckets.length}):`, 
          normalizedBuckets.map(b => b.name).join(', '));
          
        return res.status(200).json({
          success: true,
          buckets: normalizedBuckets
        });
      } catch (error) {
        console.error('Error al listar buckets:', error);
        return res.status(200).json({
          success: false,
          message: `Error al listar buckets: ${error.message}`,
          buckets: []
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en listBuckets:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error al listar buckets: ${error.message}`,
      buckets: []
    });
  }
}

/**
 * Crea un nuevo bucket en el proveedor cloud usando un secreto específico
 */
async function createBucket(req, res, id) {
  try {
    // Validar el cuerpo de la solicitud
    let { bucketName } = req.body;
    
    console.log(`[Buckets API] Credenciales preparadas para crear bucket:`, {
      tipo: 'azure',
      credenciales_type: typeof req.body.bucketName,
      key_file_type: typeof bucketName,
      bucket_name: bucketName
    });
    
    // Asegurarse de que bucketName sea un string
    if (typeof bucketName !== 'string') {
      if (bucketName === undefined || bucketName === null) {
        return res.status(400).json({
          success: false,
          message: 'Nombre de bucket no proporcionado'
        });
      }
      
      // Intentar convertir a string si no lo es
      try {
        bucketName = String(bucketName);
        console.log(`[Buckets API] bucketName convertido a string:`, bucketName);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Nombre de bucket no es convertible a string: ${error.message}`
        });
      }
    }
    
    // Validar formato del nombre (letras minúsculas, números, puntos y guiones)
    if (!/^[a-z0-9.-]+$/.test(bucketName)) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de bucket inválido. Use sólo letras minúsculas, números, puntos y guiones.'
      });
    }
    
    const client = await pool.connect();
    
    try {
      // Obtener el secreto por ID
      const secretResult = await client.query(
        `SELECT id, nombre, tipo, secretos
         FROM cloud_secrets
         WHERE id = $1`,
        [id]
      );
      
      if (secretResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Secreto no encontrado' 
        });
      }
      
      const secret = secretResult.rows[0];
      
      // Crear un proveedor temporal para listar buckets
      // Parsear credenciales si es necesario
      let credenciales = typeof secret.secretos === 'string' 
        ? JSON.parse(secret.secretos) 
        : secret.secretos;
        
      // Para GCP, necesitamos asegurarnos de que el key_file esté parseado correctamente
      if (secret.tipo === 'gcp' && credenciales.key_file && typeof credenciales.key_file === 'string') {
        try {
          console.log('[Buckets API] Intentando parsear key_file de GCP');
          credenciales.key_file = JSON.parse(credenciales.key_file);
          console.log('[Buckets API] key_file parseado correctamente');
        } catch (error) {
          console.error('[Buckets API] Error al parsear key_file:', error);
          // Continuamos aunque haya error, el adaptador intentará manejarlo
        }
      }
      
      // Para Azure, verificar la estructura de connection_string
      if (secret.tipo === 'azure' && credenciales.connection_string) {
        console.log('[Buckets API] Verificando formato del connection_string de Azure para crear bucket');
        const connString = credenciales.connection_string;
        
        // Formato especial con URL + SharedAccessSignature
        if ((connString.includes('SharedAccessSignature=sv=') || connString.includes('SharedAccessSignature=')) && 
            connString.includes('blob.core.windows.net')) {
          console.log('[Buckets API] Detectado formato connection_string con SharedAccessSignature y URL');
          
          // Verificar que el SAS token tenga permisos de creación (sp=c o sp=a)
          if (!connString.includes('sp=c') && !connString.includes('sp=rwdlacup') && 
              !connString.includes('sp=a') && !connString.includes('sp=racwdl')) {
            console.warn('[Buckets API] Advertencia: El SAS token no parece tener permisos explícitos de creación');
          }
        }
        
        // Mostrar información básica para diagnóstico
        console.log('[Buckets API] Información de connection_string de Azure:', {
          longitud: connString.length,
          contiene_sharedaccesssignature: connString.includes('SharedAccessSignature='),
          contiene_sv: connString.includes('sv='),
          contiene_blob: connString.includes('blob.core.windows.net'),
          empieza_con_http: connString.startsWith('http'),
          contiene_permisos_crear: 
            connString.includes('sp=c') || 
            connString.includes('sp=a') || 
            connString.includes('sp=rwdlacup') || 
            connString.includes('sp=racwdl')
        });
      }
      
      console.log('[Buckets API] Credenciales preparadas para crear bucket:', {
        tipo: secret.tipo,
        credenciales_type: typeof credenciales,
        key_file_type: credenciales.key_file ? typeof credenciales.key_file : 'undefined',
        bucket_name: bucketName,
        tiene_connection_string: secret.tipo === 'azure' ? !!credenciales.connection_string : undefined,
        connection_string_length: secret.tipo === 'azure' && credenciales.connection_string ? credenciales.connection_string.length : 0
      });
      
      // Para Azure, configuración especial
      let configuracionAzure = {};
      if (secret.tipo === 'azure' && credenciales.connection_string && 
          credenciales.connection_string.includes('blob.core.windows.net')) {
        console.log('[Buckets API] Activando modo SAS para Azure en createBucket');
        configuracionAzure.use_sas = true;
      }
      
      // Normalizar las credenciales según el tipo de proveedor para createBucket
      let normalizedCredentials = { ...credenciales };
      
      // Asegurarnos de que todas las credenciales tengan formato uniforme
      if (secret.tipo === 's3' || secret.tipo === 'minio') {
        normalizedCredentials = {
          ...normalizedCredentials,
          access_key: normalizedCredentials.access_key || normalizedCredentials.accessKey,
          secret_key: normalizedCredentials.secret_key || normalizedCredentials.secretKey,
          bucket: bucketName,
          bucket_name: bucketName
        };
      } else if (secret.tipo === 'azure') {
        normalizedCredentials = {
          ...normalizedCredentials,
          containerName: bucketName,
          container_name: bucketName
        };
      } else if (secret.tipo === 'gcp') {
        // Para GCP aseguramos que key_file esté correctamente formateado
        if (normalizedCredentials.key_file && typeof normalizedCredentials.key_file === 'string') {
          try {
            normalizedCredentials.key_file = JSON.parse(normalizedCredentials.key_file);
          } catch (e) {
            // Mantenemos el formato original si hay error en el parsing
          }
        }
      }
      
      const tempProvider = {
        id: 0,
        nombre: `Test de ${secret.nombre}`,
        tipo: secret.tipo,
        credenciales: normalizedCredentials,
        configuracion: configuracionAzure
      };
      
      // Obtener adaptador y crear bucket
      try {
        const adapter = await getCloudAdapter(tempProvider.tipo);
        
        if (!adapter) {
          return res.status(400).json({ 
            success: false, 
            message: `Tipo de proveedor no soportado: ${secret.tipo}` 
          });
        }
        
        // Verificamos que el adaptador tenga el método createBucket
        if (!adapter.createBucket) {
          return res.status(400).json({ 
            success: false, 
            message: `El proveedor ${secret.tipo} no implementa el método createBucket` 
          });
        }
        
        // Crear bucket con posibles opciones específicas según el proveedor
        let options = {};
        
        // Configuraciones específicas por tipo de proveedor
        if (secret.tipo === 'gcp') {
          options = {
            location: 'us-central1',  // Valor predeterminado para GCP
            storageClass: 'STANDARD'
          };
        } else if (secret.tipo === 'azure') {
          // Opciones específicas para Azure si son necesarias
        } else if (secret.tipo === 's3') {
          // Opciones específicas para S3 si son necesarias
        }
        
        // Crear bucket
        console.log(`[Buckets API] Creando bucket "${bucketName}" en proveedor tipo ${secret.tipo}`);
        
        // Cada adaptador tiene un orden diferente de parámetros, necesitamos adaptarnos a cada implementación
        let result;
        
        // Comprobando directamente cada tipo de proveedor
        if (secret.tipo === 'minio') {
          console.log(`[Buckets API] Llamando a createBucket para MinIO con credenciales, config, bucketName`);
          result = await adapter.createBucket(tempProvider.credenciales, options, bucketName);
        } 
        else if (secret.tipo === 's3') {
          console.log(`[Buckets API] Llamando a createBucket para S3 con credenciales, config, bucketName`);
          result = await adapter.createBucket(tempProvider.credenciales, options, bucketName);
        }
        else if (secret.tipo === 'gcp') {
          console.log(`[Buckets API] Llamando a createBucket para GCP con credenciales, bucketName, config`);
          result = await adapter.createBucket(tempProvider.credenciales, bucketName, options);
        }
        else if (secret.tipo === 'azure') {
          console.log(`[Buckets API] Llamando a createBucket para Azure con credenciales, bucketName, config`);
          
          // Importante: Verificar que el nombre sea un string válido
          if (typeof bucketName !== 'string') {
            console.error(`[Buckets API] Error crítico: bucketName no es string, es: ${typeof bucketName}`, bucketName);
            return res.status(400).json({
              success: false,
              message: `Nombre de bucket inválido. Debe ser un string, se recibió: ${typeof bucketName}`
            });
          }
          
          // Log detallado del nombre recibido
          console.log(`[Buckets API] Nombre de bucket recibido: "${bucketName}" (${typeof bucketName})`);
          
          // Verificar formato del nombre para Azure (letras minúsculas y números, sin puntos ni caracteres especiales)
          if (!/^[a-z0-9-]+$/.test(bucketName)) {
            console.error(`[Buckets API] Error: bucketName no cumple el formato para Azure:`, bucketName);
            return res.status(400).json({
              success: false,
              message: `Nombre de contenedor inválido para Azure. Use sólo letras minúsculas, números y guiones. No se permiten puntos en Azure.`
            });
          }
          
          // Asegurarse de que las credenciales tengan la estructura correcta
          if (!tempProvider.credenciales.connection_string) {
            console.error('[Buckets API] Error: Faltan parámetros para Azure - connection_string es requerido');
            return res.status(400).json({
              success: false,
              message: 'Las credenciales de Azure requieren connection_string'
            });
          }
          
          // Intentar crear el contenedor
          try {
            // Verificar estructura completa de credenciales para debugging
            console.log(`[Buckets API] Verificando credenciales Azure:`, {
              tiene_connection_string: !!tempProvider.credenciales.connection_string,
              connection_string_length: tempProvider.credenciales.connection_string ? tempProvider.credenciales.connection_string.length : 0,
              tiene_account_name: !!tempProvider.credenciales.account_name,
              tiene_blob_endpoint: !!tempProvider.credenciales.blob_endpoint
            });
            
            // Pasar el nombre de bucket como string explícito
            // NOTA: Azure recibe parámetros (credentials, bucketName, config) a diferencia de otros adaptadores
            console.log(`[Buckets API] Pasando parámetros a adapter.createBucket: bucketName="${bucketName}"`);
            
            // Primer intento: Directo como string
            result = await adapter.createBucket(
              tempProvider.credenciales, 
              bucketName, // Pasar directamente como string
              options
            );
          } catch (error) {
            console.error('[Buckets API] Error al crear contenedor Azure:', error);
            return res.status(400).json({
              success: false,
              message: `Error al crear contenedor en Azure: ${error.message}`,
              error: error.name || 'AZURE_ERROR'
            });
          }
        }
        else if (secret.tipo === 'sftp') {
          console.log(`[Buckets API] Llamando a createBucket para SFTP con credenciales, bucketName, config`);
          result = await adapter.createBucket(tempProvider.credenciales, bucketName, options);
        }
        else {
          console.log(`[Buckets API] Proveedor desconocido: ${secret.tipo}, intentando orden: credentials, bucketName, config`);
          result = await adapter.createBucket(tempProvider.credenciales, bucketName, options);
        }
        
        // Verificar si la operación fue exitosa
        if (result && result.success === false) {
          // El adaptador reportó un error pero no lanzó una excepción
          console.log(`[Buckets API] Error reportado por el adaptador: ${result.message || 'Error desconocido'}`);
          return res.status(400).json({
            success: false,
            error: result.message || 'Error desconocido al crear el bucket',
            details: result.error || result.details || {}
          });
        }

        // Actualizar fecha de última modificación
        await client.query(
          `UPDATE cloud_secrets 
           SET modificado_en = NOW()
           WHERE id = $1`,
          [id]
        );
        
        return res.status(200).json({
          success: true,
          message: `Bucket "${bucketName}" creado exitosamente`,
          bucket: result
        });
      } catch (error) {
        console.error('Error al crear bucket:', error);
        return res.status(400).json({
          success: false,
          error: `Error al crear bucket: ${error.message}`
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en createBucket:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error al crear bucket: ${error.message}`
    });
  }
}