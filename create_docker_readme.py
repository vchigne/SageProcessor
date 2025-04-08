import os

# Contenido del README para Docker
docker_readme = """# Despliegue de SAGE con Docker

Esta documentación proporciona instrucciones detalladas para desplegar la aplicación SAGE utilizando Docker. La configuración utiliza Docker Compose para gestionar múltiples contenedores, incluyendo la aplicación principal y una base de datos PostgreSQL.

## Requisitos Previos

- Docker instalado (versión 19.03.0+)
- Docker Compose instalado (versión 1.27.0+)
- Al menos 2GB de RAM disponible para los contenedores
- Conocimientos básicos de Docker y línea de comandos

## Estructura de Directorios

```
sage/
├── docker/
│   ├── Dockerfile            # Definición de la imagen de la aplicación
│   ├── docker-compose.yml    # Configuración de Docker Compose
│   ├── supervisord.conf      # Configuración de supervisord
│   ├── .env.example          # Ejemplo de variables de entorno
│   └── init-scripts/         # Scripts de inicialización para la base de datos
│       └── init-db.sh        # Script de inicialización de la BD
└── ... (otros archivos de la aplicación)
```

## Configuración Inicial

1. Crea un archivo `.env` en el directorio `docker/` basado en `.env.example`:

   ```bash
   cp docker/.env.example docker/.env
   ```

2. Edita el archivo `.env` para configurar las variables de entorno según tus necesidades:
   - Configura las credenciales de la base de datos
   - Ajusta la configuración de correo electrónico si es necesario
   - Configura otras variables específicas del entorno

## Despliegue

Para desplegar la aplicación, sigue estos pasos:

1. Construye las imágenes y crea los contenedores:

   ```bash
   cd docker
   docker-compose up -d --build
   ```

2. Verifica que los contenedores estén ejecutándose correctamente:

   ```bash
   docker-compose ps
   ```

3. Accede a la aplicación en tu navegador:

   ```
   http://localhost:5000
   ```

## Gestión de Contenedores

### Ver Logs

Para ver los logs de los contenedores:

```bash
# Logs de la aplicación SAGE
docker-compose logs sage

# Logs de la base de datos
docker-compose logs db

# Logs en tiempo real
docker-compose logs -f
```

### Detener la Aplicación

Para detener los contenedores sin eliminarlos:

```bash
docker-compose stop
```

### Iniciar la Aplicación

Si los contenedores ya están creados y deseas iniciarlos:

```bash
docker-compose start
```

### Reiniciar la Aplicación

Para reiniciar todos los servicios:

```bash
docker-compose restart
```

### Eliminar Contenedores

Para detener y eliminar los contenedores, redes y volúmenes:

```bash
docker-compose down
```

Si también deseas eliminar los volúmenes de datos persistentes (¡CUIDADO: esto eliminará todos los datos!):

```bash
docker-compose down -v
```

## Solución de Problemas

### Conexión a la Base de Datos

Si la aplicación no puede conectarse a la base de datos:

1. Verifica que el contenedor de la base de datos esté en ejecución:
   ```bash
   docker-compose ps db
   ```

2. Comprueba que la URL de conexión en el archivo `.env` es correcta:
   ```
   DATABASE_URL=postgres://postgres:tu_contraseña@db:5432/sage
   ```

3. Intenta conectarte directamente a la base de datos:
   ```bash
   docker-compose exec db psql -U postgres -d sage
   ```

### Errores en los Daemons de SAGE

Si hay problemas con los daemons de SAGE:

1. Revisa los logs específicos:
   ```bash
   docker-compose exec sage cat /app/logs/sage_daemon.out.log
   docker-compose exec sage cat /app/logs/sage_daemon2.out.log
   ```

2. Reinicia los procesos manualmente:
   ```bash
   docker-compose exec sage supervisorctl restart sage_daemon
   docker-compose exec sage supervisorctl restart sage_daemon2
   ```

## Actualización de la Aplicación

Para actualizar la aplicación a una nueva versión:

1. Detén y elimina los contenedores actuales (mantén los volúmenes):
   ```bash
   docker-compose down
   ```

2. Actualiza el código fuente

3. Reconstruye las imágenes y crea nuevos contenedores:
   ```bash
   docker-compose up -d --build
   ```

## Respaldo y Restauración

### Respaldo de la Base de Datos

Para crear un respaldo de la base de datos:

```bash
docker-compose exec db pg_dump -U postgres -d sage > sage_backup_$(date +%Y%m%d).sql
```

### Restauración de la Base de Datos

Para restaurar un respaldo:

```bash
cat sage_backup_YYYYMMDD.sql | docker-compose exec -T db psql -U postgres -d sage
```

## Consideraciones de Seguridad

- Cambia las contraseñas predeterminadas en el archivo `.env`
- No expongas los puertos de la base de datos (5432) a internet
- Considera usar un proxy inverso (como Nginx) para agregar HTTPS

## Soporte

Si encuentras problemas con esta configuración Docker, por favor contacta al equipo de soporte o crea un issue en el repositorio del proyecto.
"""

# Escribir el contenido al archivo
with open('docker/README.md', 'w') as f:
    f.write(docker_readme)

print("README.md para Docker creado exitosamente")