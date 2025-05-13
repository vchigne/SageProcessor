import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Crear los directorios necesarios si no existen
const tempDir = path.join(process.cwd(), 'tmp');
const backupDir = path.join(process.cwd(), 'yaml_backups');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Obtener el contenido YAML del cuerpo de la petición
    const { yaml_content, backup_name } = req.body;
    
    if (!yaml_content) {
      return res.status(400).json({ error: 'No se proporcionó contenido YAML' });
    }
    
    // Determinar si estamos creando un backup o un archivo temporal normal
    if (backup_name) {
      // Modo backup - guardar con nombre específico en directorio de backups
      const filename = backup_name.includes('.yaml') ? backup_name : `${backup_name}.yaml`;
      const backupPath = path.join(backupDir, filename);
      
      // Comprobar que el nombre del archivo es seguro
      if (filename.includes('..') || !filename.match(/^[a-zA-Z0-9_\-\.]+\.yaml$/)) {
        return res.status(400).json({ error: 'Nombre de archivo no válido para backup' });
      }
      
      // Escribir el contenido en el archivo de backup
      fs.writeFileSync(backupPath, yaml_content);
      
      return res.status(200).json({
        filename,
        path: backupPath,
        is_backup: true,
        success: true,
        message: 'Backup de YAML creado correctamente'
      });
    } else {
      // Modo normal - generar nombre único y guardar en directorio temporal
      const filename = `yaml_${uuidv4()}.yaml`;
      const filePath = path.join(tempDir, filename);
      
      // Escribir el contenido en el archivo temporal
      fs.writeFileSync(filePath, yaml_content);
      
      // Responder con el nombre del archivo
      return res.status(200).json({ 
        filename, 
        path: filePath,
        is_backup: false,
        success: true,
        message: 'Archivo YAML temporal creado correctamente'
      });
    }
  } catch (error) {
    console.error('Error al escribir archivo YAML:', error);
    return res.status(500).json({ 
      error: 'Error al crear archivo YAML',
      details: error.message
    });
  }
}