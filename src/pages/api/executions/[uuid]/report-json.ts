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
    // Buscamos tanto por UUID exacto como por UUID en la ruta_directorio
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
    
    // Construir la ruta completa al archivo de reporte JSON
    const reportPath = path.join(execPath, 'report.json');
    console.log(`Ruta original en BD: ${ruta_directorio}`);
    console.log(`Buscando reporte JSON en: ${reportPath}`);

    // Verificar que el archivo existe
    try {
      await fs.access(reportPath);
    } catch (accessError) {
      console.error(`Error al acceder al reporte JSON: ${accessError}. Ruta: ${reportPath}`);
      return res.status(404).json({ error: 'Reporte JSON no encontrado' });
    }

    // Leer el contenido del reporte JSON
    const reportContent = await fs.readFile(reportPath, 'utf-8');

    try {
      // Intentar parsear el JSON para validar que es correcto
      const jsonData = JSON.parse(reportContent);
      
      // Configurar encabezados para descarga (opcional, el navegador preguntará si descargar)
      res.setHeader('Content-Disposition', `attachment; filename="report-${uuid}.json"`);
      res.setHeader('Content-Type', 'application/json');
      
      // Enviar el contenido JSON
      res.send(reportContent);
    } catch (jsonError) {
      console.error('Error parsing JSON report:', jsonError);
      return res.status(500).json({ error: 'El archivo de reporte no contiene JSON válido' });
    }
  } catch (error: any) {
    console.error('Error reading JSON report:', error);
    res.status(500).json({ error: 'Error al leer el reporte JSON: ' + error.message });
  }
}