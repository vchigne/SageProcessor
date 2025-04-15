import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Ruta a la especificación YAML
  const specPath = path.join(process.cwd(), 'docs', 'YAML_SPEC.md');
  
  try {
    // Manejo según método HTTP
    if (req.method === 'GET') {
      // Leer el contenido del archivo
      if (!fs.existsSync(specPath)) {
        return res.status(404).json({ error: 'Archivo de especificación YAML no encontrado' });
      }
      
      const content = fs.readFileSync(specPath, 'utf8');
      return res.status(200).json({ content });
    } 
    else if (req.method === 'PUT') {
      // Actualizar el contenido del archivo
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'No se proporcionó contenido para actualizar' });
      }
      
      // Verificar directorio
      const dirPath = path.dirname(specPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Guardar archivo con backup
      if (fs.existsSync(specPath)) {
        const backupPath = `${specPath}.backup.${Date.now()}`;
        fs.copyFileSync(specPath, backupPath);
      }
      
      fs.writeFileSync(specPath, content, 'utf8');
      return res.status(200).json({ success: true, message: 'Especificación YAML actualizada correctamente' });
    } 
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en el manejador de especificación YAML:', error);
    return res.status(500).json({ error: 'Error al procesar la solicitud', details: error.message });
  }
}