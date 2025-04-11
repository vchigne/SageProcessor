import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import yaml from 'yaml';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

// Promisify exec para usar con async/await
const execAsync = promisify(exec);

// Configurar conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Obtiene el formato de archivo (CSV o Excel) basado en la configuración YAML
 * @param yamlContent Contenido YAML analizado
 * @param catalogName Nombre del catálogo
 * @returns Formato del archivo ('CSV' o 'EXCEL')
 */
function obtenerFormatoArchivo(yamlContent: any, catalogName: string): string {
  try {
    if (yamlContent.catalogs && yamlContent.catalogs[catalogName]) {
      const catalog = yamlContent.catalogs[catalogName];
      
      if (catalog.file_format && catalog.file_format.type) {
        const formato = catalog.file_format.type.toLowerCase();
        return formato === 'excel' ? 'EXCEL' : 'CSV';
      }
    }
    
    // Por defecto, usar CSV
    return 'CSV';
  } catch (error) {
    console.error('Error al obtener formato de archivo:', error);
    return 'CSV';
  }
}

/**
 * Crea un archivo CSV o Excel a partir de los datos en memoria
 * @param data Datos del formulario
 * @param catalogName Nombre del catálogo
 * @param filePath Ruta donde guardar el archivo
 * @param formato Formato del archivo ('CSV' o 'EXCEL')
 */
async function crearArchivoDesdeData(data: any, catalogName: string, filePath: string, formato: string): Promise<void> {
  // Solo procesar filas con datos
  const rows = data[catalogName].filter((row: any) => 
    Object.values(row).some(val => val !== undefined && val !== '')
  );
  
  if (rows.length === 0) {
    throw new Error('No hay datos para guardar');
  }
  
  // Obtener nombres de columnas del primer registro
  const columnNames = Object.keys(rows[0]);
  
  if (formato.toLowerCase() === 'excel') {
    // En el caso de Excel, usaríamos una librería como xlsx
    // Como no tenemos xlsx instalada, por ahora creamos un CSV
    return crearArchivoCSV(rows, columnNames, filePath);
  } else {
    // Crear archivo CSV
    return crearArchivoCSV(rows, columnNames, filePath);
  }
}

/**
 * Crea un archivo CSV a partir de los datos
 * @param rows Filas de datos
 * @param columnNames Nombres de las columnas
 * @param filePath Ruta del archivo
 */
function crearArchivoCSV(rows: any[], columnNames: string[], filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Crear el encabezado
      let csvContent = columnNames.join(',') + '\n';
      
      // Agregar las filas
      rows.forEach(row => {
        const rowValues = columnNames.map(col => {
          // Manejar casos especiales (comas, comillas, valores nulos)
          let cellValue = row[col] === undefined || row[col] === null ? '' : row[col];
          
          // Convertir valores booleanos
          if (typeof cellValue === 'boolean') {
            cellValue = cellValue ? 'true' : 'false';
          }
          
          // Convertir a string y escapar comillas, agregar comillas si hay comas
          cellValue = String(cellValue);
          if (cellValue.includes('"')) {
            cellValue = cellValue.replace(/"/g, '""');
          }
          
          if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
            cellValue = `"${cellValue}"`;
          }
          
          return cellValue;
        });
        
        csvContent += rowValues.join(',') + '\n';
      });
      
      // Escribir en el archivo
      fs.writeFileSync(filePath, csvContent, 'utf8');
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }
  
  const { id } = req.query; // ID de la casilla
  const { data, uuid, casilla_id, instalacion_id } = req.body;
  
  if (!id || !data || !uuid) {
    return res.status(400).json({
      success: false,
      error: 'Datos incompletos. Se requiere ID de casilla, UUID del portal y datos a procesar.'
    });
  }
  
  try {
    // 1. Verificar acceso al portal y obtener la casilla
    const casillaQuery = await pool.query(
      `SELECT c.*, 
              i.id as instalacion_id,
              o.id as organizacion_id,
              o.nombre as organizacion_nombre,
              pr.id as producto_id,
              pr.nombre as producto_nombre,
              pa.id as pais_id,
              pa.nombre as pais_nombre
       FROM casillas c
       LEFT JOIN instalaciones i ON c.instalacion_id = i.id
       LEFT JOIN organizaciones o ON i.organizacion_id = o.id
       LEFT JOIN productos pr ON i.producto_id = pr.id
       LEFT JOIN paises pa ON i.pais_id = pa.id
       WHERE c.id = $1`,
      [id]
    );
    
    if (casillaQuery.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Casilla no encontrada' });
    }
    
    const casilla = casillaQuery.rows[0];
    
    // 2. Analizar la estructura YAML para validar los datos
    const yamlString = casilla.yaml_contenido;
    if (!yamlString) {
      return res.status(400).json({
        success: false,
        error: 'No se encontró estructura YAML para esta casilla'
      });
    }
    
    try {
      // Analizar YAML
      const yamlContent = yaml.parse(yamlString);
      
      // 3. Validar que la estructura de datos coincida con la esperada
      const catalogs = Object.keys(data);
      if (catalogs.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No se proporcionaron datos para ningún catálogo'
        });
      }
      
      // 4. Para cada catálogo en los datos, verificar que existe en la estructura YAML
      for (const catalogName of catalogs) {
        if (!yamlContent.catalogs || !yamlContent.catalogs[catalogName]) {
          return res.status(400).json({
            success: false,
            error: `Catálogo "${catalogName}" no existe en la definición YAML`
          });
        }
        
        // Obtener las definiciones de columnas para validar
        const yamlCatalog = yamlContent.catalogs[catalogName];
        const columnDefs = yamlCatalog.columns || yamlCatalog.fields || {};
        
        // Obtener los datos enviados para este catálogo
        const catalogData = data[catalogName];
        if (!Array.isArray(catalogData) || catalogData.length === 0) {
          return res.status(400).json({
            success: false,
            error: `No se proporcionaron datos para el catálogo "${catalogName}"`
          });
        }
        
        // Validar cada fila de datos
        for (let i = 0; i < catalogData.length; i++) {
          const row = catalogData[i];
          // Verificar si la fila tiene datos o está vacía
          const hasData = Object.values(row).some(val => val !== undefined && val !== '');
          if (!hasData) continue; // Ignorar filas vacías
          
          // TODO: Aquí se pueden agregar validaciones específicas según el tipo de dato
          // Por ejemplo, verificar que los campos numéricos sean números, etc.
        }
      }
      
      // 5. Crear directorio de datos para los archivos
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '_');
      const archivoName = `datos_directos_${timestamp}`;
      
      // Determinar el formato del archivo (CSV o Excel) basado en el YAML
      const formatoArchivo = obtenerFormatoArchivo(yamlContent, catalogs[0]);
      
      // Crear el directorio data/casilla_id si no existe
      const dataDirBase = path.join(process.cwd(), 'data');
      const dataDirCasilla = path.join(dataDirBase, id.toString());
      
      try {
        if (!fs.existsSync(dataDirBase)) {
          fs.mkdirSync(dataDirBase);
        }
        
        if (!fs.existsSync(dataDirCasilla)) {
          fs.mkdirSync(dataDirCasilla);
        }
        
        // Nombre y ruta del archivo a crear
        const fileExt = formatoArchivo.toLowerCase() === 'excel' ? '.xlsx' : '.csv';
        const filePath = path.join(dataDirCasilla, archivoName + fileExt);
        
        // Convertir los datos a CSV o crear Excel basado en el formato
        await crearArchivoDesdeData(data, catalogs[0], filePath, formatoArchivo);
        
        console.log('Archivo creado:', filePath);
        
        // 6. Registrar la ejecución en la base de datos
        const ejecutionResult = await pool.query(
          `INSERT INTO ejecuciones_yaml 
           (casilla_id, fecha_ejecucion, estado, metodo_envio, 
            archivo_datos, errores_detectados, warnings_detectados,
            nombre_yaml, ruta_directorio)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            id,
            now,
            'Parcial', // Comenzamos con Parcial ya que la restricción no permite 'Pendiente'
            'portal_upload', // Usando un valor permitido por la restricción
            archivoName + fileExt,
            0, // Sin errores
            0,  // Sin advertencias
            casilla.nombre_yaml,
            dataDirCasilla
          ]
        );
        
        const ejecucionId = ejecutionResult.rows[0].id;
        console.log('Ejecución registrada con ID:', ejecucionId);
        
        // 7. Ejecutar el procesador SAGE para procesar el archivo
        try {
          // Similar a process-files.ts, usamos el módulo sage.main
          const processFile = (
            filePath: string,
            yamlContent: string,
            casilla_id: number
          ): Promise<{ execution_uuid: string; errors: number; warnings: number }> => {
            return new Promise(async (resolve, reject) => {
              try {
                // Crear un archivo YAML temporal
                const yamlPath = path.join(process.cwd(), 'tmp', `${Date.now()}.yaml`);
                
                // Asegurar que exista el directorio tmp
                await fsPromises.mkdir(path.join(process.cwd(), 'tmp'), { recursive: true });
                
                // Escribir el contenido YAML en el archivo temporal
                await fsPromises.writeFile(yamlPath, yamlContent);
                
                const args = ['-m', 'sage.main', yamlPath, filePath];
                
                // Agregar parámetros
                args.push('--casilla-id', casilla_id.toString());
                
                // Indicar que el método de envío es portal_upload (un valor válido)
                args.push('--metodo-envio', 'portal_upload');
                
                console.log('Ejecutando:', 'python3', args.join(' '));
                
                const pythonProcess = spawn('python3', args, {
                  env: { 
                    ...process.env,
                    PYTHONPATH: process.cwd()
                  }
                });
                
                let output = '';
                let error = '';
                
                pythonProcess.stdout.on('data', (data) => {
                  const dataStr = data.toString();
                  console.log('Process stdout:', dataStr);
                  output += dataStr;
                });
                
                pythonProcess.stderr.on('data', (data) => {
                  const dataStr = data.toString();
                  console.error('Process stderr:', dataStr);
                  error += dataStr;
                });
                
                pythonProcess.on('close', async (code) => {
                  // Limpiar archivo temporal
                  try {
                    await fsPromises.unlink(yamlPath);
                  } catch (err) {
                    console.error('Error al eliminar archivo YAML temporal:', err);
                  }
                  
                  // SAGE puede retornar código 1 cuando encuentra errores de validación
                  if (code === 0 || code === 1) {
                    const uuidMatch = output.match(/Execution UUID: ([a-f0-9-]+)/);
                    const errorsMatch = output.match(/Total errors: (\d+)/);
                    const warningsMatch = output.match(/Total warnings: (\d+)/);
                    
                    if (uuidMatch && errorsMatch && warningsMatch) {
                      resolve({
                        execution_uuid: uuidMatch[1],
                        errors: parseInt(errorsMatch[1]),
                        warnings: parseInt(warningsMatch[1])
                      });
                    } else {
                      reject(new Error('No se pudo analizar la salida del procesador SAGE'));
                    }
                  } else {
                    reject(new Error(error || 'Error al procesar el archivo'));
                  }
                });
              } catch (err) {
                reject(err);
              }
            });
          };
          
          // Procesar el archivo con SAGE
          const processingResult = await processFile(filePath, yamlString, parseInt(id as string));
          
          // Actualizar el estado de ejecución
          await pool.query(
            `UPDATE ejecuciones_yaml SET 
              estado = $1, 
              errores_detectados = $2, 
              warnings_detectados = $3,
              uuid = $4
             WHERE id = $5`,
            [
              processingResult.errors > 0 ? 'Fallido' : 'Éxito',
              processingResult.errors,
              processingResult.warnings,
              processingResult.execution_uuid,
              ejecucionId
            ]
          );
          
          // 8. Responder con éxito, incluyendo UUID para poder mostrar el log
          return res.status(200).json({
            success: true,
            message: 'Datos procesados correctamente',
            execution_uuid: processingResult.execution_uuid,
            errors: processingResult.errors,
            warnings: processingResult.warnings,
            ejecucion_id: ejecucionId,
            fecha: now.toISOString(),
            archivo: archivoName + fileExt,
            log_url: `/api/executions/${processingResult.execution_uuid}/log`
          });
        } catch (execError) {
          console.error('Error al ejecutar el procesamiento:', execError);
          
          // Actualizar estado a fallido
          await pool.query(
            `UPDATE ejecuciones_yaml SET estado = 'Fallido', errores_detectados = 1 
             WHERE id = $1`,
            [ejecucionId]
          );
          
          return res.status(200).json({
            success: false,
            message: 'Datos guardados, pero hubo un error en el procesamiento',
            error: execError.message,
            ejecucion_id: ejecucionId,
            fecha: now.toISOString(),
            warning: 'El archivo fue creado pero el procesamiento falló'
          });
        }
      } catch (fsError) {
        console.error('Error al crear archivo o directorio:', fsError);
        return res.status(500).json({
          success: false,
          error: 'Error al crear archivo para procesamiento',
          details: fsError.message
        });
      }
      
    } catch (yamlError) {
      console.error('Error al analizar estructura YAML:', yamlError);
      return res.status(500).json({
        success: false,
        error: 'Error al procesar estructura YAML',
        details: yamlError.message
      });
    }
    
  } catch (error) {
    console.error('Error al procesar datos directos:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}