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
  // Solo permitir POST para iniciar SSH tunnel
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
        error: `El servidor debe estar activo para iniciar SSH tunnel. Estado actual: ${server.status}` 
      });
    }
    
    // Obtener información de SSH desde la base de datos
    const { rows } = await pool.query(
      'SELECT ssh_host, ssh_port, ssh_username FROM duckdb_servers WHERE id = $1',
      [serverId]
    );
    
    const sshInfo = rows[0];
    
    if (!sshInfo || !sshInfo.ssh_host || !sshInfo.ssh_username) {
      return res.status(400).json({
        success: false,
        error: 'Información SSH incompleta para este servidor'
      });
    }
    
    // Para una conexión SSH real se necesitaría implementar un servicio de túnel SSH
    // Aquí devolvemos la información para que el cliente ejecute el comando localmente
    
    // Puerto local para el túnel (usamos 4213 para DuckDB UI)
    const localPort = 4213;
    
    return res.status(200).json({
      success: true,
      connection_type: 'ssh',
      tunnel_command: `ssh -L ${localPort}:localhost:4213 ${sshInfo.ssh_username}@${sshInfo.ssh_host} -p ${sshInfo.ssh_port || 22}`,
      ui_url: `http://localhost:${localPort}`,
      message: 'Información para túnel SSH generada correctamente'
    });
  } catch (error) {
    console.error('Error al generar información de túnel SSH:', error);
    return res.status(500).json({
      success: false,
      error: `Error interno del servidor: ${error.message}`
    });
  }
}