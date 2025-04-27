/**
 * Endpoint para la gestión de scripts de despliegue de DuckDB
 * Este endpoint permite cargar y actualizar los scripts utilizados para el despliegue de servidores DuckDB remotos
 */
import fs from 'fs';
import path from 'path';
import { pool } from '../../../../../utils/db';

// Directorio base donde se almacenan los scripts
const SCRIPTS_BASE_DIR = path.join(process.cwd(), 'deploy_scripts', 'duckdb_systemd');

// Rutas a los diferentes archivos de script
const SCRIPT_PATHS = {
  'install': path.join(SCRIPTS_BASE_DIR, 'install_scripts', 'install_duckdb_systemd.sh'),
  'validate': path.join(SCRIPTS_BASE_DIR, 'install_scripts', 'validate_duckdb_systemd.sh'),
  'duckdb-server': path.join(SCRIPTS_BASE_DIR, 'server_files', 'duckdb_server.py'),
  'demos': path.join(SCRIPTS_BASE_DIR, 'install_scripts', 'install_demos_duckdb_server.py')
};

// Verificar que los directorios existen
const ensureDirectoriesExist = () => {
  Object.values(SCRIPT_PATHS).forEach(scriptPath => {
    const dir = path.dirname(scriptPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Leer un script del sistema de archivos
const readScript = (scriptType) => {
  if (!SCRIPT_PATHS[scriptType]) {
    throw new Error(`Tipo de script desconocido: ${scriptType}`);
  }

  const scriptPath = SCRIPT_PATHS[scriptType];
  
  if (!fs.existsSync(scriptPath)) {
    // Si el archivo no existe, devolver una cadena vacía
    return '';
  }
  
  return fs.readFileSync(scriptPath, 'utf8');
};

// Guardar un script en el sistema de archivos
const saveScript = (scriptType, content) => {
  if (!SCRIPT_PATHS[scriptType]) {
    throw new Error(`Tipo de script desconocido: ${scriptType}`);
  }

  const scriptPath = SCRIPT_PATHS[scriptType];
  
  // Asegurarse de que el directorio existe
  const dir = path.dirname(scriptPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Guardar el archivo
  fs.writeFileSync(scriptPath, content, 'utf8');
};

// Verificar si los archivos de demostración están disponibles
const checkDemoFilesExist = () => {
  const demoFilesDir = path.join(SCRIPTS_BASE_DIR, 'demo_files');
  
  if (!fs.existsSync(demoFilesDir)) {
    return false;
  }
  
  // Verificar si hay archivos ZIP en el directorio
  const files = fs.readdirSync(demoFilesDir);
  return files.some(file => file.endsWith('.zip'));
};

export default async function handler(req, res) {
  // Asegurarse de que los directorios existen
  ensureDirectoriesExist();

  // Manejar diferentes métodos HTTP
  switch (req.method) {
    case 'GET':
      // Cargar todos los scripts
      try {
        const installScript = readScript('install');
        const validateScript = readScript('validate');
        const duckdbServerScript = readScript('duckdb-server');
        const demosScript = readScript('demos');
        const hasFiles = checkDemoFilesExist();
        
        return res.status(200).json({
          installScript,
          validateScript,
          duckdbServerScript,
          demosScript,
          hasFiles
        });
      } catch (error) {
        console.error('Error al cargar scripts:', error);
        return res.status(500).json({ error: `Error al cargar scripts: ${error.message}` });
      }
      
    case 'POST':
      // Guardar un script específico
      try {
        const { type, content } = req.body;
        
        if (!type || !SCRIPT_PATHS[type]) {
          return res.status(400).json({ error: 'Tipo de script desconocido o no especificado' });
        }
        
        if (typeof content !== 'string') {
          return res.status(400).json({ error: 'El contenido del script debe ser una cadena de texto' });
        }
        
        saveScript(type, content);
        
        // Registrar la actualización en la base de datos (opcional)
        // try {
        //   const client = await pool.connect();
        //   try {
        //     await client.query(`
        //       INSERT INTO duckdb_server_logs (
        //         log_type, log_message, created_by
        //       ) VALUES ($1, $2, $3)
        //     `, [
        //       'script_update',
        //       `Script "${type}" actualizado`,
        //       'admin'
        //     ]);
        //   } finally {
        //     client.release();
        //   }
        // } catch (dbError) {
        //   console.error('Error al registrar actualización en BD:', dbError);
        //   // No bloqueamos la respuesta por errores de BD
        // }
        
        return res.status(200).json({ success: true, message: `Script "${type}" guardado correctamente` });
      } catch (error) {
        console.error('Error al guardar script:', error);
        return res.status(500).json({ error: `Error al guardar script: ${error.message}` });
      }
      
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Método ${req.method} no permitido` });
  }
}