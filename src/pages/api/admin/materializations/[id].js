import { pool } from '../../../../utils/db';

export default async function handler(req, res) {
  const { id } = req.query;
  const materializationId = parseInt(id);
  
  if (isNaN(materializationId)) {
    return res.status(400).json({ message: 'ID de materialización inválido' });
  }

  const conn = pool;
  
  // GET - Obtener una materialización específica
  if (req.method === 'GET') {
    try {
      const query = `
        SELECT * FROM materializaciones
        WHERE id = $1
      `;
      
      const { rows } = await conn.query(query, [materializationId]);
      
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Materialización no encontrada' });
      }
      
      // Convertir configuración de JSONB a objeto JavaScript
      const materializacion = {
        ...rows[0],
        configuracion: rows[0].configuracion || {}
      };
      
      return res.status(200).json(materializacion);
    } catch (error) {
      console.error('Error al obtener materialización:', error);
      return res.status(500).json({ message: 'Error al obtener materialización', error: error.message });
    }
  }
  
  // PUT - Actualizar una materialización
  else if (req.method === 'PUT') {
    try {
      const { nombre, descripcion, configuracion } = req.body;
      
      if (!nombre || !configuracion) {
        return res.status(400).json({ message: 'Faltan campos requeridos' });
      }
      
      const query = `
        UPDATE materializaciones
        SET nombre = $1, 
            descripcion = $2,
            configuracion = $3,
            fecha_actualizacion = NOW()
        WHERE id = $4
        RETURNING *
      `;
      
      const { rows } = await conn.query(query, [
        nombre,
        descripcion || '',
        configuracion,
        materializationId
      ]);
      
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Materialización no encontrada' });
      }
      
      // Convertir configuración de JSONB a objeto JavaScript
      const materializacion = {
        ...rows[0],
        configuracion: rows[0].configuracion || {}
      };
      
      return res.status(200).json(materializacion);
    } catch (error) {
      console.error('Error al actualizar materialización:', error);
      return res.status(500).json({ message: 'Error al actualizar materialización', error: error.message });
    }
  }
  
  // DELETE - Eliminar una materialización
  else if (req.method === 'DELETE') {
    try {
      // Primero verificamos que exista la materialización
      const checkQuery = `SELECT * FROM materializaciones WHERE id = $1`;
      const checkResult = await conn.query(checkQuery, [materializationId]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ message: 'Materialización no encontrada' });
      }
      
      // Verificar si hay procesos activos de materialización
      const checkActiveQuery = `
        SELECT * FROM materializaciones_ejecuciones 
        WHERE materialization_id = $1 
        AND estado = 'en_proceso'
      `;
      const activeResult = await conn.query(checkActiveQuery, [materializationId]);
      
      // Intentar matar procesos activos si existen
      if (activeResult.rows.length > 0) {
        console.log(`Encontrados ${activeResult.rows.length} procesos activos para materialización ${materializationId}`);
        
        // Marcar estos procesos como cancelados
        const cancelQuery = `
          UPDATE materializaciones_ejecuciones 
          SET estado = 'cancelado', 
              mensaje = 'Cancelado por eliminación de materialización',
              fecha_fin = NOW()
          WHERE materialization_id = $1 
          AND estado = 'en_proceso'
        `;
        await conn.query(cancelQuery, [materializationId]);
        
        // Nota: Los procesos reales de Python seguirán ejecutándose en el servidor,
        // pero al menos marcaremos su estado como cancelado en la base de datos.
        // Idealmente deberíamos implementar un sistema para matar estos procesos.
      }
      
      // Comenzamos una transacción para garantizar la integridad
      await conn.query('BEGIN');
      
      try {
        // Primero eliminamos los registros relacionados en materializaciones_ejecuciones
        const deleteRelatedQuery = `DELETE FROM materializaciones_ejecuciones WHERE materialization_id = $1`;
        await conn.query(deleteRelatedQuery, [materializationId]);
        
        // Luego eliminamos la materialización
        const deleteQuery = `DELETE FROM materializaciones WHERE id = $1`;
        await conn.query(deleteQuery, [materializationId]);
        
        // Confirmamos la transacción
        await conn.query('COMMIT');
        
        return res.status(200).json({ 
          message: 'Materialización eliminada correctamente',
          activeProcessesCancelled: activeResult.rows.length > 0
        });
      } catch (txError) {
        // Si hay un error, revertimos la transacción
        await conn.query('ROLLBACK');
        throw txError;
      }
    } catch (error) {
      console.error('Error al eliminar materialización:', error);
      return res.status(500).json({ message: 'Error al eliminar materialización', error: error.message });
    }
  }
  
  // Método no soportado
  else {
    return res.status(405).json({ message: 'Método no permitido' });
  }
}