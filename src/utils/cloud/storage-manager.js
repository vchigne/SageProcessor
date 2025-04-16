/**
 * Cloud Storage Manager
 * 
 * Punto central para interactuar con proveedores de almacenamiento en la nube.
 * Este módulo proporciona una interfaz unificada para operaciones comunes
 * como listar archivos, descargar, subir, borrar, etc. independientemente
 * del proveedor subyacente (AWS S3, Azure Blob, GCP, SFTP, MinIO).
 */

import { getAdapter } from './index';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Convertir funciones callback de fs a Promesas
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

/**
 * Cliente unificado para almacenamiento en la nube
 */
class CloudStorageManager {
  /**
   * Crea una instancia de CloudStorageManager
   * @param {Object|string} provider - Objeto proveedor de DB o tipo de proveedor
   * @param {Object} credentials - Credenciales si se proporciona tipo en lugar de objeto DB
   * @param {Object} config - Configuración si se proporciona tipo en lugar de objeto DB
   */
  constructor(provider, credentials = null, config = null) {
    if (typeof provider === 'string') {
      // Inicialización con tipo, credenciales y config
      this.providerType = provider.toLowerCase();
      this.credentials = credentials;
      this.config = config;
      this.provider = { 
        nombre: 'Custom provider',
        tipo: this.providerType,
        credenciales: this.credentials,
        configuracion: this.config
      };
    } else {
      // Inicialización con objeto proveedor desde DB
      this.provider = provider;
      this.providerType = provider.tipo.toLowerCase();
      
      // Extraer credenciales y configuración
      let providerCredentials = provider.credenciales;
      let providerConfig = provider.configuracion;
      
      // Asegurarse de que son objetos y no strings
      if (typeof providerCredentials === 'string') {
        try {
          providerCredentials = JSON.parse(providerCredentials);
        } catch (e) {
          console.warn('Error al parsear credenciales como JSON, usando como string');
        }
      }
      
      if (typeof providerConfig === 'string') {
        try {
          providerConfig = JSON.parse(providerConfig);
        } catch (e) {
          console.warn('Error al parsear configuración como JSON, usando como string');
        }
      }
      
      this.credentials = providerCredentials;
      this.config = providerConfig;
    }
    
    // Inicializar el adaptador correspondiente
    this._initAdapter();
  }
  
  /**
   * Inicializa el adaptador para el proveedor
   * @private
   */
  _initAdapter() {
    try {
      // Especial para MinIO
      if (this.providerType === 'minio') {
        this.adapter = getAdapter('s3');
      } else {
        this.adapter = getAdapter(this.providerType);
      }
      
      if (!this.adapter) {
        throw new Error(`Adaptador no encontrado para tipo ${this.providerType}`);
      }
      
      // Crear cliente una vez para reutilizar
      this.client = this.adapter.createClient(this.credentials, this.config);
    } catch (error) {
      console.error(`Error inicializando adaptador para ${this.providerType}:`, error);
      throw new Error(`No se pudo inicializar el adaptador de nube: ${error.message}`);
    }
  }

  /**
   * Prueba la conexión al proveedor de nube
   * @returns {Promise<Object>} Resultado de la prueba
   */
  async testConnection() {
    try {
      if (!this.adapter || !this.adapter.testConnection) {
        throw new Error(`El adaptador para ${this.providerType} no implementa testConnection`);
      }
      
      return await this.adapter.testConnection(this.credentials, this.config);
    } catch (error) {
      console.error(`Error probando conexión a ${this.providerType}:`, error);
      return {
        success: false,
        message: error.message || 'Error desconocido al probar la conexión'
      };
    }
  }
  
  /**
   * Lista archivos y directorios en una ruta
   * @param {string} remotePath - Ruta remota para listar contenidos
   * @returns {Promise<Object>} Objeto con arrays de folders y files
   */
  async listContents(remotePath = '') {
    try {
      if (!this.adapter || !this.adapter.listContents) {
        throw new Error(`El adaptador para ${this.providerType} no implementa listContents`);
      }
      
      return await this.adapter.listContents(this.credentials, this.config, remotePath);
    } catch (error) {
      console.error(`Error listando contenidos en ${this.providerType}:`, error);
      throw new Error(`Error al listar archivos: ${error.message}`);
    }
  }
  
  /**
   * Descarga un archivo desde la nube a una ubicación local
   * @param {string} remotePath - Ruta del archivo en la nube
   * @param {string} localPath - Ruta local donde guardar el archivo
   * @returns {Promise<Object>} Información sobre la descarga
   */
  async downloadFile(remotePath, localPath) {
    try {
      if (!this.adapter || !this.adapter.downloadFile) {
        throw new Error(`El adaptador para ${this.providerType} no implementa downloadFile`);
      }
      
      // Asegurar que el directorio local existe
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        await mkdirAsync(localDir, { recursive: true });
      }
      
      return await this.adapter.downloadFile(this.client, remotePath, localPath);
    } catch (error) {
      console.error(`Error descargando archivo desde ${this.providerType}:`, error);
      throw new Error(`Error al descargar archivo: ${error.message}`);
    }
  }
  
  /**
   * Sube un archivo a la nube
   * @param {string} localPath - Ruta local del archivo
   * @param {string} remotePath - Ruta destino en la nube
   * @returns {Promise<Object>} Información sobre la subida
   */
  async uploadFile(localPath, remotePath) {
    try {
      if (!this.adapter || !this.adapter.uploadFile) {
        throw new Error(`El adaptador para ${this.providerType} no implementa uploadFile`);
      }
      
      // Verificar que el archivo local existe
      if (!fs.existsSync(localPath)) {
        throw new Error(`El archivo local no existe: ${localPath}`);
      }
      
      return await this.adapter.uploadFile(this.client, localPath, remotePath);
    } catch (error) {
      console.error(`Error subiendo archivo a ${this.providerType}:`, error);
      throw new Error(`Error al subir archivo: ${error.message}`);
    }
  }
  
  /**
   * Elimina un archivo de la nube
   * @param {string} remotePath - Ruta del archivo a eliminar
   * @returns {Promise<Object>} Resultado de la operación
   */
  async deleteFile(remotePath) {
    try {
      if (!this.adapter || !this.adapter.deleteFile) {
        throw new Error(`El adaptador para ${this.providerType} no implementa deleteFile`);
      }
      
      return await this.adapter.deleteFile(this.client, remotePath);
    } catch (error) {
      console.error(`Error eliminando archivo de ${this.providerType}:`, error);
      throw new Error(`Error al eliminar archivo: ${error.message}`);
    }
  }
  
  /**
   * Verifica si un archivo existe en la nube
   * @param {string} remotePath - Ruta del archivo a verificar
   * @returns {Promise<boolean>} true si existe, false en caso contrario
   */
  async fileExists(remotePath) {
    try {
      if (!this.adapter || !this.adapter.fileExists) {
        // Si no hay implementación específica, intentamos listar el directorio
        // y buscar el archivo
        const directory = path.dirname(remotePath);
        const fileName = path.basename(remotePath);
        
        const contents = await this.listContents(directory);
        return contents.files.some(file => file.name === fileName);
      }
      
      return await this.adapter.fileExists(this.client, remotePath);
    } catch (error) {
      console.error(`Error verificando existencia de archivo en ${this.providerType}:`, error);
      return false;
    }
  }
  
  /**
   * Obtiene el contenido de un archivo como buffer
   * @param {string} remotePath - Ruta del archivo en la nube
   * @returns {Promise<Buffer>} Contenido del archivo
   */
  async readFile(remotePath) {
    try {
      // Descargar a un archivo temporal y leerlo
      const tempDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tempDir)) {
        await mkdirAsync(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, `temp_${Date.now()}_${path.basename(remotePath)}`);
      
      await this.downloadFile(remotePath, tempFile);
      const content = await readFileAsync(tempFile);
      
      // Limpiar archivo temporal
      try {
        await unlinkAsync(tempFile);
      } catch (e) {
        console.warn(`No se pudo eliminar archivo temporal ${tempFile}`, e);
      }
      
      return content;
    } catch (error) {
      console.error(`Error leyendo archivo de ${this.providerType}:`, error);
      throw new Error(`Error al leer archivo: ${error.message}`);
    }
  }
  
  /**
   * Escribe contenido a un archivo en la nube
   * @param {string} remotePath - Ruta del archivo en la nube
   * @param {Buffer|string} content - Contenido a escribir
   * @returns {Promise<Object>} Resultado de la operación
   */
  async writeFile(remotePath, content) {
    try {
      // Escribir a un archivo temporal y subirlo
      const tempDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tempDir)) {
        await mkdirAsync(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, `temp_${Date.now()}_${path.basename(remotePath)}`);
      
      await writeFileAsync(tempFile, content);
      const result = await this.uploadFile(tempFile, remotePath);
      
      // Limpiar archivo temporal
      try {
        await unlinkAsync(tempFile);
      } catch (e) {
        console.warn(`No se pudo eliminar archivo temporal ${tempFile}`, e);
      }
      
      return result;
    } catch (error) {
      console.error(`Error escribiendo archivo en ${this.providerType}:`, error);
      throw new Error(`Error al escribir archivo: ${error.message}`);
    }
  }
  
  /**
   * Migra un directorio completo al almacenamiento en nube
   * @param {string} localDirectory - Directorio local a migrar
   * @param {string} remoteBasePath - Ruta base remota donde subir los archivos
   * @returns {Promise<Object>} Resultado con archivos migrados y errores
   */
  async migrateDirectory(localDirectory, remoteBasePath) {
    try {
      const results = {
        success: true,
        filesUploaded: 0,
        errors: [],
        details: []
      };
      
      // Verificar que el directorio local existe
      if (!fs.existsSync(localDirectory)) {
        throw new Error(`El directorio local no existe: ${localDirectory}`);
      }
      
      // Función recursiva para procesar directorios
      const processDirectory = async (dir, remotePath) => {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const localPath = path.join(dir, file);
          const stat = fs.statSync(localPath);
          
          if (stat.isDirectory()) {
            // Procesar subdirectorio recursivamente
            await processDirectory(localPath, path.join(remotePath, file));
          } else {
            // Subir archivo
            try {
              const cloudPath = path.join(remotePath, file).replace(/\\/g, '/');
              const uploadResult = await this.uploadFile(localPath, cloudPath);
              
              results.filesUploaded++;
              results.details.push({
                file: localPath,
                cloudPath,
                success: true
              });
            } catch (error) {
              results.success = false;
              results.errors.push(error.message);
              results.details.push({
                file: localPath,
                cloudPath: path.join(remotePath, file).replace(/\\/g, '/'),
                success: false,
                error: error.message
              });
            }
          }
        }
      };
      
      // Iniciar procesamiento
      await processDirectory(localDirectory, remoteBasePath);
      return results;
    } catch (error) {
      console.error(`Error migrando directorio a ${this.providerType}:`, error);
      return {
        success: false,
        filesUploaded: 0,
        errors: [error.message],
        details: []
      };
    }
  }
}

/**
 * Obtiene una instancia del gestor de almacenamiento para un proveedor
 * @param {Object} provider - Información del proveedor desde la base de datos
 * @returns {CloudStorageManager} Instancia del gestor
 */
export function getStorageManager(provider) {
  return new CloudStorageManager(provider);
}

/**
 * Crea una instancia personalizada del gestor de almacenamiento
 * @param {string} providerType - Tipo de proveedor (s3, azure, gcp, sftp, minio)
 * @param {Object} credentials - Credenciales para el proveedor
 * @param {Object} config - Configuración para el proveedor
 * @returns {CloudStorageManager} Instancia del gestor
 */
export function createStorageManager(providerType, credentials, config) {
  return new CloudStorageManager(providerType, credentials, config);
}

/**
 * Analiza una URI de nube en sus componentes
 * @param {string} uri - URI en formato cloud://proveedor/ruta/al/archivo
 * @returns {Object|null} - Componentes de la URI {provider, path} o null si inválida
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

export default {
  getStorageManager,
  createStorageManager,
  parseCloudUri
};