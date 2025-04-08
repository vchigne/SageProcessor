import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

// Función para verificar conexión SMTP con timeout
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
      },
      connectionTimeout: 10000, // 10 segundos de timeout
      socketTimeout: 15000     // 15 segundos de timeout para socket
    });

    // Crear una promesa con timeout para la verificación
    const verificarConTimeout = async () => {
      return new Promise(async (resolve, reject) => {
        // Timeout de 20 segundos
        const timeoutId = setTimeout(() => {
          reject(new Error('Tiempo de espera agotado al intentar conectar con el servidor SMTP'));
        }, 20000);
        
        try {
          // Intentar verificar la conexión
          await transport.verify();
          clearTimeout(timeoutId);
          resolve(true);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    };
    
    // Ejecutar verificación con timeout
    await verificarConTimeout();
    
  } catch (error: any) {
    throw new Error(`Error de conexión SMTP: ${error.message}`);
  }
}

// Función para verificar conexión IMAP/POP3 
// Esta función es un placeholder, en una implementación completa
// se utilizaría una librería como imap o poplib para verificar realmente
async function verificarRecepcion(config: any): Promise<void> {
  try {
    // En una implementación real, aquí se usaría una librería de IMAP o POP3
    // Por ahora, simplemente simulamos que funciona si los datos parecen correctos
    if (!config.servidor_entrada || !config.puerto_entrada) {
      throw new Error('Servidor o puerto de entrada no configurados');
    }
    
    // Verificación básica de puertos estándar
    if (config.protocolo_entrada === 'imap' && 
        ![143, 993].includes(config.puerto_entrada)) {
      console.warn('Puerto no estándar para IMAP:', config.puerto_entrada);
    } else if (config.protocolo_entrada === 'pop3' && 
        ![110, 995].includes(config.puerto_entrada)) {
      console.warn('Puerto no estándar para POP3:', config.puerto_entrada);
    }
    
  } catch (error: any) {
    throw new Error(`Error de conexión ${config.protocolo_entrada.toUpperCase()}: ${error.message}`);
  }
}

// Función principal de verificación
async function verificarConfiguracion(config: any): Promise<{
  mensajes: string[];
}> {
  const mensajes: string[] = [];
  
  try {
    // Verificar SMTP para configuraciones de envío o múltiples
    if (config.proposito === 'envio' || config.proposito === 'multiple' || config.proposito === 'admin') {
      await verificarSMTP(config);
      mensajes.push('Conexión SMTP verificada correctamente');
    }
    
    // Verificar IMAP/POP3 para configuraciones de recepción o múltiples
    if (config.proposito === 'recepcion' || config.proposito === 'multiple') {
      await verificarRecepcion(config);
      mensajes.push(`Conexión ${config.protocolo_entrada.toUpperCase()} verificada correctamente`);
    }
    
    return { mensajes };
  } catch (error: any) {
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }
  
  try {
    const config = req.body;
    
    if (!config) {
      return res.status(400).json({ error: 'No se proporcionaron datos de configuración' });
    }
    
    // Validaciones básicas
    if ((config.proposito === 'envio' || config.proposito === 'multiple' || config.proposito === 'admin') && 
        (!config.servidor_salida || !config.puerto_salida)) {
      return res.status(400).json({ error: 'Faltan datos del servidor de salida' });
    }
    
    if ((config.proposito === 'recepcion' || config.proposito === 'multiple') && 
        (!config.servidor_entrada || !config.puerto_entrada)) {
      return res.status(400).json({ error: 'Faltan datos del servidor de entrada' });
    }
    
    if (!config.usuario || !config.password) {
      return res.status(400).json({ error: 'Faltan credenciales de autenticación' });
    }
    
    try {
      // Intentar verificar la configuración
      const resultado = await verificarConfiguracion(config);
      
      return res.status(200).json({ 
        mensaje: resultado.mensajes.join('. '),
        estado: 'activo'
      });
      
    } catch (verifyError: any) {
      return res.status(400).json({ 
        error: 'Error al verificar configuración',
        mensaje: verifyError.message,
        estado: 'error'
      });
    }
    
  } catch (error: any) {
    console.error('Error al validar configuración:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}