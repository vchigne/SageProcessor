import { Pool } from 'pg';

// Conectar a la base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'ID de plantilla inválido' });
  }

  const templateId = parseInt(id);
  const client = await pool.connect();

  try {
    // GET - Obtener una plantilla específica
    if (method === 'GET') {
      const result = await client.query(`
        SELECT *
        FROM plantillas_email
        WHERE id = $1
      `, [templateId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      return res.status(200).json(result.rows[0]);
    }

    // PUT - Actualizar una plantilla
    if (method === 'PUT') {
      const {
        nombre,
        descripcion,
        tipo,
        subtipo,
        variante,
        canal,
        idioma,
        asunto,
        contenido_html,
        contenido_texto,
        es_predeterminada
      } = req.body;

      // Validaciones básicas
      if (!nombre || !tipo || !subtipo || !canal) {
        return res.status(400).json({
          error: 'Faltan campos obligatorios'
        });
      }

      // Verificar si la plantilla existe
      const checkResult = await client.query(
        'SELECT id FROM plantillas_email WHERE id = $1',
        [templateId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      // Si es plantilla predeterminada, actualizar otras plantillas del mismo tipo/subtipo
      if (es_predeterminada) {
        await client.query(`
          UPDATE plantillas_email 
          SET es_predeterminada = FALSE 
          WHERE tipo = $1 AND subtipo = $2 AND canal = $3 AND idioma = $4 
            AND es_predeterminada = TRUE AND id != $5
        `, [tipo, subtipo, canal, idioma, templateId]);
      }

      // Actualizar la plantilla
      await client.query(`
        UPDATE plantillas_email
        SET nombre = $1,
            descripcion = $2,
            tipo = $3,
            subtipo = $4,
            variante = $5,
            canal = $6,
            idioma = $7,
            asunto = $8,
            contenido_html = $9,
            contenido_texto = $10,
            es_predeterminada = $11,
            fecha_modificacion = CURRENT_TIMESTAMP
        WHERE id = $12
      `, [
        nombre,
        descripcion || '',
        tipo,
        subtipo,
        variante || 'standard',
        canal,
        idioma || 'es',
        asunto || '',
        contenido_html || '',
        contenido_texto || '',
        es_predeterminada || false,
        templateId
      ]);

      return res.status(200).json({
        message: 'Plantilla actualizada con éxito',
        templateId
      });
    }

    // DELETE - Eliminar una plantilla
    if (method === 'DELETE') {
      // Verificar si es una plantilla predeterminada
      const checkResult = await client.query(
        'SELECT es_predeterminada FROM plantillas_email WHERE id = $1',
        [templateId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }

      const { es_predeterminada } = checkResult.rows[0];

      // No permitir eliminar plantillas predeterminadas
      if (es_predeterminada) {
        return res.status(400).json({
          error: 'No se puede eliminar una plantilla predeterminada. Establezca otra plantilla como predeterminada primero.'
        });
      }

      // Eliminar la plantilla
      await client.query('DELETE FROM plantillas_email WHERE id = $1', [templateId]);

      return res.status(200).json({
        message: 'Plantilla eliminada con éxito',
        templateId
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