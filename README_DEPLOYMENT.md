# Guía de Despliegue SAGE

Esta guía cubre las diferentes opciones de despliegue para la plataforma SAGE.

## Opciones de Despliegue

### 1. Docker (Recomendado)

La opción más sencilla para despliegue en producción.

```bash
# Clonar repositorio
git clone <repository-url>
cd sage-platform

# Configurar variables de entorno
cp .env.example .env
nano .env

# Desplegar con Docker Compose
docker-compose up --build -d
```

**Ventajas:**
- Instalación automática de dependencias
- Gestión integrada de servicios
- Fácil escalabilidad
- Aislamiento de entorno

Ver documentación completa: [deploy_scripts/README_DOCKER.md](deploy_scripts/README_DOCKER.md)

### 2. Servidor Tradicional

Para instalaciones en servidores dedicados.

```bash
# Ejecutar script de configuración
python3 deploy_scripts/setup_server.py --install-deps
```

**Ventajas:**
- Control total del entorno
- Personalización avanzada
- Integración con sistemas existentes

Ver documentación completa: [deploy_scripts/README_SERVER.md](deploy_scripts/README_SERVER.md)

## Requisitos del Sistema

### Mínimos
- 4GB RAM
- 2 CPU cores
- 20GB espacio en disco
- PostgreSQL 12+
- Node.js 18+
- Python 3.8+

### Recomendados (Producción)
- 8GB RAM
- 4 CPU cores
- 100GB espacio en disco
- PostgreSQL 15+
- Node.js 20+
- Python 3.11+

## Variables de Entorno Críticas

```bash
# Base de datos (obligatorias)
DATABASE_URL=postgresql://user:pass@host:5432/db
PGHOST=localhost
PGPORT=5432
PGDATABASE=sage_production
PGUSER=sage_user
PGPASSWORD=secure_password

# Aplicación
NODE_ENV=production
PORT=5000
MAX_FILE_SIZE=100MB
```

## Verificación Post-Despliegue

1. **Verificar servicios:**
```bash
curl http://localhost:5000/api/health
```

2. **Verificar base de datos:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM casillas_datos;"
```

3. **Verificar logs:**
```bash
tail -f logs/sage_daemon.log
tail -f logs/janitor_daemon.log
```

## Monitoreo

### Health Checks
- `/api/health` - Estado general de la aplicación
- `/api/database/health` - Estado de la base de datos
- `/api/services/status` - Estado de los daemons

### Métricas Importantes
- Uso de memoria y CPU
- Espacio en disco disponible
- Tiempo de respuesta de APIs
- Tasa de error en procesamientos

## Backup y Recuperación

### Backup Automático
Los daemons de SAGE realizan backup automático a múltiples proveedores cloud configurados.

### Backup Manual
```bash
# Base de datos
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Archivos de ejecución
tar -czf executions_backup.tar.gz executions/

# Configuración
cp .env config_backup.env
```

### Recuperación
```bash
# Restaurar base de datos
psql $DATABASE_URL < backup_20250529.sql

# Restaurar archivos
tar -xzf executions_backup.tar.gz
```

## Solución de Problemas Comunes

### Error de Conexión a Base de Datos
```bash
# Verificar conectividad
pg_isready -h $PGHOST -p $PGPORT

# Verificar credenciales
psql $DATABASE_URL -c "SELECT 1;"
```

### Aplicación No Responde
```bash
# Verificar procesos
ps aux | grep -E "(node|python.*sage)"

# Reiniciar servicios
systemctl restart sage-web
# o para Docker:
docker-compose restart sage-web
```

### Problemas de Espacio en Disco
```bash
# Limpiar logs antiguos
find logs/ -name "*.log" -mtime +30 -delete

# Limpiar ejecuciones migradas
python3 scripts/cleanup_old_executions.py --days 90
```

## Actualizaciones

### Actualización de Código
```bash
git pull origin main
docker-compose up --build -d
# o para servidor tradicional:
systemctl restart sage-web
```

### Migración de Base de Datos
```bash
# Backup antes de migrar
pg_dump $DATABASE_URL > pre_migration_backup.sql

# Ejecutar migraciones
python3 deploy_scripts/setup_server.py --migrate-only
```

## Seguridad

### Configuraciones Recomendadas
- Usar HTTPS en producción
- Configurar firewall restrictivo
- Rotación regular de contraseñas
- Monitoreo de logs de seguridad
- Backups cifrados

### Puertos a Exponer
- `5000` - Aplicación web principal
- `80/443` - Nginx (si se usa)
- `5432` - PostgreSQL (solo si es necesario acceso externo)

Con esta guía, el despliegue de SAGE debería ser sencillo y confiable en cualquier entorno.