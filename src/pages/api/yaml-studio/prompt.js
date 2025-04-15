import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Ruta al prompt maestro
  const promptPath = path.join(process.cwd(), 'sage', 'ai_prompt_yaml_studio.frm');
  
  try {
    // Manejo según método HTTP
    if (req.method === 'GET') {
      // Leer el contenido del archivo
      if (!fs.existsSync(promptPath)) {
        return res.status(404).json({ error: 'Archivo de prompt no encontrado' });
      }
      
      const content = fs.readFileSync(promptPath, 'utf8');
      return res.status(200).json({ content });
    } 
    else if (req.method === 'PUT') {
      // Actualizar el contenido del archivo
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'No se proporcionó contenido para actualizar' });
      }
      
      // Verificar directorio
      const dirPath = path.dirname(promptPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Guardar archivo con backup
      if (fs.existsSync(promptPath)) {
        const backupPath = `${promptPath}.backup.${Date.now()}`;
        fs.copyFileSync(promptPath, backupPath);
      }
      
      fs.writeFileSync(promptPath, content, 'utf8');
      return res.status(200).json({ success: true, message: 'Prompt actualizado correctamente' });
    } 
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en el manejador de prompt:', error);
    return res.status(500).json({ error: 'Error al procesar la solicitud', details: error.message });
  }
}