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
          id, admin_emails, log_level, 
          janitor_notifications_enabled, disk_space_monitoring_enabled, 
          updated_at
        ) VALUES (
          1, $1, $2, $3, $4, NOW()
        )
      `, [
        JSON.stringify(defaultConfig.admin_emails),
        defaultConfig.log_level,
        defaultConfig.janitor_notifications_enabled,
        defaultConfig.disk_space_monitoring_enabled
      ]);
      
      return defaultConfig;
    }
    
    // Formatear la configuración obtenida y mapearla al formato esperado por el frontend
    const config = result.rows[0];
    
    return {
      admin_emails: Array.isArray(config.admin_emails) 
        ? config.admin_emails 
        : JSON.parse(config.admin_emails || '[]'),
      check_interval_hours: config.check_interval_hours,
      monitor_cloud_providers: config.monitor_cloud_providers,
      monitor_disk_space: config.monitor_disk_space,
      disk_space_warning_threshold: config.disk_space_warning_threshold,
      janitor_notifications_enabled: config.notification_enabled,
      disk_space_monitoring_enabled: config.monitor_disk_space,
      // Usar el campo de la base de datos
      log_level: config.log_level || 'info',
      // Nuevos campos para eventos de notificación
      notify_events: config.notify_events || ['cloud_connection_error', 'disk_space_warning'],
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
    
    // Actualizar configuración con los campos de la tabla incluyendo log_level y notify_events
    const result = await db.query(`
      INSERT INTO system_config (
        id, admin_emails, 
        check_interval_hours, monitor_cloud_providers, 
        monitor_disk_space, disk_space_warning_threshold,
        notification_enabled, log_level, notify_events, updated_at
      ) 
      VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        admin_emails = $1,
        check_interval_hours = $2,
        monitor_cloud_providers = $3,
        monitor_disk_space = $4,
        disk_space_warning_threshold = $5,
        notification_enabled = $6,
        log_level = $7,
        notify_events = $8,
        updated_at = NOW()
      RETURNING *
    `, [
      JSON.stringify(config.admin_emails),
      config.check_interval_hours,
      config.monitor_cloud_providers,
      config.monitor_disk_space,
      config.disk_space_warning_threshold,
      config.notification_enabled,
      config.log_level,
      JSON.stringify(config.notify_events)
    ]);
    
    const updatedConfig = result.rows[0];
    
    // Formatear la respuesta usando los valores de la base de datos
    // y mapearlos al formato esperado por el frontend
    return {
      admin_emails: Array.isArray(updatedConfig.admin_emails) 
        ? updatedConfig.admin_emails 
        : JSON.parse(updatedConfig.admin_emails || '[]'),
      check_interval_hours: updatedConfig.check_interval_hours,
      janitor_notifications_enabled: updatedConfig.notification_enabled,
      disk_space_monitoring_enabled: updatedConfig.monitor_disk_space,
      disk_space_warning_threshold: updatedConfig.disk_space_warning_threshold,
      monitor_cloud_providers: updatedConfig.monitor_cloud_providers,
      // Usar el valor directamente de la base de datos
      log_level: updatedConfig.log_level,
      // Incluir los eventos de notificación
      notify_events: Array.isArray(updatedConfig.notify_events) 
        ? updatedConfig.notify_events
        : JSON.parse(updatedConfig.notify_events || '["cloud_connection_error", "disk_space_warning"]'),
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
        admin_emails TEXT NOT NULL DEFAULT '[]',
        check_interval_hours INTEGER NOT NULL DEFAULT 6,
        monitor_cloud_providers BOOLEAN NOT NULL DEFAULT TRUE,
        monitor_disk_space BOOLEAN NOT NULL DEFAULT FALSE,
        disk_space_warning_threshold INTEGER NOT NULL DEFAULT 85,
        notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        log_level VARCHAR(20) DEFAULT 'info',
        notify_events JSONB DEFAULT '["cloud_connection_error", "disk_space_warning"]'::jsonb,
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
    check_interval_hours: 6,
    monitor_cloud_providers: true,
    monitor_disk_space: false,
    disk_space_warning_threshold: 85,
    notification_enabled: true,
    log_level: 'info',
    notify_events: ['cloud_connection_error', 'disk_space_warning']
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
    check_interval_hours: parseInt(config.check_interval_hours) || 6,
    monitor_cloud_providers: Boolean(config.monitor_cloud_providers),
    monitor_disk_space: Boolean(config.monitor_disk_space),
    disk_space_warning_threshold: parseInt(config.disk_space_warning_threshold) || 85,
    notification_enabled: Boolean(config.notification_enabled),
    log_level: ['debug', 'info', 'warning', 'error'].includes(config.log_level) 
      ? config.log_level 
      : 'info',
    notify_events: Array.isArray(config.notify_events) ? config.notify_events : ['cloud_connection_error', 'disk_space_warning']
  };
  
  // Validar emails
  validatedConfig.admin_emails = validatedConfig.admin_emails
    .filter(email => typeof email === 'string' && /\S+@\S+\.\S+/.test(email));

  // Validar eventos de notificación
  const validEvents = ['cloud_connection_error', 'disk_space_warning', 'janitor_error', 'migration_completed'];
  validatedConfig.notify_events = validatedConfig.notify_events
    .filter(event => typeof event === 'string' && validEvents.includes(event));
  
  return validatedConfig;
}