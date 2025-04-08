import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uuid } = req.query;

    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ error: 'UUID inválido' });
    }

    // Construir la ruta al directorio de ejecución
    const execPath = path.join(process.cwd(), 'executions', uuid);
    const logPath = path.join(execPath, 'output.log');

    // Verificar que el archivo existe
    try {
      await fs.access(logPath);
    } catch {
      return res.status(404).json({ error: 'Log no encontrado' });
    }

    // Leer el contenido del log
    const logContent = await fs.readFile(logPath, 'utf-8');

    // Enviar una página HTML con el contenido formateado
    res.setHeader('Content-Type', 'text/html');
    res.send(logContent);
  } catch (error: any) {
    console.error('Error reading log:', error);
    res.status(500).json({ error: 'Error al leer el log' });
  }
}