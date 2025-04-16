/**
 * Módulo principal para acceso a almacenamiento en la nube
 *
 * Este módulo proporciona una interfaz de alto nivel para operaciones
 * de almacenamiento en la nube, utilizando diferentes proveedores (S3, Azure, GCP, SFTP, MinIO)
 * de manera transparente y unificada.
 */

import { getStorageManager, parseCloudUri } from '@/utils/cloud/storage-manager';
import { getProviderById, getDefaultProviderByType } from '@/utils/db/cloud-providers';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

// Convertir funciones de fs a promesas
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);
const unlinkAsync = promisify(fs.unlink);

/**
 * Comprueba si una ruta es una URI de cloud
 * @param {string} path - Ruta a comprobar
 * @returns {boolean} - true si es una URI de cloud
 */
export function isCloudPath(path) {
  return path && typeof path === 'string' && path.startsWith('cloud://');
}

/**
 * Lee un archivo, ya sea local o en la nube
 * @param {string} filePath - Ruta del archivo (local o cloud://)
 * @returns {Promise<Buffer>} - Contenido del archivo como Buffer
 */
export async function readFile(filePath) {
  if (isCloudPath(filePath)) {
    return await readCloudFile(filePath);
  } else {
    return await readFileAsync(filePath);
  }
}

/**
 * Lee un archivo como texto, ya sea local o en la nube
 * @param {string} filePath - Ruta del archivo (local o cloud://)
 * @param {string} encoding - Codificación del archivo (por defecto 'utf-8')
 * @returns {Promise<string>} - Contenido del archivo como texto
 */
export async function readFileAsText(filePath, encoding = 'utf-8') {
  const buffer = await readFile(filePath);
  return buffer.toString(encoding);
}

/**
 * Lee un archivo desde la nube
 * @param {string} cloudUri - URI de cloud (cloud://proveedor/ruta)
 * @returns {Promise<Buffer>} - Contenido del archivo como Buffer
 */
async function readCloudFile(cloudUri) {
  const parsed = parseCloudUri(cloudUri);
  if (!parsed) {
    throw new Error(`URI de nube inválida: ${cloudUri}`);
  }
  
  // Obtener el proveedor de nube predeterminado para este tipo
  const provider = await getDefaultProviderByType(parsed.provider);
  if (!provider) {
    throw new Error(`No hay un proveedor predeterminado configurado para ${parsed.provider}`);
  }
  
  // Crear gestor de almacenamiento
  const storageManager = getStorageManager(provider);
  
  // Descargar a un archivo temporal y leerlo
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    await mkdirAsync(tempDir, { recursive: true });
  }
  
  const tempFile = path.join(tempDir, `temp_${Date.now()}_${path.basename(parsed.path)}`);
  
  try {
    await storageManager.downloadFile(parsed.path, tempFile);
    const content = await readFileAsync(tempFile);
    
    // Limpiar archivo temporal
    try {
      await unlinkAsync(tempFile);
    } catch (e) {
      console.warn(`No se pudo eliminar archivo temporal ${tempFile}`, e);
    }
    
    return content;
  } catch (error) {
    console.error(`Error leyendo archivo de la nube ${cloudUri}:`, error);
    throw new Error(`Error leyendo archivo de la nube: ${error.message}`);
  }
}

/**
 * Escribe un archivo, ya sea local o en la nube
 * @param {string} filePath - Ruta del archivo (local o cloud://)
 * @param {Buffer|string} content - Contenido a escribir
 * @returns {Promise<void>}
 */
export async function writeFile(filePath, content) {
  if (isCloudPath(filePath)) {
    await writeCloudFile(filePath, content);
  } else {
    // Asegurar que el directorio existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await mkdirAsync(dir, { recursive: true });
    }
    
    await writeFileAsync(filePath, content);
  }
}

/**
 * Escribe un archivo en la nube
 * @param {string} cloudUri - URI de cloud (cloud://proveedor/ruta)
 * @param {Buffer|string} content - Contenido a escribir
 * @returns {Promise<void>}
 */
async function writeCloudFile(cloudUri, content) {
  const parsed = parseCloudUri(cloudUri);
  if (!parsed) {
    throw new Error(`URI de nube inválida: ${cloudUri}`);
  }
  
  // Obtener el proveedor de nube predeterminado para este tipo
  const provider = await getDefaultProviderByType(parsed.provider);
  if (!provider) {
    throw new Error(`No hay un proveedor predeterminado configurado para ${parsed.provider}`);
  }
  
  // Crear gestor de almacenamiento
  const storageManager = getStorageManager(provider);
  
  // Escribir a un archivo temporal y subirlo
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) {
    await mkdirAsync(tempDir, { recursive: true });
  }
  
  const tempFile = path.join(tempDir, `temp_${Date.now()}_${path.basename(parsed.path)}`);
  
  try {
    await writeFileAsync(tempFile, content);
    await storageManager.uploadFile(tempFile, parsed.path);
    
    // Limpiar archivo temporal
    try {
      await unlinkAsync(tempFile);
    } catch (e) {
      console.warn(`No se pudo eliminar archivo temporal ${tempFile}`, e);
    }
  } catch (error) {
    console.error(`Error escribiendo archivo en la nube ${cloudUri}:`, error);
    throw new Error(`Error escribiendo archivo en la nube: ${error.message}`);
  }
}

/**
 * Verifica si un archivo existe, ya sea local o en la nube
 * @param {string} filePath - Ruta del archivo (local o cloud://)
 * @returns {Promise<boolean>} - true si el archivo existe
 */
export async function fileExists(filePath) {
  try {
    if (isCloudPath(filePath)) {
      return await cloudFileExists(filePath);
    } else {
      return await existsAsync(filePath);
    }
  } catch (error) {
    console.error(`Error verificando existencia de ${filePath}:`, error);
    return false;
  }
}

/**
 * Verifica si un archivo existe en la nube
 * @param {string} cloudUri - URI de cloud (cloud://proveedor/ruta)
 * @returns {Promise<boolean>} - true si el archivo existe
 */
async function cloudFileExists(cloudUri) {
  try {
    const parsed = parseCloudUri(cloudUri);
    if (!parsed) {
      return false;
    }
    
    // Obtener el proveedor de nube predeterminado para este tipo
    const provider = await getDefaultProviderByType(parsed.provider);
    if (!provider) {
      return false;
    }
    
    // Crear gestor de almacenamiento
    const storageManager = getStorageManager(provider);
    
    return await storageManager.fileExists(parsed.path);
  } catch (error) {
    console.error(`Error verificando existencia en la nube ${cloudUri}:`, error);
    return false;
  }
}

/**
 * Lista archivos en un directorio, ya sea local o en la nube
 * @param {string} dirPath - Ruta del directorio (local o cloud://)
 * @returns {Promise<Array<Object>>} - Lista de archivos y directorios
 */
export async function listFiles(dirPath) {
  if (isCloudPath(dirPath)) {
    return await listCloudFiles(dirPath);
  } else {
    const entries = fs.readdirSync(dirPath);
    return entries.map(entry => {
      const fullPath = path.join(dirPath, entry);
      const stats = fs.statSync(fullPath);
      
      return {
        name: entry,
        path: fullPath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      };
    });
  }
}

/**
 * Lista archivos en un directorio en la nube
 * @param {string} cloudUri - URI de cloud (cloud://proveedor/ruta)
 * @returns {Promise<Array<Object>>} - Lista de archivos y directorios
 */
async function listCloudFiles(cloudUri) {
  const parsed = parseCloudUri(cloudUri);
  if (!parsed) {
    throw new Error(`URI de nube inválida: ${cloudUri}`);
  }
  
  // Obtener el proveedor de nube predeterminado para este tipo
  const provider = await getDefaultProviderByType(parsed.provider);
  if (!provider) {
    throw new Error(`No hay un proveedor predeterminado configurado para ${parsed.provider}`);
  }
  
  // Crear gestor de almacenamiento
  const storageManager = getStorageManager(provider);
  
  try {
    const result = await storageManager.listContents(parsed.path);
    
    // Formatear resultado para que sea consistente con el formato local
    const allEntries = [
      ...result.folders.map(folder => ({
        name: folder.name,
        path: `cloud://${parsed.provider}/${path.join(parsed.path, folder.name).replace(/\\/g, '/')}`,
        isDirectory: true,
        size: 0,
        modified: folder.modified || new Date()
      })),
      ...result.files.map(file => ({
        name: file.name,
        path: `cloud://${parsed.provider}/${path.join(parsed.path, file.name).replace(/\\/g, '/')}`,
        isDirectory: false,
        size: file.size || 0,
        modified: file.modified || new Date()
      }))
    ];
    
    return allEntries;
  } catch (error) {
    console.error(`Error listando archivos en la nube ${cloudUri}:`, error);
    throw new Error(`Error listando archivos en la nube: ${error.message}`);
  }
}

/**
 * Copia un archivo a un destino, ambos pueden ser locales o en la nube
 * @param {string} sourcePath - Ruta origen (local o cloud://)
 * @param {string} destinationPath - Ruta destino (local o cloud://)
 * @returns {Promise<void>}
 */
export async function copyFile(sourcePath, destinationPath) {
  // Leer el archivo origen
  const content = await readFile(sourcePath);
  
  // Escribir al destino
  await writeFile(destinationPath, content);
}

/**
 * Elimina un archivo, ya sea local o en la nube
 * @param {string} filePath - Ruta del archivo (local o cloud://)
 * @returns {Promise<boolean>} - true si se eliminó correctamente
 */
export async function deleteFile(filePath) {
  try {
    if (isCloudPath(filePath)) {
      return await deleteCloudFile(filePath);
    } else {
      await unlinkAsync(filePath);
      return true;
    }
  } catch (error) {
    console.error(`Error eliminando archivo ${filePath}:`, error);
    return false;
  }
}

/**
 * Elimina un archivo en la nube
 * @param {string} cloudUri - URI de cloud (cloud://proveedor/ruta)
 * @returns {Promise<boolean>} - true si se eliminó correctamente
 */
async function deleteCloudFile(cloudUri) {
  const parsed = parseCloudUri(cloudUri);
  if (!parsed) {
    throw new Error(`URI de nube inválida: ${cloudUri}`);
  }
  
  // Obtener el proveedor de nube predeterminado para este tipo
  const provider = await getDefaultProviderByType(parsed.provider);
  if (!provider) {
    throw new Error(`No hay un proveedor predeterminado configurado para ${parsed.provider}`);
  }
  
  // Crear gestor de almacenamiento
  const storageManager = getStorageManager(provider);
  
  try {
    await storageManager.deleteFile(parsed.path);
    return true;
  } catch (error) {
    console.error(`Error eliminando archivo en la nube ${cloudUri}:`, error);
    return false;
  }
}

/**
 * Migra un directorio local a la nube
 * @param {string} localDirectory - Directorio local a migrar
 * @param {string} cloudType - Tipo de nube (s3, azure, gcp, sftp, minio)
 * @param {string} cloudBasePath - Ruta base en la nube donde migrar
 * @returns {Promise<Object>} - Resultado de la migración
 */
export async function migrateToCloud(localDirectory, cloudType, cloudBasePath) {
  // Verificar que el directorio existe
  if (!fs.existsSync(localDirectory)) {
    throw new Error(`El directorio local no existe: ${localDirectory}`);
  }
  
  // Obtener el proveedor predeterminado para el tipo de nube
  const provider = await getDefaultProviderByType(cloudType);
  if (!provider) {
    throw new Error(`No hay un proveedor predeterminado configurado para ${cloudType}`);
  }
  
  // Crear gestor de almacenamiento
  const storageManager = getStorageManager(provider);
  
  // Realizar la migración
  const result = await storageManager.migrateDirectory(localDirectory, cloudBasePath);
  
  return {
    success: result.success,
    filesUploaded: result.filesUploaded,
    errors: result.errors,
    cloudUri: `cloud://${cloudType}/${cloudBasePath}`
  };
}

/**
 * Construye una URI de nube para una ruta específica
 * @param {string} cloudType - Tipo de nube (s3, azure, gcp, sftp, minio)
 * @param {string} path - Ruta en la nube
 * @returns {string} - URI completa (cloud://tipo/ruta)
 */
export function buildCloudUri(cloudType, path) {
  // Normalizar la ruta eliminando barras iniciales
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `cloud://${cloudType}/${normalizedPath}`;
}

/**
 * Obtiene información sobre un proveedor de nube por ID
 * @param {number} providerId - ID del proveedor
 * @returns {Promise<Object>} - Información del proveedor
 */
export async function getCloudProvider(providerId) {
  return await getProviderById(providerId);
}

/**
 * Prueba la conexión a un proveedor de nube por ID
 * @param {number} providerId - ID del proveedor
 * @returns {Promise<Object>} - Resultado de la prueba
 */
export async function testCloudConnection(providerId) {
  const provider = await getProviderById(providerId);
  if (!provider) {
    throw new Error(`Proveedor con ID ${providerId} no encontrado`);
  }
  
  const storageManager = getStorageManager(provider);
  return await storageManager.testConnection();
}