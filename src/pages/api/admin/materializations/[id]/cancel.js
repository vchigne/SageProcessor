import { pool } from '../../../../../utils/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  const { id } = req.query;
  const materializationId = parseInt(id);
  
  if (isNaN(materializationId)) {
    return res.status(400).json({ message: 'ID de materialización inválido' });
  }

  const conn = pool;
  
  try {
    // Verificar que la materialización exista
    const checkQuery = `SELECT * FROM materializaciones WHERE id = $1`;
    const checkResult = await conn.query(checkQuery, [materializationId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Materialización no encontrada' });
    }
    
    // Buscar procesos activos de esta materialización
    const activeQuery = `
      SELECT * FROM materializaciones_ejecuciones 
      WHERE materialization_id = $1 
      AND estado = 'en_proceso'
    `;
    const activeResult = await conn.query(activeQuery, [materializationId]);
    
    if (activeResult.rows.length === 0) {
      return res.status(200).json({ 
        message: 'No hay procesos activos para esta materialización',
        processesFound: 0,
        processesCancelled: 0
      });
    }
    
    console.log(`Encontrados ${activeResult.rows.length} procesos activos para materialización ${materializationId}`);
    
    // Marcar estos procesos como cancelados en la base de datos
    const updateQuery = `
      UPDATE materializaciones_ejecuciones 
      SET estado = 'cancelado', 
          mensaje = 'Cancelado manualmente',
          fecha_fin = NOW()
      WHERE materialization_id = $1 
      AND estado = 'en_proceso'
      RETURNING execution_id
    `;
    const updateResult = await conn.query(updateQuery, [materializationId]);
    
    // Intentar terminar los procesos a nivel de sistema operativo
    let processKilled = 0;
    
    try {
      // Buscar procesos Python que estén ejecutando sage.main con la casilla_id
      const { stdout } = await execAsync(`ps aux | grep "sage.main" | grep "casilla-id" | grep -v grep`);
      
      // Procesar cada línea
      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const pid = parts[1]; // El PID debería estar en la segunda columna
        
        if (pid && /^\d+$/.test(pid)) {
          // Verificar si este proceso tiene uno de los execution_ids que queremos cancelar
          const executionIds = updateResult.rows.map(row => row.execution_id);
          
          const matchesExecution = executionIds.some(exId => line.includes(exId));
          const matchesMaterialization = line.includes(`materializacion-id ${materializationId}`);
          
          if (matchesExecution || matchesMaterialization) {
            // Intentar matar el proceso
            try {
              await execAsync(`kill -9 ${pid}`);
              processKilled++;
              console.log(`Proceso PID ${pid} terminado para materialización ${materializationId}`);
            } catch (killError) {
              console.error(`Error al terminar proceso ${pid}:`, killError);
            }
          }
        }
      }
    } catch (psError) {
      // No hay procesos, o hubo algún error al ejecutar ps
      console.log('No se encontraron procesos coincidentes o error al buscar:', psError);
    }
    
    return res.status(200).json({
      message: `${updateResult.rowCount} procesos de materialización marcados como cancelados`,
      processesFound: activeResult.rows.length,
      processesCancelled: updateResult.rowCount,
      processesKilled: processKilled
    });
    
  } catch (error) {
    console.error('Error al cancelar procesos de materialización:', error);
    return res.status(500).json({ 
      message: 'Error al cancelar procesos de materialización', 
      error: error.message 
    });
  }
}