import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * API para gestionar la configuración administrativa del sistema
 * 
 * GET: Obtiene la configuración actual
 * POST: Actualiza la configuración
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const client = await pool.connect();
      try {
        // Buscar la configuración existente
        const { rows } = await client.query(
          'SELECT * FROM system_config WHERE id = 1'
        );
        
        // Si no hay configuración, devolver un objeto vacío
        if (rows.length === 0) {
          return res.status(200).json({
            admin_emails: [],
            check_interval_hours: 12,
            monitor_cloud_providers: true,
            monitor_disk_space: true,
            disk_space_warning_threshold: 80,
            notification_enabled: true
          });
        }
        
        // Devolver la configuración encontrada
        const config = rows[0];
        
        // Asegurar que admin_emails sea un array
        if (typeof config.admin_emails === 'string') {
          try {
            config.admin_emails = JSON.parse(config.admin_emails);
          } catch (e) {
            config.admin_emails = config.admin_emails.split(',').map(email => email.trim()).filter(Boolean);
          }
        }
        
        return res.status(200).json(config);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error al obtener la configuración del sistema:', error);
      return res.status(500).json({ error: 'Error al obtener la configuración del sistema' });
    }
  } 
  else if (req.method === 'POST') {
    try {
      const client = await pool.connect();
      try {
        const {
          admin_emails,
          check_interval_hours,
          monitor_cloud_providers,
          monitor_disk_space,
          disk_space_warning_threshold,
          notification_enabled
        } = req.body;
        
        // Validar datos obligatorios
        if (check_interval_hours === undefined || 
            monitor_cloud_providers === undefined || 
            monitor_disk_space === undefined || 
            disk_space_warning_threshold === undefined ||
            notification_enabled === undefined) {
          return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        
        // Comprobar si ya existe una configuración
        const { rows } = await client.query(
          'SELECT id FROM system_config WHERE id = 1'
        );
        
        // Convertir admin_emails a formato JSON string si es necesario
        let emailsJson = admin_emails;
        if (Array.isArray(admin_emails)) {
          emailsJson = JSON.stringify(admin_emails);
        }
        
        if (rows.length === 0) {
          // Insertar nueva configuración
          await client.query(`
            INSERT INTO system_config (
              id, 
              admin_emails, 
              check_interval_hours, 
              monitor_cloud_providers, 
              monitor_disk_space, 
              disk_space_warning_threshold,
              notification_enabled,
              created_at, 
              updated_at
            ) VALUES (
              1, 
              $1, 
              $2, 
              $3, 
              $4, 
              $5,
              $6,
              NOW(), 
              NOW()
            )
          `, [
            emailsJson,
            check_interval_hours,
            monitor_cloud_providers,
            monitor_disk_space,
            disk_space_warning_threshold,
            notification_enabled
          ]);
        } else {
          // Actualizar configuración existente
          await client.query(`
            UPDATE system_config SET
              admin_emails = $1,
              check_interval_hours = $2,
              monitor_cloud_providers = $3,
              monitor_disk_space = $4,
              disk_space_warning_threshold = $5,
              notification_enabled = $6,
              updated_at = NOW()
            WHERE id = 1
          `, [
            emailsJson,
            check_interval_hours,
            monitor_cloud_providers,
            monitor_disk_space,
            disk_space_warning_threshold,
            notification_enabled
          ]);
        }
        
        return res.status(200).json({ success: true });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error al guardar la configuración del sistema:', error);
      return res.status(500).json({ error: 'Error al guardar la configuración del sistema' });
    }
  } 
  else {
    return res.status(405).json({ error: 'Método no permitido' });
  }
}