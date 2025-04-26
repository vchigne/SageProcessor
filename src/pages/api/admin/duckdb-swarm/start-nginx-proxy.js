import { pool } from '@/utils/db';

async function getServer(serverId) {
  try {
    // Intentar obtener el servidor de la base de datos PostgreSQL con información SSH
    const { rows } = await pool.query(
      'SELECT id, name, hostname, port, server_key, status, is_local, ssh_host, ssh_port, ssh_username, ssh_password, ssh_key FROM duckdb_servers WHERE id = $1',
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
  // Solo permitir POST para iniciar Nginx proxy
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { serverId, domain } = req.body;

    if (!serverId) {
      return res.status(400).json({ success: false, error: 'Se requiere ID del servidor' });
    }

    if (!domain) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere un dominio para configurar el proxy inverso'
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
        error: `El servidor debe estar activo para configurar Nginx. Estado actual: ${server.status}` 
      });
    }
    
    // Construir URL de la API DuckDB para iniciar la UI
    const duckDBApiURL = `http://localhost:5001`;
    
    // Verificar si tenemos información SSH para servidores remotos
    let sshInfo = null;
    let hasSSHAccess = false;
    
    if (!server.is_local && server.ssh_host && server.ssh_username) {
      sshInfo = {
        host: server.ssh_host,
        port: server.ssh_port || 22,
        username: server.ssh_username,
        password: server.ssh_password || null,
        key: server.ssh_key || null
      };
      
      hasSSHAccess = true;
      console.log(`Servidor remoto con acceso SSH: ${server.id} (${server.name})`);
    }
    
    // Realizar solicitud al endpoint para iniciar la UI primero
    const uiResponse = await fetch(`${duckDBApiURL}/start-ui`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (!uiResponse.ok) {
      const errorData = await uiResponse.json().catch(() => ({ message: 'Error desconocido' }));
      return res.status(uiResponse.status).json({
        success: false,
        error: `Error al iniciar UI de DuckDB para Nginx: ${errorData.message || errorData.error || 'Error desconocido'}`
      });
    }
    
    // Generar configuración de Nginx para el servidor
    const nginxConfig = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://localhost:4213;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;

    // Aquí se llamaría a un servicio para implementar la configuración en el servidor
    // En una implementación real, esto podría comunicarse con el servidor vía SSH para configurar Nginx
    
    // Crear un script para instalar y configurar Nginx
    const setupScript = `#!/bin/bash
# Script para configurar Nginx como proxy inverso para DuckDB UI

# Actualizar repositorios
apt-get update

# Instalar Nginx si no está instalado
if ! command -v nginx &> /dev/null; then
    echo "Instalando Nginx..."
    apt-get install -y nginx
fi

# Crear archivo de configuración
cat > /etc/nginx/sites-available/duckdb.conf << 'EOF'
${nginxConfig}
EOF

# Crear enlace simbólico si no existe
if [ ! -f /etc/nginx/sites-enabled/duckdb.conf ]; then
    ln -s /etc/nginx/sites-available/duckdb.conf /etc/nginx/sites-enabled/
fi

# Eliminar la configuración default si existe
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Probar la configuración
nginx -t

# Reiniciar Nginx
systemctl restart nginx

echo "Configuración de Nginx completada para ${domain}"
    `;
    
    // Si tenemos acceso SSH para un servidor remoto, podríamos ejecutar este script
    let sshCommand = '';
    if (hasSSHAccess) {
      sshCommand = `ssh -p ${sshInfo.port} ${sshInfo.username}@${sshInfo.host} 'bash -s' < setup_nginx.sh`;
    }
    
    return res.status(200).json({
      success: true,
      connection_type: 'nginx',
      domain: domain,
      nginx_config: nginxConfig,
      setup_script: setupScript,
      ssh_command: sshCommand,
      has_ssh_access: hasSSHAccess,
      setup_instructions: !hasSSHAccess ? [
        "1. Guarda el script de configuración como 'setup_nginx.sh'",
        "2. Asegúrate de que el script tiene permisos de ejecución: chmod +x setup_nginx.sh",
        "3. Ejecuta el script como root: sudo ./setup_nginx.sh",
        "4. Verifica que Nginx está funcionando: sudo systemctl status nginx"
      ] : [
        "1. Guarda el script de configuración como 'setup_nginx.sh'",
        "2. Asegúrate de que el script tiene permisos de ejecución: chmod +x setup_nginx.sh",
        `3. Ejecuta el comando: ${sshCommand}`,
        `4. O conéctate al servidor con: ssh -p ${sshInfo.port} ${sshInfo.username}@${sshInfo.host}`
      ],
      message: 'Configuración de proxy Nginx generada correctamente'
    });
  } catch (error) {
    console.error('Error al generar configuración de Nginx:', error);
    return res.status(500).json({
      success: false,
      error: `Error interno del servidor: ${error.message}`
    });
  }
}