/**
 * API endpoint para listar directorios via SFTP
 * 
 * Este endpoint utiliza un script Python con paramiko para
 * conectarse a servidores SFTP y listar contenido de directorios.
 */

import { spawn } from 'child_process';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { host, port, username, auth, path: sftpPath } = req.body;
    
    // Validaciones básicas
    if (!host) {
      return res.status(400).json({ error: 'Se requiere el host del servidor SFTP' });
    }
    
    if (!username) {
      return res.status(400).json({ error: 'Se requiere el nombre de usuario para la conexión SFTP' });
    }
    
    if (!auth) {
      return res.status(400).json({ error: 'Se requiere contraseña o clave SSH para la conexión SFTP' });
    }
    
    const targetPort = port || 22;
    // Usar home "~" en lugar de raíz "/" como directorio por defecto
    const targetPath = sftpPath || '~';
    
    console.log(`[SFTP] Conectando a ${host}:${targetPort} como ${username}, path: ${targetPath}`);
    
    // Ejecutar el script Python para listar el directorio SFTP
    const scriptPath = path.resolve('./utils/sftp_lister.py');
    
    // Preparar los argumentos para el script
    const args = [
      scriptPath,
      host,
      targetPort.toString(),
      username,
    ];
    
    // Agregar autenticación (contraseña o clave SSH)
    if (auth.password) {
      args.push(auth.password);
      args.push(''); // Clave SSH vacía
    } else if (auth.privateKey) {
      args.push(''); // Contraseña vacía
      args.push(auth.privateKey);
    } else {
      return res.status(400).json({ error: 'Se requiere contraseña o clave SSH para la conexión SFTP' });
    }
    
    // Agregar el directorio a listar
    args.push(targetPath);
    
    // Ejecutar el script
    const pythonProcess = spawn('python', args);
    
    let dataString = '';
    let errorString = '';
    
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
      console.error(`[SFTP] Error de Python: ${data.toString()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[SFTP] Script Python terminó con código ${code}`);
        console.error(`[SFTP] Error: ${errorString}`);
        return res.status(500).json({
          error: `Error al listar directorio SFTP: ${errorString || 'Error desconocido'}`,
          code
        });
      }
      
      try {
        // Parsear la salida JSON del script
        const result = JSON.parse(dataString);
        
        if (result.error) {
          return res.status(500).json({
            error: result.message || 'Error al listar directorio SFTP'
          });
        }
        
        return res.status(200).json({
          files: result.files || [],
          folders: result.folders || [],
          path: result.path,
          parentPath: result.parentPath
        });
      } catch (parseError) {
        console.error('[SFTP] Error al parsear la salida JSON:', parseError);
        console.error('[SFTP] Salida del script:', dataString);
        return res.status(500).json({
          error: `Error al parsear la respuesta: ${parseError.message}`
        });
      }
    });
    
  } catch (error) {
    console.error('[SFTP] Error en la operación:', error);
    return res.status(500).json({
      error: `Error en la operación SFTP: ${error.message}`
    });
  }
}