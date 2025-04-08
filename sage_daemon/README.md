# SAGE Daemon

## Descripción
SAGE Daemon es un sistema de monitoreo y procesamiento automático de archivos que trabaja en conjunto con el Sistema de Análisis y Gestión de Errores (SAGE). El daemon monitorea continuamente diferentes fuentes de entrada (email, SFTP, sistema de archivos) y procesa los archivos recibidos según las reglas definidas en configuraciones YAML.

## Requisitos del Sistema
- Python 3.11 o superior
- PostgreSQL
- Las siguientes dependencias de Python (instaladas automáticamente):
  - psycopg2-binary (para PostgreSQL)
  - paramiko (para SFTP)
  - pyyaml
  - rich (para logging mejorado)

## Instalación

### 1. Clonar el Repositorio
```bash
git clone <repository_url>
cd sage_daemon
```

### 2. Instalar Dependencias
```bash
pip install -r requirements.txt
```

### 3. Configurar Variables de Entorno
```bash
# URL de conexión a PostgreSQL (requerida)
export DATABASE_URL="postgresql://usuario:contraseña@host:puerto/basededatos"

# Directorio para archivos temporales (opcional)
export SAGE_TEMP_DIR="/tmp/sage_daemon"

# Nivel de logging (opcional, default: INFO)
export SAGE_LOG_LEVEL="INFO"
```

## Configuración de Base de Datos

### Estructura de Tablas Requeridas

1. `casillas_recepcion`:
```sql
CREATE TABLE casillas_recepcion (
    id SERIAL PRIMARY KEY,
    nombre_yaml VARCHAR(255) NOT NULL,
    instalacion_id INTEGER NOT NULL,
    metodo_envio_id INTEGER NOT NULL,
    activo BOOLEAN DEFAULT true
);
```

2. `metodos_envio`:
```sql
CREATE TABLE metodos_envio (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,  -- 'email', 'sftp', 'filesystem'
    configuracion JSONB NOT NULL,
    activo BOOLEAN DEFAULT true
);
```

3. `emisores_responsables`:
```sql
CREATE TABLE emisores_responsables (
    emisor_id INTEGER NOT NULL,
    casilla_id INTEGER NOT NULL,
    activo BOOLEAN DEFAULT true,
    PRIMARY KEY (emisor_id, casilla_id)
);
```

4. `procesamiento_archivos`:
```sql
CREATE TABLE procesamiento_archivos (
    id SERIAL PRIMARY KEY,
    execution_uuid VARCHAR(100) NOT NULL,
    casilla_id INTEGER NOT NULL,
    emisor_id INTEGER NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    fecha_procesamiento TIMESTAMP NOT NULL
);
```

## Configuración de Monitores

### Monitor de Email
```yaml
configuracion:
  host: imap.servidor.com
  usuario: usuario@dominio.com
  password: contraseña
  # Opcional:
  port: 993  # Default para IMAP sobre SSL
  ssl: true  # Usar SSL (recomendado)
  carpeta: "INBOX"  # Carpeta a monitorear
```

### Monitor SFTP
```yaml
configuracion:
  host: sftp.servidor.com
  port: 22
  usuario: usuario
  password: contraseña
  path: /ruta/monitoreo
  # Opcional:
  key_filename: /ruta/a/llave/privada  # Para autenticación por llave
  pattern: "*.csv"  # Patrón de archivos a procesar
```

### Monitor de Sistema de Archivos
```yaml
configuracion:
  path: /ruta/local/monitoreo
  pattern: "*.csv"  # Opcional: patrón de archivos
  recursive: false  # Opcional: buscar en subdirectorios
```

## Ejecución

### Modo Básico
```bash
python -m sage_daemon
```

### Con Opciones Personalizadas
```bash
python -m sage_daemon --interval 30 --log-level DEBUG --log-file /var/log/sage_daemon.log
```

### Opciones Disponibles
- `--interval`: Intervalo de chequeo en segundos (default: 60)
- `--log-level`: Nivel de logging (DEBUG, INFO, WARNING, ERROR)
- `--log-file`: Archivo para guardar logs (opcional)

## Monitoreo y Logs

### Formato de Logs
Los logs incluyen:
- Timestamp
- Nombre del módulo
- Nivel de log
- Mensaje detallado

Ejemplo:
```
2025-03-14 12:00:00 - sage_daemon - INFO - Iniciando SAGE Daemon
2025-03-14 12:00:01 - sage_daemon - DEBUG - Procesando archivo: entrada.csv
```

### Métricas Importantes
- Archivos procesados por intervalo
- Errores de procesamiento
- Tiempo de procesamiento por archivo
- Estado de conexión con monitores

## Solución de Problemas

### Problemas Comunes

1. **Error de Conexión a Base de Datos**
   ```
   Error: DATABASE_URL environment variable is required
   ```
   Solución: Verificar que la variable DATABASE_URL está configurada correctamente.

2. **Errores de Acceso a Archivos**
   ```
   PermissionError: [Errno 13] Permission denied: '/ruta/archivo'
   ```
   Solución: Verificar permisos del usuario que ejecuta el daemon.

3. **Errores de Monitoreo**
   ```
   Error: Could not connect to IMAP server
   ```
   Solución: Verificar credenciales y conectividad con el servidor.

### Diagnóstico

1. Activar logging detallado:
   ```bash
   python -m sage_daemon --log-level DEBUG
   ```

2. Verificar logs:
   ```bash
   tail -f /var/log/sage_daemon.log
   ```

3. Verificar estado de la base de datos:
   ```sql
   SELECT * FROM procesamiento_archivos ORDER BY fecha_procesamiento DESC LIMIT 5;
   ```

## Estructura del Código

```
sage_daemon/
├── __init__.py           # Versión y metadatos
├── __main__.py          # Punto de entrada
├── daemon.py            # Clase principal SageDaemon
├── monitors/            # Monitores de archivos
│   ├── __init__.py     # Interfaces de monitores
│   ├── email.py        # Monitor de email
│   ├── sftp.py         # Monitor SFTP
│   └── filesystem.py   # Monitor de sistema de archivos
└── tests/              # Pruebas unitarias
    ├── __init__.py
    ├── test_daemon.py
    ├── test_monitors.py
    └── conftest.py
```

## Desarrollo y Pruebas

### Ejecutar Pruebas
```bash
# Ejecutar todas las pruebas
python -m pytest

# Ejecutar pruebas específicas
python -m pytest sage_daemon/tests/test_daemon.py -v

# Ejecutar con coverage
python -m pytest --cov=sage_daemon
```

### Agregar Nuevos Monitores
1. Crear nuevo archivo en `monitors/`
2. Implementar la interfaz base de Monitor
3. Registrar en `SageDaemon.__init__`
4. Agregar pruebas unitarias

## Contribuir
1. Crear rama feature/fix
2. Implementar cambios
3. Agregar pruebas
4. Crear pull request

## Licencia
Este proyecto está licenciado bajo los términos de la licencia MIT.