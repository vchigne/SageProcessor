import { pool } from '../../../lib/db';
import migrationService from '../../../utils/cloud/migration-service';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // Obtener todas las migraciones
    if (method === 'GET') {
      try {
        // Verificar si la tabla existe
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'cloud_migrations'
          );
        `);
        
        // Si la tabla no existe, crear la tabla
        if (!tableCheck.rows[0].exists) {
          return res.status(404).json({ 
            error: 'Tabla de migraciones no encontrada',
            details: 'La funcionalidad de migraciones aún no está completamente implementada.'
          });
        }
        
        // Obtener migraciones con información de proveedores
        const migrations = await migrationService.getMigrationTasks();
        return res.status(200).json(migrations);
      } catch (error) {
        console.error('Error al obtener migraciones:', error);
        return res.status(500).json({ 
          error: 'Error al obtener migraciones', 
          details: error.message 
        });
      }
    }
    
    // Crear una nueva migración
    else if (method === 'POST') {
      try {
        const { 
          provider_id, 
          source_path, 
          target_path, 
          description, 
          options
        } = req.body;
        
        // Validar datos requeridos
        if (!provider_id || !source_path || !target_path) {
          return res.status(400).json({ 
            error: 'Datos incompletos', 
            details: 'Se requiere provider_id, source_path y target_path' 
          });
        }
        
        // Registrar la migración
        const migration = await migrationService.registerMigrationTask({
          provider_id,
          source_path,
          target_path,
          description,
          options
        });
        
        return res.status(201).json(migration);
      } catch (error) {
        console.error('Error al crear migración:', error);
        
        // Si la tabla no existe, responder con un 404
        if (error.message.includes('relation "cloud_migrations" does not exist')) {
          return res.status(404).json({ 
            error: 'Tabla de migraciones no encontrada',
            details: 'La funcionalidad de migraciones aún no está completamente implementada.'
          });
        }
        
        return res.status(500).json({ 
          error: 'Error al crear migración', 
          details: error.message 
        });
      }
    }
    
    // Método no permitido
    else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error al procesar solicitud de migraciones:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message 
    });
  }
}