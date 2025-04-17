import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import s3Adapter from '@/utils/cloud/adapters/s3_fixed';
import azureAdapter from '@/utils/cloud/adapters/azure';
import gcpAdapter from '@/utils/cloud/adapters/gcp';
import sftpAdapter from '@/utils/cloud/adapters/sftp';
import minioAdapter from '@/utils/cloud/adapters/minio';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Configurar encabezados para descargas binarias
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { uuid, tipo } = req.query;

    if (!uuid) {
      return res.status(400).json({ message: 'Se requiere el UUID de la ejecución' });
    }

    if (!['log', 'yaml', 'datos'].includes(String(tipo))) {
      return res.status(400).json({ message: 'Tipo de archivo no válido' });
    }

    // Obtenemos información de la ejecución desde la base de datos
    const result = await pool.query(
      'SELECT uuid, nombre_yaml, archivo_datos, ruta_directorio, migrado_a_nube, ruta_nube, nube_primaria_id FROM ejecuciones_yaml WHERE uuid = $1',
      [uuid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ejecución no encontrada' });
    }

    const ejecucion = result.rows[0];
    
    console.log("Datos de ejecución:", JSON.stringify(ejecucion, null, 2));
    
    // Determinar si el archivo está en la nube o local
    // Verificar tanto migrado_a_nube como si la ruta_nube o ruta_directorio comienza con "cloud://"
    const estaEnNube = (ejecucion.migrado_a_nube && ejecucion.ruta_nube) || 
                      (ejecucion.ruta_directorio && ejecucion.ruta_directorio.startsWith('cloud://'));
    let execDir;
    
    if (estaEnNube) {
      // Determinar si usamos ruta_nube o ruta_directorio (en caso de cloud://)
      if (ejecucion.ruta_nube) {
        console.log('Ejecución migrada a la nube (ruta_nube):', ejecucion.ruta_nube);
        execDir = ejecucion.ruta_nube;
      } else if (ejecucion.ruta_directorio && ejecucion.ruta_directorio.startsWith('cloud://')) {
        console.log('Ejecución migrada a la nube (ruta_directorio):', ejecucion.ruta_directorio);
        execDir = ejecucion.ruta_directorio;
      } else {
        return res.status(500).json({ message: 'Inconsistencia en datos de ejecución: marcada como migrada pero sin ruta de nube válida' });
      }
    } else {
      // Usar el directorio almacenado en la base de datos si existe, sino construir la ruta por defecto
      if (ejecucion.ruta_directorio && !ejecucion.ruta_directorio.startsWith('cloud://')) {
        execDir = ejecucion.ruta_directorio;
      } else {
        execDir = path.join(process.cwd(), 'executions', String(uuid));
      }
      
      console.log('Directorio de ejecución para archivo (local):', execDir);
      
      // Si el directorio no existe localmente, retornamos un error
      if (!fs.existsSync(execDir)) {
        return res.status(404).json({ 
          message: 'Archivos de ejecución no encontrados',
          error: 'No se pudo encontrar el directorio de archivos para esta ejecución.',
          details: 'Es posible que los archivos hayan sido eliminados o movidos.',
          tipo: 'archivo_no_encontrado',
          rutaDirectorio: execDir
        });
      }
    }

    let filePath: string;
    let contentType: string;
    let fileName: string;

    switch (String(tipo)) {
      case 'log':
        filePath = path.join(execDir, 'output.log');
        contentType = 'text/html'; // Usando text/html para mantener consistencia con api/executions/[uuid]/log.ts
        fileName = `ejecucion_${uuid}_log.html`; // Cambiado a .html para mantener consistencia
        break;
      case 'yaml':
        filePath = path.join(execDir, ejecucion.nombre_yaml || 'input.yaml');
        contentType = 'application/x-yaml';
        fileName = `ejecucion_${uuid}_${ejecucion.nombre_yaml || 'input.yaml'}`;
        break;
      case 'datos':
        filePath = path.join(execDir, ejecucion.archivo_datos || '');
        // Intentamos determinar el tipo de contenido basado en la extensión
        const ext = path.extname(ejecucion.archivo_datos || '').toLowerCase();
        switch (ext) {
          case '.csv':
            contentType = 'text/csv';
            break;
          case '.json':
            contentType = 'application/json';
            break;
          case '.xml':
            contentType = 'application/xml';
            break;
          case '.zip':
            contentType = 'application/zip';
            break;
          default:
            contentType = 'application/octet-stream';
        }
        fileName = `ejecucion_${uuid}_${ejecucion.archivo_datos || 'datos'}`;
        break;
      default:
        return res.status(400).json({ message: 'Tipo de archivo no válido' });
    }

    // No aplicamos el Content-Type y Disposition aquí, 
    // pues lo configuraremos específicamente para cada caso más adelante
    if (estaEnNube) {
      // Definir las variables a nivel del bloque try/catch para tenerlas disponibles en caso de error
      let cloudPath = '';
      let providerName = '';
      let provider = null;

      try {
        // Si estamos usando ruta_directorio con formato cloud://
        if (ejecucion.ruta_directorio && ejecucion.ruta_directorio.startsWith('cloud://') && (!ejecucion.ruta_nube || !ejecucion.nube_primaria_id)) {
          // Extraer el nombre del proveedor de la URI en formato cloud://proveedor/ruta
          const cloudParts = ejecucion.ruta_directorio.substring(8).split('/');
          providerName = cloudParts[0];
          
          // Construir la ruta sin el prefijo cloud://proveedor
          cloudPath = '/' + cloudParts.slice(1).join('/');
          
          console.log(`Usando ruta_directorio en formato cloud://, proveedor: ${providerName}, ruta: ${cloudPath}`);
          
          // Obtener información del proveedor por nombre
          const providerResult = await pool.query(
            'SELECT id, nombre, tipo, descripcion, configuracion, credenciales FROM cloud_providers WHERE nombre = $1',
            [providerName]
          );
          
          if (providerResult.rows.length === 0) {
            return res.status(500).json({ 
              message: `Proveedor de nube no encontrado: ${providerName}`,
              error: `No se pudo encontrar el proveedor de nube "${providerName}" en la configuración.`,
              tipo: 'proveedor_no_encontrado',
              nombreProveedor: providerName
            });
          }
          
          provider = providerResult.rows[0];
        } else {
          // Usar los campos estándar de la base de datos
          // Obtener información del proveedor de la nube
          const providerResult = await pool.query(
            'SELECT id, nombre, tipo, descripcion, configuracion, credenciales FROM cloud_providers WHERE id = $1',
            [ejecucion.nube_primaria_id]
          );
          
          if (providerResult.rows.length === 0) {
            return res.status(500).json({ 
              message: 'Proveedor de nube no encontrado',
              error: `No se pudo encontrar el proveedor de nube con ID ${ejecucion.nube_primaria_id} en la configuración.`,
              tipo: 'proveedor_no_encontrado',
              idProveedor: ejecucion.nube_primaria_id
            });
          }
          
          provider = providerResult.rows[0];
          providerName = provider.nombre;
          cloudPath = ejecucion.ruta_nube;
        }
        
        console.log(`Obteniendo archivo desde nube ${provider.nombre} (${provider.tipo})`);
        
        // Crear un directorio temporal para el archivo
        const tempDir = path.join(os.tmpdir(), 'sage-cloud-downloads', uuidv4());
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Variables para la ruta relativa
        let relativePath;
        
        // Verificar que cloudPath existe y añadir / al final si no termina con eso
        if (!cloudPath) {
          console.error('Error: cloudPath es indefinido o nulo');
          return res.status(500).json({
            message: 'Error en la ruta de nube',
            error: 'La ruta de almacenamiento en nube es inválida.',
            details: 'No se pudo determinar la ruta en la nube para esta ejecución.',
            tipo: 'error_ruta_nube',
            nube_primaria_id: ejecucion.nube_primaria_id,
            ruta_nube: ejecucion.ruta_nube
          });
        }
        
        // Asegurar que cloudPath es un string
        cloudPath = String(cloudPath);
        
        // Verificar si la ruta de nube termina con "/" y añadirla si no
        if (!cloudPath.endsWith('/')) {
          cloudPath = cloudPath + '/';
        }
        
        switch (String(tipo)) {
          case 'log':
            relativePath = 'output.log';
            break;
          case 'yaml':
            relativePath = ejecucion.nombre_yaml || 'input.yaml';
            break;
          case 'datos':
            relativePath = ejecucion.archivo_datos || '';
            break;
        }
        
        // Generar ruta temporal local para almacenar el archivo descargado
        const tempFilePath = path.join(tempDir, path.basename(relativePath));
        
        try {
          // Intentar parsear la configuración y credenciales si son strings
          if (typeof provider.configuracion === 'string') {
            provider.configuracion = JSON.parse(provider.configuracion);
          }
          
          if (typeof provider.credenciales === 'string') {
            provider.credenciales = JSON.parse(provider.credenciales);
          }
        } catch (parseError) {
          console.error('Error parseando configuración del proveedor:', parseError);
        }
        
        // Primero obtenemos y normalizamos las credenciales
        // Ya hemos declarado 'credentials' y 'config' arriba, así que usamos esas referencias
        let credentials = provider.credenciales;
        let config = provider.configuracion;
        
        // Asegurarse de que credentials y config sean objetos, no strings
        try {
            if (typeof credentials === 'string') {
                credentials = JSON.parse(credentials);
            }
            if (typeof config === 'string') {
                config = JSON.parse(config);
            }
        } catch (err) {
            console.error('Error parseando credenciales o configuración:', err);
        }
        
        // CORRECCIÓN: Extraer correctamente la ruta del archivo en la nube 
        // La ruta completa está en formato cloud://proveedor/ruta/al/archivo
        // IMPORTANTE: Debemos ignorar el nombre descriptivo del proveedor y usar solo la ruta real
        
        // PROBLEMA IDENTIFICADO: Cuando el archivo está en S3, el URI contiene el nombre descriptivo del 
        // proveedor (ej: "AmazonBackup Executions") en lugar del nombre real del bucket (ej: "sage.vidasoft")
        
        // 1. Extraer el nombre descriptivo del proveedor para depuración
        const uriSinProtocolo = execDir.substring(8); // Quitar 'cloud://'
        const primerSlash = uriSinProtocolo.indexOf('/');
        const nombreDescriptivo = primerSlash !== -1 ? uriSinProtocolo.substring(0, primerSlash) : '';
        
        // 2. Extraer la ruta real después del primer slash
        const rutaReal = primerSlash !== -1 ? uriSinProtocolo.substring(primerSlash + 1) : '';
        
        // 3. IMPORTANTE: Usar el bucket real de las credenciales en lugar del nombre descriptivo
        const bucket = credentials.bucket || ''; // Bucket real desde las credenciales
                
        console.log(`ANÁLISIS DE RUTA CORREGIDO:
          - URI original: ${execDir}
          - Nombre descriptivo (ignorado): ${nombreDescriptivo}
          - Ruta real: ${rutaReal}
          - Bucket real según credenciales: ${bucket}
          - Archivo solicitado: ${relativePath}
        `);
        
        // Construir la ruta remota correctamente usando el bucket real y la ruta
        let remoteFilePath;
        
        // Construcción directa de la ruta usando la parte después del nombre descriptivo
        if (rutaReal.endsWith('/')) {
          remoteFilePath = `${rutaReal}${relativePath}`;
        } else if (rutaReal) {
          remoteFilePath = `${rutaReal}/${relativePath}`;
        } else {
          remoteFilePath = relativePath;
        }
        
        console.log(`RUTA REMOTA CONSTRUIDA: ${remoteFilePath}`);
        
        console.log(`RUTA REMOTA FINAL: ${remoteFilePath}`);
        
        // Descargar el archivo de la nube usando el adaptador adecuado
        console.log(`Descargando ${relativePath} desde ${cloudPath} a ${tempFilePath}`);
        console.log('Tipo de proveedor:', provider.tipo);
        
        // Usamos las credenciales que ya normalizamos arriba
        // No es necesario volver a parsear
        
        // Seleccionar el adaptador según el tipo de proveedor
        const providerTipo = provider.tipo ? provider.tipo.toLowerCase() : '';
        
        try {
          console.log(`Iniciando descarga desde proveedor tipo: ${providerTipo}`);
          console.log(`Ruta remota: ${remoteFilePath}`);
          console.log(`Ruta local: ${tempFilePath}`);
          console.log('Credenciales:', JSON.stringify({...credentials, secret_key: credentials.secret_key ? '***' : undefined}, null, 2));
          
          // Cada adaptador es un objeto exportado por defecto con varias funciones
          if (providerTipo === 's3') {
            // Para el adaptador S3, modificamos el config para incluir la ruta real
            const configWithRealPath = {
              ...config,
              realPath: remoteFilePath // Pasamos la ruta real como parte de la configuración
            };
            await s3Adapter.downloadFile(credentials, configWithRealPath, remoteFilePath, tempFilePath);
          } else if (providerTipo === 'azure') {
            await azureAdapter.downloadFile(credentials, config, remoteFilePath, tempFilePath);
          } else if (providerTipo === 'gcp') {
            await gcpAdapter.downloadFile(credentials, config, remoteFilePath, tempFilePath);
          } else if (providerTipo === 'sftp') {
            await sftpAdapter.downloadFile(credentials, config, remoteFilePath, tempFilePath);
          } else if (providerTipo === 'minio') {
            await minioAdapter.downloadFile(credentials, config, remoteFilePath, tempFilePath);
          } else {
            throw new Error(`Tipo de proveedor no soportado: ${providerTipo}`);
          }
        } catch (downloadError) {
          console.error(`Error descargando archivo desde ${providerTipo}:`, downloadError);
          return res.status(500).json({
            message: `Error descargando archivo desde ${providerTipo}`,
            error: `No se pudo descargar el archivo "${String(tipo)}" desde el proveedor ${provider.nombre}.
\nRuta completa: ${execDir}/${relativePath}
\nBucket: ${credentials.bucket || 'No especificado'}, 
\nRegión: ${credentials.region || config.region || 'No especificado'}
\nRuta en nube: ${remoteFilePath}`,
            detallesTecnicos: downloadError.message,
            tipo: 'error_descarga_archivo',
            proveedor: provider.nombre,
            rutaRemota: remoteFilePath,
            rutaRemotaCompleta: `Bucket: ${credentials.bucket || 'No especificado'}, Región: ${credentials.region || config.region || 'No especificado'}, Archivo: ${remoteFilePath}`,
            rutaLocal: tempFilePath,
            errorOriginal: downloadError.stack || 'No hay stack trace disponible'
          });
        }
        
        if (!fs.existsSync(tempFilePath)) {
          return res.status(404).json({
            message: `No se pudo descargar el archivo ${String(tipo)} desde la nube`,
            error: `El archivo "${String(tipo)}" no se encontró en el almacenamiento en la nube.`,
            details: 'Esto puede deberse a que el archivo fue eliminado o a problemas de conexión con el proveedor de nube.',
            tipo: 'archivo_nube_no_encontrado',
            archivoSolicitado: String(tipo),
            proveedor: provider.nombre,
            rutaRemota: remoteFilePath
          });
        }
        
        // Forzar la descarga para todos los archivos
        res.setHeader('Content-Disposition', `attachment; filename="${String(tipo) === 'log' ? 'output.log' : String(tipo) === 'yaml' ? 'configuracion.yaml' : 'datos.txt'}"`);
        
        // Configurar el tipo MIME según el tipo de archivo
        if (String(tipo) === 'log') {
          res.setHeader('Content-Type', 'text/plain');
        } else if (String(tipo) === 'yaml') {
          res.setHeader('Content-Type', 'text/yaml');
        } else {
          res.setHeader('Content-Type', 'text/plain');
        }
        
        // Usar streaming para todos los tipos de archivos
        const fileStream = fs.createReadStream(tempFilePath);
        fileStream.on('end', () => {
          // Limpiar archivos temporales después de enviarlos
          try {
            fs.unlinkSync(tempFilePath);
            fs.rmdirSync(tempDir, { recursive: true });
          } catch (cleanupError) {
            console.error('Error limpiando archivos temporales:', cleanupError);
          }
        });
        
        fileStream.pipe(res);
      } catch (cloudError) {
        console.error('Error accediendo a archivo en la nube:', cloudError);
        // Ya no necesitamos definir el nombre nuevamente, usamos el que ya declaramos antes
        return res.status(500).json({ 
          message: 'Error al acceder al proveedor de nube', 
          error: 'No se pudo acceder al archivo en el almacenamiento en nube.',
          details: cloudError.message,
          tipo: 'error_acceso_nube',
          proveedor: providerName,
          archivoSolicitado: String(tipo),
          errorTecnico: cloudError.message,
          errorStack: cloudError.stack
        });
      }
    } else {
      // Verificamos si el archivo existe localmente
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message: `Archivo ${String(tipo)} no encontrado`,
          error: `No se encontró el archivo "${String(tipo)}" para esta ejecución.`,
          details: 'El archivo podría haber sido eliminado o nunca existió.',
          tipo: 'archivo_no_encontrado',
          archivoSolicitado: String(tipo),
          rutaArchivo: filePath
        });
      }
      
      // Forzar la descarga para todos los archivos
      res.setHeader('Content-Disposition', `attachment; filename="${String(tipo) === 'log' ? 'output.log' : String(tipo) === 'yaml' ? 'configuracion.yaml' : 'datos.txt'}"`);
      
      // Configurar el tipo MIME según el tipo de archivo
      if (String(tipo) === 'log') {
        res.setHeader('Content-Type', 'text/plain');
      } else if (String(tipo) === 'yaml') {
        res.setHeader('Content-Type', 'text/yaml');
      } else {
        res.setHeader('Content-Type', 'text/plain');
      }
      
      // Usar streaming para todos los tipos de archivos
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
  } catch (error) {
    console.error('Error al obtener archivo de ejecución:', error);
    return res.status(500).json({ 
      message: 'Error al obtener archivo de ejecución',
      error: 'Ocurrió un error al procesar su solicitud. Por favor intente nuevamente más tarde.',
      details: 'Si el problema persiste, contacte al administrador del sistema.',
      tipo: 'error_interno',
      errorTecnico: error.message,
      errorStack: error.stack,
      archivoSolicitado: String(tipo)
    });
  }
}