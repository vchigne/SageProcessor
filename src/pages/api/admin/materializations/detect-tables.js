import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import yaml from 'yaml';

/**
 * API para detectar tablas en la configuración YAML de una casilla
 */
export default async function handler(req, res) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user.isAdmin) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const { casilla_id, yaml_config } = req.body;
    
    if (!yaml_config) {
      return res.status(400).json({ message: 'Configuración YAML requerida' });
    }
    
    // Detectar tablas en el YAML
    const detectedTables = detectTablesFromYaml(yaml_config, casilla_id);
    
    return res.status(200).json({ tables: detectedTables });
  } catch (error) {
    console.error('Error al detectar tablas:', error);
    return res.status(500).json({ message: 'Error al analizar el YAML y detectar tablas' });
  }
}

/**
 * Detecta tablas en la configuración YAML
 * 
 * @param {string} yamlConfig - Configuración YAML
 * @param {number} casillaId - ID de la casilla
 * @returns {Array} - Lista de tablas detectadas
 */
function detectTablesFromYaml(yamlConfig, casillaId) {
  try {
    // Parsear YAML
    const config = yaml.parse(yamlConfig);
    
    if (!config || !config.transformations) {
      return [];
    }
    
    const tables = [];
    let tableIdCounter = 1;
    
    // Recorrer transformaciones para detectar outputs
    for (const transform of config.transformations) {
      // Solo procesar transformaciones con output definido
      if (!transform.output) continue;
      
      // Obtener nombre de la tabla desde output o transformation
      const tableName = transform.output.name || transform.name || `tabla_${tableIdCounter}`;
      
      // Obtener tipo de tabla
      const tableType = getTableType(transform);
      
      // Obtener columnas si están disponibles
      const columns = detectColumns(transform);
      
      // Generar ID único para la tabla
      const tableId = `${casillaId}_${transform.name || tableIdCounter}`;
      
      // Nombre sugerido para materialización
      const suggestedName = `Materialización ${tableName}`;
      
      tables.push({
        id: tableId,
        table_name: tableName,
        type: tableType,
        columns,
        transformation: transform.name,
        suggested_name: suggestedName
      });
      
      tableIdCounter++;
    }
    
    return tables;
  } catch (error) {
    console.error('Error al parsear YAML:', error);
    throw new Error('Error al analizar el YAML');
  }
}

/**
 * Detecta el tipo de tabla basado en la transformación
 * 
 * @param {Object} transform - Objeto de transformación
 * @returns {string} - Tipo de tabla
 */
function getTableType(transform) {
  if (transform.type === 'pandas') {
    return 'Pandas DataFrame';
  } else if (transform.type === 'sql') {
    return 'SQL Query';
  } else if (transform.type === 'csv') {
    return 'CSV';
  } else if (transform.type === 'excel') {
    return 'Excel';
  } else if (transform.type === 'json') {
    return 'JSON';
  } else {
    return transform.type || 'Dataframe';
  }
}

/**
 * Detecta columnas de la tabla basado en la transformación
 * 
 * @param {Object} transform - Objeto de transformación
 * @returns {Array} - Lista de columnas detectadas
 */
function detectColumns(transform) {
  // Si hay schema definido, extraer columnas
  if (transform.output && transform.output.schema) {
    return Object.keys(transform.output.schema).map(colName => ({
      name: colName,
      type: transform.output.schema[colName]
    }));
  }
  
  // Si hay columnas definidas en la transformación
  if (transform.columns) {
    return Array.isArray(transform.columns) 
      ? transform.columns.map(col => ({ name: col, type: 'unknown' }))
      : Object.keys(transform.columns).map(colName => ({
          name: colName,
          type: transform.columns[colName]
        }));
  }
  
  // Si estamos seleccionando columnas en una transformación
  if (transform.select) {
    return transform.select.map(col => ({ name: col, type: 'unknown' }));
  }
  
  return [];
}