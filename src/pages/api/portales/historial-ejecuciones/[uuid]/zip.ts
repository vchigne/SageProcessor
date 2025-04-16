import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import * as yazl from 'yazl';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { uuid } = req.query;
  if (!uuid || Array.isArray(uuid)) {
    return res.status(400).json({ message: 'UUID inválido' });
  }

  try {
    // Verificar que la ejecución existe
    const ejecucionResult = await pool.query(
      'SELECT * FROM ejecuciones_yaml WHERE uuid = $1',
      [uuid]
    );

    if (ejecucionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ejecución no encontrada' });
    }

    const ejecucion = ejecucionResult.rows[0];
    
    // Usar el directorio almacenado en la base de datos si existe, sino construir la ruta por defecto
    let execDir;
    if (ejecucion.ruta_directorio) {
      execDir = ejecucion.ruta_directorio;
    } else {
      execDir = path.join(process.cwd(), 'executions', uuid);
    }

    console.log('Directorio de ejecución:', execDir);

    // Verificar si el directorio existe
    if (!fs.existsSync(execDir)) {
      return res.status(404).json({
        message: 'Directorio de ejecución no encontrado',
        error: 'No se pudo encontrar el directorio de archivos para esta ejecución.',
        details: 'Es posible que los archivos hayan sido eliminados o movidos a un almacenamiento en la nube.',
        tipo: 'directorio_no_encontrado',
        solucion: 'Si la ejecución fue migrada a la nube, contacte al administrador para activar la descarga desde la nube.'
      });
    }

    // Crear un nuevo archivo ZIP
    const zipfile = new yazl.ZipFile();
    
    // Leer todos los archivos en el directorio
    const files = fs.readdirSync(execDir);
    
    // Agregar cada archivo al ZIP
    files.forEach(file => {
      const filePath = path.join(execDir, file);
      // Solo agregar archivos, no directorios
      if (fs.statSync(filePath).isFile()) {
        zipfile.addFile(filePath, file);
      }
    });

    // Finalizar el ZIP
    zipfile.end();

    // Configurar los headers de la respuesta
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="ejecucion-${uuid}.zip"`);

    // Enviar el ZIP como respuesta
    zipfile.outputStream.pipe(res);
  } catch (error) {
    console.error('Error al crear archivo ZIP:', error);
    return res.status(500).json({ message: 'Error al crear archivo ZIP', error: error.message });
  }
}