/**
 * API para obtener el contenido de archivos en la nube
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
      // Obtener el contenido del archivo
      const content = await adapter.getFileContent(
        JSON.parse(providerData.config),
        JSON.parse(providerData.credentials),
        parsedUri.path
      );
      
      // Determinar si debemos enviar como texto o binario
      if (content instanceof Buffer) {
        // Enviar como datos binarios
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.send(content);
      } else {
        // Enviar como texto
        return res.status(200).json({ content });
      }
    } catch (error) {
      console.error('Error obteniendo archivo:', error);
      return res.status(404).json({ message: `No se pudo obtener el archivo: ${error.message}` });
    }
  } catch (error) {
    console.error('Error en API cloud-files/content:', error);
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  }
}