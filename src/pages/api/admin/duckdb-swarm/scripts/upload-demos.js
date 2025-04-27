/**
 * Endpoint para la carga de archivos de demostración para DuckDB
 * Este endpoint permite subir un archivo ZIP con demos y ejemplos para los servidores DuckDB
 */
import fs from 'fs';
import path from 'path';
import formidable from 'formidable';

// Configuración para formidable (no guardar en '/tmp')
export const config = {
  api: {
    bodyParser: false,
  },
};

// Directorio para guardar los archivos de demos
const DEMOS_DIR = path.join(process.cwd(), 'deploy_scripts', 'duckdb_systemd', 'demo_files');

// Asegurarse de que el directorio existe
const ensureDirectoryExists = () => {
  if (!fs.existsSync(DEMOS_DIR)) {
    fs.mkdirSync(DEMOS_DIR, { recursive: true });
  }
};

export default async function handler(req, res) {
  // Solo permitimos POST para subir archivos
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Método ${req.method} no permitido` });
  }

  try {
    // Asegurarse de que el directorio existe
    ensureDirectoryExists();

    // Configurar formidable para la carga de archivos
    const form = new formidable.IncomingForm({
      uploadDir: DEMOS_DIR,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
    });

    // Procesar la carga de archivos
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error al procesar el archivo:', err);
        return res.status(500).json({ error: `Error al procesar el archivo: ${err.message}` });
      }

      // Verificar que se subió un archivo
      if (!files.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }

      const file = files.file[0] || files.file;  // Compatibilidad con diferentes versiones de formidable
      
      // Verificar que el archivo es un ZIP
      if (!file.originalFilename.endsWith('.zip')) {
        // Eliminar el archivo si no es un ZIP
        try {
          fs.unlinkSync(file.filepath);
        } catch (unlinkErr) {
          console.error('Error al eliminar archivo no válido:', unlinkErr);
        }
        
        return res.status(400).json({ error: 'El archivo debe ser un ZIP' });
      }

      // Renombrar el archivo a un nombre estándar
      const targetPath = path.join(DEMOS_DIR, 'demos.zip');
      
      try {
        // Si ya existe un archivo, eliminarlo
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
        
        // Renombrar el archivo subido
        fs.renameSync(file.filepath, targetPath);
        
        return res.status(200).json({
          success: true,
          message: 'Archivo de demos subido correctamente',
          filename: 'demos.zip'
        });
      } catch (fsError) {
        console.error('Error al mover el archivo:', fsError);
        return res.status(500).json({ error: `Error al mover el archivo: ${fsError.message}` });
      }
    });
  } catch (error) {
    console.error('Error al subir archivo de demos:', error);
    return res.status(500).json({ error: `Error al subir archivo de demos: ${error.message}` });
  }
}