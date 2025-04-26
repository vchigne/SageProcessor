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
    
    return null;
  } catch (error) {
    console.error('Error obteniendo servidor:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // Solo permitir POST para configurar VNC
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { serverId, vncPassword } = req.body;

    if (!serverId) {
      return res.status(400).json({ success: false, error: 'Se requiere ID del servidor' });
    }

    if (!vncPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere una contraseña para la conexión VNC'
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
        error: `El servidor debe estar activo para configurar VNC. Estado actual: ${server.status}` 
      });
    }
    
    // Verificar que tenemos información SSH para el servidor remoto
    if (!server.ssh_host || !server.ssh_username) {
      return res.status(400).json({
        success: false,
        error: 'Configuración VNC requiere acceso SSH al servidor. Verifique la configuración SSH del servidor.'
      });
    }
    
    const sshInfo = {
      host: server.ssh_host,
      port: server.ssh_port || 22,
      username: server.ssh_username,
      password: server.ssh_password || null,
      key: server.ssh_key || null
    };
    
    console.log(`Preparando configuración VNC para servidor ${server.id} (${server.name}) en ${sshInfo.host}`);
    
    // Crear script para instalar y configurar VNC
    const setupScript = `#!/bin/bash
# Script para configurar entorno VNC con DuckDB UI

# Actualizar repositorios
echo "Actualizando repositorios..."
apt-get update

# Instalar entorno gráfico ligero (Xfce)
echo "Instalando Xfce..."
apt-get install -y xfce4 xfce4-goodies

# Instalar servidor VNC (TigerVNC)
echo "Instalando TigerVNC..."
apt-get install -y tigervnc-standalone-server

# Crear directorio .vnc si no existe
mkdir -p ~/.vnc

# Configurar contraseña VNC
echo "${vncPassword}" | vncpasswd -f > ~/.vnc/passwd
chmod 600 ~/.vnc/passwd

# Crear archivo de configuración para iniciar Xfce
cat > ~/.vnc/xstartup << 'EOF'
#!/bin/bash
xrdb $HOME/.Xresources
startxfce4 &
EOF

# Hacer ejecutable el archivo de inicio
chmod +x ~/.vnc/xstartup

# Detener sesiones VNC existentes
vncserver -kill :1 || true

# Iniciar servidor VNC
vncserver :1 -geometry 1280x800 -depth 24

# Instalar navegador web si no está instalado
apt-get install -y firefox

# Crear script para iniciar DuckDB-UI en el navegador
cat > ~/start-duckdb-ui.sh << 'EOF'
#!/bin/bash
# Iniciar servidor DuckDB con interfaz UI
cd ~
duckdb -ui &
# Esperar 5 segundos para que DuckDB inicie
sleep 5
# Abrir navegador con la interfaz
firefox http://localhost:4213 &
EOF

# Hacer ejecutable el script
chmod +x ~/start-duckdb-ui.sh

echo "Configuración VNC completada. Servidor escuchando en puerto 5901."
echo "Para conectarse, use un cliente VNC (como RealVNC, TightVNC o Remmina) y conecte a ${server.ssh_host}:5901"
echo "Una vez conectado, ejecute ~/start-duckdb-ui.sh para iniciar la interfaz DuckDB"
`;

    // Información para la conexión SSH
    const sshCommand = `ssh -p ${sshInfo.port} ${sshInfo.username}@${sshInfo.host} 'bash -s' < setup_vnc.sh`;
    
    // Generar respuesta JSON
    return res.status(200).json({
      success: true,
      connection_type: 'vnc',
      server_name: server.name,
      server_host: sshInfo.host,
      vnc_port: 5901,
      setup_script: setupScript,
      ssh_command: sshCommand,
      instructions: [
        "Para configurar VNC en el servidor remoto:",
        "1. Guarda el script proporcionado como 'setup_vnc.sh'",
        "2. Asegúrate de que el script tiene permisos de ejecución: chmod +x setup_vnc.sh",
        `3. Ejecuta el comando: ${sshCommand}`,
        "4. Una vez completada la instalación, conecta usando un cliente VNC:",
        `   - Servidor: ${sshInfo.host}:5901`,
        `   - Contraseña: ${vncPassword}`,
        "5. Dentro del entorno gráfico, ejecuta ~/start-duckdb-ui.sh para iniciar DuckDB"
      ],
      message: 'Instrucciones de configuración VNC generadas correctamente'
    });
  } catch (error) {
    console.error('Error al generar configuración VNC:', error);
    return res.status(500).json({
      success: false,
      error: `Error interno del servidor: ${error.message}`
    });
  }
}