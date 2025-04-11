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
    // GET - Obtener detalles de una asignación específica
    if (method === 'GET') {
      const result = await client.query(`
        SELECT cp.id, cp.cliente_id, cp.plantilla_id, cp.activo, 
               cp.fecha_creacion, cp.fecha_modificacion,
               p.nombre as plantilla_nombre, p.tipo, p.subtipo, p.canal, p.idioma,
               o.nombre as cliente_nombre
        FROM cliente_plantilla cp
        JOIN plantillas_email p ON cp.plantilla_id = p.id
        JOIN organizaciones o ON cp.cliente_id = o.id
        WHERE cp.id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Asignación no encontrada' });
      }
      
      return res.status(200).json(result.rows[0]);
    }
    
    // PUT - Actualizar una asignación
    if (method === 'PUT') {
      const { activo = true } = req.body;
      
      const result = await client.query(`
        UPDATE cliente_plantilla 
        SET activo = $1, fecha_modificacion = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, cliente_id, plantilla_id, activo
      `, [activo, id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Asignación no encontrada' });
      }
      
      return res.status(200).json({
        message: 'Asignación actualizada con éxito',
        data: result.rows[0]
      });
    }
    
    // DELETE - Eliminar una asignación
    if (method === 'DELETE') {
      const result = await client.query(`
        DELETE FROM cliente_plantilla
        WHERE id = $1
        RETURNING id
      `, [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Asignación no encontrada' });
      }
      
      return res.status(200).json({
        message: 'Asignación eliminada con éxito',
        id: id
      });
    }
    
    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en la API de asignaciones de plantillas:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  } finally {
    client.release();
  }
}