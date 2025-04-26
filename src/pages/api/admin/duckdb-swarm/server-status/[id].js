import { pool } from '@/utils/db';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'ID de servidor inválido' });
  }

  const serverId = parseInt(id);

  switch (method) {
    case 'GET':
      try {
        // 1. Obtener información actual del servidor desde la base de datos
        const client = await pool.connect();
        try {
          const result = await client.query(
            'SELECT id, name, hostname, port, server_key, status FROM duckdb_servers WHERE id = $1',
            [serverId]
          );

          if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado' });
          }

          const server = result.rows[0];

          // Si el servidor ya está activo, simplemente devolver la información
          if (server.status === 'active') {
            return res.status(200).json({ success: true, server });
          }

          // 2. Verificar el estado del servidor a través del endpoint de DuckDB Swarm API
          try {
            const response = await fetch(`http://localhost:5001/api/servers/${serverId}/status`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });

            const statusResult = await response.json();

            // 3. Si el servidor está activo, actualizar su estado en la base de datos
            if (statusResult.status === 'active') {
              const updateResult = await client.query(
                'UPDATE duckdb_servers SET status = $1 WHERE id = $2 RETURNING *',
                ['active', serverId]
              );

              return res.status(200).json({
                success: true,
                server: updateResult.rows[0],
                statusInfo: statusResult
              });
            }

            // Si el servidor no está activo todavía, devolver el estado actual
            return res.status(200).json({
              success: true,
              server,
              statusInfo: statusResult
            });
          } catch (apiError) {
            console.error('Error al verificar estado del servidor con DuckDB API:', apiError);
            
            // Si no se puede conectar con la API, igual devolver la información del servidor
            return res.status(200).json({
              success: true,
              server,
              statusInfo: {
                status: 'unknown',
                error: apiError.message
              }
            });
          }
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Error al obtener estado del servidor:', error);
        return res.status(500).json({ error: 'Error al obtener estado del servidor: ' + error.message });
      }

    default:
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: `Método ${method} no permitido` });
  }
}