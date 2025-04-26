// API para gestionar servidores DuckDB
import { pool } from '../../../../utils/db';

// Crear la tabla de servidores si no existe
async function createServersTableIfNotExists() {
  const client = await pool.connect();
  try {
    // Crear la tabla principal si no existe
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
    
    // Verificar y añadir columnas SSH si no existen
    // Usamos ALTER TABLE ADD COLUMN IF NOT EXISTS para PostgreSQL moderno
    try {
      // Verificar si las columnas existen
      const checkColumns = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'duckdb_servers' AND column_name = 'ssh_host'
      `);
      
      // Si no existen las columnas SSH, añadirlas
      if (checkColumns.rows.length === 0) {
        console.log('Añadiendo columnas SSH a la tabla duckdb_servers');
        await client.query(`
          ALTER TABLE duckdb_servers
          ADD COLUMN ssh_host VARCHAR(255),
          ADD COLUMN ssh_port INTEGER DEFAULT 22,
          ADD COLUMN ssh_username VARCHAR(255),
          ADD COLUMN ssh_password VARCHAR(255),
          ADD COLUMN ssh_key TEXT
        `);
      }
    } catch (error) {
      console.error('Error al añadir columnas SSH:', error);
      // Continuamos aunque haya un error para no bloquear la creación inicial
    }
    
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
        
        // Variable para controlar si el despliegue fue exitoso
        let deploy_successful = false;

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
            
            // Variable para indicar que el despliegue fue exitoso y se debe cambiar el estado a 'active'
            console.log('DuckDB desplegado exitosamente:', deployResult);
            deploy_successful = true;
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
              cloud_secret_id, bucket_name, installation_id,
              ssh_host, ssh_port, ssh_username, ssh_password, ssh_key
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            ) RETURNING *
          `, [
            name, 
            hostname, 
            port, 
            server_key || '', 
            server_type || 'general', 
            !!is_local, 
            deploy_successful ? 'active' : 'starting', 
            cloud_secret_id, 
            bucket_name, 
            installation_id || '',
            ssh_host || null,
            ssh_port || 22,
            ssh_username || null,
            ssh_password || null,
            ssh_key || null
          ]);
          
          console.log('Servidor DuckDB creado con credenciales SSH:', {
            ssh_host,
            ssh_port,
            ssh_username,
            ssh_password: ssh_password ? '******' : null,
            ssh_key: ssh_key ? '[CLAVE PRIVADA]' : null
          });
          
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

    case 'PUT':
      try {
        const { id } = req.query;
        
        if (!id) {
          return res.status(400).json({ error: 'Se requiere ID del servidor' });
        }
        
        // Extraer datos actualizados
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
          ssh_host,
          ssh_port,
          ssh_username,
          ssh_password,
          ssh_key,
          status
        } = req.body;
        
        // Validaciones básicas
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
        const client = await pool.connect();
        try {
          // Construir dinámicamente la consulta SQL y los parámetros
          let updateFields = [];
          let queryParams = [];
          let paramIndex = 1;
          
          // Agregamos cada campo solo si está definido
          if (name !== undefined) {
            updateFields.push(`name = $${paramIndex++}`);
            queryParams.push(name);
          }
          
          if (hostname !== undefined) {
            updateFields.push(`hostname = $${paramIndex++}`);
            queryParams.push(hostname);
          }
          
          if (port !== undefined) {
            updateFields.push(`port = $${paramIndex++}`);
            queryParams.push(port);
          }
          
          if (server_key !== undefined) {
            updateFields.push(`server_key = $${paramIndex++}`);
            queryParams.push(server_key);
          }
          
          if (server_type !== undefined) {
            updateFields.push(`server_type = $${paramIndex++}`);
            queryParams.push(server_type);
          }
          
          if (is_local !== undefined) {
            updateFields.push(`is_local = $${paramIndex++}`);
            queryParams.push(!!is_local);
          }
          
          if (status !== undefined) {
            updateFields.push(`status = $${paramIndex++}`);
            queryParams.push(status);
          }
          
          if (cloud_secret_id !== undefined) {
            updateFields.push(`cloud_secret_id = $${paramIndex++}`);
            queryParams.push(cloud_secret_id);
          }
          
          if (bucket_name !== undefined) {
            updateFields.push(`bucket_name = $${paramIndex++}`);
            queryParams.push(bucket_name);
          }
          
          if (installation_id !== undefined) {
            updateFields.push(`installation_id = $${paramIndex++}`);
            queryParams.push(installation_id);
          }
          
          if (ssh_host !== undefined) {
            updateFields.push(`ssh_host = $${paramIndex++}`);
            queryParams.push(ssh_host);
          }
          
          if (ssh_port !== undefined) {
            updateFields.push(`ssh_port = $${paramIndex++}`);
            queryParams.push(ssh_port);
          }
          
          if (ssh_username !== undefined) {
            updateFields.push(`ssh_username = $${paramIndex++}`);
            queryParams.push(ssh_username);
          }
          
          if (ssh_password !== undefined) {
            updateFields.push(`ssh_password = $${paramIndex++}`);
            queryParams.push(ssh_password);
          }
          
          if (ssh_key !== undefined) {
            updateFields.push(`ssh_key = $${paramIndex++}`);
            queryParams.push(ssh_key);
          }
          
          // Agregar updated_at timestamp
          updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
          
          // Solo continuar si hay campos para actualizar
          if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
          }
          
          // Agregar el ID del servidor como último parámetro
          queryParams.push(id);
          
          const query = `
            UPDATE duckdb_servers 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
          `;
          
          console.log('Ejecutando consulta de actualización:', query);
          console.log('Con parámetros:', queryParams);
          
          const result = await client.query(query, queryParams);
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Servidor no encontrado' });
          }
          
          console.log('Servidor DuckDB actualizado con credenciales SSH:', {
            ssh_host,
            ssh_port,
            ssh_username,
            ssh_password: ssh_password ? '******' : '[no modificado]',
            ssh_key: ssh_key ? '[CLAVE PRIVADA]' : '[no modificado]'
          });
          
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
      
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT']);
      return res.status(405).json({ error: `Método ${method} no permitido` });
  }
}