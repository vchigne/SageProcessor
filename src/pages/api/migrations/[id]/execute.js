import { pool } from '../../../../lib/db';
import migrationService from '../../../../utils/cloud/migration-service';

export default async function handler(req, res) {
  // Solo permitimos POST para ejecutar migraciones
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  const { id } = req.query;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'ID de migración inválido' });
  }
  
  const migrationId = parseInt(id);
  
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
    
    // Verificar que la migración existe
    try {
      const migration = await migrationService.getMigrationTask(migrationId);
      
      // Verificar que la migración esté en estado pendiente
      if (migration.status !== migrationService.MigrationStatus.PENDING) {
        return res.status(400).json({ 
          error: 'Migración no ejecutable', 
          details: `La migración está en estado ${migration.status} y no puede ser ejecutada` 
        });
      }
      
      // Programar la ejecución
      const result = await migrationService.scheduleMigrationTask(migrationId);
      
      return res.status(200).json({
        success: true,
        migration_id: migrationId,
        scheduled: true,
        message: `Migración ${migrationId} programada para ejecución`
      });
    } catch (error) {
      console.error(`Error al obtener o programar migración ${migrationId}:`, error);
      
      // Si el error es que no existe la migración
      if (error.message === `No se encontró la tarea de migración con ID ${migrationId}`) {
        return res.status(404).json({ 
          error: 'Migración no encontrada', 
          details: error.message 
        });
      }
      
      throw error;
    }
  } catch (error) {
    console.error(`Error al ejecutar migración ${migrationId}:`, error);
    return res.status(500).json({ 
      error: 'Error al ejecutar migración', 
      details: error.message 
    });
  }
}