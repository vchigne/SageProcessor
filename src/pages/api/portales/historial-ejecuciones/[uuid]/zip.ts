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
      // Definir la variable provider a nivel del bloque try/catch para acceder a ella en caso de error
      let provider = null;
      let providerName = '';
      let cloudPath = '';
      
      try {
        // Extraer el nombre del proveedor de la URI en formato cloud://proveedor/ruta
        const cloudParts = execDir.substring(8).split('/');
        providerName = cloudParts[0];
        cloudPath = '/' + cloudParts.slice(1).join('/');
        
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
        
        provider = providerResult.rows[0];
        
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
        
        // Seleccionar el adaptador correcto según el tipo de proveedor
        let cloudFiles;
        const tipo = provider.tipo.toLowerCase();
        console.log(`Usando adaptador para tipo de proveedor: ${tipo}`);
        
        try {
          if (tipo === 's3') {
            cloudFiles = await s3Adapter.listContents(provider.credenciales, provider.configuracion, cloudPath);
          } else if (tipo === 'azure') {
            cloudFiles = await azureAdapter.listContents(provider.credenciales, provider.configuracion, cloudPath);
          } else if (tipo === 'gcp') {
            cloudFiles = await gcpAdapter.listContents(provider.credenciales, provider.configuracion, cloudPath);
          } else if (tipo === 'sftp') {
            cloudFiles = await sftpAdapter.listContents(provider.credenciales, provider.configuracion, cloudPath);
          } else if (tipo === 'minio') {
            cloudFiles = await minioAdapter.listContents(provider.credenciales, provider.configuracion, cloudPath);
          } else {
            throw new Error(`Tipo de proveedor no soportado: ${tipo}`);
          }
        } catch (adapterError) {
          console.error(`Error al listar contenido desde ${tipo}:`, adapterError);
          return res.status(500).json({
            message: `Error al listar archivos desde ${tipo}`,
            error: `No se pudo obtener la lista de archivos desde el proveedor ${providerName}.`,
            detallesTecnicos: adapterError.message,
            tipo: 'error_listado_archivos',
            proveedor: providerName,
            rutaNube: cloudPath
          });
        }
        
        // Verificar si cloudFiles existe y tiene la estructura correcta
        console.log('Estructura de cloudFiles:', JSON.stringify(cloudFiles, null, 2));
        
        if (!cloudFiles) {
          return res.status(404).json({
            message: 'No se encontraron archivos en la nube',
            error: 'No hay archivos disponibles para esta ejecución en el almacenamiento en nube.',
            tipo: 'archivos_nube_no_encontrados',
            proveedor: providerName,
            ruta: cloudPath,
            detalles: 'La respuesta del adaptador es nula'
          });
        }
        
        // Normalizar la estructura de cloudFiles para asegurar que siempre sea iterable
        let filesArray = [];
        
        if (Array.isArray(cloudFiles)) {
          filesArray = cloudFiles;
        } else if (cloudFiles.files && Array.isArray(cloudFiles.files)) {
          filesArray = cloudFiles.files;
        } else if (cloudFiles.Contents && Array.isArray(cloudFiles.Contents)) {
          // Para respuestas de S3 que tienen un formato diferente
          filesArray = cloudFiles.Contents.map(item => ({
            name: item.Key.split('/').pop(),
            path: item.Key,
            size: item.Size,
            lastModified: item.LastModified
          }));
        } else {
          console.error('Formato de respuesta no reconocido:', cloudFiles);
          console.log('Intentaremos usar la lista manual de archivos esenciales');
          // No retornamos error, seguimos con la lista manual
        }
        
        // No nos detenemos si no hay archivos, intentaremos descargar archivos esenciales
        if (filesArray.length === 0) {
          console.log('AVISO: No se encontraron archivos en la lista de la nube, intentaremos obtener archivos manualmente');
        }
        
        // Si la lista está vacía o es muy corta, intentamos construir una
        // lista más completa basada en patrones comunes de archivos
        if (filesArray.length < 3) {
          console.log(`Usando estrategia alternativa para listar archivos (${filesArray.length} encontrados originalmente)`);
          
          // Guardamos los archivos que ya teníamos
          const archivosExistentes = [...filesArray];
          
          try {
            // Lista básica de archivos que deberían estar siempre presentes
            filesArray = [
              { name: 'output.log', path: `${cloudPath}/output.log` },
              { name: 'input.yaml', path: `${cloudPath}/input.yaml` }
            ];
            
            // Si conocemos el nombre del YAML, agregarlo 
            if (ejecucion.nombre_yaml) {
              filesArray.push({ 
                name: ejecucion.nombre_yaml, 
                path: `${cloudPath}/${ejecucion.nombre_yaml}` 
              });
            }
            
            // Si tenemos el nombre del archivo de datos, agregarlo a la lista
            if (ejecucion.archivo_datos) {
              filesArray.push({ 
                name: ejecucion.archivo_datos, 
                path: `${cloudPath}/${ejecucion.archivo_datos}` 
              });
            } else {
              // Tipos comunes de archivos de datos
              const dataFiles = ['data.csv', 'data.txt', 'data.xlsx', 'data', 'dataset.csv'];
              dataFiles.forEach(dataFile => {
                filesArray.push({ name: dataFile, path: `${cloudPath}/${dataFile}` });
              });
            }
            
            // Otros archivos comunes que pueden estar presentes
            const otrosArchivos = [
              'config.json', 'metadata.json', 'resultados.csv', 'resultados.json',
              'reporte.txt', 'reporte.html', 'reporte.csv', 'reporte.json',
              'errors.log', 'warning.log', 'estadisticas.csv'
            ];
            
            otrosArchivos.forEach(archivo => {
              filesArray.push({ name: archivo, path: `${cloudPath}/${archivo}` });
            });
            
            // Agregamos los archivos que ya teníamos para no perderlos
            archivosExistentes.forEach(archivo => {
              if (!filesArray.some(a => a.name === archivo.name)) {
                filesArray.push(archivo);
              }
            });
            
            console.log(`Lista ampliada generada con ${filesArray.length} archivos potenciales`);
            
          } catch (err) {
            console.error('Error creando lista manual de archivos:', err);
            // Si falló la estrategia alternativa, volvemos a la lista original
            if (archivosExistentes.length > 0) {
              filesArray = archivosExistentes;
              console.log('Volviendo a la lista original de archivos');
            }
          }
        }
        
        // Crear directorio temporal para descargar archivos
        const tempDir = path.join(os.tmpdir(), `sage-zip-${uuidv4()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Descargar todos los archivos
        const zipfile = new yazl.ZipFile();
        
        // Información para debuggeo
        console.log(`Archivos encontrados: ${filesArray.length}`);
        filesArray.forEach((file, index) => {
          console.log(`Archivo ${index + 1}: ${file.name || 'Sin nombre'}, ruta: ${file.path || 'Sin ruta'}`);
        });
        
        // Lista de archivos clave para asegurarnos de incluirlos en el ZIP
        // incluso si no están en la lista retornada por el adaptador
        const archivosEsenciales = ['output.log', 'input.yaml'];
        
        // Agregar el archivo de datos a la lista de esenciales si existe en el registro
        if (ejecucion.archivo_datos) {
          archivosEsenciales.push(ejecucion.archivo_datos);
        } else {
          // Intentar diferentes formatos comunes si no hay un nombre específico
          archivosEsenciales.push('data.csv', 'data.txt', 'data.xlsx', 'data');
        }
        
        // Descargar cada archivo y agregarlo al ZIP
        for (const file of filesArray) {
          // Verificar que file y file.name existen
          if (!file || (!file.name && !file.Key && !file.Name)) {
            console.warn('Archivo inválido en la lista:', file);
            continue;
          }
          
          // Extraer el nombre del archivo de la estructura que puede variar según el provider
          const fileName = file.name || 
            (file.Key ? file.Key.split('/').pop() : null) || 
            (file.Name ? file.Name.split('/').pop() : 'archivo_sin_nombre');
            
          const tempFilePath = path.join(tempDir, fileName);
          
          try {
            // Obtener la ruta efectiva
            // Algunos proveedores devuelven la ruta completa, otros solo la relativa
            let rutaEfectiva;
            const filePath = file.path || file.Key || file.Name || '';
            
            if (filePath.includes(cloudPath)) {
              // La ruta ya contiene el prefijo completo, solo asegurarse de que no haya barras dobles
              rutaEfectiva = filePath.replace(/\/+/g, '/');
            } else {
              // Concatenar el cloudPath con la ruta del archivo y normalizar barras
              rutaEfectiva = `${cloudPath}/${filePath}`.replace(/\/+/g, '/');
            }
            
            console.log(`Descargando archivo para ZIP desde proveedor ${tipo}:`);
            console.log(`- Archivo solicitado: ${fileName}`);
            console.log(`- Ruta base en nube: ${cloudPath}`);
            console.log(`- Ruta en archivo:   ${filePath}`);
            console.log(`- RUTA EFECTIVA:     ${rutaEfectiva}`);
            
            // Normalizar las credenciales y la configuración
            let credentials = provider.credenciales;
            let config = provider.configuracion;
            
            // Intentar parsear la configuración y credenciales si son strings
            if (typeof config === 'string') {
              try {
                config = JSON.parse(config);
              } catch (e) {
                console.error('Error al parsear configuración:', e);
                throw new Error('Formato de configuración inválido');
              }
            }
            
            if (typeof credentials === 'string') {
              try {
                credentials = JSON.parse(credentials);
              } catch (e) {
                console.error('Error al parsear credenciales:', e);
                throw new Error('Formato de credenciales inválido');
              }
            }
            
            console.log('Credenciales para ZIP:', JSON.stringify({
              ...credentials, 
              secret_key: credentials.secret_key ? '***' : undefined
            }, null, 2));
            
            console.log(`Intentando acceder a: Bucket=${credentials.bucket}, Región=${credentials.region || config.region}, Archivo=${rutaEfectiva}`);
            
            // Descargar el archivo de la nube usando el adaptador correcto según el tipo
            if (tipo === 's3') {
              await s3Adapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
            } else if (tipo === 'azure') {
              await azureAdapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
            } else if (tipo === 'gcp') {
              await gcpAdapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
            } else if (tipo === 'sftp') {
              await sftpAdapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
            } else if (tipo === 'minio') {
              await minioAdapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
            }
            
            if (fs.existsSync(tempFilePath)) {
              // Agregar al ZIP
              zipfile.addFile(tempFilePath, fileName);
            } else {
              console.warn(`Archivo ${fileName} no se pudo descargar correctamente`);
            }
          } catch (downloadError) {
            console.error(`Error descargando archivo ${fileName} desde ${tipo}:`, downloadError);
            console.error(`DETALLES COMPLETOS DEL ERROR:
              Proveedor: ${tipo}
              Bucket: ${credentials.bucket || 'No especificado'}
              Región: ${credentials.region || config.region || 'No especificado'}
              Archivo: ${file.path}
              Ruta completa: ${cloudPath}/${file.path}
              Error: ${downloadError.message}
              Stack: ${downloadError.stack || 'No disponible'}
            `);
            // Continuar con otros archivos incluso si hay error en uno
          }
        }
        
        // Verificar si tenemos archivos esenciales faltantes e intentar descargarlos
        for (const archivoEsencial of archivosEsenciales) {
          // Verificar si ya tenemos este archivo esencial en el ZIP
          const yaExiste = filesArray.some(file => {
            const nombreArchivo = file.name || 
              (file.Key ? file.Key.split('/').pop() : null) || 
              (file.Name ? file.Name.split('/').pop() : null);
            return nombreArchivo === archivoEsencial;
          });
          
          if (!yaExiste) {
            console.log(`Intentando descargar archivo esencial: ${archivoEsencial}`);
            const tempFilePath = path.join(tempDir, archivoEsencial);
            const rutaEfectiva = `${cloudPath}/${archivoEsencial}`.replace(/\/+/g, '/');
            
            try {
              console.log(`Descargando: ${rutaEfectiva}`);
              let credentials = provider.credenciales;
              let config = provider.configuracion;
              
              // Asegurarse de que son objetos
              if (typeof credentials === 'string') credentials = JSON.parse(credentials);
              if (typeof config === 'string') config = JSON.parse(config);
              
              if (tipo === 's3') {
                await s3Adapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
              } else if (tipo === 'azure') {
                await azureAdapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
              } else if (tipo === 'gcp') {
                await gcpAdapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
              } else if (tipo === 'sftp') {
                await sftpAdapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
              } else if (tipo === 'minio') {
                await minioAdapter.downloadFile(credentials, config, rutaEfectiva, tempFilePath);
              }
              
              if (fs.existsSync(tempFilePath)) {
                console.log(`Archivo esencial ${archivoEsencial} descargado correctamente`);
                zipfile.addFile(tempFilePath, archivoEsencial);
              } else {
                console.log(`No se pudo descargar el archivo esencial ${archivoEsencial}`);
              }
            } catch (err) {
              console.error(`Error descargando archivo esencial ${archivoEsencial}:`, err.message);
              // Ignorar el error y continuar con otros archivos
            }
          }
        }
        
        // Siempre crearemos un archivo readme.txt para indicar la estructura
        const readmePath = path.join(tempDir, 'readme.txt');
        fs.writeFileSync(readmePath, `Ejecución: ${uuid}
        Fecha: ${ejecucion.fecha_ejecucion}
        Nombre YAML: ${ejecucion.nombre_yaml}
        Estado: ${ejecucion.estado}
        
        Archivos comunes:
        - output.log: Registro de la ejecución
        - input.yaml: Configuración YAML utilizada
        - data.*: Archivo de datos procesado (formato variable)
        `);
        zipfile.addFile(readmePath, 'readme.txt');
        
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
        // Usar el nombre del proveedor que ya definimos en el alcance superior
        // o si no está disponible, usar el nombre del provider si existe
        let providerDisplayName = 'desconocido';
        if (providerName) {
          providerDisplayName = providerName;
        } else if (provider && provider.nombre) {
          providerDisplayName = provider.nombre;
        }
        
        return res.status(500).json({
          message: 'Error al acceder a archivos en la nube',
          error: 'Ocurrió un error al acceder a los archivos en el almacenamiento en nube.',
          details: cloudError.message,
          tipo: 'error_acceso_nube',
          proveedor: providerDisplayName,
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
    
    // Verificar si hay información valiosa en el objeto de ejecución
    let infoEjecucion = {};
    try {
      if (typeof ejecucion !== 'undefined') {
        infoEjecucion = {
          id: ejecucion.id,
          fecha: ejecucion.fecha_ejecucion,
          nombreYaml: ejecucion.nombre_yaml,
          rutaDirectorio: ejecucion.ruta_directorio,
          migradoANube: ejecucion.migrado_a_nube,
          rutaNube: ejecucion.ruta_nube,
          archivosDatos: ejecucion.archivo_datos
        };
      }
    } catch (infoError) {
      console.error('Error extrayendo información adicional:', infoError);
    }
    
    return res.status(500).json({ 
      message: 'Error al crear archivo ZIP', 
      error: 'No se pudo crear el archivo ZIP con los archivos de la ejecución.',
      details: 'Ocurrió un error al intentar comprimir y descargar los archivos. El error puede ser debido a problemas de conectividad con el almacenamiento cloud, falta de archivos en la ubicación esperada, o errores en la configuración del proveedor de nube.',
      sugerencia: 'Intente descargar los archivos individualmente usando los botones respectivos o contacte al administrador del sistema.',
      tipo: 'error_crear_zip',
      errorTecnico: error.message,
      errorStack: error.stack,
      uuid: uuid,
      infoEjecucion: infoEjecucion
    });
  }
}