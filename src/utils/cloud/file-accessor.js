/**
 * Utilidad para acceder a archivos en la nube mediante URIs cloud://
 * 
 * Este módulo proporciona funciones para acceder transparentemente a archivos
 * ya sea que estén almacenados localmente o en proveedores de nube.
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getAdapter } from './index';

const readFileAsync = promisify(fs.readFile);

/**
 * Obtiene un adaptador de acceso a archivos en la nube con métodos adicionales
 * @param {string} providerType - Tipo de proveedor (s3, azure, gcp, sftp, minio)
 * @returns {Object} - Adaptador para el proveedor especificado con interfaz estandarizada
 */
export function getCloudFileAccessor(providerType) {
  try {
    // Verificar que el tipo de proveedor es válido
    if (!providerType || typeof providerType !== 'string') {
      throw new Error('Tipo de proveedor no válido');
    }
    
    // Normalizar tipo de proveedor
    const type = providerType.toLowerCase();
    
    // Obtener el adaptador base
    let adapter;
    
    // Asignar minio a adaptador de s3
    if (type === 'minio') {
      adapter = getAdapter('s3');
    } else {
      adapter = getAdapter(type);
    }
    
    if (!adapter) {
      throw new Error(`Adaptador no encontrado para tipo ${type}`);
    }
    
    // Extender el adaptador con funciones adicionales
    return {
      ...adapter,
      
      /**
       * Descarga un archivo desde la nube a una ubicación local
       * @param {Object} provider - Información del proveedor desde la base de datos
       * @param {string} cloudPath - Ruta base en la nube
       * @param {string} relativePath - Ruta relativa dentro de cloudPath
       * @param {string} localPath - Ruta local donde guardar el archivo
       * @returns {Promise<boolean>} - true si la descarga fue exitosa
       */
      downloadFile: async (provider, cloudPath, relativePath, localPath) => {
        try {
          console.log(`Downloading: ${cloudPath}${relativePath} to ${localPath}`);
          
          // Extraer las credenciales y configuración del proveedor
          let providerConfig = provider.configuracion;
          let providerCredentials = provider.credenciales;
          
          // Asegurarse de que son objetos y no strings
          if (typeof providerConfig === 'string') {
            try {
              providerConfig = JSON.parse(providerConfig);
            } catch (e) {
              console.warn('Error al parsear configuración como JSON, usando como string:', e);
            }
          }
          
          if (typeof providerCredentials === 'string') {
            try {
              providerCredentials = JSON.parse(providerCredentials);
            } catch (e) {
              console.warn('Error al parsear credenciales como JSON, usando como string:', e);
            }
          }
          
          // Verificar que tenemos un adaptador válido
          if (!adapter) {
            throw new Error(`Adaptador no disponible para tipo ${type}`);
          }
          
          // Verificar que el adaptador tiene el método createClient
          if (!adapter.createClient) {
            throw new Error(`El adaptador para ${type} no implementa createClient`);
          }
          
          // Crear cliente para acceder al proveedor
          const client = adapter.createClient(providerCredentials, providerConfig);
          
          // Asegurar que el directorio destino existe
          const localDir = path.dirname(localPath);
          if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
          }
          
          // Combinar cloudPath con relativePath para obtener la ruta completa
          // Asegurarse de que no hay doble barra
          const remotePath = cloudPath.endsWith('/') 
            ? cloudPath + relativePath 
            : `${cloudPath}/${relativePath}`;
          
          console.log(`Ruta remota final: ${remotePath}`);
          
          // Llamar al método de descarga específico del adaptador
          if (adapter.downloadFile) {
            await adapter.downloadFile(client, remotePath, localPath);
          } else {
            // Implementación genérica para adaptadores que no tienen downloadFile específico
            throw new Error(`El adaptador para ${type} no implementa downloadFile`);
          }
          
          return true;
        } catch (error) {
          console.error(`Error descargando archivo desde ${type}:`, error);
          throw new Error(`Error al descargar archivo: ${error.message}`);
        }
      }
    };
  } catch (error) {
    console.error(`Error al obtener adaptador para ${providerType}:`, error);
    return null;
  }
}

/**
 * Analiza una URI de nube en sus componentes
 * 
 * @param {string} uri - URI en formato cloud://proveedor/ruta/al/archivo
 * @returns {Object} - Componentes de la URI {provider, path}
 */
export function parseCloudUri(uri) {
  // Verificar que es una URI cloud://
  if (!uri || typeof uri !== 'string' || !uri.startsWith('cloud://')) {
    return null;
  }

  // Extraer el proveedor y la ruta
  const parts = uri.substring(8).split('/');
  if (parts.length < 1) {
    return null;
  }

  const provider = parts[0];
  const cloudPath = parts.slice(1).join('/');

  return {
    provider,
    path: cloudPath
  };
}

/**
 * Lee el contenido de un archivo, independientemente de su ubicación
 * 
 * @param {string} filePath - Ruta al archivo (local o cloud://)
 * @returns {Promise<Buffer>} - Contenido del archivo como Buffer
 */
export async function readFile(filePath) {
  try {
    // Verificar si es una ruta en la nube
    if (filePath.startsWith('cloud://')) {
      return await readCloudFile(filePath);
    }

    // Archivo local
    return await readFileAsync(filePath);
  } catch (error) {
    console.error(`Error leyendo archivo ${filePath}:`, error);
    throw new Error(`No se pudo leer el archivo: ${error.message}`);
  }
}

/**
 * Lee el contenido de un archivo en la nube
 * 
 * @param {string} cloudUri - URI en formato cloud://proveedor/ruta/al/archivo
 * @returns {Promise<Buffer>} - Contenido del archivo como Buffer
 */
async function readCloudFile(cloudUri) {
  const parsedUri = parseCloudUri(cloudUri);
  
  if (!parsedUri) {
    throw new Error(`URI de nube inválida: ${cloudUri}`);
  }

  // Obtener el archivo a través de la API usando fetch en lugar de axios
  const response = await fetch(`/api/cloud-files/content?path=${encodeURIComponent(cloudUri)}`);
  
  if (!response.ok) {
    throw new Error(`Error al obtener el archivo: ${response.status} ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Lee el contenido de un archivo como texto
 * 
 * @param {string} filePath - Ruta al archivo (local o cloud://)
 * @param {string} encoding - Codificación del archivo (por defecto 'utf-8')
 * @returns {Promise<string>} - Contenido del archivo como texto
 */
export async function readFileAsText(filePath, encoding = 'utf-8') {
  const buffer = await readFile(filePath);
  return buffer.toString(encoding);
}

/**
 * Verifica si un archivo existe
 * 
 * @param {string} filePath - Ruta al archivo (local o cloud://)
 * @returns {Promise<boolean>} - true si el archivo existe, false en caso contrario
 */
export async function fileExists(filePath) {
  try {
    if (filePath.startsWith('cloud://')) {
      // Verificar existencia a través de la API usando fetch en lugar de axios
      const response = await fetch(`/api/cloud-files/exists?path=${encodeURIComponent(filePath)}`);
      return response.ok;
    } else {
      // Archivo local
      return fs.existsSync(filePath);
    }
  } catch (error) {
    return false;
  }
}

/**
 * Lista los archivos en un directorio
 * 
 * @param {string} dirPath - Ruta al directorio (local o cloud://)
 * @returns {Promise<Array<Object>>} - Lista de archivos y directorios
 */
export async function listFiles(dirPath) {
  try {
    if (dirPath.startsWith('cloud://')) {
      // Listar a través de la API usando fetch en lugar de axios
      const response = await fetch(`/api/cloud-files/list?path=${encodeURIComponent(dirPath)}`);
      
      if (!response.ok) {
        throw new Error(`Error al listar archivos: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } else {
      // Directorio local
      const files = fs.readdirSync(dirPath);
      return files.map(file => {
        const fullPath = path.join(dirPath, file);
        const stats = fs.statSync(fullPath);
        return {
          name: file,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        };
      });
    }
  } catch (error) {
    console.error(`Error listando archivos en ${dirPath}:`, error);
    throw new Error(`No se pudo listar archivos: ${error.message}`);
  }
}