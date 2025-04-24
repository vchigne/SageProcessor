/**
 * API para validar los datos de conexión SFTP de un emisor
 * 
 * POST: Valida los datos proporcionados sin realizar una conexión real
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { 
    sftp_servidor, 
    sftp_puerto = 22, 
    sftp_usuario, 
    sftp_clave, 
    sftp_directorio = '/' 
  } = req.body;

  // Validar campos obligatorios
  if (!sftp_servidor || !sftp_usuario || !sftp_clave) {
    return res.status(400).json({ 
      success: false, 
      message: 'Faltan campos obligatorios: servidor, usuario y clave son requeridos' 
    });
  }

  try {
    // Realizar validaciones básicas
    const validaciones = validarDatosConexionSFTP(
      sftp_servidor,
      sftp_puerto,
      sftp_usuario,
      sftp_clave,
      sftp_directorio
    );

    if (validaciones.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errores: validaciones
      });
    }

    // Si todas las validaciones pasan, devuelve éxito
    return res.status(200).json({
      success: true,
      message: 'Datos de conexión SFTP válidos',
      data: {
        servidor: sftp_servidor,
        puerto: sftp_puerto,
        usuario: sftp_usuario,
        directorio: sftp_directorio
      }
    });
  } catch (error) {
    console.error('Error al validar datos SFTP:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error interno del servidor: ${error.message}` 
    });
  }
}

/**
 * Valida los datos de conexión SFTP sin realizar una conexión real
 * @param {string} servidor - Servidor SFTP
 * @param {number|string} puerto - Puerto SFTP
 * @param {string} usuario - Usuario SFTP
 * @param {string} clave - Clave SFTP
 * @param {string} directorio - Directorio en el servidor SFTP
 * @returns {Array<string>} - Lista de errores encontrados (vacía si no hay errores)
 */
function validarDatosConexionSFTP(servidor, puerto, usuario, clave, directorio) {
  const errores = [];

  // Validar servidor
  if (!servidor) {
    errores.push('El servidor es requerido');
  } else if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(servidor) && 
             !/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(servidor)) {
    errores.push('El formato del servidor no es válido. Debe ser un nombre de dominio o dirección IP');
  }

  // Validar puerto
  const puertoParsed = parseInt(puerto);
  if (isNaN(puertoParsed) || puertoParsed < 1 || puertoParsed > 65535) {
    errores.push('El puerto debe ser un número entre 1 y 65535');
  }

  // Validar usuario
  if (!usuario) {
    errores.push('El usuario es requerido');
  } else if (usuario.length < 3) {
    errores.push('El usuario debe tener al menos 3 caracteres');
  }

  // Validar clave
  if (!clave) {
    errores.push('La clave es requerida');
  } else if (clave.length < 4) {
    errores.push('La clave debe tener al menos 4 caracteres');
  }

  // Validar directorio
  if (!directorio) {
    errores.push('El directorio es requerido');
  } else if (!directorio.startsWith('/')) {
    errores.push('El directorio debe comenzar con /');
  }

  return errores;
}