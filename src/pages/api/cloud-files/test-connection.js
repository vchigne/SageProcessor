/**
 * API para probar conexión a un proveedor de nube
 * 
 * Este endpoint recibe la información de un proveedor y prueba la conexión.
 */

import { getStorageManager } from '@/utils/cloud/storage-manager';
import { getProviderById } from '@/utils/db/cloud-providers';

export default async function handler(req, res) {
  // Solo permitir solicitudes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  
  try {
    // Si viene provider_id, obtenemos el proveedor de la base de datos
    if (req.body.provider_id) {
      const providerId = req.body.provider_id;
      
      // Obtener el proveedor de la base de datos
      const provider = await getProviderById(providerId);
      
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: `Proveedor de nube con ID ${providerId} no encontrado`
        });
      }
      
      // Crear gestor de almacenamiento para este proveedor
      const storageManager = getStorageManager(provider);
      
      // Probar conexión
      const result = await storageManager.testConnection();
      
      return res.status(result.success ? 200 : 400).json(result);
    } 
    // Si vienen credenciales y tipo, usamos esos directamente
    else if (req.body.provider_type && req.body.credentials) {
      const { provider_type, credentials, config } = req.body;
      
      // Crear gestor de almacenamiento con credenciales proporcionadas
      const { createStorageManager } = require('@/utils/cloud/storage-manager');
      const storageManager = createStorageManager(provider_type, credentials, config || {});
      
      // Probar conexión
      const result = await storageManager.testConnection();
      
      return res.status(result.success ? 200 : 400).json(result);
    }
    else {
      return res.status(400).json({
        success: false,
        message: 'Se requiere provider_id o (provider_type + credentials)'
      });
    }
  } catch (error) {
    console.error('Error probando conexión a nube:', error);
    return res.status(500).json({
      success: false,
      message: `Error probando conexión: ${error.message}`,
      error: error.stack
    });
  }
}