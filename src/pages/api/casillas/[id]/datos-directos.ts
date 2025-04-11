import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import yaml from 'yaml';

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
      
      // 5. Registrar la ejecución en la base de datos
      const now = new Date();
      const archivoName = 'datos_directos_' + now.toISOString().replace(/[:.]/g, '_');
      const ejecutionResult = await pool.query(
        `INSERT INTO ejecuciones_yaml 
         (casilla_id, fecha_ejecucion, estado, metodo_envio, 
          archivo_datos, errores_detectados, warnings_detectados)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          id,
          now,
          'Éxito', 
          'ENTRADA_DIRECTA',
          archivoName,
          0, // Sin errores
          0  // Sin advertencias
        ]
      );
      
      const ejecucionId = ejecutionResult.rows[0].id;
      
      // 6. Responder con éxito
      return res.status(200).json({
        success: true,
        message: 'Datos procesados correctamente',
        ejecucion_id: ejecucionId,
        fecha: now.toISOString()
      });
      
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