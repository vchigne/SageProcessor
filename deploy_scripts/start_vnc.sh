#!/bin/bash
# Script para iniciar el servidor VNC

# Asegurarse que no hay sesiones VNC previas
vncserver -kill :1 || true

# Iniciar servidor VNC
vncserver :1 -geometry $VNC_GEOMETRY -depth $VNC_DEPTH

# Crear script para iniciar DuckDB-UI
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

# Mostrar mensaje informativo
echo "Servidor VNC iniciado en puerto 5901"
echo "DuckDB API escuchando en puerto 1294"
echo "Para iniciar DuckDB UI, ejecuta ~/start-duckdb-ui.sh desde el entorno VNC"

# Mantener el script en ejecución
tail -f /root/.vnc/*xvnc.log