/**
 * API para probar una conexión a un proveedor de nube usando credenciales sin guardar
 * 
 * POST: Prueba la conexión con las credenciales proporcionadas
 */

import { getCloudAdapter } from '../../../utils/cloud';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { tipo, secretos } = req.body;
    
    // Validaciones
    if (!tipo) {
      return res.status(400).json({ 
        success: false, 
        message: 'El tipo de proveedor es obligatorio' 
      });
    }
    
    if (!secretos || Object.keys(secretos).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Las credenciales son obligatorias' 
      });
    }
    
    // Crear un proveedor temporal para probar la conexión
    const tempProvider = {
      id: 0,
      nombre: "Test de conexión",
      tipo,
      credenciales: secretos,
      configuracion: {}
    };
    
    try {
      // Obtener adaptador
      const adapter = getCloudAdapter(tempProvider);
      
      if (!adapter) {
        return res.status(400).json({ 
          success: false, 
          message: `Tipo de proveedor no soportado: ${tipo}` 
        });
      }
      
      // Probar conexión
      const result = await adapter.testConnection();
      
      return res.status(200).json({
        success: true,
        message: `Conexión exitosa`
      });
    } catch (error) {
      console.error('Error al probar conexión:', error);
      return res.status(200).json({
        success: false,
        message: `Error al conectar: ${error.message}`
      });
    }
  } catch (error) {
    console.error('Error en API de prueba de conexión:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error interno del servidor: ${error.message}` 
    });
  }
}