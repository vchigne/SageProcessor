import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import * as yazl from 'yazl';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as fileAccessor from '@/utils/cloud/file-accessor';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { uuid } = req.query;
  if (!uuid || Array.isArray(uuid)) {
    return res.status(400).json({ message: 'UUID inválido' });
  }

  try {
    // Verificar que la ejecución existe
    const ejecucionResult = await pool.query(
      'SELECT * FROM ejecuciones_yaml WHERE uuid = $1',
      [uuid]
    );

    if (ejecucionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ejecución no encontrada' });
    }

    const ejecucion = ejecucionResult.rows[0];
    
    // Usar el directorio almacenado en la base de datos si existe, sino construir la ruta por defecto
    let execDir;
    if (ejecucion.ruta_directorio) {
      execDir = ejecucion.ruta_directorio;
    } else {
      execDir = path.join(process.cwd(), 'executions', uuid);
    }

    console.log('Directorio de ejecución:', execDir);

    // Verificar si se trata de una ruta en la nube
    const esRutaEnNube = execDir && execDir.startsWith('cloud://');
    
    if (esRutaEnNube) {
      // Manejar archivos desde la nube
      try {
        // Extraer el nombre del proveedor de la URI en formato cloud://proveedor/ruta
        const cloudParts = execDir.substring(8).split('/');
        const providerName = cloudParts[0];
        const cloudPath = '/' + cloudParts.slice(1).join('/');
        
        console.log(`Descargando archivos desde nube: ${providerName}, ruta: ${cloudPath}`);
        
        // Obtener información del proveedor por nombre
        const providerResult = await pool.query(
          'SELECT id, nombre, tipo, descripcion, configuracion, credenciales FROM cloud_providers WHERE nombre = $1',
          [providerName]
        );
        
        if (providerResult.rows.length === 0) {
          return res.status(500).json({ 
            message: 'Proveedor de nube no encontrado', 
            error: `El proveedor de nube "${providerName}" no está configurado en el sistema.`,
            tipo: 'proveedor_no_encontrado'
          });
        }
        
        const provider = providerResult.rows[0];
        
        // Asegurarse de que la configuración y credenciales son objetos
        try {
          if (typeof provider.configuracion === 'string') {
            provider.configuracion = JSON.parse(provider.configuracion);
          }
          
          if (typeof provider.credenciales === 'string') {
            provider.credenciales = JSON.parse(provider.credenciales);
          }
        } catch (parseError) {
          console.error('Error parseando configuración del proveedor:', parseError);
        }
        
        // Listar archivos en la nube
        const cloudFiles = await fileAccessor.listFiles(provider, cloudPath);
        
        if (!cloudFiles || cloudFiles.length === 0) {
          return res.status(404).json({
            message: 'No se encontraron archivos en la nube',
            error: 'No hay archivos disponibles para esta ejecución en el almacenamiento en nube.',
            tipo: 'archivos_nube_no_encontrados',
            proveedor: providerName,
            ruta: cloudPath
          });
        }
        
        // Crear directorio temporal para descargar archivos
        const tempDir = path.join(os.tmpdir(), `sage-zip-${uuidv4()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Descargar todos los archivos
        const zipfile = new yazl.ZipFile();
        
        // Descargar cada archivo y agregarlo al ZIP
        for (const file of cloudFiles) {
          const fileName = path.basename(file);
          const tempFilePath = path.join(tempDir, fileName);
          
          try {
            // Descargar el archivo de la nube
            await fileAccessor.downloadFile(provider, cloudPath, fileName, tempFilePath);
            
            if (fs.existsSync(tempFilePath)) {
              // Agregar al ZIP
              zipfile.addFile(tempFilePath, fileName);
            } else {
              console.warn(`Archivo ${fileName} no se pudo descargar correctamente`);
            }
          } catch (downloadError) {
            console.error(`Error descargando archivo ${fileName}:`, downloadError);
            // Continuar con otros archivos incluso si hay error en uno
          }
        }
        
        // Finalizar y enviar el ZIP
        zipfile.end();
        
        // Configurar limpieza al finalizar
        res.on('finish', () => {
          try {
            // Limpiar archivos temporales
            fs.readdirSync(tempDir).forEach(file => {
              try {
                fs.unlinkSync(path.join(tempDir, file));
              } catch (err) {
                console.error(`Error eliminando archivo temporal ${file}:`, err);
              }
            });
            fs.rmdirSync(tempDir, { recursive: true });
          } catch (cleanupError) {
            console.error('Error limpiando archivos temporales:', cleanupError);
          }
        });
        
        // Configurar los headers de la respuesta
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="ejecucion-${uuid}.zip"`);
        
        // Enviar el ZIP como respuesta
        zipfile.outputStream.pipe(res);
        return;
      } catch (cloudError) {
        console.error('Error procesando archivos desde la nube:', cloudError);
        // Asegurarnos de que provider esté definido para evitar errores
        const providerName = (typeof provider !== 'undefined' && provider && provider.nombre) ? provider.nombre : 'desconocido';
        return res.status(500).json({
          message: 'Error al acceder a archivos en la nube',
          error: 'Ocurrió un error al acceder a los archivos en el almacenamiento en nube.',
          details: cloudError.message,
          tipo: 'error_acceso_nube',
          proveedor: providerName,
          rutaNube: execDir
        });
      }
    } else {
      // Para rutas locales, verificar si el directorio existe
      if (!fs.existsSync(execDir)) {
        return res.status(404).json({
          message: 'Directorio de ejecución no encontrado',
          error: 'No se pudo encontrar el directorio de archivos para esta ejecución.',
          details: 'Es posible que los archivos hayan sido eliminados o movidos a un almacenamiento en la nube.',
          tipo: 'directorio_no_encontrado',
          solucion: 'Si la ejecución fue migrada a la nube, contacte al administrador para activar la descarga desde la nube.',
          rutaDirectorio: execDir,
          rutaEjecucion: ejecucion.ruta_directorio,
          migradoANube: ejecucion.migrado_a_nube === true,
          rutaNube: ejecucion.ruta_nube
        });
      }
      
      // Crear un nuevo archivo ZIP
      const zipfile = new yazl.ZipFile();
      
      // Leer todos los archivos en el directorio
      const files = fs.readdirSync(execDir);
      
      // Agregar cada archivo al ZIP
      files.forEach(file => {
        const filePath = path.join(execDir, file);
        // Solo agregar archivos, no directorios
        if (fs.statSync(filePath).isFile()) {
          zipfile.addFile(filePath, file);
        }
      });
      
      // Finalizar el ZIP
      zipfile.end();
      
      // Configurar los headers de la respuesta
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="ejecucion-${uuid}.zip"`);
      
      // Enviar el ZIP como respuesta
      zipfile.outputStream.pipe(res);
    }


  } catch (error) {
    console.error('Error al crear archivo ZIP:', error);
    return res.status(500).json({ 
      message: 'Error al crear archivo ZIP', 
      error: 'No se pudo crear el archivo ZIP con los archivos de la ejecución.',
      details: 'Ocurrió un error al procesar su solicitud. Por favor intente nuevamente más tarde.',
      tipo: 'error_crear_zip',
      errorTecnico: error.message,
      uuid: uuid
    });
  }
}