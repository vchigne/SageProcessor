# Implementación SFTP en SAGE Daemon 2

## Descripción

SAGE Daemon 2 ahora incluye soporte para monitorizar directorios en servidores SFTP. Esta funcionalidad permite que el sistema:

1. Se conecte a servidores SFTP configurados en la tabla `emisores_por_casilla`
2. Busque archivos nuevos en directorios específicos (`data/[numero_casilla]`)
3. Procese los archivos encontrados usando el mismo motor de validación SAGE
4. Mueva los archivos procesados a un directorio de procesados (`procesado/[numero_casilla]`)
5. Registre los resultados en la base de datos igual que con los correos electrónicos

## Configuración SFTP

Las configuraciones de conexión SFTP se almacenan en el campo `parametros` (JSON) de la tabla `emisores_por_casilla`. Deben incluir los siguientes parámetros:

```json
{
  "sftp_host": "servidor.sftp.com",
  "sftp_port": 22,
  "sftp_user": "usuario_sftp",
  "sftp_password": "contraseña_sftp",
  "sftp_key_path": "/ruta/opcional/a/clave_privada"
}
```

Adicionalmente, pueden incluirse parámetros para personalizar los directorios:

```json
{
  "sftp_data_dir": "data/personalizado",
  "sftp_processed_dir": "procesado/personalizado"
}
```

## Estructura de Directorios

Por defecto, el sistema busca en los siguientes directorios:

- **Directorio de entrada**: `data/[numero_casilla]`
- **Directorio de procesados**: `procesado/[numero_casilla]`

Donde `[numero_casilla]` es el ID de la casilla en la base de datos. Por ejemplo, para la casilla con ID 45, se usarían los directorios `data/45` y `procesado/45`.

Si los directorios no existen, el sistema intentará crearlos automáticamente.

## Flujo de Procesamiento

1. **Conexión al servidor SFTP**:
   - Establece conexión usando contraseña o clave privada según la configuración
   - Verifica/crea los directorios necesarios

2. **Búsqueda de archivos**:
   - Lista archivos en el directorio de entrada
   - Descarga cada archivo a un directorio temporal local

3. **Procesamiento**:
   - Procesa cada archivo usando la configuración YAML de la casilla
   - Genera reportes y logs de ejecución

4. **Gestión de archivos procesados**:
   - Mueve los archivos procesados al directorio de procesados
   - El nombre del archivo incluye un timestamp para evitar colisiones
   - Elimina el archivo original del directorio de entrada

5. **Registro de resultados**:
   - Registra la ejecución en la tabla `ejecuciones_yaml`
   - Incluye la referencia al emisor para mantener la trazabilidad

## Seguridad

- Las contraseñas y credenciales SFTP se almacenan de forma segura en la base de datos
- Se soporta autenticación por contraseña o por clave privada
- Las conexiones se establecen usando SSH (puerto 22 por defecto)

## Solución de Problemas

Si hay problemas con la conexión SFTP, verifique:

1. Que el servidor SFTP esté accesible en la red
2. Que las credenciales (usuario/contraseña o clave) sean correctas
3. Que el usuario tenga permisos de lectura y escritura en los directorios configurados
4. Que los directorios `data/[casilla_id]` y `procesado/[casilla_id]` existan o puedan ser creados

Los errores detallados se registran en el archivo `sage_daemon2_log.txt`.