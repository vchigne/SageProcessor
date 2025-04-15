import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';

// Configuración de la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uuid } = req.query;

    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ error: 'UUID inválido' });
    }

    // Consultar la ruta correcta desde la base de datos
    // Ahora buscamos tanto por UUID exacto como por UUID en la ruta_directorio
    const dbResult = await pool.query(
      `
      SELECT ruta_directorio FROM ejecuciones_yaml 
      WHERE uuid = $1 
      OR ruta_directorio LIKE $2 
      ORDER BY fecha_ejecucion DESC 
      LIMIT 1
      `,
      [uuid, `%${uuid}%`]
    );

    if (dbResult.rows.length === 0) {
      console.error(`No se encontró ejecución con UUID: ${uuid}`);
      return res.status(404).json({ error: 'Ejecución no encontrada' });
    }

    // Obtener la ruta desde la base de datos
    const { ruta_directorio } = dbResult.rows[0];
    
    // Preparamos la ruta dependiendo de cómo está almacenada
    let execPath;
    if (ruta_directorio.startsWith('/home/runner/workspace/')) {
      // Si ya es una ruta absoluta completa, la usamos directamente
      execPath = ruta_directorio;
    } else {
      // Si es una ruta relativa, la convertimos a absoluta
      execPath = path.join('/home/runner/workspace', ruta_directorio);
    }
    
    // Construir la ruta completa al archivo de log
    const logPath = path.join(execPath, 'output.log');
    console.log(`Ruta original en BD: ${ruta_directorio}`);
    
    console.log(`Buscando log en: ${logPath}`);

    // Verificar que el archivo existe
    try {
      await fs.access(logPath);
    } catch (accessError) {
      console.error(`Error al acceder al log: ${accessError}. Ruta: ${logPath}`);
      return res.status(404).json({ error: 'Log no encontrado' });
    }

    // Leer el contenido del log
    const logContent = await fs.readFile(logPath, 'utf-8');

    // Convertir el contenido del log a HTML formateado
    const formattedContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Log de Ejecución</title>
          <style>
            body { font-family: monospace; padding: 20px; line-height: 1.5; }
            .success { color: green; }
            .error { color: red; }
            .warning { color: orange; }
            .info { color: blue; }
          </style>
        </head>
        <body>
          <pre>${logContent
            .replace(/SUCCESS/g, '<span class="success">SUCCESS</span>')
            .replace(/ERROR/g, '<span class="error">ERROR</span>')
            .replace(/WARNING/g, '<span class="warning">WARNING</span>')
            .replace(/MESSAGE/g, '<span class="info">MESSAGE</span>')
          }</pre>
        </body>
      </html>
    `;

    // Enviar una página HTML con el contenido formateado
    res.setHeader('Content-Type', 'text/html');
    res.send(formattedContent);
  } catch (error: any) {
    console.error('Error reading log:', error);
    res.status(500).json({ error: 'Error al leer el log: ' + error.message });
  }
}