import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    // Ruta al archivo ZIP
    const zipFilePath = path.join(process.cwd(), 'sage-cloud-backups.zip');
    
    // Verificar si el archivo existe
    if (!fs.existsSync(zipFilePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    // Obtener el tamaño del archivo
    const stat = fs.statSync(zipFilePath);
    
    // Configurar headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=sage-cloud-backups.zip');
    res.setHeader('Content-Length', stat.size);
    
    // Enviar el archivo
    const fileStream = fs.createReadStream(zipFilePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error al descargar el archivo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}