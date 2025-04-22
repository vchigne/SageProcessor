import { Pool } from 'pg';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

// Obtener la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }
  
  const { casilla_id } = req.body;
  
  if (!casilla_id) {
    return res.status(400).json({ message: 'ID de casilla requerido' });
  }
  
  try {
    // Obtener la configuración YAML de la casilla
    const yamlQuery = `
      SELECT yaml_config 
      FROM data_boxes 
      WHERE id = $1
    `;
    
    const yamlResult = await pool.query(yamlQuery, [casilla_id]);
    
    if (yamlResult.rows.length === 0) {
      return res.status(404).json({ message: 'Casilla no encontrada' });
    }
    
    const yamlConfig = yamlResult.rows[0].yaml_config;
    
    if (!yamlConfig) {
      return res.status(404).json({ 
        message: 'La casilla no tiene configuración YAML',
        tables: []
      });
    }
    
    // Parsear y analizar la configuración YAML
    const detectedTables = await analyzeYamlConfig(yamlConfig);
    
    return res.status(200).json({
      message: 'Tablas detectadas correctamente',
      tables: detectedTables
    });
  } catch (error) {
    console.error('Error al detectar tablas:', error);
    return res.status(500).json({ 
      message: 'Error interno al detectar tablas', 
      error: error.message 
    });
  }
}

// Función para analizar la configuración YAML y detectar tablas
async function analyzeYamlConfig(yamlConfig) {
  try {
    // Llamar al servicio Python para analizar el YAML
    const response = await fetch('http://localhost:3000/api/internal/analyze-yaml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ yaml_config: yamlConfig }),
    });
    
    if (!response.ok) {
      // Si el servicio Python no está disponible, hacemos un análisis básico en JS
      return fallbackYamlAnalysis(yamlConfig);
    }
    
    const data = await response.json();
    return data.tables || [];
  } catch (error) {
    console.error('Error al analizar YAML:', error);
    // Si falla el servicio Python, hacemos un análisis básico en JS
    return fallbackYamlAnalysis(yamlConfig);
  }
}

// Análisis básico de YAML en JavaScript como fallback
function fallbackYamlAnalysis(yamlConfig) {
  try {
    // Buscar patrones de definición de tablas en el YAML
    const tablesPattern = /tabla[s]?:\s*\n([\s\S]*?)(?:\n\w+:|$)/gi;
    const tableNamePattern = /nombre:\s*["']?([\w\s-]+)["']?/i;
    const columnsPattern = /columnas:\s*\n([\s\S]*?)(?:\n\w+:|$)/i;
    const columnPattern = /-\s*["']?([\w\s-]+)["']?/gi;
    const primaryKeyPattern = /clave_primaria:\s*\n([\s\S]*?)(?:\n\w+:|$)/i;
    const pkColumnPattern = /-\s*["']?([\w\s-]+)["']?/gi;
    const filePattern = /archivo:\s*["']?([\w\s\.-]+)["']?/i;
    
    const tables = [];
    let tableMatch;
    
    // Estructura básica si no hay sección de tablas
    if (!yamlConfig.match(tablesPattern)) {
      // Buscar secciones de datos o exportadores
      const dataExportersPattern = /exportadores:\s*\n([\s\S]*?)(?:\n\w+:|$)/gi;
      const dataPattern = /datos:\s*\n([\s\S]*?)(?:\n\w+:|$)/gi;
      
      let dataSections = [];
      let match;
      
      while ((match = dataExportersPattern.exec(yamlConfig)) !== null) {
        dataSections.push(match[1]);
      }
      
      while ((match = dataPattern.exec(yamlConfig)) !== null) {
        dataSections.push(match[1]);
      }
      
      if (dataSections.length > 0) {
        // Extraer archivos mencionados
        const fileMatches = [];
        for (const section of dataSections) {
          const filePattern = /archivo:\s*["']?([\w\s\.-]+)["']?/gi;
          let fileMatch;
          while ((fileMatch = filePattern.exec(section)) !== null) {
            fileMatches.push(fileMatch[1]);
          }
        }
        
        // Crear una tabla por cada archivo detectado
        for (const file of [...new Set(fileMatches)]) {
          tables.push({
            name: file.replace(/\.\w+$/, ''), // Nombre sin extensión
            columns: [],
            primary_key: [],
            source_file: file
          });
        }
        
        // Si no hay archivos explícitos pero hay secciones de datos
        if (tables.length === 0 && dataSections.length > 0) {
          tables.push({
            name: 'Datos Principales',
            columns: [],
            primary_key: [],
            source_file: 'datos.csv'
          });
        }
      }
      
      // Si aún no hay tablas, crear una genérica
      if (tables.length === 0) {
        tables.push({
          name: 'Tabla Principal',
          columns: [],
          primary_key: [],
          source_file: null
        });
      }
      
      return tables;
    }
    
    // Procesar secciones de tablas explícitas
    while ((tableMatch = tablesPattern.exec(yamlConfig)) !== null) {
      const tableSection = tableMatch[1];
      
      // Extraer nombre de la tabla
      const nameMatch = tableSection.match(tableNamePattern);
      const name = nameMatch ? nameMatch[1].trim() : `Tabla ${tables.length + 1}`;
      
      // Extraer columnas
      const columns = [];
      const columnsMatch = tableSection.match(columnsPattern);
      if (columnsMatch) {
        let columnMatch;
        while ((columnMatch = columnPattern.exec(columnsMatch[1])) !== null) {
          columns.push(columnMatch[1].trim());
        }
      }
      
      // Extraer clave primaria
      const primaryKey = [];
      const pkMatch = tableSection.match(primaryKeyPattern);
      if (pkMatch) {
        let pkColumnMatch;
        while ((pkColumnMatch = pkColumnPattern.exec(pkMatch[1])) !== null) {
          primaryKey.push(pkColumnMatch[1].trim());
        }
      }
      
      // Extraer archivo fuente
      let sourceFile = null;
      const fileMatch = tableSection.match(filePattern);
      if (fileMatch) {
        sourceFile = fileMatch[1].trim();
      }
      
      tables.push({
        name,
        columns,
        primary_key: primaryKey,
        source_file: sourceFile
      });
    }
    
    return tables;
  } catch (error) {
    console.error('Error en análisis fallback:', error);
    return [];
  }
}