import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../../../lib/db';
import nodemailer from 'nodemailer';

// Función para verificar conexión SMTP
async function verificarSMTP(config: any): Promise<void> {
  try {
    const transport = nodemailer.createTransport({
      host: config.servidor_salida,
      port: config.puerto_salida,
      secure: config.puerto_salida === 465,
      auth: {
        user: config.usuario,
        pass: config.password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verificar conexión
    await transport.verify();
    
  } catch (error: any) {
    throw new Error(`Error de conexión SMTP: ${error.message}`);
  }
}

// Función principal de verificación
async function verificarConfiguracion(config: any): Promise<void> {
  try {
    // Por ahora, solo verificamos SMTP para cualquier configuración
    // En una implementación completa, se agregarían las verificaciones
    // de IMAP y POP3 según el propósito
    await verificarSMTP(config);
  } catch (error) {
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { id } = req.query;
  
  // Validar ID
  const configId = parseInt(id as string);
  if (isNaN(configId)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }
  
  try {
    // Obtener datos de la configuración
    const configResult = await pool.query(`
      SELECT 
        id, proposito, servidor_entrada, puerto_entrada, protocolo_entrada, usar_ssl_entrada,
        servidor_salida, puerto_salida, usar_tls_salida, usuario, password
      FROM email_configuraciones
      WHERE id = $1
    `, [configId]);
    
    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    
    const config = configResult.rows[0];
    
    try {
      // Intentar verificar la configuración
      await verificarConfiguracion(config);
      
      // Actualizar estado a 'activo'
      await pool.query(`
        UPDATE email_configuraciones
        SET 
          estado = 'activo',
          ultimo_chequeo = NOW(),
          mensaje_error = NULL,
          fecha_modificacion = NOW()
        WHERE id = $1
      `, [configId]);
      
      return res.status(200).json({ 
        mensaje: 'Configuración verificada correctamente',
        estado: 'activo'
      });
      
    } catch (verifyError: any) {
      // Actualizar estado a 'error'
      await pool.query(`
        UPDATE email_configuraciones
        SET 
          estado = 'error',
          ultimo_chequeo = NOW(),
          mensaje_error = $2,
          fecha_modificacion = NOW()
        WHERE id = $1
      `, [configId, verifyError.message]);
      
      return res.status(400).json({ 
        error: 'Error al verificar configuración',
        mensaje: verifyError.message,
        estado: 'error'
      });
    }
    
  } catch (error: any) {
    console.error(`Error al verificar configuración ${configId}:`, error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}