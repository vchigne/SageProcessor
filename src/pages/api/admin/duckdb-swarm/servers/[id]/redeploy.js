// API para redesplegar un servidor DuckDB
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
    // En una implementación real, aquí obtendríamos la información del servidor
    // desde la base de datos y luego realizaríamos el redespliegue
    
    // Simulamos obtener datos del servidor de la base de datos
    const server = {
      id: parseInt(id),
      hostname: `server-${id}.example.com`,
      port: 1294,
      server_key: 'server-key-secret',
      is_local: parseInt(id) === 1, // El servidor con ID 1 es local
      ssh_host: `server-${id}.example.com`,
      ssh_port: 22,
      ssh_username: 'deployer',
      // En una implementación real, estas credenciales estarían almacenadas de forma segura
      ssh_password: '', // Normalmente usaríamos clave SSH en lugar de contraseña
      ssh_key: '-----BEGIN RSA PRIVATE KEY----- (contenido truncado para seguridad) -----END RSA PRIVATE KEY-----'
    };
    
    // Verificamos que el servidor no sea local
    if (server.is_local) {
      return res.status(400).json({ 
        error: 'No se puede redesplegar el servidor local' 
      });
    }
    
    // Llamar al API de DuckDB Swarm para redesplegar
    try {
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
        return res.status(deployResponse.status).json({
          error: `Error al redesplegar: ${errorData.message || 'Error desconocido'}`
        });
      }
      
      const deployResult = await deployResponse.json();
      
      if (!deployResult.success) {
        return res.status(500).json({ 
          error: `Error al redesplegar: ${deployResult.message || 'Error desconocido'}`
        });
      }
      
      // Aquí actualizaríamos el estado del servidor en la base de datos
      
      return res.status(200).json({
        success: true,
        message: 'Servidor redesplegado correctamente',
        details: deployResult
      });
      
    } catch (deployError) {
      console.error('Error al conectar con el API de despliegue:', deployError);
      return res.status(500).json({ 
        error: `Error al conectar con el API de despliegue: ${deployError.message}`
      });
    }
    
  } catch (error) {
    console.error('Error redeploying server:', error);
    return res.status(500).json({ error: 'Error al redesplegar servidor' });
  }
}