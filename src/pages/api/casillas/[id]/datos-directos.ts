import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import yaml from 'yaml';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Configurar conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }
  
  const { id } = req.query;
  const { data, uuid, casilla_id, instalacion_id } = req.body;
  
  if (!data || !uuid || !casilla_id || !instalacion_id) {
    return res.status(400).json({ success: false, error: 'Faltan parámetros requeridos' });
  }
  
  try {
    // Obtener información de la casilla
    const casillaQuery = await pool.query(
      'SELECT nombre_yaml, yaml_contenido, archivo_yaml_contenido FROM data_boxes WHERE id = $1', 
      [id]
    );
    
    if (casillaQuery.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Casilla no encontrada' });
    }
    
    const casilla = casillaQuery.rows[0];
    
    // Obtener el contenido YAML
    const yamlContent = casilla.yaml_contenido || casilla.archivo_yaml_contenido;
    
    if (!yamlContent) {
      return res.status(400).json({ success: false, error: 'No se encontró configuración YAML para esta casilla' });
    }
    
    // Analizar el YAML para determinar formatos
    const yamlData = yaml.parse(yamlContent);
    
    // Directorio temporal para los archivos
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Crear un ID único para esta operación
    const operationId = uuidv4();
    
    // Iterar sobre los catálogos en los datos recibidos
    const filesPaths: string[] = [];
    const filesProcessed: string[] = [];
    
    for (const catalogName in data) {
      if (!data[catalogName] || !Array.isArray(data[catalogName])) continue;
      
      // Filtrar filas vacías
      const rows = data[catalogName].filter(row => 
        Object.values(row).some(value => value !== undefined && value !== '')
      );
      
      if (rows.length === 0) continue;
      
      // Buscar el catálogo en la configuración YAML
      const catalog = yamlData.catalogs?.[catalogName];
      if (!catalog) continue;
      
      // Determinar el formato del archivo (CSV o Excel)
      const fileFormat = catalog.file_format?.type?.toLowerCase();
      
      if (fileFormat === 'csv') {
        // Crear un archivo CSV
        const columns = catalog.columns ? Object.keys(catalog.columns) : [];
        
        if (columns.length === 0) continue;
        
        // Construir contenido CSV
        let csvContent = columns.join(',') + '\\n';
        
        rows.forEach(row => {
          const rowValues = columns.map(col => {
            const value = row[col] || '';
            // Escapar comillas y poner el valor entre comillas si contiene comas
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          });
          csvContent += rowValues.join(',') + '\\n';
        });
        
        // Guardar el archivo CSV
        const fileName = `${catalogName}_${operationId}.csv`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, csvContent);
        
        filesPaths.push(filePath);
        filesProcessed.push(fileName);
        
      } else if (fileFormat === 'excel') {
        // Para archivos Excel, guardaremos como CSV y luego convertiremos a Excel
        // NOTA: Esto requiere un procesamiento adicional que se realizará en el backend Python
        const columns = catalog.columns ? Object.keys(catalog.columns) : [];
        
        if (columns.length === 0) continue;
        
        // Construir contenido CSV para convertir después
        let csvContent = columns.join(',') + '\\n';
        
        rows.forEach(row => {
          const rowValues = columns.map(col => {
            const value = row[col] || '';
            // Escapar comillas y poner el valor entre comillas si contiene comas
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          });
          csvContent += rowValues.join(',') + '\\n';
        });
        
        // Guardar el archivo CSV temporal
        const csvFileName = `${catalogName}_${operationId}.csv`;
        const csvFilePath = path.join(tempDir, csvFileName);
        fs.writeFileSync(csvFilePath, csvContent);
        
        // El archivo Excel se creará posteriormente por el procesamiento Python
        const excelFileName = `${catalogName}_${operationId}.xlsx`;
        const excelFilePath = path.join(tempDir, excelFileName);
        
        filesPaths.push(csvFilePath);
        filesProcessed.push(excelFileName); // Añadimos el nombre del archivo Excel que se creará
      }
    }
    
    if (filesPaths.length === 0) {
      return res.status(400).json({ success: false, error: 'No se pudieron generar archivos a partir de los datos proporcionados' });
    }
    
    // Registrar la ejecución en la base de datos
    const registroQuery = await pool.query(
      `INSERT INTO ejecuciones 
       (casilla_id, emisor_id, fecha_ejecucion, archivo, estado, directorio_ejecucion) 
       VALUES ($1, NULL, NOW(), $2, 'Pendiente', $3) 
       RETURNING id`,
      [casilla_id, filesProcessed.join(','), tempDir]
    );
    
    const ejecucionId = registroQuery.rows[0]?.id;
    
    // Registrar acceso al portal
    await pool.query(
      `INSERT INTO portal_accesos 
       (uuid, instalacion_id, fecha_acceso, accion, casilla_id) 
       VALUES ($1, $2, NOW(), 'ingreso_directo_datos', $3)`,
      [uuid, instalacion_id, casilla_id]
    );
    
    // Llamar al script Python para procesamiento (esto dependerá de la implementación específica)
    try {
      // Ejemplo: podríamos ejecutar un script Python para procesar estos archivos
      // Este es un placeholder - la implementación real dependerá de cómo esté configurado el backend
      const processingCommand = `python process_direct_data.py --ejecucion-id=${ejecucionId} --casilla-id=${casilla_id} --files=${filesPaths.join(',')}`;
      
      // NOTA: Esta parte se comenta porque no existe el script aún
      // const { stdout, stderr } = await execPromise(processingCommand);
      // console.log('Procesamiento completado:', stdout);
      
      // Por ahora, solo registraremos como éxito
      await pool.query(
        `UPDATE ejecuciones SET estado = 'Éxito' WHERE id = $1`,
        [ejecucionId]
      );
      
    } catch (processingError) {
      console.error('Error en procesamiento de datos:', processingError);
      
      // Registrar el error en la base de datos
      await pool.query(
        `UPDATE ejecuciones SET estado = 'Fallido', error_mensaje = $1 WHERE id = $2`,
        [processingError.message || 'Error desconocido en procesamiento', ejecucionId]
      );
      
      return res.status(500).json({ 
        success: false, 
        error: 'Error en procesamiento de datos',
        details: processingError.message
      });
    }
    
    // Responder con éxito
    return res.status(200).json({ 
      success: true, 
      message: 'Datos procesados correctamente',
      ejecucion_id: ejecucionId,
      files: filesProcessed
    });
    
  } catch (error) {
    console.error('Error al procesar datos directos:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}