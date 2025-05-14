import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { yaml_content } = req.body;

    if (!yaml_content) {
      return res.status(400).json({ error: 'Missing YAML content' });
    }

    // Crear un directorio temporal para el archivo YAML
    const tempDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tempDir, { recursive: true });

    const tempFile = path.join(tempDir, `${uuidv4()}.yaml`);
    console.log('Escribiendo YAML temporal en:', tempFile);
    await fs.writeFile(tempFile, yaml_content);

    const validationResult = await new Promise<ValidationResult>((resolve) => {
      console.log('Ejecutando validador SAGE...');
      const validator = spawn('python3', ['-m', 'sage.validate_yaml', tempFile], {
        env: { 
          ...process.env, 
          PYTHONPATH: process.cwd()
        }
      });

      let output = '';
      let error = '';

      validator.stdout.on('data', (data) => {
        const dataStr = data.toString();
        console.log('Validator stdout:', dataStr);
        output += dataStr;
      });

      validator.stderr.on('data', (data) => {
        const dataStr = data.toString();
        console.error('Validator stderr:', dataStr);
        error += dataStr;
      });

      validator.on('error', (err) => {
        console.error('Error spawning validator:', err);
        resolve({ 
          isValid: false, 
          error: `Error executing validator: ${err.message}` 
        });
      });

      validator.on('close', async (code) => {
        console.log('Validator exit code:', code);
        
        // Para depuración, no eliminamos el archivo temporal
        // await fs.unlink(tempFile).catch(console.error);

        if (code === 0) {
          resolve({ isValid: true });
        } else {
          resolve({ 
            isValid: false, 
            error: error || output || 'Error validando el archivo YAML' 
          });
        }
      });
    });

    if (!validationResult.isValid) {
      return res.status(400).json({ 
        error: 'Error de validación en el archivo YAML', 
        details: validationResult.error 
      });
    }

    res.status(200).json({ message: 'YAML is valid' });
  } catch (error: any) {
    console.error('Error validating YAML:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}