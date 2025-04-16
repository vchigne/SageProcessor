/**
 * Módulo central para la gestión de almacenamiento en la nube
 * 
 * Este módulo proporciona una interfaz unificada para trabajar con
 * diferentes proveedores de almacenamiento en la nube, permitiendo
 * operaciones como subir, descargar y listar archivos de manera
 * transparente, sin importar dónde se almacenen los datos.
 */

import { pool } from '../../lib/db';

/**
 * Adaptadores para los diferentes tipos de proveedores de nube
 * 
 * Cada adaptador implementa una interfaz común para operaciones básicas
 * como listar archivos, subir, descargar, etc.
 */
const adapters = {
  s3: null, // Se cargan dinámicamente para evitar problemas con SSR
  azure: null,
  gcp: null,
  sftp: null,
  minio: null
};

/**
 * Carga dinámica de los adaptadores según se necesiten
 * @param {string} type Tipo de adaptador a cargar
 * @returns {Promise<Object>} Adaptador cargado
 */
async function loadAdapter(type) {
  if (adapters[type]) return adapters[type];
  
  try {
    // Para S3, usar la versión corregida del adaptador
    if (type === 's3') {
      const module = await import(`./adapters/s3_fixed`);
      adapters[type] = module.default;
      return adapters[type];
    }
    
    const module = await import(`./adapters/${type}`);
    adapters[type] = module.default;
    return adapters[type];
  } catch (error) {
    console.error(`Error al cargar el adaptador para ${type}:`, error);
    throw new Error(`Adaptador no disponible para ${type}`);
  }
}

/**
 * Obtiene el adaptador para un tipo de proveedor específico (versión síncrona)
 * @param {string} type Tipo de proveedor (s3, azure, etc.)
 * @returns {Object} Adaptador para el tipo de proveedor
 */
export function getAdapter(type) {
  // Solo usar esta función del lado del servidor
  if (typeof window !== 'undefined') {
    throw new Error('Esta función solo puede usarse en el servidor');
  }
  
  try {
    // Carga síncrona de adaptadores
    if (!adapters[type]) {
      if (type === 's3') {
        adapters[type] = require(`./adapters/s3_fixed`).default;
      } else if (type === 'minio') {
        // MinIO usa el mismo adaptador que S3
        adapters[type] = require(`./adapters/s3_fixed`).default;
      } else {
        adapters[type] = require(`./adapters/${type}`).default;
      }
    }
    
    return adapters[type];
  } catch (error) {
    console.error(`Error al obtener adaptador para ${type}:`, error);
    throw new Error(`Adaptador no disponible para ${type}`);
  }
}

/**
 * Obtiene un proveedor de nube por su ID
 * @param {number} id ID del proveedor
 * @returns {Promise<Object>} Información del proveedor
 */
export async function getCloudProvider(id) {
  try {
    const result = await pool.query(
      'SELECT * FROM cloud_providers WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`No se encontró proveedor con ID ${id}`);
    }
    
    const provider = result.rows[0];
    
    // Parsear JSON si es necesario
    if (typeof provider.credenciales === 'string') {
      provider.credenciales = JSON.parse(provider.credenciales);
    }
    
    if (typeof provider.configuracion === 'string') {
      provider.configuracion = JSON.parse(provider.configuracion);
    }
    
    return provider;
  } catch (error) {
    console.error(`Error al obtener proveedor de nube ${id}:`, error);
    throw error;
  }
}

/**
 * Obtiene todos los proveedores de nube activos
 * @returns {Promise<Array<Object>>} Lista de proveedores activos
 */
export async function getActiveCloudProviders() {
  try {
    const result = await pool.query(
      'SELECT id, nombre, tipo, estado FROM cloud_providers WHERE activo = true'
    );
    return result.rows;
  } catch (error) {
    console.error('Error al obtener proveedores de nube activos:', error);
    throw error;
  }
}

/**
 * Crea un cliente para un proveedor de nube específico
 * @param {number} providerId ID del proveedor
 * @returns {Promise<Object>} Cliente configurado para el proveedor
 */
export async function createCloudClient(providerId) {
  try {
    const provider = await getCloudProvider(providerId);
    const adapter = await loadAdapter(provider.tipo);
    return adapter.createClient(provider.credenciales, provider.configuracion);
  } catch (error) {
    console.error(`Error al crear cliente para proveedor ${providerId}:`, error);
    throw error;
  }
}

/**
 * Obtiene el adaptador para un tipo de proveedor específico
 * @param {string} type Tipo de proveedor (s3, azure, etc.)
 * @param {Object} config Configuración combinada (credenciales + configuración)
 * @returns {Object} Adaptador para el tipo de proveedor
 */
export async function getCloudAdapter(type, config = {}) {
  try {
    const adapter = await loadAdapter(type);
    return adapter;
  } catch (error) {
    console.error(`Error al obtener adaptador para ${type}:`, error);
    throw error;
  }
}

/**
 * Sube un archivo a un proveedor de nube
 * @param {number} providerId ID del proveedor
 * @param {string} localPath Ruta local del archivo
 * @param {string} remotePath Ruta remota donde guardar el archivo
 * @returns {Promise<Object>} Información sobre la subida
 */
export async function uploadFile(providerId, localPath, remotePath) {
  try {
    const provider = await getCloudProvider(providerId);
    const adapter = await loadAdapter(provider.tipo);
    const client = await adapter.createClient(
      provider.credenciales, 
      provider.configuracion
    );
    
    return await adapter.uploadFile(client, localPath, remotePath);
  } catch (error) {
    console.error(`Error al subir archivo a proveedor ${providerId}:`, error);
    throw error;
  }
}

/**
 * Descarga un archivo desde un proveedor de nube
 * @param {number} providerId ID del proveedor
 * @param {string} remotePath Ruta remota del archivo
 * @param {string} localPath Ruta local donde guardar el archivo
 * @returns {Promise<Object>} Información sobre la descarga
 */
export async function downloadFile(providerId, remotePath, localPath) {
  try {
    const provider = await getCloudProvider(providerId);
    const adapter = await loadAdapter(provider.tipo);
    const client = await adapter.createClient(
      provider.credenciales, 
      provider.configuracion
    );
    
    return await adapter.downloadFile(client, remotePath, localPath);
  } catch (error) {
    console.error(`Error al descargar archivo de proveedor ${providerId}:`, error);
    throw error;
  }
}

/**
 * Lista archivos en un directorio remoto
 * @param {number} providerId ID del proveedor
 * @param {string} remotePath Ruta remota a listar
 * @returns {Promise<Array<Object>>} Lista de archivos
 */
export async function listFiles(providerId, remotePath) {
  try {
    const provider = await getCloudProvider(providerId);
    const adapter = await loadAdapter(provider.tipo);
    const client = await adapter.createClient(
      provider.credenciales, 
      provider.configuracion
    );
    
    return await adapter.listFiles(client, remotePath);
  } catch (error) {
    console.error(`Error al listar archivos en proveedor ${providerId}:`, error);
    throw error;
  }
}

/**
 * Genera una URL firmada para acceder a un archivo
 * @param {number} providerId ID del proveedor
 * @param {string} remotePath Ruta remota del archivo
 * @param {Object} options Opciones adicionales (expiración, etc.)
 * @returns {Promise<string>} URL firmada
 */
export async function getSignedUrl(providerId, remotePath, options = {}) {
  try {
    const provider = await getCloudProvider(providerId);
    const adapter = await loadAdapter(provider.tipo);
    const client = await adapter.createClient(
      provider.credenciales, 
      provider.configuracion
    );
    
    // Aplicar opciones de la configuración del proveedor
    const config = provider.configuracion || {};
    const mergedOptions = {
      expiresIn: config.presigned_url_expiry || 3600,
      ...options
    };
    
    return await adapter.getSignedUrl(client, remotePath, mergedOptions);
  } catch (error) {
    console.error(`Error al generar URL firmada para proveedor ${providerId}:`, error);
    throw error;
  }
}

/**
 * Migra un directorio completo a un proveedor de nube
 * @param {number} providerId ID del proveedor
 * @param {string} localPath Ruta local del directorio
 * @param {string} remotePath Ruta remota base
 * @param {Object} options Opciones de migración
 * @returns {Promise<Object>} Resultado de la migración
 */
export async function migrateDirectory(providerId, localPath, remotePath, options = {}) {
  // Esta función será implementada en el futuro
  throw new Error('Función no implementada');
}

/**
 * Prueba la conexión con un proveedor de nube
 * @param {number} providerId ID del proveedor
 * @returns {Promise<Object>} Resultado de la prueba
 */
export async function testConnection(providerId) {
  try {
    // Esta función será implementada por cada adaptador
    const provider = await getCloudProvider(providerId);
    const adapter = await loadAdapter(provider.tipo);
    
    if (!adapter.testConnection) {
      throw new Error(`El adaptador para ${provider.tipo} no implementa testConnection`);
    }
    
    const result = await adapter.testConnection(
      provider.credenciales, 
      provider.configuracion
    );
    
    // Actualizar estado del proveedor
    await pool.query(
      `UPDATE cloud_providers 
       SET estado = $1, ultimo_chequeo = NOW(), mensaje_error = $2 
       WHERE id = $3`,
      [result.success ? 'conectado' : 'error', 
       result.success ? null : result.message, 
       providerId]
    );
    
    return result;
  } catch (error) {
    console.error(`Error al probar conexión con proveedor ${providerId}:`, error);
    
    // Actualizar estado del proveedor
    await pool.query(
      `UPDATE cloud_providers 
       SET estado = 'error', ultimo_chequeo = NOW(), mensaje_error = $1 
       WHERE id = $2`,
      [error.message, providerId]
    );
    
    throw error;
  }
}

/**
 * Registra un nuevo proveedor de nube
 * @param {Object} providerData Datos del proveedor
 * @returns {Promise<Object>} Proveedor creado
 */
export async function registerCloudProvider(providerData) {
  try {
    const { nombre, descripcion, tipo, credenciales, configuracion, activo = true } = providerData;
    
    // Validación básica
    if (!nombre || !tipo || !credenciales || !configuracion) {
      throw new Error('Faltan datos obligatorios');
    }
    
    // Convertir a JSON si es necesario
    const credencialesJson = typeof credenciales === 'string' 
      ? credenciales 
      : JSON.stringify(credenciales);
      
    const configuracionJson = typeof configuracion === 'string' 
      ? configuracion 
      : JSON.stringify(configuracion);
    
    const result = await pool.query(
      `INSERT INTO cloud_providers 
       (nombre, descripcion, tipo, credenciales, configuracion, activo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, tipo, estado, activo, creado_en`,
      [nombre, descripcion || '', tipo, credencialesJson, configuracionJson, activo]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error al registrar proveedor de nube:', error);
    throw error;
  }
}

export default {
  getCloudProvider,
  getActiveCloudProviders,
  createCloudClient,
  getCloudAdapter,
  uploadFile,
  downloadFile,
  listFiles,
  getSignedUrl,
  migrateDirectory,
  testConnection,
  registerCloudProvider
};