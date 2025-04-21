import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { getCloudFileAccessor, parseCloudUri } from '@/utils/cloud/file-accessor';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * API para obtener el contenido de un archivo en la nube
 * 
 * Endpoint: /api/cloud-files/content
 * Método: GET
 * Query params:
 * - path: cloud://provider/path/to/file
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

    // Crear un directorio temporal para descargar el archivo
    const tempDir = path.join(os.tmpdir(), 'sage-cloud-temp', uuidv4());
    fs.mkdirSync(tempDir, { recursive: true });

    // Determinar la ruta del archivo en la nube
    const fileName = path.basename(parsedUri.path);
    const fileDir = path.dirname(parsedUri.path);
    
    // Generar ruta temporal local
    const tempFilePath = path.join(tempDir, fileName);

    // Descargar el archivo
    console.log(`Descargando ${fileName} desde ${fileDir} a ${tempFilePath}`);
    
    try {
      await fileAccessor.downloadFile(provider, fileDir, fileName, tempFilePath);
    } catch (downloadError) {
      console.error('Error descargando archivo:', downloadError);
      return res.status(500).json({ 
        message: 'Error al descargar archivo desde la nube', 
        error: downloadError.message 
      });
    }

    if (!fs.existsSync(tempFilePath)) {
      return res.status(404).json({ message: 'No se pudo descargar el archivo desde la nube' });
    }

    // Determinar el tipo de contenido basado en la extensión
    const ext = path.extname(fileName).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.html':
      case '.htm':
        contentType = 'text/html';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.js':
        contentType = 'application/javascript';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.xml':
        contentType = 'application/xml';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.zip':
        contentType = 'application/zip';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.csv':
        contentType = 'text/csv';
        break;
      case '.txt':
      case '.log':
        contentType = 'text/plain';
        break;
      case '.yaml':
      case '.yml':
        contentType = 'application/x-yaml';
        break;
    }

    // Establecer encabezados de respuesta
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

    // Leer y enviar el archivo
    const fileStream = fs.createReadStream(tempFilePath);
    
    // Configurar limpieza de archivos temporales
    fileStream.on('end', () => {
      try {
        fs.unlinkSync(tempFilePath);
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (cleanupError) {
        console.error('Error limpiando archivos temporales:', cleanupError);
      }
    });

    // Enviar el archivo como respuesta
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error al obtener archivo desde la nube:', error);
    return res.status(500).json({ 
      message: 'Error al obtener archivo desde la nube', 
      error: error.message 
    });
  }
}