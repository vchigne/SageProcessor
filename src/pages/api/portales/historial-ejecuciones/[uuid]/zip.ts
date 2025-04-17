import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import * as yazl from 'yazl';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import s3Adapter from '@/utils/cloud/adapters/s3_fixed';
import azureAdapter from '@/utils/cloud/adapters/azure';
import gcpAdapter from '@/utils/cloud/adapters/gcp';
import sftpAdapter from '@/utils/cloud/adapters/sftp';
import minioAdapter from '@/utils/cloud/adapters/minio';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Configurar encabezados para descargas binarias
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { uuid } = req.query;
  if (!uuid || Array.isArray(uuid)) {
    return res.status(400).json({ message: 'UUID inválido' });
  }

  // Crear directorio temporal para los archivos del ZIP
  const tempDir = path.join(os.tmpdir(), `sage-zip-${uuidv4()}`);
  let zipfile = null;
  
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Verificar que la ejecución existe
    const ejecucionResult = await pool.query(
      'SELECT * FROM ejecuciones_yaml WHERE uuid = $1',
      [uuid]
    );

    if (ejecucionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ejecución no encontrada' });
    }

    const ejecucion = ejecucionResult.rows[0];
    
    // Obtener la ruta del directorio (local o en nube)
    let execDir = ejecucion.ruta_directorio || path.join(process.cwd(), 'executions', uuid);
    console.log('Directorio de ejecución:', execDir);

    // Preparar archivo ZIP
    zipfile = new yazl.ZipFile();
    
    // Crear archivo readme.txt con información de la ejecución
    const readmePath = path.join(tempDir, 'readme.txt');
    const readmeContent = `Ejecución: ${uuid}
Fecha: ${ejecucion.fecha_ejecucion}
Nombre YAML: ${ejecucion.nombre_yaml}
Estado: ${ejecucion.estado}
Archivo Datos: ${ejecucion.archivo_datos || 'No especificado'}
    
Archivos comunes:
- output.log: Registro de la ejecución
- input.yaml: Configuración YAML utilizada
- data.*: Archivo de datos procesado
`;
    fs.writeFileSync(readmePath, readmeContent);
    zipfile.addFile(readmePath, 'readme.txt');

    // Verificar si es una ruta en la nube
    if (execDir && execDir.startsWith('cloud://')) {
      // Extraer proveedor y ruta
      const cloudParts = execDir.substring(8).split('/');
      const providerName = cloudParts[0];
      const cloudPath = '/' + cloudParts.slice(1).join('/');
      
      console.log(`Descargando archivos desde nube: ${providerName}, ruta: ${cloudPath}`);
      
      // Obtener información del proveedor
      const providerResult = await pool.query(
        'SELECT id, nombre, tipo, descripcion, configuracion, credenciales FROM cloud_providers WHERE nombre = $1',
        [providerName]
      );
      
      if (providerResult.rows.length === 0) {
        throw new Error(`Proveedor de nube "${providerName}" no encontrado`);
      }
      
      const provider = providerResult.rows[0];
      
      // Preparar credenciales y configuración
      let credentials = provider.credenciales;
      let config = provider.configuracion;
      
      if (typeof credentials === 'string') credentials = JSON.parse(credentials);
      if (typeof config === 'string') config = JSON.parse(config);
      
      const tipo = provider.tipo.toLowerCase();
      
      // Archivos esenciales a descargar (siempre intentamos estos)
      const archivosEsenciales = [
        'output.log', 
        'input.yaml'
      ];
      
      // Agregar el archivo de datos si se conoce
      if (ejecucion.archivo_datos) {
        archivosEsenciales.push(ejecucion.archivo_datos);
      } else {
        // Intentar varios formatos comunes
        ['data.csv', 'data.txt', 'data.xlsx', 'data'].forEach(formato => 
          archivosEsenciales.push(formato)
        );
      }
      
      // Descargar todos los archivos esenciales
      for (const archivo of archivosEsenciales) {
        const rutaArchivo = `${cloudPath}/${archivo}`.replace(/\/+/g, '/');
        const rutaLocal = path.join(tempDir, archivo);
        
        try {
          console.log(`Descargando archivo: ${rutaArchivo}`);
          
          // Usar el adaptador correcto según el tipo de proveedor
          if (tipo === 's3') {
            await s3Adapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
          } else if (tipo === 'azure') {
            await azureAdapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
          } else if (tipo === 'gcp') {
            await gcpAdapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
          } else if (tipo === 'sftp') {
            await sftpAdapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
          } else if (tipo === 'minio') {
            await minioAdapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
          }
          
          // Agregar al ZIP si se descargó correctamente
          if (fs.existsSync(rutaLocal)) {
            zipfile.addFile(rutaLocal, archivo);
            console.log(`Archivo ${archivo} agregado al ZIP`);
          }
        } catch (err) {
          console.warn(`No se pudo descargar el archivo ${archivo}: ${err.message}`);
          // Continuar con el siguiente archivo aunque este falle
        }
      }
      
      // Intentar listar archivos adicionales
      try {
        let archivosAdicionales = [];
        
        if (tipo === 's3') {
          archivosAdicionales = await s3Adapter.listContents(credentials, config, cloudPath);
        } else if (tipo === 'azure') {
          archivosAdicionales = await azureAdapter.listContents(credentials, config, cloudPath);
        } else if (tipo === 'gcp') {
          archivosAdicionales = await gcpAdapter.listContents(credentials, config, cloudPath);
        } else if (tipo === 'sftp') {
          archivosAdicionales = await sftpAdapter.listContents(credentials, config, cloudPath);
        } else if (tipo === 'minio') {
          archivosAdicionales = await minioAdapter.listContents(credentials, config, cloudPath);
        }
        
        // Normalizar la estructura
        let filesArray = [];
        if (Array.isArray(archivosAdicionales)) {
          filesArray = archivosAdicionales;
        } else if (archivosAdicionales && archivosAdicionales.files) {
          filesArray = archivosAdicionales.files;
        } else if (archivosAdicionales && archivosAdicionales.Contents) {
          filesArray = archivosAdicionales.Contents.map(item => ({
            name: item.Key.split('/').pop(),
            path: item.Key
          }));
        }
        
        // Procesar archivos adicionales
        for (const file of filesArray) {
          // Extraer nombre del archivo
          const fileName = file.name || 
            (file.Key ? file.Key.split('/').pop() : null) || 
            (file.Name ? file.Name.split('/').pop() : null);
          
          // Verificar si ya tenemos este archivo en el ZIP
          if (!fileName || archivosEsenciales.includes(fileName)) {
            continue;
          }
          
          // Preparar rutas
          const rutaArchivo = (file.path && file.path.includes(cloudPath)) 
            ? file.path.replace(/\/+/g, '/') 
            : `${cloudPath}/${file.path || fileName}`.replace(/\/+/g, '/');
          const rutaLocal = path.join(tempDir, fileName);
          
          try {
            console.log(`Descargando archivo adicional: ${rutaArchivo}`);
            
            // Descargar según el tipo de proveedor
            if (tipo === 's3') {
              await s3Adapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
            } else if (tipo === 'azure') {
              await azureAdapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
            } else if (tipo === 'gcp') {
              await gcpAdapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
            } else if (tipo === 'sftp') {
              await sftpAdapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
            } else if (tipo === 'minio') {
              await minioAdapter.downloadFile(credentials, config, rutaArchivo, rutaLocal);
            }
            
            // Agregar al ZIP
            if (fs.existsSync(rutaLocal)) {
              zipfile.addFile(rutaLocal, fileName);
              console.log(`Archivo adicional ${fileName} agregado al ZIP`);
            }
          } catch (err) {
            console.warn(`No se pudo descargar el archivo adicional ${fileName}: ${err.message}`);
          }
        }
      } catch (err) {
        console.warn(`Error al listar archivos adicionales: ${err.message}`);
        // Continuamos con los archivos esenciales ya descargados
      }
      
    } else {
      // Ruta local - simplemente leer archivos del directorio
      if (!fs.existsSync(execDir)) {
        throw new Error(`Directorio no encontrado: ${execDir}`);
      }
      
      const files = fs.readdirSync(execDir);
      console.log(`Encontrados ${files.length} archivos en directorio local`);
      
      // Agregar cada archivo al ZIP
      files.forEach(file => {
        const filePath = path.join(execDir, file);
        if (fs.statSync(filePath).isFile()) {
          zipfile.addFile(filePath, file);
          console.log(`Archivo ${file} agregado al ZIP desde directorio local`);
        }
      });
    }
    
    // Finalizar el ZIP y enviar
    zipfile.end();
    
    // Configurar limpieza de temporales
    res.on('finish', () => {
      try {
        fs.readdirSync(tempDir).forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {}
        });
        fs.rmdirSync(tempDir, { recursive: true });
      } catch (e) {}
    });
    
    // Enviar el ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="ejecucion_${uuid}.zip"`);
    zipfile.outputStream.pipe(res);
    
  } catch (error) {
    console.error('Error creando ZIP:', error);
    
    try {
      // Limpiar archivos temporales
      if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {}
        });
        fs.rmdirSync(tempDir, { recursive: true });
      }
    } catch (e) {}
    
    // Enviar error al cliente
    return res.status(500).json({
      message: 'Error al crear ZIP',
      error: 'No se pudieron descargar los archivos para esta ejecución.',
      detalle: error.message
    });
  }
}