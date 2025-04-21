/**
 * API para verificar si un archivo existe en la nube
 */
import { parseCloudUri } from '../../../utils/cloud/file-accessor';
import { pool } from '../../../utils/db';
import { getAdapter } from '../../../utils/cloud';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { path } = req.query;
    
    if (!path) {
      return res.status(400).json({ message: 'Se requiere el parámetro path' });
    }
    
    // Analizar la URI de la nube
    const parsedUri = parseCloudUri(path);
    
    if (!parsedUri) {
      return res.status(400).json({ message: 'URI de nube inválida' });
    }
    
    // Obtener el proveedor de la base de datos
    const providerResult = await pool.query(
      'SELECT * FROM cloud_providers WHERE nombre = $1',
      [parsedUri.provider]
    );
    
    if (providerResult.rows.length === 0) {
      return res.status(404).json({ message: `Proveedor de nube ${parsedUri.provider} no encontrado` });
    }
    
    const providerData = providerResult.rows[0];
    
    // Obtener el adaptador para el tipo de proveedor
    const adapter = getAdapter(providerData.tipo);
    
    if (!adapter) {
      return res.status(500).json({ message: `Adaptador no encontrado para el tipo: ${providerData.tipo}` });
    }
    
    try {
      // Verificar si el archivo existe
      const exists = await adapter.fileExists(
        JSON.parse(providerData.config),
        JSON.parse(providerData.credentials),
        parsedUri.path
      );
      
      return res.status(200).json({ exists });
    } catch (error) {
      // Si hay un error verificando, asumimos que no existe
      return res.status(200).json({ exists: false });
    }
  } catch (error) {
    console.error('Error en API cloud-files/exists:', error);
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
}