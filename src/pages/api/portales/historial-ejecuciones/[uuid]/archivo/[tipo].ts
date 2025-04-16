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
        contentType = 'text/html';
        fileName = `ejecucion_${uuid}_log.html`;
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

    // Configuramos la respuesta para servir el archivo
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
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
        
        // Ruta completa al archivo en la nube
        const remoteFilePath = cloudPath + relativePath;
        
        // Descargar el archivo de la nube usando el adaptador adecuado
        console.log(`Descargando ${relativePath} desde ${cloudPath} a ${tempFilePath}`);
        console.log('Tipo de proveedor:', provider.tipo);
        
        // Seleccionar el adaptador según el tipo de proveedor
        const tipo = provider.tipo.toLowerCase();
        
        try {
          if (tipo === 's3') {
            await s3Adapter.downloadFile(provider.credenciales, provider.configuracion, remoteFilePath, tempFilePath);
          } else if (tipo === 'azure') {
            await azureAdapter.downloadFile(provider.credenciales, provider.configuracion, remoteFilePath, tempFilePath);
          } else if (tipo === 'gcp') {
            await gcpAdapter.downloadFile(provider.credenciales, provider.configuracion, remoteFilePath, tempFilePath);
          } else if (tipo === 'sftp') {
            await sftpAdapter.downloadFile(provider.credenciales, provider.configuracion, remoteFilePath, tempFilePath);
          } else if (tipo === 'minio') {
            await minioAdapter.downloadFile(provider.credenciales, provider.configuracion, remoteFilePath, tempFilePath);
          } else {
            throw new Error(`Tipo de proveedor no soportado: ${tipo}`);
          }
        } catch (downloadError) {
          console.error(`Error descargando archivo desde ${tipo}:`, downloadError);
          return res.status(500).json({
            message: `Error descargando archivo desde ${tipo}`,
            error: `No se pudo descargar el archivo "${tipo}" desde el proveedor ${provider.nombre}.`,
            detallesTecnicos: downloadError.message,
            tipo: 'error_descarga_archivo',
            proveedor: provider.nombre,
            rutaRemota: remoteFilePath,
            rutaLocal: tempFilePath
          });
        }
        
        if (!fs.existsSync(tempFilePath)) {
          return res.status(404).json({
            message: `No se pudo descargar el archivo ${tipo} desde la nube`,
            error: `El archivo "${tipo}" no se encontró en el almacenamiento en la nube.`,
            details: 'Esto puede deberse a que el archivo fue eliminado o a problemas de conexión con el proveedor de nube.',
            tipo: 'archivo_nube_no_encontrado',
            archivoSolicitado: tipo,
            proveedor: provider.nombre
          });
        }
        
        // Enviar el archivo y configurar limpieza al finalizar
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
          archivoSolicitado: tipo,
          errorTecnico: cloudError.message
        });
      }
    } else {
      // Verificamos si el archivo existe localmente
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          message: `Archivo ${tipo} no encontrado`,
          error: `No se encontró el archivo "${tipo}" para esta ejecución.`,
          details: 'El archivo podría haber sido eliminado o nunca existió.',
          tipo: 'archivo_no_encontrado',
          archivoSolicitado: tipo,
          rutaArchivo: filePath
        });
      }
      
      // Leemos y enviamos el archivo local
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
      errorTecnico: error.message
    });
  }
}