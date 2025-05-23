import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Configurar formidable para mantener la extensión original
    const form = formidable({
      keepExtensions: true,
      filename: (name, ext) => `${Date.now()}${ext}`
    });

    const [fields, files] = await form.parse(req);

    const inputFile = files.file?.[0];
    const instructions = fields.instructions?.[0] || '';

    if (!inputFile) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    // Crear directorio temporal para archivos
    const tmpDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    // Guardar instrucciones en archivo temporal
    const instructionsPath = path.join(tmpDir, `instructions_${Date.now()}.txt`);
    await fs.writeFile(instructionsPath, instructions);

    // Generar nombre único para el archivo prompt de salida
    const outputPath = path.join(tmpDir, `prompt_${Date.now()}.txt`);

    // Construir el comando con las rutas exactas para generar sólo el prompt
    const command = `python3 -m sage.yaml_studio_cli generate-prompt "${inputFile.filepath}" "${outputPath}" --instructions "${instructionsPath}" --original-filename "${inputFile.originalFilename}"`;
    console.log('Executing command:', command);
    console.log('Input file details:', {
      originalFilename: inputFile.originalFilename,
      filepath: inputFile.filepath,
      mimetype: inputFile.mimetype
    });

    const { stdout, stderr } = await execAsync(command);
    console.log('Command output:', stdout);
    if (stderr) console.error('Command stderr:', stderr);

    // Leer el prompt generado
    const promptContent = await fs.readFile(outputPath, 'utf-8');

    // Limpiar archivos temporales
    await Promise.all([
      fs.unlink(instructionsPath).catch(() => {}),
      fs.unlink(outputPath).catch(() => {})
    ]);

    res.status(200).json({ prompt: promptContent });
  } catch (error: any) {
    console.error('Error generando prompt:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}