import { pool } from '@/utils/db';

export default async function handler(req, res) {
  // Solo permitir solicitudes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Se requiere ID del servidor' });
  }

  try {
    // Verificar que el servidor exista y esté en estado 'deploying'
    const serverCheck = await pool.query(
      'SELECT id, status FROM duckdb_servers WHERE id = $1',
      [id]
    );

    if (serverCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Servidor no encontrado' });
    }

    const server = serverCheck.rows[0];
    
    if (server.status !== 'deploying') {
      return res.status(400).json({ 
        error: 'Solo se pueden cancelar despliegues en progreso',
        status: server.status
      });
    }

    // Actualizar el estado del servidor a 'error'
    await pool.query(
      'UPDATE duckdb_servers SET status = $1, last_error = $2, updated_at = NOW() WHERE id = $3',
      ['error', 'Despliegue cancelado por el usuario', id]
    );

    // Registrar la operación en la tabla de logs
    await pool.query(
      'INSERT INTO duckdb_server_logs (server_id, operation, status, message, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [id, 'deploy_cancel', 'completed', 'Despliegue cancelado manualmente por el usuario']
    );

    return res.status(200).json({
      message: 'Despliegue cancelado exitosamente',
      server_id: id
    });
  } catch (error) {
    console.error('Error al cancelar el despliegue:', error);
    return res.status(500).json({ error: `Error al cancelar el despliegue: ${error.message}` });
  }
}