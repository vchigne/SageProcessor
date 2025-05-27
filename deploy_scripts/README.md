# Guía de Despliegue SAGE

Esta guía te ayudará a configurar el sistema SAGE en un servidor nuevo desde cero.

## Requisitos Previos

### Sistema Operativo
- Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- Mínimo 4GB RAM, 2 CPU cores
- 50GB de espacio en disco disponible

### Software Requerido
- PostgreSQL 12+
- Node.js 18+
- Python 3.9+
- npm 8+

## Instalación Paso a Paso

### 1. Preparar el Servidor

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias básicas
sudo apt install -y curl wget git build-essential

# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar Python y pip
sudo apt install -y python3 python3-pip python3-venv
```

### 2. Configurar PostgreSQL

```bash
# Cambiar al usuario postgres
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE sage_production;
CREATE USER sage_user WITH PASSWORD 'tu_password_seguro_aqui';
GRANT ALL PRIVILEGES ON DATABASE sage_production TO sage_user;
\q
```

### 3. Clonar y Configurar el Proyecto

```bash
# Clonar el repositorio
git clone <tu-repositorio-sage>
cd sage-project

# Dar permisos de ejecución al script de configuración
chmod +x deploy_scripts/setup_server.py
```

### 4. Ejecutar Script de Configuración Automática

```bash
# Ejecutar el script de configuración
python3 deploy_scripts/setup_server.py \
  --db-host localhost \
  --db-port 5432 \
  --db-name sage_production \
  --db-user sage_user \
  --db-password tu_password_seguro_aqui
```

### 5. Configuración Manual (si es necesario)

Si el script automático presenta problemas, puedes configurar manualmente:

#### 5.1 Inicializar Base de Datos
```bash
# Conectar a PostgreSQL e importar esquema
psql -h localhost -U sage_user -d sage_production -f deploy_scripts/init_database.sql
```

#### 5.2 Instalar Dependencias
```bash
# Dependencias de Node.js
npm install
npm run build

# Dependencias de Python
pip3 install -r requirements.txt
```

#### 5.3 Crear Archivo de Configuración
```bash
# Copiar y editar archivo de configuración
cp .env.example .env
nano .env
```

Contenido del archivo `.env`:
```bash
# Base de datos
DATABASE_URL=postgresql://sage_user:tu_password@localhost:5432/sage_production
PGHOST=localhost
PGPORT=5432
PGDATABASE=sage_production
PGUSER=sage_user
PGPASSWORD=tu_password

# Aplicación
NODE_ENV=production
PORT=3000
MAX_FILE_SIZE=100MB

# Logs
LOG_LEVEL=info
LOG_DIR=/var/log/sage
```

### 6. Configurar Servicios del Sistema

#### 6.1 Crear Service para Next.js
```bash
sudo nano /etc/systemd/system/sage-web.service
```

Contenido del archivo:
```ini
[Unit]
Description=SAGE Web Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/sage-project
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 6.2 Crear Service para SAGE Daemon
```bash
sudo nano /etc/systemd/system/sage-daemon.service
```

Contenido del archivo:
```ini
[Unit]
Description=SAGE Background Daemon
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/sage-project
Environment=PYTHONPATH=/path/to/sage-project
ExecStart=/usr/bin/python3 run_sage_daemon2.py
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
```

#### 6.3 Activar y Iniciar Servicios
```bash
# Recargar systemd
sudo systemctl daemon-reload

# Activar servicios para inicio automático
sudo systemctl enable sage-web
sudo systemctl enable sage-daemon

# Iniciar servicios
sudo systemctl start sage-web
sudo systemctl start sage-daemon

# Verificar estado
sudo systemctl status sage-web
sudo systemctl status sage-daemon
```

### 7. Configurar Nginx (Opcional)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Crear configuración
sudo nano /etc/nginx/sites-available/sage
```

Contenido del archivo:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar sitio
sudo ln -s /etc/nginx/sites-available/sage /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Configurar SSL con Let's Encrypt (Opcional)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com

# Configurar renovación automática
sudo crontab -e
# Añadir línea:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Verificación del Despliegue

### 1. Verificar Servicios
```bash
# Verificar que los servicios estén corriendo
sudo systemctl status sage-web
sudo systemctl status sage-daemon
sudo systemctl status postgresql
sudo systemctl status nginx

# Verificar puertos
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :80
```

### 2. Verificar Base de Datos
```bash
# Conectar a la base de datos
psql -h localhost -U sage_user -d sage_production

# Verificar tablas
\dt

# Ejecutar función de estadísticas
SELECT * FROM obtener_estadisticas_dashboard(30);
```

### 3. Verificar Aplicación Web
- Abrir navegador en `http://tu-servidor:3000` o `http://tu-dominio.com`
- Verificar que el dashboard cargue correctamente
- Probar cargar un archivo pequeño para validar el procesamiento

### 4. Verificar Logs
```bash
# Logs de la aplicación web
sudo journalctl -u sage-web -f

# Logs del daemon
sudo journalctl -u sage-daemon -f

# Logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Configuración Post-Despliegue

### 1. Configurar Proveedores de Nube
- Acceder al panel de administración
- Ir a "Proveedores de Nube"
- Configurar credenciales para AWS S3, Azure, GCP, etc.

### 2. Configurar Notificaciones por Email
- Ir a "Configuraciones de Email"
- Configurar servidor SMTP/IMAP
- Probar envío de notificaciones

### 3. Crear Casillas de Datos de Prueba
- Crear una instalación de prueba
- Configurar una casilla de datos
- Subir archivos YAML de configuración
- Probar procesamiento de archivos

## Mantenimiento

### Backup de Base de Datos
```bash
# Crear backup
pg_dump -h localhost -U sage_user sage_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
psql -h localhost -U sage_user sage_production < backup_file.sql
```

### Actualización del Sistema
```bash
# Detener servicios
sudo systemctl stop sage-web sage-daemon

# Actualizar código
git pull origin main
npm install
npm run build
pip3 install -r requirements.txt

# Reiniciar servicios
sudo systemctl start sage-web sage-daemon
```

### Limpieza de Archivos Antiguos
```bash
# Ejecutar función de limpieza en PostgreSQL
psql -h localhost -U sage_user -d sage_production -c "SELECT limpiar_ejecuciones_antiguas(90);"
```

## Solución de Problemas

### Problemas Comunes

1. **Error de conexión a base de datos**
   - Verificar credenciales en `.env`
   - Verificar que PostgreSQL esté corriendo
   - Verificar firewall

2. **Aplicación no accesible**
   - Verificar que el puerto 3000 esté abierto
   - Verificar configuración de Nginx
   - Verificar logs del servicio

3. **Archivos grandes no se cargan**
   - Verificar configuración de `client_max_body_size` en Nginx
   - Verificar configuración `MAX_FILE_SIZE` en `.env`
   - Verificar espacio en disco

4. **Daemon no procesa archivos**
   - Verificar logs del daemon
   - Verificar configuración de proveedores de nube
   - Verificar permisos de archivos

### Contacto de Soporte
Para problemas técnicos, contacta al equipo de desarrollo con:
- Logs del error
- Configuración del sistema
- Pasos para reproducir el problema

## Notas de Seguridad

- Cambiar todas las contraseñas por defecto
- Configurar firewall para permitir solo puertos necesarios
- Mantener el sistema actualizado
- Configurar backups automáticos
- Revisar logs regularmente para detectar actividad sospechosa