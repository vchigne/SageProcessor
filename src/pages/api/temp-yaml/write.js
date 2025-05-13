import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Crear el directorio temporal si no existe
const tempDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Obtener el contenido YAML del cuerpo de la petición
    const { yaml_content } = req.body;
    
    if (!yaml_content) {
      return res.status(400).json({ error: 'No se proporcionó contenido YAML' });
    }
    
    // Generar un nombre único para el archivo
    const filename = `yaml_${uuidv4()}.yaml`;
    const filePath = path.join(tempDir, filename);
    
    // Escribir el contenido en el archivo
    fs.writeFileSync(filePath, yaml_content);
    
    // Responder con el nombre del archivo
    return res.status(200).json({ 
      filename, 
      success: true,
      message: 'Archivo YAML creado correctamente'
    });
  } catch (error) {
    console.error('Error al escribir archivo YAML temporal:', error);
    return res.status(500).json({ 
      error: 'Error al crear archivo YAML temporal',
      details: error.message
    });
  }
}