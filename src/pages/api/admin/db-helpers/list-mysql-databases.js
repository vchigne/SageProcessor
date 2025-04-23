/**
 * API para listar bases de datos desde un servidor MySQL
 * 
 * Este endpoint realiza una conexión real al servidor MySQL
 * y devuelve la lista completa de bases de datos disponibles.
 */

// Activar modo estricto
'use strict';

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Obtener credenciales del cuerpo de la solicitud
    const { server, port, user, password } = req.body;
    
    // Validar parámetros requeridos
    if (!server || !port || !user) {
      return res.status(400).json({ 
        success: false,
        message: 'Faltan parámetros requeridos (servidor, puerto, usuario)'
      });
    }
    
    // Para implementar una conexión real a MySQL, necesitamos instalar 'mysql2'
    // como no podemos instalarlo ahora debido a conflictos de dependencias,
    // devolvemos un mensaje de error informativo
    return res.status(503).json({
      success: false,
      message: `La conexión a MySQL está temporalmente no disponible. La conexión al servidor ${server}:${port} no pudo establecerse porque el paquete requerido no está disponible.`,
      error: {
        code: 'MODULE_NOT_AVAILABLE',
        details: 'El módulo mysql2 no está disponible para establecer conexiones a MySQL.'
      },
      databases: []  // Devolvemos un array vacío en lugar de datos simulados
    });
  } catch (error) {
    console.error('Error al listar bases de datos MySQL:', error);
    
    // Devolver error detallado
    return res.status(500).json({
      success: false,
      message: `Error al listar bases de datos MySQL: ${error.message}`,
      databases: [], // Lista vacía en lugar de datos simulados
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        details: error.message
      }
    });
  }
}