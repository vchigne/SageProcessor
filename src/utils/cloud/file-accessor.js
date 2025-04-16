/**
 * Utilidad para acceder a archivos en la nube mediante URIs cloud://
 * 
 * Este módulo proporciona funciones para acceder transparentemente a archivos
 * ya sea que estén almacenados localmente o en proveedores de nube.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getAdapter } from './index';

const readFileAsync = promisify(fs.readFile);

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

  // Obtener el archivo a través de la API
  const { data } = await axios.get('/api/cloud-files/content', {
    params: {
      path: cloudUri
    },
    responseType: 'arraybuffer'
  });

  return Buffer.from(data);
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
      // Verificar existencia a través de la API
      await axios.get('/api/cloud-files/exists', {
        params: { path: filePath }
      });
      return true;
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
      // Listar a través de la API
      const { data } = await axios.get('/api/cloud-files/list', {
        params: { path: dirPath }
      });
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