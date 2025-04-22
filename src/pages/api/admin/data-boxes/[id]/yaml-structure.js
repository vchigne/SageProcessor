import { pool } from '../../../../../utils/db';
import yaml from 'yaml';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID de casilla inválido' });
  }

  const casillaId = parseInt(id);

  try {
    const conn = pool;
    
    // Obtener la casilla y su contenido YAML
    const query = `
      SELECT id, nombre, descripcion, yaml_contenido as yaml_content, nombre_yaml 
      FROM casillas 
      WHERE id = $1
    `;
    
    const { rows } = await conn.query(query, [casillaId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Casilla no encontrada' });
    }
    
    const casilla = rows[0];
    
    // Verificar si existe contenido YAML
    if (!casilla.yaml_content) {
      console.log(`Casilla ${casillaId} no tiene contenido YAML definido`);
      return res.status(404).json({ message: 'La casilla no tiene contenido YAML definido' });
    }
    
    // Analizar estructura del YAML
    let yamlStructure;
    try {
      // Parsear el contenido como YAML utilizando la biblioteca importada
      let yamlContent;
      try {
        yamlContent = typeof casilla.yaml_content === 'string' 
          ? yaml.parse(casilla.yaml_content) 
          : casilla.yaml_content;
          
        console.log('YAML parseado correctamente');
      } catch (parseError) {
        console.error('Error al parsear YAML contenido:', parseError);
        return res.status(500).json({ 
          message: 'Error al parsear el contenido YAML', 
          error: parseError.message
        });
      }
      
      // Si después de todo el yamlContent es null o undefined
      if (!yamlContent) {
        console.error('YAML contenido es nulo después de parsear');
        return res.status(500).json({ message: 'Error al procesar el contenido YAML' });
      }
      
      // Estructura específica de SAGE YAML
      if (!yamlContent.sage_yaml || !yamlContent.catalogs) {
        console.error('El YAML no tiene la estructura esperada de SAGE (sage_yaml, catalogs)');
        return res.status(400).json({ message: 'El YAML no tiene la estructura esperada de SAGE' });
      }
        
      // Extraer estructura de archivos/tablas del YAML
      let fileStructures = [];
      
      // Procesar los catálogos definidos en el YAML
      const catalogs = yamlContent.catalogs || {};
      
      // Convertir el objeto de catálogos a un array de estructuras de archivo
      fileStructures = Object.entries(catalogs).map(([catalogId, catalog]) => {
        console.log(`Procesando catálogo: ${catalogId}, name: ${catalog.name}`);
        
        // En YAML_SPEC.md, los campos se definen con la propiedad "fields"
        if (!catalog.fields || !Array.isArray(catalog.fields)) {
          console.log(`El catálogo ${catalogId} no tiene campos definidos en la propiedad "fields" o no es un array`);
          return {
            name: catalog.name || catalogId,
            description: catalog.description || '',
            columns: []
          };
        }
        
        console.log(`El catálogo ${catalogId} tiene ${catalog.fields.length} campos definidos`);
        
        // Convertir los campos del catálogo a columnas
        const columns = catalog.fields.map(field => ({
          name: field.name,
          type: field.type || 'texto',
          required: field.required || false,
          primary: field.unique || false, // Usar unique como equivalente a primary key
          partitionKey: false, // Por defecto no es clave de partición
          description: field.description || ''
        }));
        
        return {
          name: catalog.name || catalogId,
          description: catalog.description || '',
          columns: columns
        };
      });
      
      // Crear la estructura final
      yamlStructure = {
        id: casilla.id,
        name: casilla.nombre || yamlContent.sage_yaml?.name || casilla.nombre_yaml,
        description: casilla.descripcion || yamlContent.sage_yaml?.description || '',
        files: fileStructures
      };
    } catch (e) {
      console.error('Error al analizar YAML:', e);
      return res.status(500).json({ 
        message: 'Error al analizar la estructura del YAML', 
        error: e.message 
      });
    }
    
    return res.status(200).json(yamlStructure);
  } catch (error) {
    console.error('Error al obtener estructura YAML:', error);
    return res.status(500).json({ 
      message: 'Error al obtener estructura YAML', 
      error: error.message 
    });
  }
}