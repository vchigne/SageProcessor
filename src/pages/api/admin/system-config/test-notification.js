import { pool } from '../../../../utils/db';
import nodemailer from 'nodemailer';

/**
 * API para enviar notificaciones de prueba a los administradores configurados
 * 
 * POST: Envía un correo de prueba a los emails configurados
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const db = pool;
    
    // Obtener configuración del sistema
    const config = await getSystemConfig(db);
    
    if (!config.admin_emails || config.admin_emails.length === 0) {
      return res.status(400).json({ 
        error: 'No hay emails configurados', 
        message: 'Debe configurar al menos un email de administrador para enviar notificaciones'
      });
    }
    
    // Obtener configuración de SMTP
    const smtpConfig = await getSmtpConfig(db);
    
    if (!smtpConfig) {
      return res.status(400).json({ 
        error: 'SMTP no configurado', 
        message: 'La configuración SMTP no está completa. Configure SMTP en la sección de Email.'
      });
    }
    
    // Enviar emails de prueba
    const result = await sendTestEmails(config.admin_emails, smtpConfig);
    
    res.status(200).json({ 
      success: true, 
      message: `Notificación de prueba enviada a ${result.sentTo.length} destinatarios`,
      sentTo: result.sentTo
    });
  } catch (error) {
    console.error('Error al enviar notificación de prueba:', error);
    res.status(500).json({ 
      error: 'Error al enviar notificación de prueba', 
      message: error.message 
    });
  }
}

/**
 * Obtiene la configuración del sistema
 * 
 * @param {Object} db - Conexión a la base de datos
 * @returns {Object} - Configuración del sistema
 */
async function getSystemConfig(db) {
  try {
    // Verificar si existe la tabla
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'system_config'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return { admin_emails: [] };
    }
    
    // Obtener configuración
    const result = await db.query('SELECT * FROM system_config WHERE id = 1');
    
    if (!result.rows.length) {
      return { admin_emails: [] };
    }
    
    const config = result.rows[0];
    
    return {
      admin_emails: Array.isArray(config.admin_emails) 
        ? config.admin_emails 
        : JSON.parse(config.admin_emails || '[]')
    };
  } catch (error) {
    console.error('Error al obtener configuración del sistema:', error);
    throw new Error('Error al obtener configuración: ' + error.message);
  }
}

/**
 * Obtiene la configuración SMTP
 * 
 * @param {Object} db - Conexión a la base de datos
 * @returns {Object|null} - Configuración SMTP o null si no está configurada
 */
async function getSmtpConfig(db) {
  try {
    // Verificar si existe la tabla
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'configuraciones_email'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return null;
    }
    
    // Obtener configuración SMTP
    const result = await db.query(`
      SELECT 
        smtp_server, smtp_port, smtp_user, smtp_password, 
        smtp_secure, sender_email, sender_name
      FROM configuraciones_email 
      WHERE id = 1
    `);
    
    if (!result.rows.length) {
      return null;
    }
    
    const smtpConfig = result.rows[0];
    
    // Verificar que los campos requeridos existan
    if (!smtpConfig.smtp_server || !smtpConfig.smtp_port) {
      return null;
    }
    
    return {
      host: smtpConfig.smtp_server,
      port: smtpConfig.smtp_port,
      secure: smtpConfig.smtp_secure || false,
      auth: {
        user: smtpConfig.smtp_user || '',
        pass: smtpConfig.smtp_password || ''
      },
      sender: {
        email: smtpConfig.sender_email || 'sage@example.com',
        name: smtpConfig.sender_name || 'SAGE System'
      }
    };
  } catch (error) {
    console.error('Error al obtener configuración SMTP:', error);
    throw new Error('Error al obtener configuración SMTP: ' + error.message);
  }
}

/**
 * Envía emails de prueba a los administradores configurados
 * 
 * @param {Array} emails - Lista de emails de administradores
 * @param {Object} smtpConfig - Configuración SMTP
 * @returns {Object} - Resultado del envío
 */
async function sendTestEmails(emails, smtpConfig) {
  // Crear transportador SMTP
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth,
    tls: {
      rejectUnauthorized: false // Para desarrollo
    }
  });
  
  const sentTo = [];
  const timestamp = new Date().toLocaleString();
  
  // Preparar y enviar email para cada destinatario
  for (const email of emails) {
    try {
      // Opciones del email
      const mailOptions = {
        from: `"${smtpConfig.sender.name}" <${smtpConfig.sender.email}>`,
        to: email,
        subject: `[SAGE] Notificación de prueba - ${timestamp}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #4f46e5; margin-bottom: 20px;">Notificación de Prueba SAGE</h2>
            
            <p>Hola Administrador,</p>
            
            <p>Este es un correo de prueba del sistema de notificaciones administrativas de SAGE.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; color: #374151;"><strong>Fecha y hora:</strong> ${timestamp}</p>
              <p style="margin: 8px 0 0; color: #374151;"><strong>Enviado a:</strong> ${email}</p>
            </div>
            
            <p>Si ha recibido este correo, significa que la configuración de notificaciones administrativas está funcionando correctamente.</p>
            
            <p>El sistema utilizará este mismo canal para enviar alertas sobre:</p>
            <ul style="margin-bottom: 20px;">
              <li>Problemas con conexiones a proveedores de nube</li>
              <li>Errores en la migración de ejecuciones</li>
              <li>Otros eventos administrativos importantes</li>
            </ul>
            
            <p style="margin-bottom: 5px;">Saludos,</p>
            <p style="margin-top: 0;"><strong>Sistema SAGE</strong></p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #6b7280;">
              <p>Este es un mensaje automático. Por favor no responda a este correo.</p>
            </div>
          </div>
        `
      };
      
      // Enviar email
      await transporter.sendMail(mailOptions);
      sentTo.push(email);
    } catch (error) {
      console.error(`Error al enviar notificación a ${email}:`, error);
      // Continuamos con los demás emails aunque uno falle
    }
  }
  
  return { sentTo };
}