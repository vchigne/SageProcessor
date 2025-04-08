# Procesamiento de Archivos SFTP en SAGE

## Descripción

El sistema SAGE ahora cuenta con la capacidad de procesar archivos recibidos a través de SFTP (Secure File Transfer Protocol). Esta funcionalidad permite a los usuarios autorizados enviar archivos que serán automáticamente procesados usando las configuraciones YAML definidas para cada casilla.

## Funcionamiento

El procesamiento SFTP funciona de la siguiente manera:

1. **Configuración**: Cada casilla puede tener uno o varios emisores configurados con parámetros SFTP.
2. **Monitoreo**: El SAGE Daemon 2 monitorea periódicamente las configuraciones SFTP activas.
3. **Procesamiento**: Cuando detecta nuevos archivos, los procesa utilizando la configuración YAML de la casilla asociada.
4. **Resultados**: Los archivos procesados se mueven a un directorio de procesados y se registran en la base de datos.

## Estructura de Directorios

- **Datos**: `data/[casilla_id]/` - Directorio donde se depositan los archivos a procesar.
- **Procesados**: `procesado/[casilla_id]/` - Directorio donde se mueven los archivos procesados.
- **Ejecuciones**: `executions/` - Directorio donde se guardan los resultados de cada ejecución.

## Base de Datos

La configuración SFTP se almacena en la tabla `emisores_por_casilla` con los siguientes parámetros:

- **host**: Servidor SFTP
- **port**: Puerto (por defecto 22)
- **username**: Usuario
- **password**: Contraseña
- **directory**: Directorio remoto a monitorear
- **processed_directory**: Directorio remoto para archivos procesados

## Modo de Pruebas

Para facilitar las pruebas, el sistema ofrece un modo simulado que procesa archivos locales sin necesidad de un servidor SFTP real:

1. Coloca archivos en el directorio `data/[casilla_id]/`
2. El SAGE Daemon 2 detectará y procesará estos archivos
3. Los archivos procesados se moverán a `procesado/[casilla_id]/`

## Ejecución del Daemon

El SAGE Daemon 2 se inicia mediante el script `run_sage_daemon2.py` y verifica periódicamente la existencia de nuevos archivos.

Para una única verificación, se puede usar `run_sage_daemon2_once.py` o pasar el parámetro `--once` a `run_sage_daemon2.py`.

## Registros de Procesamiento

Todos los resultados del procesamiento se registran en:

1. **Base de datos**: Tabla `ejecuciones_yaml`
2. **Sistema de archivos**: Directorio `executions/[timestamp]_[filename]/`
3. **Logs**: Archivo `sage_daemon2_log.txt`

La tabla `ejecuciones_yaml` almacena información detallada sobre cada procesamiento, incluyendo:

- ID de casilla
- Fecha y hora de ejecución
- Nombre del archivo
- Directorio de ejecución
- ID del emisor
- Detalles del procesamiento (errores, advertencias)
- Configuración YAML utilizada

## Flujo Completo

1. El SAGE Daemon 2 inicia y obtiene las configuraciones de SFTP.
2. Para cada configuración, verifica si hay archivos nuevos.
3. Los archivos se procesan según la configuración YAML de la casilla.
4. Se generan resultados (reportes HTML, JSON y log).
5. Los resultados se registran en la base de datos.
6. El archivo procesado se mueve al directorio de procesados.
7. El ciclo se repite cada minuto (configurable).

## Ventajas

- Procesamiento automático sin intervención manual
- Integración perfecta con el sistema de validación SAGE
- Registro detallado en base de datos y sistema de archivos
- Flexibilidad para procesar cualquier tipo de archivo
- Modo de pruebas para verificar configuraciones sin servidor SFTP real