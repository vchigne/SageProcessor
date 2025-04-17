import { Pool } from 'pg';
import nodemailer from 'nodemailer';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
    const { emails } = req.body;
    
    // Validar que se hayan proporcionado emails
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'No hay direcciones de correo válidas para enviar la prueba' });
    }
    
    // Obtener configuración de email desde la base de datos
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT * FROM email_configuraciones 
        WHERE activo = true 
        ORDER BY id DESC 
        LIMIT 1
      `);
      
      if (rows.length === 0) {
        return res.status(400).json({ error: 'No hay configuración de correo disponible' });
      }
      
      const emailConfig = rows[0];
      
      // Crear transportador para enviar email
      const transporter = nodemailer.createTransport({
        host: emailConfig.smtp_host,
        port: emailConfig.smtp_port,
        secure: emailConfig.smtp_secure,
        auth: {
          user: emailConfig.smtp_username,
          pass: emailConfig.smtp_password,
        },
      });
      
      // Crear contenido del email
      const fecha = new Date().toLocaleString('es-ES');
      const contenido = `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #2c3e50;">Notificación de Prueba del Sistema SAGE</h2>
          <p>Esta es una notificación de prueba del sistema de monitoreo de SAGE.</p>
          <p>Si estás recibiendo este correo, la configuración de notificaciones administrativas está funcionando correctamente.</p>
          <div style="background-color: #f8f9fa; border-left: 4px solid #4299e1; padding: 12px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Fecha y hora de la prueba:</strong> ${fecha}</p>
          </div>
          <p>
            Esta dirección de correo ha sido configurada para recibir alertas sobre los siguientes eventos:
          </p>
          <ul>
            <li>Problemas de conectividad con proveedores de nube</li>
            <li>Alertas de espacio en disco</li>
            <li>Otros eventos críticos del sistema</li>
          </ul>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="color: #718096; font-size: 0.9em;">
            Este es un mensaje automático del sistema SAGE. Por favor, no responda a este correo.
          </p>
        </div>
      `;
      
      // Enviar email a todos los destinatarios
      const mailPromises = emails.map(email => 
        transporter.sendMail({
          from: `"Sistema SAGE" <${emailConfig.smtp_username}>`,
          to: email,
          subject: 'Prueba de Notificaciones de SAGE',
          html: contenido,
        })
      );
      
      // Esperar a que se envíen todos los correos
      await Promise.all(mailPromises);
      
      return res.status(200).json({ success: true, message: `Notificación enviada a ${emails.length} direcciones` });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al enviar la notificación de prueba:', error);
    return res.status(500).json({ error: 'Error al enviar la notificación de prueba' });
  }
}