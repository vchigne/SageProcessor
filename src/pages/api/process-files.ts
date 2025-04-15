import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { Pool } from 'pg';

export const config = {
  api: {
    bodyParser: false,
  },
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const processFile = (
  filePath: string, 
  yamlPath: string, 
  casilla_id?: number, 
  emisor_id?: number
): Promise<{ 
  execution_uuid: string; 
  errors: number; 
  warnings: number; 
  log_url: string;
  report_html_url: string;
  report_json_url: string;
}> => {
  return new Promise((resolve, reject) => {
    const args = ['-m', 'sage.main', yamlPath, filePath];
    
    // Agregar parámetros opcionales si están presentes
    if (casilla_id) {
      args.push('--casilla-id', casilla_id.toString());
    }
    
    if (emisor_id) {
      args.push('--emisor-id', emisor_id.toString());
    }
    
    // Indicar que el método de envío es portal_upload
    args.push('--metodo-envio', 'portal_upload');
    
    const pythonProcess = spawn('python3', args, {
      env: { 
        ...process.env,
        PYTHONPATH: process.cwd()
      }
    });

    let output = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log('Process stdout:', dataStr);
      output += dataStr;
    });

    pythonProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      console.error('Process stderr:', dataStr);
      error += dataStr;
    });

    pythonProcess.on('close', (code) => {
      // SAGE puede retornar código 1 cuando encuentra errores de validación
      // pero eso no significa que el proceso haya fallado
      if (code === 0 || code === 1) {
        const uuidMatch = output.match(/Execution UUID: ([a-f0-9-]+)/);
        const errorsMatch = output.match(/Total errors: (\d+)/);
        const warningsMatch = output.match(/Total warnings: (\d+)/);

        if (uuidMatch && errorsMatch && warningsMatch) {
          const executionUuid = uuidMatch[1];
          resolve({
            execution_uuid: executionUuid,
            errors: parseInt(errorsMatch[1]),
            warnings: parseInt(warningsMatch[1]),
            log_url: `/api/executions/${executionUuid}/log`,
            report_html_url: `/api/executions/${executionUuid}/report-html`,
            report_json_url: `/api/executions/${executionUuid}/report-json`
          });
        } else {
          // Si no podemos extraer la información necesaria, es un error real
          reject(new Error('Could not parse SAGE output'));
        }
      } else {
        // Solo rechazar si el código de salida indica un error real
        reject(new Error(error || 'Error processing file'));
      }
    });
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      keepExtensions: true
    });

    const [fields, files] = await form.parse(req);

    const instalacionId = fields.instalacion_id?.[0];
    const casillaId = fields.casilla_id?.[0];
    const yamlNombre = fields.yaml_nombre?.[0];
    const emisorId = fields.emisor_id?.[0]; // Nuevo: Obtener emisor_id de los campos
    const file = files.file?.[0];

    if (!casillaId || !file) {
      return res.status(400).json({ error: 'Missing required fields: se requiere casilla_id y archivo' });
    }

    console.log('Procesando archivo para casilla_id:', casillaId);

    // Obtener el YAML asociado a la casilla
    const client = await pool.connect();
    let yamlPath = '';
    
    try {
      // Obtener el contenido YAML directamente de la casilla
      const query = 'SELECT id as casilla_id, nombre_yaml, yaml_contenido FROM casillas WHERE id = $1 AND yaml_contenido IS NOT NULL';
      const queryParams = [casillaId];
      console.log('Ejecutando consulta:', query, 'con parámetros:', queryParams);
      
      const result = await client.query(query, queryParams);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: `No se encontró configuración YAML para la casilla ID: ${casillaId}` });
      }

      const yamlContent = result.rows[0].yaml_contenido;
      yamlPath = path.join(process.cwd(), 'tmp', `${Date.now()}.yaml`);

      // Escribir el YAML temporalmente
      await fs.mkdir(path.join(process.cwd(), 'tmp'), { recursive: true });
      await fs.writeFile(yamlPath, yamlContent);

      // Procesar el archivo con SAGE
      const casilla_id = result.rows[0].casilla_id;
      
      let processingResult;
      
      // Si tenemos un emisor_id, lo usamos. De lo contrario, solo usamos la casilla
      if (emisorId) {
        console.log('Procesando archivo para casilla_id:', casilla_id, 'con emisor_id:', emisorId);
        processingResult = await processFile(file.filepath, yamlPath, casilla_id, parseInt(emisorId));
      } else {
        // Para subidas sin emisor específico
        console.log('Procesando archivo para casilla_id:', casilla_id, 'sin emisor específico (subida por portal)');
        processingResult = await processFile(file.filepath, yamlPath, casilla_id);
      }
      
      return res.status(200).json(processingResult);
    } finally {
      // Limpiar archivo temporal si existe
      if (yamlPath) {
        await fs.unlink(yamlPath).catch(console.error);
      }
      client.release();
    }
  } catch (error: any) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: error.message || 'Error processing file' });
  }
}