/**
 * Endpoint para inspeccionar el contenido de un proveedor de nube
 * 
 * Este endpoint permite listar archivos y carpetas de un proveedor de nube
 * con un nivel de detalle mayor que el listado básico, incluyendo mejor
 * organización y metadatos.
 */

import { getCloudProvider, getCloudAdapter } from '../../../../utils/cloud';

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    // Validar que tenemos un ID válido
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de proveedor inválido' });
    }
    
    // Obtener datos del body
    const { path = '' } = req.body;
    
    // Obtener el proveedor
    const provider = await getCloudProvider(parseInt(id));
    
    if (!provider) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    
    // Cargar el adaptador específico para este tipo de proveedor
    const adapter = await getCloudAdapter(provider.tipo);
    
    if (!adapter || !adapter.listContents) {
      return res.status(400).json({ 
        error: `El adaptador para ${provider.tipo} no soporta la función de inspección` 
      });
    }
    
    // Ejecutar la función de listado de contenido
    const contents = await adapter.listContents(
      provider.credenciales,
      provider.configuracion,
      path
    );
    
    return res.status(200).json(contents);
  } catch (error) {
    console.error('Error al inspeccionar proveedor:', error);
    return res.status(500).json({ 
      error: 'Error al inspeccionar proveedor',
      message: error.message
    });
  }
}