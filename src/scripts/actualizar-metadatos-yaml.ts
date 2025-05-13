/**
 * Script para actualizar los metadatos de YAML (nombre y descripción)
 * desde el contenido YAML a las columnas dedicadas en casillas
 */

const { Pool } = require('pg');
const yaml = require('yaml');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Función para extraer metadatos del contenido YAML
function extraerMetadatosYaml(contenido: string): { nombre: string, descripcion: string } {
  try {
    // Valores por defecto
    let nombre = '';
    let descripcion = '';
    
    // Usar el parser de YAML en lugar de expresiones regulares
    const parsedYaml = yaml.parse(contenido);
    
    // Extraer los metadatos del objeto YAML parseado
    if (parsedYaml && parsedYaml.sage_yaml) {
      nombre = parsedYaml.sage_yaml.name || '';
      descripcion = parsedYaml.sage_yaml.description || '';
    }
    
    return { nombre, descripcion };
  } catch (e) {
    console.error('Error extrayendo metadatos del YAML:', e);
    return { nombre: '', descripcion: '' };
  }
}

async function actualizarMetadatosYaml() {
  const client = await pool.connect();
  
  try {
    console.log('Iniciando actualización de metadatos YAML...');
    
    // Obtener todas las casillas con contenido YAML
    const result = await client.query(`
      SELECT id, nombre_yaml, yaml_contenido 
      FROM casillas 
      WHERE yaml_contenido IS NOT NULL AND (nombre IS NULL OR nombre = '' OR descripcion IS NULL OR descripcion = '')
    `);
    
    console.log(`Se encontraron ${result.rows.length} casillas con metadatos faltantes`);
    
    // Procesar cada casilla
    for (const row of result.rows) {
      try {
        // Extraer metadatos del YAML
        const { nombre, descripcion } = extraerMetadatosYaml(row.yaml_contenido);
        
        if (nombre || descripcion) {
          // Actualizar los campos de la casilla
          await client.query(`
            UPDATE casillas
            SET nombre = COALESCE($1, nombre), descripcion = COALESCE($2, descripcion)
            WHERE id = $3
          `, [nombre, descripcion, row.id]);
          
          console.log(`Casilla ID ${row.id} (${row.nombre_yaml}) actualizada: nombre='${nombre}', descripcion='${descripcion}'`);
        } else {
          console.log(`Casilla ID ${row.id} (${row.nombre_yaml}): No se encontraron metadatos en el YAML`);
        }
      } catch (err) {
        console.error(`Error procesando casilla ID ${row.id}:`, err);
      }
    }
    
    console.log('Actualización de metadatos YAML completada');
  } catch (err) {
    console.error('Error en la actualización:', err);
  } finally {
    client.release();
  }
}

// Ejecutar la función principal
actualizarMetadatosYaml()
  .then(() => {
    console.log('Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error en el proceso:', err);
    process.exit(1);
  });