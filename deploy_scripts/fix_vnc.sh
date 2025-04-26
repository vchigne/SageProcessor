#!/bin/bash
# Script para corregir y configurar correctamente el servidor VNC
# Este script debe ejecutarse dentro del contenedor Docker como root

# Habilitar modo depuración
set -x

echo "[$(date)] Iniciando script de reparación de VNC..."

# Asegurar instalación de paquetes necesarios
echo "[$(date)] Verificando e instalando paquetes necesarios..."
apt-get update
apt-get install -y tigervnc-standalone-server tigervnc-common net-tools procps xfce4 xfce4-goodies

# Configurar variable DISPLAY
export DISPLAY=:1
echo "[$(date)] DISPLAY configurado como $DISPLAY"

# Configurar variables de entorno para el usuario admin
export USER=admin
export HOME=/home/admin
mkdir -p $HOME/.vnc

# Definir geometría y profundidad de color
VNC_GEOMETRY="1280x800"
VNC_DEPTH=24
VNC_PASSWORD="duckdb"

# Detener posibles sesiones VNC activas
echo "[$(date)] Deteniendo posibles sesiones VNC activas..."
pkill -f Xtigervnc || true
pkill -f "Xtightvnc :1" || true
vncserver -kill :1 &>/dev/null || true
su - admin -c "vncserver -kill :1" &>/dev/null || true

# Limpiar archivos de bloqueo
echo "[$(date)] Limpiando archivos de bloqueo..."
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1 || true
su - admin -c "rm -f /tmp/.X1-lock /tmp/.X11-unix/X1" || true

# Configurar directorio .vnc para admin
echo "[$(date)] Configurando directorio .vnc para admin..."
mkdir -p /home/admin/.vnc
chmod 750 /home/admin/.vnc

# Crear archivo de configuración VNC
echo "[$(date)] Creando archivo de configuración para permitir conexiones remotas..."
cat > /home/admin/.vnc/config << EOF
no-remote-connections=0
localhost=no
AlwaysShared=1
EOF
chmod 644 /home/admin/.vnc/config

# Crear script xstartup para admin
echo "[$(date)] Creando script xstartup para admin..."
cat > /home/admin/.vnc/xstartup << 'EOF'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS

[ -r $HOME/.Xresources ] && xrdb $HOME/.Xresources
[ -r $HOME/.Xdefaults ] && xrdb $HOME/.Xdefaults

export XKL_XMODMAP_DISABLE=1
export XDG_CURRENT_DESKTOP="XFCE"
export XDG_RUNTIME_DIR=/tmp/runtime-admin

# Iniciar xfce
startxfce4 &
EOF
chmod 755 /home/admin/.vnc/xstartup

# Configurar contraseña VNC para admin
echo "[$(date)] Configurando contraseña VNC para admin..."
echo "$VNC_PASSWORD" | vncpasswd -f > /home/admin/.vnc/passwd
chmod 600 /home/admin/.vnc/passwd

# Asegurar permisos correctos
echo "[$(date)] Asignando permisos correctos..."
chown -R admin:admin /home/admin/.vnc

# Iniciar servidor VNC como admin
echo "[$(date)] Iniciando servidor VNC como usuario admin..."
su - admin -c "touch ~/.Xauthority"
su - admin -c "vncserver :1 -geometry $VNC_GEOMETRY -depth $VNC_DEPTH -localhost no -rfbport 5901 -SecurityTypes VncAuth -rfbauth /home/admin/.vnc/passwd"

# Verificar si el servidor se inició correctamente
if [ $? -ne 0 ]; then
  echo "[$(date)] Error al iniciar vncserver, intentando con configuración mínima..."
  su - admin -c "vncserver :1 -localhost no"
  
  if [ $? -ne 0 ]; then
    echo "[$(date)] Error en segundo intento, usando configuración básica..."
    su - admin -c "vncserver"
    
    if [ $? -ne 0 ]; then
      echo "[$(date)] FALLÓ COMPLETAMENTE: No se pudo iniciar VNC"
      exit 1
    else
      echo "[$(date)] VNC iniciado con configuración básica"
    fi
  else
    echo "[$(date)] VNC iniciado con configuración simplificada"
  fi
else
  echo "[$(date)] VNC iniciado con éxito"
fi

# Verificar que el puerto 5901 está abierto y escuchando
echo "[$(date)] Verificando puerto 5901..."
netstat -tuln | grep -E ":5901"

# Verificar procesos VNC en ejecución
echo "[$(date)] Verificando procesos VNC en ejecución..."
ps aux | grep -E "(vnc|Xtigervnc)"

echo "[$(date)] Verificación completada. VNC debería estar ejecutándose en el puerto 5901"