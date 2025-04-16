import { Pool } from 'pg';

// Conectar a la base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  // Obtener una conexión del pool
  const client = await pool.connect();

  try {
    if (req.method === 'GET') {
      // Obtener la configuración actual
      const result = await client.query(`
        SELECT * FROM ejecuciones_config 
        ORDER BY id DESC 
        LIMIT 1
      `);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'No se encontró configuración' });
      }

      return res.status(200).json(result.rows[0]);
      
    } else if (req.method === 'POST') {
      // Guardar/actualizar la configuración
      const { 
        nube_primaria_id, 
        nubes_alternativas,
        tiempo_retencion_local,
        prefijo_ruta_nube,
        migrar_automaticamente
      } = req.body;

      // Verificar si ya existe una configuración
      const checkResult = await client.query('SELECT id FROM ejecuciones_config LIMIT 1');
      
      let result;
      if (checkResult.rows.length === 0) {
        // Insertar nueva configuración
        result = await client.query(`
          INSERT INTO ejecuciones_config
          (nube_primaria_id, nubes_alternativas, tiempo_retencion_local, prefijo_ruta_nube, migrar_automaticamente)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [nube_primaria_id, nubes_alternativas, tiempo_retencion_local, prefijo_ruta_nube, migrar_automaticamente]);
      } else {
        // Actualizar configuración existente
        result = await client.query(`
          UPDATE ejecuciones_config
          SET nube_primaria_id = $1,
              nubes_alternativas = $2,
              tiempo_retencion_local = $3,
              prefijo_ruta_nube = $4,
              migrar_automaticamente = $5,
              fecha_actualizacion = NOW()
          WHERE id = $6
          RETURNING *
        `, [nube_primaria_id, nubes_alternativas, tiempo_retencion_local, prefijo_ruta_nube, migrar_automaticamente, checkResult.rows[0].id]);
      }

      return res.status(200).json(result.rows[0]);
    }
    
    return res.status(405).json({ message: 'Método no permitido' });
  } catch (error) {
    console.error('Error en API ejecuciones-config:', error);
    return res.status(500).json({ message: 'Error interno del servidor', error: error.message });
  } finally {
    client.release();
  }
}