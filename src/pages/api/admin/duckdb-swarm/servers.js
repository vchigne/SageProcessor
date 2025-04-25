// API para gestionar servidores DuckDB
import { pool } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method } = req;

  switch (method) {
    case 'GET':
      try {
        // Simulamos obtener los servidores desde la base de datos
        return res.status(200).json({
          success: true,
          servers: [
            {
              id: 1,
              hostname: 'localhost',
              port: 1294,
              server_type: 'general',
              is_local: true,
              status: 'active',
              created_at: '2025-04-24T12:00:00Z',
              last_seen: '2025-04-25T10:30:00Z'
            },
            {
              id: 2,
              hostname: 'duckdb-analytics.example.com',
              port: 1294,
              server_type: 'analytics',
              is_local: false,
              status: 'standby',
              created_at: '2025-04-23T09:15:00Z',
              last_seen: '2025-04-25T08:45:00Z'
            }
          ]
        });
      } catch (error) {
        console.error('Error getting servers:', error);
        return res.status(500).json({ error: 'Error al obtener servidores' });
      }

    case 'POST':
      try {
        // Extraer datos del nuevo servidor
        const {
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
        }

        // Aquí normalmente guardaríamos el servidor en la base de datos
        // Por ahora, simplemente devolvemos éxito y un ID ficticio
        return res.status(200).json({
          success: true,
          server: {
            id: 3,
            hostname,
            port,
            server_type,
            is_local: !!is_local,
            status: 'starting',
            created_at: new Date().toISOString(),
            cloud_secret_id,
            bucket_name
          }
        });
      } catch (error) {
        console.error('Error creating server:', error);
        return res.status(500).json({ error: 'Error al crear servidor' });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Método ${method} no permitido` });
  }
}