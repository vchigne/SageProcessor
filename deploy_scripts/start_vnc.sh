#!/bin/bash
# Script para iniciar el servidor VNC

# Configurar logging más detallado
exec > >(tee -a /var/log/vnc-startup.log) 2>&1
echo "$(date): Iniciando script de configuración VNC"

# Establecer DISPLAY
export DISPLAY=:1
echo "$(date): DISPLAY configurado como $DISPLAY"

# Verificar configuración
echo "$(date): Geometría: $VNC_GEOMETRY, Profundidad: $VNC_DEPTH, Contraseña configurada: $(if [ -n "$VNC_PASSWORD" ]; then echo "Sí"; else echo "No"; fi)"

# Asegurarse que no hay sesiones VNC previas (para root y admin)
echo "$(date): Deteniendo sesiones VNC previas"
pkill -f Xtigervnc || true
vncserver -kill :1 &>/dev/null || true
su - admin -c "vncserver -kill :1" &>/dev/null || true

# Asegurarse que el directorio .vnc exista y tenga permisos correctos
echo "$(date): Configurando directorios .vnc"
mkdir -p /home/admin/.vnc
mkdir -p /root/.vnc

# Verificar permisos de los xstartup
echo "$(date): Verificando scripts xstartup"
if [ -f /home/admin/.vnc/xstartup ]; then
  echo "$(date): Script xstartup de admin existe"
  cat /home/admin/.vnc/xstartup
  chmod +x /home/admin/.vnc/xstartup
else
  echo "$(date): Creando script xstartup para admin"
  cat > /home/admin/.vnc/xstartup << 'EOF'
#!/bin/sh
[ -r $HOME/.Xresources ] && xrdb $HOME/.Xresources
export XKL_XMODMAP_DISABLE=1
export XDG_CURRENT_DESKTOP="XFCE"
startxfce4 &
EOF
  chmod +x /home/admin/.vnc/xstartup
fi

# Configuración VNC para permitir conexiones remotas
echo "$(date): Configurando parámetros VNC para permitir conexiones remotas"
cat > /home/admin/.vnc/config << EOF
no-remote-connections=0
localhost=no
AlwaysShared=1
EOF
chmod 644 /home/admin/.vnc/config
chown admin:admin /home/admin/.vnc/config -R

# Configurar contraseña VNC si está definida
if [ -n "$VNC_PASSWORD" ]; then
  echo "$(date): Configurando contraseña VNC para admin"
  echo "$VNC_PASSWORD" | vncpasswd -f > /home/admin/.vnc/passwd
  chmod 600 /home/admin/.vnc/passwd
  chown admin:admin /home/admin/.vnc/passwd
else
  echo "$(date): ADVERTENCIA: No se ha configurado contraseña VNC, usando 'duckdb' por defecto"
  echo "duckdb" | vncpasswd -f > /home/admin/.vnc/passwd
  chmod 600 /home/admin/.vnc/passwd
  chown admin:admin /home/admin/.vnc/passwd
fi

# Verificar que Xfce está instalado
echo "$(date): Verificando instalación de Xfce"
if ! command -v startxfce4 > /dev/null; then
  echo "$(date): ERROR: Xfce no está instalado, intentando instalar"
  apt-get update && apt-get install -y xfce4 xfce4-goodies
fi

# Iniciar servidor VNC para el usuario admin con acceso desde cualquier dirección IP
echo "$(date): Iniciando servidor VNC como usuario admin"
su - admin -c "touch ~/.Xauthority"
su - admin -c "vncserver :1 -geometry $VNC_GEOMETRY -depth $VNC_DEPTH -localhost no -SecurityTypes VncAuth -rfbauth /home/admin/.vnc/passwd"
VNC_STATUS=$?

if [ $VNC_STATUS -ne 0 ]; then
  echo "$(date): ERROR: Fallo al iniciar vncserver, código de salida: $VNC_STATUS"
  # Intentar iniciar sin algunos parámetros en caso de error
  echo "$(date): Intentando iniciar vncserver con parámetros mínimos"
  su - admin -c "vncserver :1"
  VNC_STATUS=$?
  
  if [ $VNC_STATUS -ne 0 ]; then
    echo "$(date): ERROR: Segundo intento fallido, código de salida: $VNC_STATUS"
    exit 1
  else
    echo "$(date): VNC iniciado con éxito en el segundo intento"
  fi
else
  echo "$(date): VNC iniciado con éxito en el primer intento"
fi

# Crear script para iniciar DuckDB-UI para usuario root
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

# Crear script para iniciar DuckDB-UI para usuario admin
cat > /home/admin/start-duckdb-ui.sh << 'EOF'
#!/bin/bash
# Iniciar servidor DuckDB con interfaz UI
cd ~
duckdb -ui &
# Esperar 5 segundos para que DuckDB inicie
sleep 5
# Abrir navegador con la interfaz
firefox http://localhost:4213 &
EOF

# Hacer ejecutable el script y asignar propiedad
chmod +x /home/admin/start-duckdb-ui.sh
chown admin:admin /home/admin/start-duckdb-ui.sh

# Mostrar mensaje informativo
echo "Servidor VNC iniciado en puerto 5901"
echo "noVNC (Web VNC) disponible en http://localhost:6080/vnc.html"
echo "DuckDB API escuchando en puerto 1294"
echo "Para iniciar DuckDB UI, ejecuta ~/start-duckdb-ui.sh desde el entorno VNC"

# Mantener el script en ejecución monitoreando los logs de VNC del usuario admin
tail -f /home/admin/.vnc/*xvnc.log