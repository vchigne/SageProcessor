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
      
      // Mostrar toda la información disponible para depuración
      console.log(`=========== INFORMACIÓN DE EJECUCIÓN ===========`);
      console.log(`UUID: ${uuid}`);
      console.log(`ID: ${ejecucion.id}`);
      console.log(`Estado: ${ejecucion.estado}`);
      console.log(`Ruta directorio: ${ejecucion.ruta_directorio}`);
      console.log(`Migrado a nube: ${ejecucion.migrado_a_nube ? 'Sí' : 'No'}`);
      console.log(`Ruta nube: ${ejecucion.ruta_nube || 'No definida'}`);
      console.log(`Nube primaria ID: ${ejecucion.nube_primaria_id || 'No definida'}`);
      console.log(`Archivo datos: ${ejecucion.archivo_datos || 'No definido'}`);
      console.log(`=========== INFORMACIÓN DE CLOUD URI ===========`);
      console.log(`Descargando archivos desde nube: ${providerName}, ruta: ${cloudPath}`);
      
      // IMPORTANTE: Aquí hay un problema con los nombres de los proveedores en la base de datos
      // Los nombres en las URIs cloud:// no coinciden exactamente con los nombres en la tabla cloud_providers
      
      // Usar directamente el proveedor Amazon S3 con ID 1
      let providerResult = await pool.query(
        'SELECT id, nombre, tipo, descripcion, configuracion, credenciales FROM cloud_providers WHERE id = 1'
      );
      
      // Si no se encuentra Amazon, intentar con cualquier otro
      if (!providerResult || providerResult.rows.length === 0) {
        providerResult = await pool.query(
          'SELECT id, nombre, tipo, descripcion, configuracion, credenciales FROM cloud_providers LIMIT 1'
        );
      }
      
      // Si después de todo, no encontramos proveedor, lanzar error
      if (!providerResult || providerResult.rows.length === 0) {
        throw new Error(`No se pudo encontrar un proveedor de nube válido. Nombre intentado: "${providerName}"`);
      }
      
      const provider = providerResult.rows[0];
      
      // Imprimir información del proveedor encontrado
      console.log(`=========== INFORMACIÓN DE PROVEEDOR ===========`);
      console.log(`ID Proveedor: ${provider.id}`);
      console.log(`Nombre: ${provider.nombre}`);
      console.log(`Tipo: ${provider.tipo}`);
      console.log(`Descripción: ${provider.descripcion || 'No definida'}`);
      console.log(`Credenciales: ${typeof provider.credenciales === 'string' ? 'String JSON' : 'Objeto'}`);
      console.log(`Configuración: ${typeof provider.configuracion === 'string' ? 'String JSON' : 'Objeto'}`);
      
      // Preparar credenciales y configuración
      let credentials = provider.credenciales;
      let config = provider.configuracion;
      
      if (typeof credentials === 'string') credentials = JSON.parse(credentials);
      if (typeof config === 'string') config = JSON.parse(config);
      
      const tipo = provider.tipo.toLowerCase();
      
      // Listar TODOS los archivos en el directorio de la nube
      try {
        const rutaLimpia = cloudPath.replace(/^\/+/, '');
        
        console.log(`Listando TODOS los archivos en: ${rutaLimpia} (proveedor tipo ${tipo})`);
        
        // Obtener lista de archivos
        let resultadoListado;
        if (tipo === 's3') {
          resultadoListado = await s3Adapter.listContents(credentials, config, rutaLimpia);
        } else if (tipo === 'azure') {
          resultadoListado = await azureAdapter.listContents(credentials, config, rutaLimpia);
        } else if (tipo === 'gcp') {
          resultadoListado = await gcpAdapter.listContents(credentials, config, rutaLimpia);
        } else if (tipo === 'sftp') {
          resultadoListado = await sftpAdapter.listContents(credentials, config, rutaLimpia);
        } else if (tipo === 'minio') {
          resultadoListado = await minioAdapter.listContents(credentials, config, rutaLimpia);
        }
        
        if (!resultadoListado) {
          console.log('No se encontraron archivos en la ruta específica');
          // Finalizar aquí
          throw new Error(`No se encontraron archivos en la ruta: ${rutaLimpia}`);
        }
        
        // Normalizar la estructura según el tipo de respuesta
        let filesArray = [];
        
        console.log('Estructura de resultadoListado:', JSON.stringify(resultadoListado, null, 2));
        
        if (Array.isArray(resultadoListado)) {
          filesArray = resultadoListado;
        } else if (resultadoListado.files && Array.isArray(resultadoListado.files)) {
          filesArray = resultadoListado.files;
        } else if (resultadoListado.Contents && Array.isArray(resultadoListado.Contents)) {
          filesArray = resultadoListado.Contents.map(item => ({
            name: item.Key.split('/').pop(),
            path: item.Key
          }));
        } else {
          console.warn('Formato desconocido en la respuesta del listado');
          throw new Error('No se pudo interpretar la respuesta del proveedor de almacenamiento');
        }
        
        console.log(`Se encontraron ${filesArray.length} archivos en total.`);
        
        // Procesar todos los archivos
        let archivosDescargados = 0;
        
        for (const file of filesArray) {
          // Obtener nombre de archivo
          const fileName = file.name || 
            (file.Key ? file.Key.split('/').pop() : null) || 
            (file.Name ? file.Name.split('/').pop() : null);
          
          if (!fileName) {
            console.warn('Archivo sin nombre detectado, omitiendo...');
            continue;
          }
          
          // Determinar la ruta correcta para el archivo
          let rutaArchivo;
          
          if (file.Key) {
            rutaArchivo = file.Key;
          } else if (file.path) {
            rutaArchivo = file.path;
          } else {
            rutaArchivo = `${rutaLimpia}/${fileName}`;
          }
          
          // Eliminar barras iniciales si existen
          rutaArchivo = rutaArchivo.replace(/^\/+/, '');
          
          const rutaLocal = path.join(tempDir, fileName);
          
          try {
            console.log(`[${archivosDescargados + 1}/${filesArray.length}] Descargando: ${rutaArchivo}`);
            
            // Descargar archivo según tipo de proveedor
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
              zipfile.addFile(rutaLocal, fileName);
              console.log(`✓ Archivo ${fileName} agregado al ZIP correctamente`);
              archivosDescargados++;
            } else {
              console.warn(`✗ Error: El archivo ${fileName} no se descargó correctamente`);
            }
          } catch (err) {
            console.warn(`✗ Error descargando ${fileName}: ${err.message}`);
          }
        }
        
        console.log(`Proceso completo: ${archivosDescargados} de ${filesArray.length} archivos descargados correctamente`);
        
      } catch (err) {
        console.error(`Error al procesar archivos: ${err.message}`);
        
        // No incluir readme.txt, simplemente devolver el error
        throw new Error(`Error al procesar archivos: ${err.message}`);
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