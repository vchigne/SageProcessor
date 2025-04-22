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
      SELECT id, nombre, descripcion, yaml_content, nombre_yaml 
      FROM casillas 
      WHERE id = $1
    `;
    
    const { rows } = await conn.query(query, [casillaId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Casilla no encontrada' });
    }
    
    const casilla = rows[0];
    
    // Si no hay contenido YAML
    if (!casilla.yaml_content) {
      return res.status(404).json({ message: 'La casilla no tiene contenido YAML definido' });
    }
    
    // Analizar estructura del YAML
    let yamlStructure;
    try {
      // Convertir cadena JSON a objeto
      let yamlContent = typeof casilla.yaml_content === 'string' 
        ? JSON.parse(casilla.yaml_content) 
        : casilla.yaml_content;
        
      // Extraer estructura de archivos/tablas del YAML
      let fileStructures = [];
      
      // Extraer los archivos definidos en el YAML
      if (yamlContent.files) {
        // Formato multi-archivo
        fileStructures = yamlContent.files.map(file => {
          // Extraer las columnas de cada archivo
          const columns = file.columns || [];
          return {
            name: file.name || 'Sin nombre',
            description: file.description || '',
            columns: columns.map(col => ({
              name: col.name,
              type: col.type || 'string',
              required: col.required || false,
              primary: col.primary || false,
              description: col.description || ''
            }))
          };
        });
      } else if (yamlContent.columns) {
        // Formato de archivo único
        fileStructures = [{
          name: yamlContent.name || 'Archivo principal',
          description: yamlContent.description || '',
          columns: yamlContent.columns.map(col => ({
            name: col.name,
            type: col.type || 'string',
            required: col.required || false,
            primary: col.primary || false,
            description: col.description || ''
          }))
        }];
      }
      
      yamlStructure = {
        id: casilla.id,
        name: casilla.nombre || yamlContent.name || casilla.nombre_yaml,
        description: casilla.descripcion || yamlContent.description || '',
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