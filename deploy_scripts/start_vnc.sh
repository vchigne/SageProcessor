#!/bin/bash
# Script para iniciar el servidor VNC

# Asegurarse que no hay sesiones VNC previas (para root y admin)
vncserver -kill :1 || true
su - admin -c "vncserver -kill :1" || true

# Configuración VNC para permitir conexiones remotas
mkdir -p /home/admin/.vnc
echo "no-remote-connections=0" > /home/admin/.vnc/config
echo "localhost=no" >> /home/admin/.vnc/config
echo "AlwaysShared=1" >> /home/admin/.vnc/config
chmod 644 /home/admin/.vnc/config
chown admin:admin /home/admin/.vnc/config

# Iniciar servidor VNC para el usuario admin con acceso desde cualquier dirección IP
su - admin -c "vncserver :1 -geometry $VNC_GEOMETRY -depth $VNC_DEPTH -localhost no -SecurityTypes VncAuth -rfbauth /home/admin/.vnc/passwd"

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