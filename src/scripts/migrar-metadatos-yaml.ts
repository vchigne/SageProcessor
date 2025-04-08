import { Pool } from 'pg';
import { extraerMetadatosYaml } from '../lib/yaml-utils';

// Conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Script para migrar los metadatos de YAML (nombre y descripción)
 * desde el contenido YAML a las columnas dedicadas en casillas
 */
async function migrarMetadatosYaml() {
  const client = await pool.connect();
  
  try {
    console.log('Iniciando migración de metadatos YAML...');
    
    // Obtener todas las casillas con contenido YAML
    const result = await client.query(`
      SELECT id, yaml_contenido 
      FROM casillas 
      WHERE yaml_contenido IS NOT NULL
    `);
    
    console.log(`Se encontraron ${result.rows.length} casillas con contenido YAML`);
    
    // Procesar cada casilla
    for (const row of result.rows) {
      try {
        // Extraer metadatos del YAML
        const { nombre, descripcion } = extraerMetadatosYaml(row.yaml_contenido);
        
        // Actualizar los campos de la casilla
        await client.query(`
          UPDATE casillas
          SET nombre = $1, descripcion = $2
          WHERE id = $3
        `, [nombre, descripcion, row.id]);
        
        console.log(`Casilla ID ${row.id} actualizada: nombre='${nombre}', descripcion='${descripcion}'`);
      } catch (err) {
        console.error(`Error procesando casilla ID ${row.id}:`, err);
      }
    }
    
    console.log('Migración de metadatos YAML completada');
  } catch (err) {
    console.error('Error en la migración:', err);
  } finally {
    client.release();
  }
}

// Ejecutar el script
migrarMetadatosYaml().catch(console.error);