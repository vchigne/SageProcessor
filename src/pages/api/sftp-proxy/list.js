/**
 * API endpoint para listar archivos a través de SFTP
 * 
 * Este endpoint proporciona el acceso a servidores SFTP aprovechando
 * la infraestructura ya existente en SAGE Daemon 2 y devuelve errores reales.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { host, port, username, password, key_path, path } = req.body;
    
    // Validaciones básicas
    if (!host) {
      return res.status(400).json({ error: 'Se requiere el host del servidor SFTP' });
    }
    
    if (!username) {
      return res.status(400).json({ error: 'Se requiere el nombre de usuario para la conexión SFTP' });
    }
    
    if (!password && !key_path) {
      return res.status(400).json({ error: 'Se requiere contraseña o clave SSH para la conexión SFTP' });
    }
    
    // Mostrar detalles de la conexión (sin la contraseña)
    console.log(`[SFTP Proxy] Conectando a ${host}:${port || 22} como ${username}, path: ${path || '/'}`);
    
    // Responder con error de características no soportadas para no simular datos
    // En un entorno real, este endpoint se conectaría con la implementación Python
    // que ya tiene las capacidades SFTP instaladas
    return res.status(501).json({
      error: 'La funcionalidad de navegación SFTP está parcialmente implementada. El módulo Python necesario para conexiones SSH está disponible, pero el endpoint para solicitudes desde el frontend requiere implementación. Por favor, contacta al administrador del sistema para finalizar esta característica.'
    });
    
  } catch (error) {
    console.error('[SFTP Proxy] Error:', error);
    return res.status(500).json({
      error: `Error al procesar la solicitud SFTP: ${error.message}`
    });
  }
}