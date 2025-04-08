import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { uuid, tipo } = req.query;

    if (!uuid) {
      return res.status(400).json({ message: 'Se requiere el UUID de la ejecución' });
    }

    if (!['log', 'yaml', 'datos'].includes(String(tipo))) {
      return res.status(400).json({ message: 'Tipo de archivo no válido' });
    }

    // Obtenemos información de la ejecución desde la base de datos
    const result = await pool.query(
      'SELECT uuid, nombre_yaml, archivo_datos, ruta_directorio FROM ejecuciones_yaml WHERE uuid = $1',
      [uuid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ejecución no encontrada' });
    }

    const ejecucion = result.rows[0];
    
    // Usar el directorio almacenado en la base de datos si existe, sino construir la ruta por defecto
    let execDir;
    if (ejecucion.ruta_directorio) {
      execDir = ejecucion.ruta_directorio;
    } else {
      execDir = path.join(process.cwd(), 'executions', String(uuid));
    }
    
    console.log('Directorio de ejecución para archivo:', execDir);
    
    // Si el directorio no existe, retornamos un error
    if (!fs.existsSync(execDir)) {
      return res.status(404).json({ message: 'Archivos de ejecución no encontrados' });
    }

    let filePath: string;
    let contentType: string;
    let fileName: string;

    switch (String(tipo)) {
      case 'log':
        filePath = path.join(execDir, 'output.log');
        contentType = 'text/html';
        fileName = `ejecucion_${uuid}_log.html`;
        break;
      case 'yaml':
        filePath = path.join(execDir, ejecucion.nombre_yaml || 'input.yaml');
        contentType = 'application/x-yaml';
        fileName = `ejecucion_${uuid}_${ejecucion.nombre_yaml || 'input.yaml'}`;
        break;
      case 'datos':
        filePath = path.join(execDir, ejecucion.archivo_datos || '');
        // Intentamos determinar el tipo de contenido basado en la extensión
        const ext = path.extname(ejecucion.archivo_datos || '').toLowerCase();
        switch (ext) {
          case '.csv':
            contentType = 'text/csv';
            break;
          case '.json':
            contentType = 'application/json';
            break;
          case '.xml':
            contentType = 'application/xml';
            break;
          case '.zip':
            contentType = 'application/zip';
            break;
          default:
            contentType = 'application/octet-stream';
        }
        fileName = `ejecucion_${uuid}_${ejecucion.archivo_datos || 'datos'}`;
        break;
      default:
        return res.status(400).json({ message: 'Tipo de archivo no válido' });
    }

    // Verificamos si el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: `Archivo ${tipo} no encontrado` });
    }

    // Configuramos la respuesta para servir el archivo
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
    // Leemos y enviamos el archivo
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error al obtener archivo de ejecución:', error);
    return res.status(500).json({ message: 'Error al obtener archivo de ejecución', error: error.message });
  }
}