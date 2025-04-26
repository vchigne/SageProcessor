// API para redesplegar un servidor DuckDB
// Este endpoint envía una solicitud al API de DuckDB Swarm para redesplegar un servidor
import { pool } from '../../../../../../utils/db';

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  // Solo permitimos método POST
  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Método ${method} no permitido` });
  }

  try {
    // Obtener datos del servidor desde la base de datos
    const client = await pool.connect();
    
    try {
      // Obtener información del servidor
      const result = await client.query(`
        SELECT 
          id, 
          hostname, 
          port, 
          server_key, 
          is_local,
          name,
          status
        FROM duckdb_servers 
        WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Servidor no encontrado' });
      }
      
      const server = result.rows[0];
      
      // Obtener las credenciales SSH desde la solicitud
      const { ssh_host, ssh_port, ssh_username, ssh_password, ssh_key } = req.body;
      
      // Verificar que se han proporcionado los datos necesarios
      if (!ssh_host) {
        return res.status(400).json({ error: 'Se requiere un host SSH para el despliegue' });
      }
      
      if (!ssh_username) {
        return res.status(400).json({ error: 'Se requiere un usuario SSH para el despliegue' });
      }
      
      // Debe tener al menos contraseña o clave SSH
      if (!ssh_password && !ssh_key) {
        return res.status(400).json({ error: 'Se requiere una contraseña o clave SSH para el despliegue' });
      }
      
      // Verificamos que el servidor no sea local
      if (server.is_local) {
        return res.status(400).json({ 
          error: 'No se puede redesplegar el servidor local' 
        });
      }
      
      // Asociar los datos SSH con el servidor
      server.ssh_host = ssh_host;
      server.ssh_port = ssh_port || 22;
      server.ssh_username = ssh_username;
      server.ssh_password = ssh_password || '';
      server.ssh_key = ssh_key || '';
      
      // Actualizar el estado del servidor a "deploying"
      await client.query(`
        UPDATE duckdb_servers
        SET status = 'deploying', updated_at = NOW()
        WHERE id = $1
      `, [server.id]);
      
      // Llamar al API de DuckDB Swarm para redesplegar
      try {
        console.log("Enviando datos al API:", JSON.stringify({
          ssh_host: server.ssh_host,
          ssh_port: server.ssh_port,
          ssh_username: server.ssh_username,
          ssh_password: "***", // No mostramos la contraseña en logs
          ssh_key: server.ssh_key ? "***" : "", // No mostramos la clave en logs
          port: server.port,
          server_key: server.server_key,
          redeploy: true // Indicamos que es un redespliegue
        }));
        
        const deployResponse = await fetch('http://localhost:5001/api/servers/deploy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ssh_host: server.ssh_host,
            ssh_port: server.ssh_port,
            ssh_username: server.ssh_username,
            ssh_password: server.ssh_password,
            ssh_key: server.ssh_key,
            port: server.port,
            server_key: server.server_key,
            redeploy: true // Indicamos que es un redespliegue
          })
        });
        
        if (!deployResponse.ok) {
          const errorData = await deployResponse.json();
          
          // Actualizar el estado del servidor a "error"
          await client.query(`
            UPDATE duckdb_servers
            SET status = 'error', updated_at = NOW()
            WHERE id = $1
          `, [server.id]);
          
          return res.status(deployResponse.status).json({
            error: `Error al redesplegar: ${errorData.message || 'Error desconocido'}`
          });
        }
        
        const deployResult = await deployResponse.json();
        
        if (!deployResult.success) {
          // Actualizar el estado del servidor a "error"
          await client.query(`
            UPDATE duckdb_servers
            SET status = 'error', updated_at = NOW()
            WHERE id = $1
          `, [server.id]);
          
          return res.status(500).json({ 
            error: `Error al redesplegar: ${deployResult.message || 'Error desconocido'}`
          });
        }
        
        // Actualizar el estado del servidor a "active" con manejo de errores mejorado
        try {
          await client.query(`
            UPDATE duckdb_servers
            SET status = 'active', updated_at = NOW(), last_seen = NOW()
            WHERE id = $1
          `, [server.id]);
        } catch (dbError) {
          console.error('Error al actualizar estado del servidor a "active":', dbError);
          // No bloqueamos la respuesta por errores de BD
        }
        
        return res.status(200).json({
          success: true,
          message: 'Servidor redesplegado correctamente',
          details: deployResult
        });
        
      } catch (deployError) {
        console.error('Error al conectar con el API de despliegue:', deployError);
        
        // Actualizar el estado del servidor a "error" con manejo de errores mejorado
        try {
          await client.query(`
            UPDATE duckdb_servers
            SET status = 'error', updated_at = NOW()
            WHERE id = $1
          `, [server.id]);
        } catch (dbError) {
          console.error('Error al actualizar estado del servidor a "error":', dbError);
          // No bloqueamos la respuesta por errores de BD
        }
        
        return res.status(500).json({ 
          error: `Error al conectar con el API de despliegue: ${deployError.message}`
        });
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error redeploying server:', error);
    return res.status(500).json({ error: 'Error al redesplegar servidor: ' + error.message });
  }
}