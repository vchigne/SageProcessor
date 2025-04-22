import { Pool } from 'pg';
import yaml from 'yaml';

// Obtener la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // En este proyecto no se está usando next-auth, sino autenticación basada en cookies/sesión
  // La autorización la maneja Next.js en el frontend
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  // Procesar solicitud para detectar tablas en YAML
  try {
    const { casilla_id } = req.body;
    
    if (!casilla_id) {
      return res.status(400).json({ message: 'ID de casilla requerido' });
    }
    
    // Obtener el YAML de la casilla
    const query = `
      SELECT yaml_contenido
      FROM casillas
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [casilla_id]);
    
    if (result.rows.length === 0 || !result.rows[0].yaml_contenido) {
      return res.status(404).json({ message: 'No se encontró YAML para esta casilla' });
    }
    
    const yamlContent = result.rows[0].yaml_contenido;
    
    // Parsear YAML
    let parsedYaml;
    try {
      parsedYaml = yaml.parse(yamlContent);
    } catch (error) {
      console.error('Error al parsear YAML:', error);
      return res.status(400).json({ message: 'Error al parsear YAML', error: error.message });
    }
    
    // Detectar tablas potenciales del YAML
    const tables = detectTablesFromYaml(parsedYaml);
    
    return res.status(200).json({ tables });
  } catch (error) {
    console.error('Error al detectar tablas:', error);
    return res.status(500).json({ 
      message: 'Error interno al detectar tablas', 
      error: error.message 
    });
  }
}

/**
 * Detecta posibles tablas a partir de un YAML
 * 
 * @param {Object} parsedYaml - YAML parseado
 * @returns {Array<Object>} - Lista de tablas detectadas
 */
function detectTablesFromYaml(parsedYaml) {
  const tables = [];
  
  // Buscar en el YAML estructura de sage_yaml y schemas
  if (parsedYaml && parsedYaml.sage_yaml) {
    
    // Buscar en schemas
    if (parsedYaml.sage_yaml.schemas) {
      const schemas = parsedYaml.sage_yaml.schemas;
      
      // Cada schema puede representar una tabla potencial
      Object.keys(schemas).forEach(schemaName => {
        const schema = schemas[schemaName];
        const fields = [];
        
        // Extraer campos del schema
        if (schema.fields) {
          Object.keys(schema.fields).forEach(fieldName => {
            const field = schema.fields[fieldName];
            fields.push({
              name: fieldName,
              type: field.type || 'string',
              description: field.description || '',
              required: field.required || false,
              primary_key: field.primary_key || false
            });
          });
        }
        
        // Identificar posibles claves primarias
        const primaryKeyFields = fields.filter(f => f.primary_key).map(f => f.name);
        
        tables.push({
          name: schemaName,
          source: 'schema',
          description: schema.description || '',
          fields,
          primary_key: primaryKeyFields.length > 0 ? primaryKeyFields.join(',') : null
        });
      });
    }
    
    // Buscar en validations
    if (parsedYaml.sage_yaml.validations) {
      const validations = parsedYaml.sage_yaml.validations;
      
      // Cada validation puede indicar una estructura de datos
      Object.keys(validations).forEach(validationName => {
        const validation = validations[validationName];
        
        // Solo incluir validaciones con campos
        if (validation.fields) {
          const fields = [];
          
          // Extraer campos de la validación
          Object.keys(validation.fields).forEach(fieldName => {
            const field = validation.fields[fieldName];
            fields.push({
              name: fieldName,
              type: field.type || 'string',
              description: field.description || '',
              required: field.required || false
            });
          });
          
          tables.push({
            name: validationName,
            source: 'validation',
            description: validation.description || '',
            fields
          });
        }
      });
    }
    
    // Buscar en exporters
    if (parsedYaml.sage_yaml.exporters) {
      const exporters = parsedYaml.sage_yaml.exporters;
      
      // Cada exporter puede ser una tabla potencial
      Object.keys(exporters).forEach(exporterName => {
        const exporter = exporters[exporterName];
        
        // Solo incluir exporters con formato o tipo
        if (exporter.format || exporter.type) {
          tables.push({
            name: exporterName,
            source: 'exporter',
            description: exporter.description || '',
            format: exporter.format || exporter.type,
            config: exporter
          });
        }
      });
    }
    
    // Buscar en transformations
    if (parsedYaml.sage_yaml.transformations) {
      const transformations = parsedYaml.sage_yaml.transformations;
      
      // Cada transformation puede modificar o crear datos
      Object.keys(transformations).forEach(transformationName => {
        const transformation = transformations[transformationName];
        
        tables.push({
          name: transformationName,
          source: 'transformation',
          description: transformation.description || '',
          config: transformation
        });
      });
    }
  }
  
  return tables;
}