import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import yaml from 'yaml';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import xlsx from 'xlsx';
import { promisify } from 'util';

// Promisify exec para usar con async/await
const execAsync = promisify(exec);

// Configurar conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Obtiene información del formato de archivo basado en la configuración YAML
 * @param yamlContent Contenido YAML analizado
 * @param catalogName Nombre del catálogo
 * @returns Objeto con información del formato {type: 'CSV'|'EXCEL', delimiter: string}
 */
function obtenerFormatoArchivo(yamlContent: any, catalogName: string): {type: string; delimiter: string} {
  try {
    if (yamlContent.catalogs && yamlContent.catalogs[catalogName]) {
      const catalog = yamlContent.catalogs[catalogName];
      
      if (catalog.file_format) {
        // Obtener el tipo de archivo
        const type = catalog.file_format.type ? 
          (catalog.file_format.type.toLowerCase() === 'excel' ? 'EXCEL' : 'CSV') : 
          'CSV';
        
        // Obtener el delimitador (solo relevante para CSV)
        const delimiter = (type === 'CSV' && catalog.file_format.delimiter) ? 
          catalog.file_format.delimiter : 
          ','; // Delimitador por defecto
        
        return { type, delimiter };
      }
    }
    
    // Por defecto, usar CSV con delimitador coma
    return { type: 'CSV', delimiter: ',' };
  } catch (error) {
    console.error('Error al obtener formato de archivo:', error);
    return { type: 'CSV', delimiter: ',' };
  }
}

/**
 * Crea un archivo CSV o Excel a partir de los datos en memoria,
 * asegurando que todas las columnas definidas en el YAML estén presentes
 * 
 * @param data Datos del formulario
 * @param catalogName Nombre del catálogo
 * @param filePath Ruta donde guardar el archivo
 * @param formato Objeto con información del formato {type: 'CSV'|'EXCEL', delimiter: string}
 * @param yamlContent Contenido YAML completo para obtener todas las columnas definidas
 */
async function crearArchivoDesdeData(
  data: any, 
  catalogName: string, 
  filePath: string, 
  formato: {type: string; delimiter: string}, 
  yamlContent: any
): Promise<void> {
  // Solo procesar filas con datos
  const rows = data[catalogName].filter((row: any) => 
    Object.values(row).some(val => val !== undefined && val !== '')
  );
  
  if (rows.length === 0) {
    throw new Error('No hay datos para guardar');
  }
  
  // Obtener la lista de columnas definidas en el YAML
  let yamlColumnNames: string[] = [];
  try {
    if (yamlContent.catalogs && yamlContent.catalogs[catalogName]) {
      const yamlCatalog = yamlContent.catalogs[catalogName];
      const columnDefs = yamlCatalog.columns || yamlCatalog.fields || {};
      yamlColumnNames = Object.keys(columnDefs);
    }
  } catch (error) {
    console.warn(`Error al obtener columnas del YAML: ${error.message}`);
  }

  // Este es el enfoque principal que sugeriste:
  // Crear columnas para TODOS los campos definidos en el YAML
  // aunque no estén en ninguna fila de datos
  
  // Si tenemos las columnas desde el YAML, las usamos TODAS
  if (yamlColumnNames.length > 0) {
    console.log(`Usando ${yamlColumnNames.length} columnas definidas en el YAML: ${yamlColumnNames.join(', ')}`);
    
    // Crear versiones completas de las filas con todas las columnas del YAML
    const completedRows = rows.map(row => {
      const completeRow: any = {};
      // Inicializar todas las columnas YAML con valores vacíos
      yamlColumnNames.forEach(col => {
        completeRow[col] = row[col] !== undefined ? row[col] : '';
      });
      return completeRow;
    });
    
    // Crear el archivo con TODAS las columnas del YAML
    if (formato.type.toLowerCase() === 'excel') {
      return crearArchivoExcel(completedRows, yamlColumnNames, filePath);
    } else {
      return crearArchivoCSV(completedRows, yamlColumnNames, filePath, formato.delimiter);
    }
  } 
  // Si no tenemos columnas del YAML, usamos las que encontramos en los datos
  else {
    // Extraer todas las columnas únicas de las filas de datos
    const allColumns = new Set<string>();
    rows.forEach(row => {
      Object.keys(row).forEach(col => {
        allColumns.add(col);
      });
    });
    
    const dataColumnNames = Array.from(allColumns);
    console.log(`No se encontraron columnas en el YAML. Usando ${dataColumnNames.length} columnas de los datos.`);
    
    // Asegurar que todas las filas tengan todas las columnas
    const completeRows = rows.map(row => {
      const completeRow: any = {};
      dataColumnNames.forEach(col => {
        completeRow[col] = row[col] !== undefined ? row[col] : '';
      });
      return completeRow;
    });
    
    // Crear el archivo con las columnas encontradas en los datos
    if (formato.type.toLowerCase() === 'excel') {
      return crearArchivoExcel(completeRows, dataColumnNames, filePath);
    } else {
      return crearArchivoCSV(completeRows, dataColumnNames, filePath, formato.delimiter);
    }
  }
}

/**
 * Crea un archivo Excel utilizando la biblioteca xlsx
 * @param rows Filas de datos
 * @param columnNames Nombres de las columnas
 * @param filePath Ruta del archivo
 */
function crearArchivoExcel(rows: any[], columnNames: string[], filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Crear un libro de trabajo Excel
      const workbook = xlsx.utils.book_new();
      
      // Preparar los datos para el formato de worksheet de xlsx
      // Primero agregamos la fila de encabezados
      const excelData = [columnNames];
      
      // Luego agregamos cada fila de datos
      rows.forEach(row => {
        const rowValues = columnNames.map(col => {
          // Manejar valores nulos
          let cellValue = row[col] === undefined || row[col] === null ? '' : row[col];
          
          // Convertir valores booleanos (xlsx puede manejar tipos nativos)
          return cellValue;
        });
        
        excelData.push(rowValues);
      });
      
      // Crear una hoja de trabajo con los datos
      const worksheet = xlsx.utils.aoa_to_sheet(excelData);
      
      // Agregar la hoja de trabajo al libro
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Datos');
      
      // Escribir el archivo
      xlsx.writeFile(workbook, filePath);
      
      resolve();
    } catch (error) {
      console.error('Error al crear archivo Excel:', error);
      reject(error);
    }
  });
}

/**
 * Crea un archivo CSV a partir de los datos
 * @param rows Filas de datos
 * @param columnNames Nombres de las columnas
 * @param filePath Ruta del archivo
 * @param delimiter Delimitador a utilizar (por defecto coma)
 */
function crearArchivoCSV(rows: any[], columnNames: string[], filePath: string, delimiter: string = ','): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Crear el encabezado con el delimitador específico
      let csvContent = columnNames.join(delimiter) + '\n';
      
      // Agregar las filas
      rows.forEach(row => {
        const rowValues = columnNames.map(col => {
          // Manejar casos especiales (delimitadores, comillas, valores nulos)
          let cellValue = row[col] === undefined || row[col] === null ? '' : row[col];
          
          // Convertir valores booleanos
          if (typeof cellValue === 'boolean') {
            cellValue = cellValue ? 'true' : 'false';
          }
          
          // Convertir a string y escapar comillas
          cellValue = String(cellValue);
          if (cellValue.includes('"')) {
            cellValue = cellValue.replace(/"/g, '""');
          }
          
          // Agregar comillas si hay delimitadores, comillas o saltos de línea
          if (cellValue.includes(delimiter) || cellValue.includes('"') || cellValue.includes('\n')) {
            cellValue = `"${cellValue}"`;
          }
          
          return cellValue;
        });
        
        // Unir los valores con el delimitador específico
        csvContent += rowValues.join(delimiter) + '\n';
      });
      
      // Escribir en el archivo
      fs.writeFileSync(filePath, csvContent, 'utf8');
      resolve();
    } catch (error) {
      console.error('Error al crear archivo CSV:', error);
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
      
      // 5. Crear directorio temporal para procesamiento y generar un UUID para SAGE
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '_');
      const archivoName = `datos_directos_${timestamp}`;
      
      // Determinar el formato del archivo (CSV o Excel) basado en el YAML
      const formatoArchivo = obtenerFormatoArchivo(yamlContent, catalogs[0]);
      
      try {
        // Crear directorio temporal para procesar los datos
        const tmpDir = path.join(process.cwd(), 'tmp');
        await fsPromises.mkdir(tmpDir, { recursive: true });
        
        // Nombre y ruta del archivo temporal
        const fileExt = formatoArchivo.type.toLowerCase() === 'excel' ? '.xlsx' : '.csv';
        const filePath = path.join(tmpDir, archivoName + fileExt);
        
        // Convertir los datos a CSV o crear Excel basado en el formato
        // Pasamos el yamlContent para obtener todas las columnas definidas en el YAML
        await crearArchivoDesdeData(data, catalogs[0], filePath, formatoArchivo, yamlContent);
        
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
            'pendiente' // Valor temporal que será actualizado por main.py con la ruta UUID real
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
                
                // Usar la función process_files de sage.main directamente como módulo
                const pythonCode = `
import os
import json
import sys
from sage.main import process_files

try:
    # Llamar a process_files con los parámetros adecuados
    execution_uuid, error_count, warning_count = process_files(
        yaml_path="${yamlPath}", 
        data_path="${filePath}",
        casilla_id=${casilla_id},
        metodo_envio="portal_upload"
    )
    
    # Imprimir el resultado como JSON para procesarlo en JavaScript
    print(json.dumps({
        "execution_uuid": execution_uuid,
        "errors": error_count,
        "warnings": warning_count
    }))
    sys.exit(0)
except Exception as e:
    print(json.dumps({
        "error": str(e)
    }))
    sys.exit(1)
`;
                
                const pythonScriptPath = path.join(process.cwd(), 'tmp', `process_${Date.now()}.py`);
                await fsPromises.writeFile(pythonScriptPath, pythonCode);
                
                console.log('Ejecutando SAGE con script temporal:', pythonScriptPath);
                
                const pythonProcess = spawn('python3', [pythonScriptPath], {
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
                  
                  // Limpiar el script temporal también
                  try {
                    await fsPromises.unlink(pythonScriptPath);
                  } catch (err) {
                    console.error('Error al eliminar script Python temporal:', err);
                  }
                  
                  // Procesamos la respuesta en formato JSON
                  if (code === 0) {
                    try {
                      // Extraer el último objeto JSON de la salida
                      const jsonString = output.split('\n').filter(line => {
                        return line.trim().startsWith('{') && line.trim().endsWith('}') && line.includes('execution_uuid');
                      }).pop();
                      
                      if (!jsonString) {
                        console.error('No se encontró un objeto JSON válido. Salida completa:', output);
                        throw new Error('No se encontró un objeto JSON válido en la salida');
                      }
                      
                      // Parsear la salida JSON encontrada
                      const result = JSON.parse(jsonString);
                      
                      resolve({
                        execution_uuid: result.execution_uuid, // Usamos el UUID generado por main.py
                        errors: result.errors,
                        warnings: result.warnings
                      });
                    } catch (err) {
                      console.error('Error al parsear la salida JSON:', err, output);
                      reject(new Error('Error al parsear la salida del procesador SAGE'));
                    }
                  } else if (code === 1) {
                    // Si hubo un error en el procesamiento, intentamos parsear el mensaje de error
                    try {
                      const errorResult = JSON.parse(output.trim());
                      reject(new Error(errorResult.error || 'Error desconocido en el procesador SAGE'));
                    } catch (err) {
                      reject(new Error('Error en el procesador SAGE: ' + output));
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
          
          // Extraer el UUID directamente de la ruta del directorio
          // El UUID es la última parte de la ruta (el nombre del directorio de ejecución)
          const dirPathParts = path.join('executions', processingResult.execution_uuid).split(path.sep);
          const directoryUuid = dirPathParts[dirPathParts.length - 1];
          
          // Actualizar el estado de ejecución asegurando que el UUID en BD sea el mismo que el del directorio
          await pool.query(
            `UPDATE ejecuciones_yaml SET 
              estado = $1, 
              errores_detectados = $2, 
              warnings_detectados = $3,
              uuid = $4,
              ruta_directorio = $5
             WHERE id = $6`,
            [
              processingResult.errors > 0 ? 'Fallido' : 'Éxito',
              processingResult.errors,
              processingResult.warnings,
              directoryUuid, // Usar el UUID extraído del nombre del directorio
              path.join('executions', directoryUuid), // Ruta del directorio usando el mismo UUID
              ejecucionId
            ]
          );
          
          // 8. Responder con éxito, incluyendo UUID para poder mostrar el log
          return res.status(200).json({
            success: true,
            message: 'Datos procesados correctamente',
            execution_uuid: directoryUuid, // Usar el UUID correcto del directorio
            errors: processingResult.errors,
            warnings: processingResult.warnings,
            ejecucion_id: ejecucionId,
            fecha: now.toISOString(),
            archivo: archivoName + fileExt,
            log_url: `/api/executions/${directoryUuid}/log` // Usar el UUID correcto en la URL del log
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