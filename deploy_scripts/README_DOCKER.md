# Despliegue SAGE con Docker

Esta guía te ayudará a desplegar la plataforma SAGE usando Docker y Docker Compose.

## Requisitos Previos

- Docker 20.0+
- Docker Compose 2.0+
- 4GB RAM mínimo
- 20GB espacio en disco

## Configuración Rápida

### 1. Preparar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar variables de entorno
nano .env
```

Configurar al menos estas variables:
```bash
PGDATABASE=sage_production
PGUSER=sage_user
PGPASSWORD=tu_password_seguro
```

### 2. Construir y Ejecutar

```bash
# Construir e iniciar todos los servicios
docker-compose up --build -d

# Ver logs
docker-compose logs -f sage-web
```

### 3. Verificar Despliegue

```bash
# Verificar que todos los servicios estén corriendo
docker-compose ps

# Acceder a la aplicación
curl http://localhost:5000/api/health
```

## Configuración Detallada

### Servicios Incluidos

1. **sage-web**: Aplicación principal (Next.js + Python daemons)
2. **postgres**: Base de datos PostgreSQL
3. **nginx**: Proxy reverso y balanceador de carga

### Variables de Entorno Importantes

```bash
# Base de datos (obligatorias)
DATABASE_URL=postgresql://sage_user:password@postgres:5432/sage_production
PGHOST=postgres
PGPORT=5432
PGDATABASE=sage_production
PGUSER=sage_user
PGPASSWORD=password

# Aplicación
NODE_ENV=production
PORT=5000
MAX_FILE_SIZE=100MB

# Opcional: configuración de proveedores de nube
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
```

### Volúmenes Persistentes

Los siguientes directorios se persisten automáticamente:

- `./executions` - Archivos de ejecuciones
- `./logs` - Logs del sistema
- `./uploads` - Archivos subidos
- `./backups` - Respaldos
- `postgres_data` - Datos de PostgreSQL

### Puertos Expuestos

- `5000` - Aplicación web SAGE
- `80` - Nginx (proxy)
- `443` - Nginx HTTPS (si se configura SSL)
- `5432` - PostgreSQL (para conexiones externas)

## Comandos Útiles

### Gestión de Servicios

```bash
# Iniciar servicios
docker-compose up -d

# Detener servicios
docker-compose down

# Reiniciar un servicio específico
docker-compose restart sage-web

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f sage-web
```

### Acceso a Contenedores

```bash
# Ejecutar comandos en el contenedor principal
docker-compose exec sage-web bash

# Acceder a PostgreSQL
docker-compose exec postgres psql -U sage_user -d sage_production

# Ver procesos en el contenedor
docker-compose exec sage-web ps aux
```

### Mantenimiento

```bash
# Backup de base de datos
docker-compose exec postgres pg_dump -U sage_user sage_production > backup.sql

# Restaurar backup
docker-compose exec -T postgres psql -U sage_user sage_production < backup.sql

# Limpiar logs
docker-compose exec sage-web find ./logs -name "*.log" -mtime +7 -delete

# Ver uso de espacio
docker system df
docker-compose exec sage-web df -h
```

## Configuración SSL/HTTPS

### 1. Preparar Certificados

```bash
# Crear directorio para certificados
mkdir ssl

# Copiar certificados
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem
```

### 2. Actualizar nginx.conf

Descomentar la sección HTTPS en `nginx.conf` y actualizar el dominio:

```nginx
server {
    listen 443 ssl http2;
    server_name tu-dominio.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    # ... resto de configuración
}
```

### 3. Reiniciar Nginx

```bash
docker-compose restart nginx
```

## Monitoreo y Logging

### Health Checks

```bash
# Verificar salud de la aplicación
curl http://localhost:5000/api/health

# Verificar estado de los contenedores
docker-compose ps
```

### Logs

```bash
# Logs de aplicación
docker-compose logs sage-web

# Logs de base de datos
docker-compose logs postgres

# Logs de nginx
docker-compose logs nginx

# Logs en tiempo real con filtro
docker-compose logs -f --tail=100 sage-web
```

### Métricas

```bash
# Uso de recursos
docker stats

# Información de contenedores
docker-compose exec sage-web top
docker-compose exec sage-web free -h
docker-compose exec sage-web df -h
```

## Solución de Problemas

### Problemas Comunes

**Error de conexión a base de datos:**
```bash
# Verificar que PostgreSQL esté corriendo
docker-compose ps postgres

# Ver logs de PostgreSQL
docker-compose logs postgres

# Reiniciar PostgreSQL
docker-compose restart postgres
```

**Aplicación no accesible:**
```bash
# Verificar puertos
docker-compose ps

# Verificar logs de nginx
docker-compose logs nginx

# Verificar configuración de red
docker network ls
```

**Falta de espacio:**
```bash
# Limpiar contenedores no utilizados
docker system prune

# Limpiar volúmenes no utilizados
docker volume prune

# Ver uso de espacio
docker system df
```

**Problemas de permisos:**
```bash
# Verificar permisos de volúmenes
ls -la executions/ logs/ uploads/ backups/

# Corregir permisos si es necesario
sudo chown -R 1001:1001 executions/ logs/ uploads/ backups/
```

### Resetear Sistema

```bash
# Detener todos los servicios
docker-compose down

# Eliminar volúmenes (CUIDADO: elimina todos los datos)
docker-compose down -v

# Limpiar todo y empezar desde cero
docker-compose down -v --remove-orphans
docker system prune -a
docker-compose up --build -d
```

## Actualización

### Actualizar Aplicación

```bash
# Detener servicios
docker-compose down

# Actualizar código
git pull

# Reconstruir e iniciar
docker-compose up --build -d
```

### Actualizar Base de Datos

```bash
# Hacer backup antes de actualizar
docker-compose exec postgres pg_dump -U sage_user sage_production > backup_pre_update.sql

# Ejecutar migraciones (si las hay)
docker-compose exec sage-web python3 deploy_scripts/setup_server.py --skip-deps

# Verificar funcionamiento
curl http://localhost:5000/api/health
```

## Configuración de Producción

### Optimizaciones Recomendadas

1. **Configurar límites de recursos:**

```yaml
# En docker-compose.yml
services:
  sage-web:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1'
```

2. **Configurar restart policies:**

```yaml
services:
  sage-web:
    restart: unless-stopped
```

3. **Configurar health checks:**

Los health checks ya están configurados en el Dockerfile.

4. **Configurar logging:**

```yaml
services:
  sage-web:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Seguridad

- Usar contraseñas fuertes para PostgreSQL
- Configurar firewall para exponer solo puertos necesarios
- Usar HTTPS en producción
- Configurar backups automáticos
- Monitorear logs regularmente

Con esta configuración, tu aplicación SAGE estará lista para ejecutarse en cualquier servidor que soporte Docker.