import { Pool } from 'pg';

// Conectar a la base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  // Obtener una conexión del pool
  const client = await pool.connect();

  try {
    // GET - Obtener detalles de una plantilla específica
    if (method === 'GET') {
      const result = await client.query(`
        SELECT id, nombre, descripcion, tipo, subtipo, variante, canal, idioma, 
               asunto, contenido_html, contenido_texto, es_predeterminada, 
               fecha_creacion, fecha_modificacion
        FROM plantillas_email
        WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }
      
      return res.status(200).json(result.rows[0]);
    }
    
    // DELETE - Eliminar una plantilla
    if (method === 'DELETE') {
      // Verificar si es una plantilla predeterminada
      const checkResult = await client.query(`
        SELECT es_predeterminada FROM plantillas_email WHERE id = $1
      `, [id]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }
      
      if (checkResult.rows[0].es_predeterminada) {
        return res.status(400).json({ 
          error: 'No se puede eliminar una plantilla predeterminada. Establezca otra plantilla como predeterminada primero.' 
        });
      }
      
      const result = await client.query(`
        DELETE FROM plantillas_email
        WHERE id = $1
        RETURNING id
      `, [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }
      
      return res.status(200).json({
        message: 'Plantilla eliminada con éxito',
        id: id
      });
    }
    
    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en la API de plantillas:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  } finally {
    client.release();
  }
}