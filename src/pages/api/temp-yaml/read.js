import fs from 'fs';
import path from 'path';

// Ruta al directorio temporal
const tempDir = path.join(process.cwd(), 'tmp');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { filename } = req.query;
    
    if (!filename) {
      return res.status(400).json({ error: 'No se proporcionó nombre de archivo' });
    }
    
    // Validar que el nombre del archivo sea seguro (evitar path traversal)
    if (!/^[a-zA-Z0-9_\-.]+\.yaml$/.test(filename)) {
      return res.status(400).json({ error: 'Nombre de archivo no válido' });
    }
    
    const filePath = path.join(tempDir, filename);
    
    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    // Leer el contenido del archivo
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Devolver el contenido
    return res.status(200).json({ 
      filename,
      content,
      success: true
    });
  } catch (error) {
    console.error('Error al leer archivo YAML temporal:', error);
    return res.status(500).json({ 
      error: 'Error al leer archivo YAML temporal',
      details: error.message
    });
  }
}