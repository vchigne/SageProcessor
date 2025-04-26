// API para gestionar un servidor DuckDB específico (obtener, actualizar, eliminar)
import { pool } from '../../../../../../utils/db';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;
  const serverId = parseInt(id);

  if (isNaN(serverId)) {
    return res.status(400).json({ error: 'ID de servidor inválido' });
  }

  switch (method) {
    case 'GET':
      try {
        // Obtener información del servidor desde la base de datos
        const client = await pool.connect();
        
        try {
          const result = await client.query(`
            SELECT * FROM duckdb_servers WHERE id = $1
          `, [serverId]);
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado' });
          }
          
          return res.status(200).json({
            success: true,
            server: result.rows[0]
          });
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Error getting server:', error);
        return res.status(500).json({ error: 'Error al obtener servidor: ' + error.message });
      }

    case 'PUT':
      try {
        // Extraer datos del servidor a actualizar
        const {
          name,
          hostname,
          port,
          server_key,
          server_type,
          is_local,
          installation_id,
          cloud_secret_id,
          bucket_name,
          // Incluir credenciales SSH si se proporcionan
          ssh_host,
          ssh_port,
          ssh_username,
          ssh_password,
          ssh_key
        } = req.body;

        // Validación simple
        if (!hostname) {
          return res.status(400).json({ error: 'Se requiere un hostname' });
        }

        if (!port) {
          return res.status(400).json({ error: 'Se requiere un puerto' });
        }
        
        if (!name) {
          return res.status(400).json({ error: 'Se requiere un nombre descriptivo' });
        }

        // Actualizar el servidor en la base de datos
        console.log(`Actualizando servidor ID ${serverId}:`, req.body);
        
        const client = await pool.connect();
        
        try {
          // Verificar si el servidor existe
          const checkResult = await client.query(`
            SELECT id FROM duckdb_servers WHERE id = $1
          `, [serverId]);
          
          if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado' });
          }
          
          // Construir la consulta de actualización con los campos proporcionados
          let updateQuery = `
            UPDATE duckdb_servers SET 
              name = $1, 
              hostname = $2, 
              port = $3, 
              server_type = $4, 
              is_local = $5,
              updated_at = NOW()
          `;
          
          const values = [
            name, 
            hostname, 
            parseInt(port), 
            server_type || 'general', 
            !!is_local
          ];
          
          // Agregar los campos opcionales si están presentes
          let paramIndex = 6;
          
          if (server_key !== undefined) {
            updateQuery += `, server_key = $${paramIndex}`;
            values.push(server_key);
            paramIndex++;
          }
          
          if (installation_id !== undefined) {
            updateQuery += `, installation_id = $${paramIndex}`;
            values.push(installation_id);
            paramIndex++;
          }
          
          if (cloud_secret_id !== undefined) {
            updateQuery += `, cloud_secret_id = $${paramIndex}`;
            values.push(cloud_secret_id);
            paramIndex++;
          }
          
          if (bucket_name !== undefined) {
            updateQuery += `, bucket_name = $${paramIndex}`;
            values.push(bucket_name);
            paramIndex++;
          }
          
          // Añadir credenciales SSH si se proporcionan
          if (ssh_host !== undefined) {
            updateQuery += `, ssh_host = $${paramIndex}`;
            values.push(ssh_host);
            paramIndex++;
          }
          
          if (ssh_port !== undefined) {
            updateQuery += `, ssh_port = $${paramIndex}`;
            values.push(parseInt(ssh_port) || 22);
            paramIndex++;
          }
          
          if (ssh_username !== undefined) {
            updateQuery += `, ssh_username = $${paramIndex}`;
            values.push(ssh_username);
            paramIndex++;
          }
          
          if (ssh_password !== undefined) {
            updateQuery += `, ssh_password = $${paramIndex}`;
            values.push(ssh_password);
            paramIndex++;
          }
          
          if (ssh_key !== undefined) {
            updateQuery += `, ssh_key = $${paramIndex}`;
            values.push(ssh_key);
            paramIndex++;
          }
          
          // Completar la consulta con la condición WHERE
          updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
          values.push(serverId);
          
          // Ejecutar la actualización
          const result = await client.query(updateQuery, values);
          
          return res.status(200).json({
            success: true,
            server: result.rows[0]
          });
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Error updating server:', error);
        return res.status(500).json({ error: 'Error al actualizar servidor: ' + error.message });
      }

    case 'DELETE':
      try {
        const client = await pool.connect();
        
        try {
          // Verificar si el servidor existe y es local
          const checkResult = await client.query(`
            SELECT id, name, is_local FROM duckdb_servers WHERE id = $1
          `, [serverId]);
          
          if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado' });
          }
          
          const server = checkResult.rows[0];
          
          // No permitir eliminar el servidor local
          if (server.is_local) {
            return res.status(400).json({ 
              error: 'No se puede eliminar el servidor local. Es necesario para el funcionamiento del sistema.' 
            });
          }
          
          // Eliminar el servidor
          await client.query(`
            DELETE FROM duckdb_servers WHERE id = $1
          `, [serverId]);
          
          return res.status(200).json({
            success: true,
            message: `Servidor ${server.name} (ID: ${serverId}) eliminado correctamente`
          });
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Error deleting server:', error);
        return res.status(500).json({ error: 'Error al eliminar servidor: ' + error.message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ error: `Método ${method} no permitido` });
  }
}