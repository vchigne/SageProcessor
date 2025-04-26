import { pool } from '@/utils/db';

async function getServer(serverId) {
  try {
    // Intentar obtener el servidor de la base de datos PostgreSQL
    const { rows } = await pool.query(
      'SELECT * FROM duckdb_servers WHERE id = $1',
      [serverId]
    );
    
    if (rows[0]) {
      return rows[0];
    }
    
    // Si no se encuentra en PostgreSQL, intentar obtenerlo de la API DuckDB Swarm
    console.log('No se encontró en PostgreSQL, intentando API DuckDB Swarm...');
    const response = await fetch(`http://localhost:5001/api/servers`);
    if (!response.ok) {
      throw new Error(`Error al obtener servidores de DuckDB Swarm API: ${response.status}`);
    }
    
    const data = await response.json();
    const server = data.servers.find(s => String(s.id) === String(serverId));
    
    if (server) {
      return {
        id: server.id,
        name: server.name,
        hostname: server.hostname,
        port: server.port,
        status: server.status,
        server_key: server.api_key || ''
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error obteniendo servidor:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // Solo permitir POST para iniciar httpserver
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { serverId, port = 9999, username, password } = req.body;

    if (!serverId) {
      return res.status(400).json({ success: false, error: 'Se requiere ID del servidor' });
    }

    // Validar credenciales para httpserver
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren nombre de usuario y contraseña para la autenticación del servidor HTTP'
      });
    }

    // Obtener información del servidor desde la base de datos
    const server = await getServer(serverId);
    
    if (!server) {
      return res.status(404).json({ success: false, error: 'Servidor no encontrado' });
    }

    if (server.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        error: `El servidor debe estar activo para iniciar httpserver. Estado actual: ${server.status}` 
      });
    }
    
    // Construir URL de la API DuckDB para iniciar el servidor HTTP
    const duckDBApiURL = `http://localhost:5001`;
    
    // Realizar solicitud al endpoint del servidor DuckDB para iniciar httpserver
    const httpServerResponse = await fetch(`${duckDBApiURL}/api/servers/${server.id}/httpserver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        port,
        auth: `${username}:${password}`
      })
    });
    
    if (!httpServerResponse.ok) {
      const errorData = await httpServerResponse.json().catch(() => ({ message: 'Error desconocido' }));
      return res.status(httpServerResponse.status).json({
        success: false,
        error: `Error al iniciar httpserver de DuckDB: ${errorData.message || errorData.error || 'Error desconocido'}`
      });
    }
    
    const httpServerData = await httpServerResponse.json();
    
    // En una implementación real, esta URL podría ser diferente dependiendo de la configuración de red
    const serverUrl = `http://${server.hostname}:${port}`;
    
    return res.status(200).json({
      success: true,
      connection_type: 'httpserver',
      server_url: serverUrl,
      credentials: {
        username,
        password: '********' // No devolver la contraseña real
      },
      sql_command: `INSTALL httpserver;\nLOAD httpserver;\nSELECT httpserve_start('0.0.0.0', ${port}, '${username}:${password}');`,
      message: 'Servidor HTTP de DuckDB iniciado correctamente'
    });
  } catch (error) {
    console.error('Error al iniciar httpserver de DuckDB:', error);
    return res.status(500).json({
      success: false,
      error: `Error interno del servidor: ${error.message}`
    });
  }
}