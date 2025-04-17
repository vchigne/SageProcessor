import { pool } from '../../../../utils/db';

/**
 * API para gestionar la configuración administrativa del sistema
 * 
 * GET: Obtiene la configuración actual
 * POST: Actualiza la configuración
 */
export default async function handler(req, res) {
  const db = pool;
  
  try {
    if (req.method === 'GET') {
      // Obtener configuración del sistema
      const systemConfig = await getSystemConfig(db);
      res.status(200).json(systemConfig);
    } 
    else if (req.method === 'POST') {
      // Actualizar configuración del sistema
      const updatedConfig = await updateSystemConfig(db, req.body);
      res.status(200).json({ 
        success: true, 
        message: 'Configuración actualizada con éxito', 
        config: updatedConfig 
      });
    } 
    else {
      res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en API system-config:', error);
    res.status(500).json({ 
      error: 'Error al procesar la solicitud', 
      message: error.message 
    });
  }
}

/**
 * Obtiene la configuración administrativa actual del sistema
 * 
 * @param {Object} db - Conexión a la base de datos
 * @returns {Object} - La configuración del sistema
 */
async function getSystemConfig(db) {
  try {
    // Verificar si existe la tabla
    const tableExists = await checkSystemConfigTable(db);
    
    if (!tableExists) {
      // Crear la tabla si no existe
      await createSystemConfigTable(db);
      // Inicializar con valores por defecto
      return getDefaultConfig();
    }
    
    // Obtener configuración
    const result = await db.query('SELECT * FROM system_config WHERE id = 1');
    
    if (!result.rows.length) {
      // Insertar configuración por defecto si no existe
      const defaultConfig = getDefaultConfig();
      
      await db.query(`
        INSERT INTO system_config (
          id, admin_emails, janitor_notifications_enabled, 
          disk_space_monitoring_enabled, log_level, updated_at
        ) VALUES (
          1, $1, $2, $3, $4, NOW()
        )
      `, [
        JSON.stringify(defaultConfig.admin_emails), 
        defaultConfig.janitor_notifications_enabled, 
        defaultConfig.disk_space_monitoring_enabled,
        defaultConfig.log_level
      ]);
      
      return defaultConfig;
    }
    
    // Formatear la configuración obtenida
    const config = result.rows[0];
    
    return {
      admin_emails: Array.isArray(config.admin_emails) 
        ? config.admin_emails 
        : JSON.parse(config.admin_emails || '[]'),
      janitor_notifications_enabled: config.janitor_notifications_enabled,
      disk_space_monitoring_enabled: config.disk_space_monitoring_enabled,
      log_level: config.log_level || 'info',
      updated_at: config.updated_at
    };
  } catch (error) {
    console.error('Error al obtener configuración del sistema:', error);
    throw new Error('Error al obtener configuración del sistema: ' + error.message);
  }
}

/**
 * Actualiza la configuración administrativa del sistema
 * 
 * @param {Object} db - Conexión a la base de datos
 * @param {Object} newConfig - Nueva configuración
 * @returns {Object} - La configuración actualizada
 */
async function updateSystemConfig(db, newConfig) {
  try {
    // Verificar si existe la tabla
    const tableExists = await checkSystemConfigTable(db);
    
    if (!tableExists) {
      // Crear la tabla si no existe
      await createSystemConfigTable(db);
    }
    
    // Validar entrada
    const config = validateConfig(newConfig);
    
    // Actualizar configuración
    const result = await db.query(`
      INSERT INTO system_config (
        id, admin_emails, janitor_notifications_enabled, 
        disk_space_monitoring_enabled, log_level, updated_at
      ) 
      VALUES (1, $1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        admin_emails = $1,
        janitor_notifications_enabled = $2,
        disk_space_monitoring_enabled = $3,
        log_level = $4,
        updated_at = NOW()
      RETURNING *
    `, [
      JSON.stringify(config.admin_emails), 
      config.janitor_notifications_enabled, 
      config.disk_space_monitoring_enabled,
      config.log_level
    ]);
    
    const updatedConfig = result.rows[0];
    
    // Formatear la respuesta
    return {
      admin_emails: Array.isArray(updatedConfig.admin_emails) 
        ? updatedConfig.admin_emails 
        : JSON.parse(updatedConfig.admin_emails || '[]'),
      janitor_notifications_enabled: updatedConfig.janitor_notifications_enabled,
      disk_space_monitoring_enabled: updatedConfig.disk_space_monitoring_enabled,
      log_level: updatedConfig.log_level,
      updated_at: updatedConfig.updated_at
    };
  } catch (error) {
    console.error('Error al actualizar configuración del sistema:', error);
    throw new Error('Error al actualizar configuración del sistema: ' + error.message);
  }
}

/**
 * Verifica si la tabla system_config existe
 * 
 * @param {Object} db - Conexión a la base de datos
 * @returns {boolean} - True si la tabla existe, false en caso contrario
 */
async function checkSystemConfigTable(db) {
  try {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'system_config'
      )
    `);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error al verificar existencia de tabla system_config:', error);
    throw new Error('Error al verificar tabla system_config: ' + error.message);
  }
}

/**
 * Crea la tabla system_config
 * 
 * @param {Object} db - Conexión a la base de datos
 */
async function createSystemConfigTable(db) {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY,
        admin_emails JSONB NOT NULL DEFAULT '[]',
        janitor_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        disk_space_monitoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        log_level VARCHAR(20) NOT NULL DEFAULT 'info',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    console.log('Tabla system_config creada correctamente');
  } catch (error) {
    console.error('Error al crear tabla system_config:', error);
    throw new Error('Error al crear tabla system_config: ' + error.message);
  }
}

/**
 * Devuelve la configuración por defecto
 * 
 * @returns {Object} - Configuración por defecto
 */
function getDefaultConfig() {
  return {
    admin_emails: [],
    janitor_notifications_enabled: true,
    disk_space_monitoring_enabled: false,
    log_level: 'info'
  };
}

/**
 * Valida la configuración proporcionada
 * 
 * @param {Object} config - Configuración a validar
 * @returns {Object} - Configuración validada
 */
function validateConfig(config) {
  const validatedConfig = {
    admin_emails: Array.isArray(config.admin_emails) ? config.admin_emails : [],
    janitor_notifications_enabled: Boolean(config.janitor_notifications_enabled),
    disk_space_monitoring_enabled: Boolean(config.disk_space_monitoring_enabled),
    log_level: ['debug', 'info', 'warning', 'error'].includes(config.log_level) 
      ? config.log_level 
      : 'info'
  };
  
  // Validar emails
  validatedConfig.admin_emails = validatedConfig.admin_emails
    .filter(email => typeof email === 'string' && /\S+@\S+\.\S+/.test(email));
  
  return validatedConfig;
}