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
        is_local: server.is_local || false,
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

    // Verificar si el servidor es local
    if (server.is_local) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se puede establecer un túnel SSH para un servidor local' 
      });
    }

    if (server.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        error: `El servidor debe estar activo para iniciar SSH tunnel. Estado actual: ${server.status}` 
      });
    }
    
    // Obtener información SSH directamente del servidor
    console.log(`Obteniendo información SSH para servidor ID ${serverId}`);
    
    // Puerto local para el túnel (puerto arbitrario para el cliente)
    const localPort = 4213;
    
    // Puerto remoto donde está ejecutándose el servidor DuckDB (1294 es el puerto por defecto)
    const remotePort = 1294;
    
    // Recuperar la información SSH de la base de datos
    const { rows } = await pool.query(
      'SELECT ssh_host, ssh_port, ssh_username, port FROM duckdb_servers WHERE id = $1',
      [serverId]
    );
    
    console.log("Datos SSH recuperados:", rows);
    
    if (!rows || rows.length === 0 || !rows[0].ssh_host || !rows[0].ssh_username) {
      return res.status(400).json({
        success: false,
        error: 'Información SSH incompleta para este servidor'
      });
    }
    
    const sshInfo = rows[0];
    // Usar el puerto configurado para el servidor DuckDB en lugar de un valor hardcodeado
    const duckDBPort = sshInfo.port || remotePort;
    
    // Para pedir la contraseña al momento de ejecutar el comando, usamos -o "BatchMode no"
    const sshCommand = `ssh -L ${localPort}:localhost:${duckDBPort} -p ${sshInfo.ssh_port || 22} -o "BatchMode no" ${sshInfo.ssh_username}@${sshInfo.ssh_host}`;
    
    return res.status(200).json({
      success: true,
      connection_type: 'ssh_tunnel',
      ssh_host: sshInfo.ssh_host,
      ssh_port: sshInfo.ssh_port || 22,
      ssh_username: sshInfo.ssh_username,
      remote_port: duckDBPort,
      local_port: localPort,
      tunnel_command: sshCommand,
      ui_url: `http://localhost:${localPort}`,
      message: 'Información para túnel SSH generada correctamente',
      instructions: [
        'Para conectar a la API de DuckDB mediante SSH, siga estos pasos:',
        '1. Abra una terminal en su máquina local',
        `2. Ejecute el comando: ${sshCommand}`,
        '3. Introduzca la contraseña SSH cuando se le solicite',
        '4. Una vez establecida la conexión SSH, abra un navegador',
        `5. Pruebe la conexión accediendo a http://localhost:${localPort}/health?api_key=krx32aFF`,
        '6. Para ejecutar consultas, use http://localhost:${localPort}/query?q=SELECT+1&api_key=krx32aFF'
      ],
      api_key: "krx32aFF",
      api_endpoints: [
        // Ruta que ya sabemos que funciona
        { "path": "/health?api_key=krx32aFF", "description": "Verificar estado del servidor" },
        
        // Prueba de consultas con diferentes patrones
        { "path": "/api/v1/query?q=SELECT+1+AS+test&api_key=krx32aFF", "description": "Consulta con prefijo /api/v1" },
        { "path": "/v1/query?q=SELECT+1+AS+test&api_key=krx32aFF", "description": "Consulta con prefijo /v1" },
        { "path": "/api/sql?q=SELECT+1+AS+test&api_key=krx32aFF", "description": "Consulta a través de /api/sql" },
        { "path": "/sql?q=SELECT+1+AS+test&api_key=krx32aFF", "description": "Consulta a través de /sql" },
        { "path": "/run?q=SELECT+1+AS+test&api_key=krx32aFF", "description": "Consulta a través de /run" },
        
        // Pruebas POST (estas requieren usar curl o similar en la terminal)
        { "path": "/query (POST con q=SELECT 1 AS test y api_key=krx32aFF)", "description": "Consulta vía POST a /query" },
        { "path": "/api/query (POST con q=SELECT 1 AS test y api_key=krx32aFF)", "description": "Consulta vía POST a /api/query" },
        
        // Rutas de información del servidor
        { "path": "/status?api_key=krx32aFF", "description": "Estado del servidor" },
        { "path": "/version?api_key=krx32aFF", "description": "Versión del servidor" },
        { "path": "/info?api_key=krx32aFF", "description": "Información del servidor" },
        
        // Rutas para listar objetos
        { "path": "/tables?api_key=krx32aFF", "description": "Listar tablas" },
        { "path": "/schemas?api_key=krx32aFF", "description": "Listar esquemas" },
        { "path": "/databases?api_key=krx32aFF", "description": "Listar bases de datos" }
      ]
    });
  } catch (error) {
    console.error('Error al generar información de túnel SSH:', error);
    return res.status(500).json({
      success: false,
      error: `Error interno del servidor: ${error.message}`
    });
  }
}