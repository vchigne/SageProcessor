FROM python:3.11-slim AS base

# Instalar dependencias base
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    supervisor \
    openssh-server \
    net-tools \
    procps \
    nano \
    iputils-ping \
    iproute2 \
    iptables \
    && rm -rf /var/lib/apt/lists/*

# Configurar directorio de trabajo
WORKDIR /app

FROM base AS duckdb

# Instalar dependencias de Python
RUN pip install --no-cache-dir duckdb flask flask-cors gunicorn websockify

FROM duckdb AS desktop

# Instalar entorno gráfico
RUN apt-get update && apt-get install -y \
    xfce4 \
    xfce4-goodies \
    tigervnc-standalone-server \
    tigervnc-common \
    firefox-esr \
    dbus-x11 \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    xterm \
    && rm -rf /var/lib/apt/lists/*

FROM desktop
    
# Asegurarse de que el puerto 5901 esté abierto
RUN iptables -A INPUT -p tcp --dport 5901 -j ACCEPT || true

# Configurar directorio de trabajo
WORKDIR /app

# Copiar los archivos del servidor y scripts
COPY duckdb_server.py .
COPY start_vnc.sh .
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Las dependencias de Python ya se instalaron en la etapa duckdb

# Instalar noVNC para acceso web al VNC
RUN mkdir -p /opt && \
    cd /opt && \
    curl -L -o novnc.zip https://github.com/novnc/noVNC/archive/refs/tags/v1.4.0.zip && \
    unzip novnc.zip && \
    mv noVNC-1.4.0 novnc && \
    cd novnc && \
    ln -s vnc.html index.html

# Variables de entorno
ENV DUCKDB_PORT=1294
ENV DUCKDB_SERVER_KEY=""
ENV DUCKDB_DATA_DIR=/data
ENV VNC_PASSWORD="duckdb"
ENV VNC_GEOMETRY="1280x800"
ENV VNC_DEPTH=24
ENV DISPLAY=:1

# Crear directorios necesarios
RUN mkdir -p /data /root/.vnc /var/run/sshd

# Configurar VNC
RUN mkdir -p /root/.vnc && \
    echo "$VNC_PASSWORD" | vncpasswd -f > /root/.vnc/passwd && \
    chmod 600 /root/.vnc/passwd && \
    echo '#!/bin/bash\nxrdb $HOME/.Xresources\nstartxfce4 &' > /root/.vnc/xstartup && \
    chmod +x /root/.vnc/xstartup && \
    # Crear usuario admin para VNC
    useradd -m -s /bin/bash admin && \
    echo "admin:$VNC_PASSWORD" | chpasswd && \
    mkdir -p /home/admin/.vnc && \
    echo "$VNC_PASSWORD" | vncpasswd -f > /home/admin/.vnc/passwd && \
    chmod 600 /home/admin/.vnc/passwd && \
    echo '#!/bin/bash\nxrdb $HOME/.Xresources\nstartxfce4 &' > /home/admin/.vnc/xstartup && \
    chmod +x /home/admin/.vnc/xstartup && \
    chown -R admin:admin /home/admin/.vnc && \
    # Configurar TigerVNC para permitir conexiones remotas
    mkdir -p /etc/tigervnc && \
    echo "no-remote-connections=0" > /etc/tigervnc/vncserver-config-defaults && \
    echo "localhost=no" >> /etc/tigervnc/vncserver-config-defaults && \
    # Crear acceso directo en el escritorio
    mkdir -p /home/admin/Desktop && \
    echo '[Desktop Entry]\nVersion=1.0\nType=Application\nName=DuckDB UI\nComment=Iniciar interfaz gráfica de DuckDB\nExec=/home/admin/start-duckdb-ui.sh\nIcon=terminal\nPath=/home/admin\nTerminal=false\nStartupNotify=false' > /home/admin/Desktop/duckdb-ui.desktop && \
    chmod +x /home/admin/Desktop/duckdb-ui.desktop && \
    chown -R admin:admin /home/admin/Desktop

# Configurar SSH
RUN echo 'root:duckdb' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# Agregar un script para iniciar VNC manualmente si es necesario
RUN echo '#!/bin/bash\nvncserver -kill :1 || true\nvncserver :1 -localhost no -geometry $VNC_GEOMETRY -depth $VNC_DEPTH' > /usr/local/bin/start-vnc && \
    chmod +x /usr/local/bin/start-vnc && \
    echo '#!/bin/bash\nsupervisorctl restart vnc' > /usr/local/bin/restart-vnc && \
    chmod +x /usr/local/bin/restart-vnc

# Exponer puertos
EXPOSE 1294 5901 6080 22

# Dar permisos ejecutables a los scripts
RUN chmod +x start_vnc.sh

# Usar supervisord para iniciar múltiples servicios
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]