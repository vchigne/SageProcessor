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
  // Solo permitir POST para iniciar UI
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { serverId } = req.body;

    if (!serverId) {
      return res.status(400).json({ success: false, error: 'Se requiere ID del servidor' });
    }

    // Obtener información del servidor desde la base de datos
    const server = await getServer(serverId);
    
    if (!server) {
      return res.status(404).json({ success: false, error: 'Servidor no encontrado' });
    }

    if (server.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        error: `El servidor debe estar activo para iniciar la UI. Estado actual: ${server.status}` 
      });
    }
    
    // Construir URL de la API DuckDB para iniciar la UI Notebook
    const duckDBApiURL = `http://localhost:5001`;
    
    // Obtener la lista de servidores desde la API de DuckDB para traducir el ID
    const serversResponse = await fetch(`${duckDBApiURL}/api/servers`);
    if (!serversResponse.ok) {
      return res.status(500).json({ 
        success: false, 
        error: `Error al obtener lista de servidores DuckDB: ${serversResponse.status}` 
      });
    }
    
    const duckdbServers = await serversResponse.json();
    const duckdbServer = duckdbServers.servers && duckdbServers.servers.length > 0 ? 
                         duckdbServers.servers[0] : null;
    
    if (!duckdbServer) {
      return res.status(404).json({ 
        success: false, 
        error: `No hay servidores disponibles en DuckDB Swarm` 
      });
    }
    
    // Usar el primer servidor disponible (en este caso el servidor local)
    const duckdbServerId = duckdbServer.id;
    
    // Realizar solicitud al endpoint de notebook UI del servidor DuckDB
    const duckDBUIResponse = await fetch(`${duckDBApiURL}/api/servers/${duckdbServerId}/notebook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (!duckDBUIResponse.ok) {
      const errorData = await duckDBUIResponse.json().catch(() => ({ message: 'Error desconocido' }));
      return res.status(duckDBUIResponse.status).json({
        success: false,
        error: `Error al iniciar UI DuckDB: ${errorData.message || errorData.error || 'Error desconocido'}`
      });
    }
    
    const uiData = await duckDBUIResponse.json();
    
    // Devolver la URL de la UI
    return res.status(200).json({
      success: true,
      ui_url: uiData.ui_url || `${duckDBApiURL}/ui`,
      message: 'UI de DuckDB iniciada correctamente'
    });
  } catch (error) {
    console.error('Error al iniciar UI DuckDB:', error);
    return res.status(500).json({
      success: false,
      error: `Error interno del servidor: ${error.message}`
    });
  }
}