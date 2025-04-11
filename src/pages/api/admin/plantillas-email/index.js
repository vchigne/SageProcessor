import { Pool } from 'pg';

// Conectar a la base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  const { method } = req;

  // Obtener una conexión del pool
  const client = await pool.connect();

  try {
    // GET - Obtener todas las plantillas
    if (method === 'GET') {
      const result = await client.query(`
        SELECT id, nombre, descripcion, tipo, subtipo, variante, canal, idioma, 
               asunto, contenido_html, contenido_texto, es_predeterminada, 
               fecha_creacion, fecha_modificacion
        FROM plantillas_email
        ORDER BY nombre
      `);
      
      return res.status(200).json(result.rows);
    }
    
    // POST - Crear nueva plantilla
    if (method === 'POST') {
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
      
      // Si es plantilla predeterminada, actualizar otras plantillas del mismo tipo/subtipo
      if (es_predeterminada) {
        await client.query(`
          UPDATE plantillas_email 
          SET es_predeterminada = FALSE 
          WHERE tipo = $1 AND subtipo = $2 AND canal = $3 AND idioma = $4 AND es_predeterminada = TRUE
        `, [tipo, subtipo, canal, idioma]);
      }
      
      // Insertar la nueva plantilla
      const result = await client.query(`
        INSERT INTO plantillas_email (
          nombre, descripcion, tipo, subtipo, variante, canal, idioma, 
          asunto, contenido_html, contenido_texto, es_predeterminada
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, nombre, tipo, subtipo, es_predeterminada
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
        es_predeterminada || false
      ]);
      
      return res.status(201).json({
        message: 'Plantilla creada con éxito',
        template: result.rows[0]
      });
    }
    
    // PUT - Actualizar plantilla existente
    if (method === 'PUT') {
      const {
        id,
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
      if (!id || !nombre || !tipo || !subtipo || !canal) {
        return res.status(400).json({ 
          error: 'Faltan campos obligatorios' 
        });
      }
      
      // Si es plantilla predeterminada, actualizar otras plantillas del mismo tipo/subtipo
      if (es_predeterminada) {
        await client.query(`
          UPDATE plantillas_email 
          SET es_predeterminada = FALSE 
          WHERE tipo = $1 AND subtipo = $2 AND canal = $3 AND idioma = $4 AND es_predeterminada = TRUE
          AND id != $5
        `, [tipo, subtipo, canal, idioma, id]);
      }
      
      // Actualizar la plantilla
      const result = await client.query(`
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
        RETURNING id, nombre, tipo, subtipo, es_predeterminada
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
        id
      ]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({
          error: 'Plantilla no encontrada'
        });
      }
      
      return res.status(200).json({
        message: 'Plantilla actualizada con éxito',
        template: result.rows[0]
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