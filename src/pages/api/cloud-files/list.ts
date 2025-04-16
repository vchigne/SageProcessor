import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import { getCloudFileAccessor, parseCloudUri } from '@/utils/cloud/file-accessor';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * API para listar archivos en un directorio en la nube
 * 
 * Endpoint: /api/cloud-files/list
 * Método: GET
 * Query params:
 * - path: cloud://provider/path/to/directory
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { path: cloudPath } = req.query;

    if (!cloudPath || typeof cloudPath !== 'string' || !cloudPath.startsWith('cloud://')) {
      return res.status(400).json({ message: 'Se requiere una ruta de nube válida (cloud://provider/path)' });
    }

    // Analizar la URI de la nube
    const parsedUri = parseCloudUri(cloudPath);
    if (!parsedUri) {
      return res.status(400).json({ message: 'URI de nube no válida' });
    }

    // Obtener información del proveedor de la nube
    const providerResult = await pool.query(
      `SELECT id, nombre, tipo, descripcion, configuracion, credenciales 
       FROM cloud_providers 
       WHERE activo = true AND LOWER(nombre) = LOWER($1)`,
      [parsedUri.provider]
    );

    if (providerResult.rows.length === 0) {
      return res.status(404).json({ message: `Proveedor de nube no encontrado: ${parsedUri.provider}` });
    }

    const provider = providerResult.rows[0];

    // Asegurarse de que las credenciales y configuración son objetos
    if (typeof provider.credenciales === 'string') {
      provider.credenciales = JSON.parse(provider.credenciales);
    }
    if (typeof provider.configuracion === 'string') {
      provider.configuracion = JSON.parse(provider.configuracion);
    }

    // Obtener el adaptador para el tipo de nube
    const fileAccessor = getCloudFileAccessor(provider.tipo);
    if (!fileAccessor) {
      return res.status(500).json({ message: `Tipo de nube no soportado: ${provider.tipo}` });
    }

    // Usar el método correspondiente para listar archivos
    if (!fileAccessor.listFiles) {
      return res.status(501).json({ message: `El tipo de nube ${provider.tipo} no implementa listado de archivos` });
    }

    // Llamar al método para listar archivos
    try {
      // Crear un cliente para el adaptador
      const client = await fileAccessor.createClient(provider.credenciales, provider.configuracion);
      
      // Listar archivos en el directorio
      const files = await fileAccessor.listFiles(client, parsedUri.path);
      
      // Transformar la respuesta para un formato consistente
      const result = files.map(file => ({
        name: file.Key ? file.Key.split('/').pop() : file.name,
        path: file.Key || file.path || file.name,
        isDirectory: file.isDirectory || false,
        size: file.Size || file.size || 0,
        modified: file.LastModified || file.modified || new Date()
      }));
      
      // Responder con la lista de archivos
      res.status(200).json(result);
    } catch (listError) {
      console.error(`Error listando archivos en ${cloudPath}:`, listError);
      return res.status(500).json({ 
        message: 'Error al listar archivos en la nube', 
        error: listError.message 
      });
    }
  } catch (error) {
    console.error('Error al listar archivos en la nube:', error);
    return res.status(500).json({ 
      message: 'Error al listar archivos en la nube', 
      error: error.message 
    });
  }
}