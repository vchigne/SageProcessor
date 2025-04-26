FROM python:3.11-slim

# Instalar dependencias del sistema y entorno gráfico
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    supervisor \
    xfce4 \
    xfce4-goodies \
    tigervnc-standalone-server \
    tigervnc-common \
    firefox-esr \
    dbus-x11 \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    xterm \
    openssh-server \
    && rm -rf /var/lib/apt/lists/*

# Configurar directorio de trabajo
WORKDIR /app

# Copiar los archivos del servidor y scripts
COPY duckdb_server.py .
COPY start_vnc.sh .
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Instalar dependencias de Python
RUN pip install --no-cache-dir duckdb flask flask-cors gunicorn

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
    chmod +x /root/.vnc/xstartup

# Configurar SSH
RUN echo 'root:duckdb' | chpasswd && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# Exponer puertos
EXPOSE 1294 5901 22

# Dar permisos ejecutables a los scripts
RUN chmod +x start_vnc.sh

# Usar supervisord para iniciar múltiples servicios
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]