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
    // GET - Obtener todas las asignaciones de plantillas
    if (method === 'GET') {
      const query = `
        SELECT cp.id, cp.cliente_id, cp.plantilla_id, cp.activo,
               p.nombre as plantilla_nombre, p.tipo, p.subtipo, p.canal,
               o.nombre as cliente_nombre
        FROM cliente_plantilla cp
        JOIN plantillas_email p ON cp.plantilla_id = p.id
        JOIN organizaciones o ON cp.cliente_id = o.id
        ORDER BY o.nombre, p.tipo, p.subtipo, p.canal
      `;
      
      const result = await client.query(query);
      
      return res.status(200).json(result.rows);
    }
    
    // POST - Crear nueva asignación
    if (method === 'POST') {
      const {
        cliente_id, 
        plantilla_id, 
        activo = true
      } = req.body;
      
      // Validaciones básicas
      if (!cliente_id || !plantilla_id) {
        return res.status(400).json({ 
          error: 'Faltan campos obligatorios (cliente_id y plantilla_id)' 
        });
      }
      
      // Verificar si el cliente existe
      const clienteResult = await client.query(
        "SELECT id FROM organizaciones WHERE id = $1", 
        [cliente_id]
      );
      
      if (clienteResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'El cliente especificado no existe' 
        });
      }
      
      // Verificar si la plantilla existe
      const plantillaResult = await client.query(
        "SELECT id FROM plantillas_email WHERE id = $1", 
        [plantilla_id]
      );
      
      if (plantillaResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'La plantilla especificada no existe' 
        });
      }
      
      // Verificar si ya existe una asignación
      const checkResult = await client.query(
        "SELECT id FROM cliente_plantilla WHERE cliente_id = $1 AND plantilla_id = $2",
        [cliente_id, plantilla_id]
      );
      
      if (checkResult.rows.length > 0) {
        // Actualizar asignación existente
        await client.query(`
          UPDATE cliente_plantilla 
          SET activo = $1, fecha_modificacion = CURRENT_TIMESTAMP
          WHERE cliente_id = $2 AND plantilla_id = $3
        `, [activo, cliente_id, plantilla_id]);
        
        return res.status(200).json({
          message: 'Asignación actualizada con éxito',
          id: checkResult.rows[0].id
        });
      }
      
      // Crear nueva asignación
      const result = await client.query(`
        INSERT INTO cliente_plantilla (cliente_id, plantilla_id, activo)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [cliente_id, plantilla_id, activo]);
      
      return res.status(201).json({
        message: 'Asignación creada con éxito',
        id: result.rows[0].id
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