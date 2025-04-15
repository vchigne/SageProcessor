import { pool } from '../../../lib/db';
import migrationService from '../../../utils/cloud/migration-service';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'ID de migración inválido' });
  }
  
  const migrationId = parseInt(id);

  try {
    // Obtener una migración específica
    if (method === 'GET') {
      try {
        // Verificar si la tabla existe
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'cloud_migrations'
          );
        `);
        
        // Si la tabla no existe, responder con un 404
        if (!tableCheck.rows[0].exists) {
          return res.status(404).json({ 
            error: 'Tabla de migraciones no encontrada',
            details: 'La funcionalidad de migraciones aún no está completamente implementada.'
          });
        }
        
        // Obtener la migración
        const migration = await migrationService.getMigrationTask(migrationId);
        return res.status(200).json(migration);
      } catch (error) {
        console.error(`Error al obtener migración ${migrationId}:`, error);
        
        // Si el error es que no existe la migración
        if (error.message === `No se encontró la tarea de migración con ID ${migrationId}`) {
          return res.status(404).json({ 
            error: 'Migración no encontrada', 
            details: error.message 
          });
        }
        
        return res.status(500).json({ 
          error: 'Error al obtener migración', 
          details: error.message 
        });
      }
    }
    
    // Actualizar una migración
    else if (method === 'PUT') {
      try {
        const updates = req.body;
        
        // Actualizar la migración
        const migration = await migrationService.updateMigrationTask(migrationId, updates);
        return res.status(200).json(migration);
      } catch (error) {
        console.error(`Error al actualizar migración ${migrationId}:`, error);
        
        // Si la tabla no existe, responder con un 404
        if (error.message.includes('relation "cloud_migrations" does not exist')) {
          return res.status(404).json({ 
            error: 'Tabla de migraciones no encontrada',
            details: 'La funcionalidad de migraciones aún no está completamente implementada.'
          });
        }
        
        // Si el error es que no existe la migración
        if (error.message === `No se encontró la tarea de migración con ID ${migrationId}`) {
          return res.status(404).json({ 
            error: 'Migración no encontrada', 
            details: error.message 
          });
        }
        
        return res.status(500).json({ 
          error: 'Error al actualizar migración', 
          details: error.message 
        });
      }
    }
    
    // Eliminar una migración
    else if (method === 'DELETE') {
      try {
        // Verificar si la tabla existe
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'cloud_migrations'
          );
        `);
        
        // Si la tabla no existe, responder con un 404
        if (!tableCheck.rows[0].exists) {
          return res.status(404).json({ 
            error: 'Tabla de migraciones no encontrada',
            details: 'La funcionalidad de migraciones aún no está completamente implementada.'
          });
        }
        
        // Eliminar la migración
        await pool.query('DELETE FROM cloud_migrations WHERE id = $1', [migrationId]);
        return res.status(204).end();
      } catch (error) {
        console.error(`Error al eliminar migración ${migrationId}:`, error);
        return res.status(500).json({ 
          error: 'Error al eliminar migración', 
          details: error.message 
        });
      }
    }
    
    // Método no permitido
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error(`Error al procesar solicitud para migración ${migrationId}:`, error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message 
    });
  }
}