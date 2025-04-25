import { db } from '../../../../utils/db';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // GET - Listar servidores
    if (method === 'GET') {
      // Obtener los servidores desde la API Flask
      const response = await fetch('http://localhost:5001/api/servers');
      const data = await response.json();
      
      // La API devuelve un objeto con una propiedad 'servers'
      return res.status(200).json(data);
    }

    // POST - Agregar servidor
    if (method === 'POST') {
      const { 
        hostname, 
        port, 
        server_type, 
        server_key,
        is_local, 
        installation_id, 
        cloud_provider_id,
        deploy_server,
        ssh_host,
        ssh_port,
        ssh_username,
        ssh_password,
        ssh_key
      } = req.body;

      // Validación básica
      if (!hostname || !port || !server_type) {
        return res.status(400).json({ error: 'Se requieren hostname, port y server_type' });
      }

      // Validación para despliegue
      if (deploy_server && (!ssh_host || !ssh_username)) {
        return res.status(400).json({ error: 'Para desplegar un servidor se requieren ssh_host y ssh_username' });
      }

      // Validación para proveedor de nube
      if (!cloud_provider_id) {
        return res.status(400).json({ error: 'Se requiere un proveedor de nube para el almacenamiento' });
      }

      try {
        // Enviar solicitud a la API Flask
        const response = await fetch('http://localhost:5001/api/servers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            hostname,
            port: parseInt(port),
            server_type,
            server_key,
            is_local: is_local || false,
            installation_id: installation_id || null,
            cloud_provider_id: cloud_provider_id || null,
            deployment: deploy_server ? {
              ssh_host,
              ssh_port: parseInt(ssh_port),
              ssh_username,
              ssh_password,
              ssh_key
            } : null
          })
        });

        // Procesar la respuesta
        const data = await response.json();
        
        if (response.ok) {
          return res.status(201).json(data);
        } else {
          return res.status(response.status).json(data);
        }
      } catch (error) {
        console.error('Error al agregar servidor:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }

    // DELETE - Eliminar servidor
    if (method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Se requiere ID del servidor' });
      }
      
      try {
        // Enviar solicitud a la API Flask
        const response = await fetch(`http://localhost:5001/api/servers/${id}`, {
          method: 'DELETE'
        });
        
        // Procesar la respuesta
        const data = await response.json();
        
        return res.status(response.status).json(data);
      } catch (error) {
        console.error('Error al eliminar servidor:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }

    // PUT - Actualizar servidor
    if (method === 'PUT') {
      const { id } = req.query;
      const { 
        hostname, 
        port, 
        server_type, 
        is_local, 
        installation_id, 
        cloud_provider_id,
        status
      } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Se requiere ID del servidor' });
      }
      
      try {
        // Enviar solicitud a la API Flask
        const response = await fetch(`http://localhost:5001/api/servers/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            hostname,
            port: parseInt(port),
            server_type,
            is_local,
            installation_id,
            cloud_provider_id,
            status
          })
        });
        
        // Procesar la respuesta
        const data = await response.json();
        
        return res.status(response.status).json(data);
      } catch (error) {
        console.error('Error al actualizar servidor:', error);
        return res.status(500).json({ error: 'Error al comunicarse con el servidor DuckDB Swarm' });
      }
    }

    // Método no soportado
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Error en el servidor DuckDB:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}