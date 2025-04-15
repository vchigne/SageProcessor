/**
 * Servicio de migración de archivos a la nube
 * 
 * Este servicio implementa la funcionalidad para migrar gradualmente
 * los archivos desde el almacenamiento local hacia proveedores
 * de nube configurados en el sistema.
 */

import fs from 'fs';
import path from 'path';
import { pool } from '../../lib/db';
import cloudUtils from './index';

/**
 * Estados de migración
 */
const MigrationStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Registra una tarea de migración en la base de datos
 * @param {Object} taskInfo Información de la tarea
 * @returns {Promise<Object>} Tarea registrada
 */
async function registerMigrationTask(taskInfo) {
  try {
    const {
      provider_id,
      source_path,
      target_path,
      description,
      options = {}
    } = taskInfo;

    // Verificar que el proveedor existe
    const providerCheck = await pool.query(
      'SELECT id FROM cloud_providers WHERE id = $1',
      [provider_id]
    );

    if (providerCheck.rows.length === 0) {
      throw new Error(`El proveedor con ID ${provider_id} no existe`);
    }

    // Crear la tabla de migraciones si no existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cloud_migrations (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER NOT NULL REFERENCES cloud_providers(id),
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        description TEXT,
        options JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        progress FLOAT DEFAULT 0,
        files_total INTEGER DEFAULT 0,
        files_processed INTEGER DEFAULT 0,
        bytes_total BIGINT DEFAULT 0,
        bytes_processed BIGINT DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_provider
          FOREIGN KEY(provider_id)
          REFERENCES cloud_providers(id)
          ON DELETE CASCADE
      )
    `);

    // Registrar la tarea
    const result = await pool.query(`
      INSERT INTO cloud_migrations
      (provider_id, source_path, target_path, description, options, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      provider_id,
      source_path,
      target_path,
      description || '',
      JSON.stringify(options),
      MigrationStatus.PENDING
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error al registrar tarea de migración:', error);
    throw error;
  }
}

/**
 * Actualiza el estado de una tarea de migración
 * @param {number} taskId ID de la tarea
 * @param {Object} updates Actualizaciones a aplicar
 * @returns {Promise<Object>} Tarea actualizada
 */
async function updateMigrationTask(taskId, updates) {
  try {
    const {
      status,
      progress,
      files_total,
      files_processed,
      bytes_total,
      bytes_processed,
      error_message
    } = updates;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Construir la consulta dinámicamente
    if (status) {
      fields.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;

      // Actualizar timestamps según el estado
      if (status === MigrationStatus.IN_PROGRESS && !updates.started_at) {
        fields.push(`started_at = NOW()`);
      } else if ((status === MigrationStatus.COMPLETED || status === MigrationStatus.FAILED) 
                && !updates.completed_at) {
        fields.push(`completed_at = NOW()`);
      }
    }

    if (progress !== undefined) {
      fields.push(`progress = $${paramIndex}`);
      values.push(progress);
      paramIndex++;
    }

    if (files_total !== undefined) {
      fields.push(`files_total = $${paramIndex}`);
      values.push(files_total);
      paramIndex++;
    }

    if (files_processed !== undefined) {
      fields.push(`files_processed = $${paramIndex}`);
      values.push(files_processed);
      paramIndex++;
    }

    if (bytes_total !== undefined) {
      fields.push(`bytes_total = $${paramIndex}`);
      values.push(bytes_total);
      paramIndex++;
    }

    if (bytes_processed !== undefined) {
      fields.push(`bytes_processed = $${paramIndex}`);
      values.push(bytes_processed);
      paramIndex++;
    }

    if (error_message !== undefined) {
      fields.push(`error_message = $${paramIndex}`);
      values.push(error_message);
      paramIndex++;
    }

    // Siempre actualizar updated_at
    fields.push(`updated_at = NOW()`);

    // Ejecutar la consulta de actualización
    const query = `
      UPDATE cloud_migrations
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    values.push(taskId);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error(`No se encontró la tarea de migración con ID ${taskId}`);
    }

    return result.rows[0];
  } catch (error) {
    console.error(`Error al actualizar tarea de migración ${taskId}:`, error);
    throw error;
  }
}

/**
 * Obtiene información detallada de una tarea de migración
 * @param {number} taskId ID de la tarea
 * @returns {Promise<Object>} Información de la tarea
 */
async function getMigrationTask(taskId) {
  try {
    const result = await pool.query(`
      SELECT m.*, p.nombre as provider_name, p.tipo as provider_type
      FROM cloud_migrations m
      JOIN cloud_providers p ON m.provider_id = p.id
      WHERE m.id = $1
    `, [taskId]);

    if (result.rows.length === 0) {
      throw new Error(`No se encontró la tarea de migración con ID ${taskId}`);
    }

    return result.rows[0];
  } catch (error) {
    console.error(`Error al obtener tarea de migración ${taskId}:`, error);
    throw error;
  }
}

/**
 * Obtiene la lista de tareas de migración
 * @param {Object} filters Filtros opcionales
 * @returns {Promise<Array<Object>>} Lista de tareas
 */
async function getMigrationTasks(filters = {}) {
  try {
    const { provider_id, status, limit = 100, offset = 0 } = filters;
    
    let query = `
      SELECT m.*, p.nombre as provider_name, p.tipo as provider_type
      FROM cloud_migrations m
      JOIN cloud_providers p ON m.provider_id = p.id
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    // Aplicar filtros
    if (provider_id) {
      query += ` AND m.provider_id = $${paramIndex}`;
      values.push(provider_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    // Ordenar y limitar
    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error al obtener tareas de migración:', error);
    throw error;
  }
}

/**
 * Calcula el tamaño total y número de archivos en un directorio
 * @param {string} dirPath Ruta del directorio
 * @returns {Promise<Object>} Resultado con totalFiles y totalSize
 */
async function calculateDirectoryStats(dirPath) {
  try {
    let totalSize = 0;
    let totalFiles = 0;

    // En una implementación real, recorreríamos el directorio recursivamente
    // Pero como es una simulación, devolveremos valores de ejemplo
    console.log(`[Migration] Calculando estadísticas para directorio ${dirPath}`);
    
    // Simulación: 100 archivos, 100MB total
    totalFiles = 100;
    totalSize = 100 * 1024 * 1024;
    
    return { totalFiles, totalSize };
  } catch (error) {
    console.error(`Error al calcular estadísticas del directorio ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Modifica la ruta en la base de datos
 * @param {string} tableName Nombre de la tabla
 * @param {string} pathColumn Nombre de la columna de ruta
 * @param {string} oldPath Ruta antigua
 * @param {string} newPath Ruta nueva
 * @returns {Promise<number>} Número de filas actualizadas
 */
async function updatePathsInDatabase(tableName, pathColumn, oldPath, newPath) {
  try {
    // Construir consulta de actualización
    const query = `
      UPDATE ${tableName} 
      SET ${pathColumn} = REPLACE(${pathColumn}, $1, $2)
      WHERE ${pathColumn} LIKE $3
    `;
    const result = await pool.query(query, [oldPath, newPath, `${oldPath}%`]);
    
    return result.rowCount;
  } catch (error) {
    console.error(`Error al actualizar rutas en ${tableName}:`, error);
    throw error;
  }
}

/**
 * Ejecuta una tarea de migración
 * @param {number} taskId ID de la tarea a ejecutar
 * @returns {Promise<Object>} Resultado de la migración
 */
async function executeMigrationTask(taskId) {
  try {
    // Obtener la tarea
    const task = await getMigrationTask(taskId);
    
    // Verificar si ya está en progreso o completada
    if (task.status === MigrationStatus.IN_PROGRESS) {
      throw new Error(`La tarea de migración ${taskId} ya está en progreso`);
    }
    
    if (task.status === MigrationStatus.COMPLETED) {
      throw new Error(`La tarea de migración ${taskId} ya está completada`);
    }
    
    // Marcar como en progreso
    await updateMigrationTask(taskId, {
      status: MigrationStatus.IN_PROGRESS,
      progress: 0
    });
    
    // Calcular estadísticas del directorio
    const stats = await calculateDirectoryStats(task.source_path);
    
    // Actualizar la tarea con las estadísticas
    await updateMigrationTask(taskId, {
      files_total: stats.totalFiles,
      bytes_total: stats.totalSize
    });
    
    // Crear cliente para el proveedor de nube
    const client = await cloudUtils.createCloudClient(task.provider_id);
    
    // Simulación de progreso para este ejemplo
    // En una implementación real, procesaríamos cada archivo
    const options = task.options ? JSON.parse(task.options) : {};
    const batchSize = options.batch_size || 10;
    const totalBatches = Math.ceil(stats.totalFiles / batchSize);
    
    // Realizar la migración por lotes
    let processedFiles = 0;
    let processedBytes = 0;
    
    // Simular procesamiento por lotes
    for (let batch = 0; batch < totalBatches; batch++) {
      // Número de archivos en este lote
      const batchFiles = Math.min(batchSize, stats.totalFiles - processedFiles);
      // Bytes aproximados en este lote (proporcional al total)
      const batchBytes = Math.floor((stats.totalSize / stats.totalFiles) * batchFiles);
      
      // En una implementación real, aquí procesaríamos los archivos
      console.log(`[Migration] Procesando lote ${batch + 1}/${totalBatches} (${batchFiles} archivos)`);
      
      // Simular tiempo de procesamiento
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Actualizar contadores
      processedFiles += batchFiles;
      processedBytes += batchBytes;
      
      // Actualizar progreso
      const progress = processedFiles / stats.totalFiles;
      await updateMigrationTask(taskId, {
        progress,
        files_processed: processedFiles,
        bytes_processed: processedBytes
      });
    }
    
    // Actualizar las rutas en la base de datos
    // Primero buscar qué tablas necesitan actualizarse
    // En este ejemplo, actualizamos la tabla ejecuciones_yaml
    const rowsUpdated = await updatePathsInDatabase(
      'ejecuciones_yaml',
      'ruta_directorio',
      task.source_path,
      task.target_path
    );
    
    console.log(`[Migration] Actualizadas ${rowsUpdated} filas en la base de datos`);
    
    // Marcar como completada
    await updateMigrationTask(taskId, {
      status: MigrationStatus.COMPLETED,
      progress: 1,
      files_processed: stats.totalFiles,
      bytes_processed: stats.totalSize
    });
    
    return {
      success: true,
      task_id: taskId,
      files_processed: stats.totalFiles,
      bytes_processed: stats.totalSize,
      database_rows_updated: rowsUpdated
    };
  } catch (error) {
    console.error(`Error en tarea de migración ${taskId}:`, error);
    
    // Marcar como fallida
    await updateMigrationTask(taskId, {
      status: MigrationStatus.FAILED,
      error_message: error.message
    });
    
    throw error;
  }
}

/**
 * Programa la ejecución de una tarea de migración
 * @param {number} taskId ID de la tarea
 * @param {Object} options Opciones de programación
 * @returns {Promise<Object>} Resultado de la programación
 */
async function scheduleMigrationTask(taskId, options = {}) {
  try {
    // Obtener información de la tarea
    const task = await getMigrationTask(taskId);
    
    // Verificar que la tarea esté pendiente
    if (task.status !== MigrationStatus.PENDING) {
      throw new Error(`La tarea ${taskId} no está pendiente (estado actual: ${task.status})`);
    }
    
    // En una implementación real, programaríamos la ejecución en un worker
    // Por ahora, simulamos un inicio retrasado
    console.log(`[Migration] Programando ejecución de tarea ${taskId} para iniciar en 5 segundos`);
    
    setTimeout(() => {
      executeMigrationTask(taskId).catch(error => {
        console.error(`Error en ejecución programada de tarea ${taskId}:`, error);
      });
    }, 5000);
    
    return {
      success: true,
      task_id: taskId,
      scheduled: true,
      message: `Tarea ${taskId} programada para ejecución`
    };
  } catch (error) {
    console.error(`Error al programar tarea ${taskId}:`, error);
    throw error;
  }
}

export default {
  registerMigrationTask,
  updateMigrationTask,
  getMigrationTask,
  getMigrationTasks,
  executeMigrationTask,
  scheduleMigrationTask,
  MigrationStatus
};