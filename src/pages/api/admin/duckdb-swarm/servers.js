// API para gestionar servidores DuckDB
import { pool } from '../../../../utils/db';

// Crear la tabla de servidores si no existe
async function createServersTableIfNotExists() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS duckdb_servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        hostname VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        server_key VARCHAR(255),
        server_type VARCHAR(50) NOT NULL,
        is_local BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'stopped',
        cloud_secret_id VARCHAR(255),
        bucket_name VARCHAR(255),
        installation_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);
    
    // Verificar si hay servidores y crear el servidor local por defecto si no hay
    const checkResult = await client.query('SELECT COUNT(*) FROM duckdb_servers');
    
    if (parseInt(checkResult.rows[0].count) === 0) {
      // No hay servidores, crear el servidor local por defecto
      await client.query(`
        INSERT INTO duckdb_servers (
          name, hostname, port, server_type, is_local, status
        ) VALUES (
          'Servidor Local', 'localhost', 1294, 'general', TRUE, 'active'
        )
      `);
    }
  } finally {
    client.release();
  }
}

export default async function handler(req, res) {
  const { method } = req;

  switch (method) {
    case 'GET':
      try {
        // Asegurarse de que la tabla existe y tiene al menos un servidor local
        await createServersTableIfNotExists();
        
        // Obtener la conexión a la base de datos
        const client = await pool.connect();
        
        try {
          // Consultar todos los servidores
          const result = await client.query(`
            SELECT * FROM duckdb_servers ORDER BY id
          `);
          
          return res.status(200).json({
            success: true,
            servers: result.rows
          });
        } finally {
          // Liberar la conexión
          client.release();
        }
      } catch (error) {
        console.error('Error getting servers:', error);
        return res.status(500).json({ error: 'Error al obtener servidores: ' + error.message });
      }

    case 'POST':
      try {
        // Extraer datos del nuevo servidor
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
          deploy_server,
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

        // Validar que se ha seleccionado un secreto cloud y un bucket
        if (!cloud_secret_id) {
          return res.status(400).json({ error: 'Se requiere un secreto de nube para el almacenamiento' });
        }

        if (!bucket_name) {
          return res.status(400).json({ error: 'Se requiere un bucket para el almacenamiento' });
        }

        // Si se va a desplegar, validar que se han proporcionado los datos de SSH
        if (deploy_server) {
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
          
          // Enviar solicitud al endpoint de despliegue para instalar DuckDB en el servidor remoto
          try {
            const deployResponse = await fetch('http://localhost:5001/api/servers/deploy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                ssh_host,
                ssh_port,
                ssh_username,
                ssh_password,
                ssh_key,
                port,
                server_key
              })
            });
            
            const deployResult = await deployResponse.json();
            
            if (!deployResult.success) {
              console.error('Error en el despliegue de DuckDB:', deployResult);
              return res.status(500).json({ 
                error: `Error al desplegar DuckDB: ${deployResult.message || 'Error desconocido'}` 
              });
            }
            
            console.log('DuckDB desplegado exitosamente:', deployResult);
          } catch (deployError) {
            console.error('Error al conectar con el API de despliegue:', deployError);
            return res.status(500).json({ 
              error: `Error al conectar con el API de despliegue: ${deployError.message}` 
            });
          }
        }

        // Guardar el servidor en la base de datos
        const client = await pool.connect();
        try {
          const result = await client.query(`
            INSERT INTO duckdb_servers (
              name, hostname, port, server_key, server_type, is_local, status, 
              cloud_secret_id, bucket_name, installation_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            ) RETURNING *
          `, [
            name, 
            hostname, 
            port, 
            server_key || '', 
            server_type || 'general', 
            !!is_local, 
            'starting', 
            cloud_secret_id, 
            bucket_name, 
            installation_id || ''
          ]);
          
          return res.status(201).json({
            success: true,
            server: result.rows[0]
          });
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Error creating server:', error);
        return res.status(500).json({ error: 'Error al crear servidor: ' + error.message });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Método ${method} no permitido` });
  }
}