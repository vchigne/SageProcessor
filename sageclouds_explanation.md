# Funcionamiento del Sistema SageClouds

## Estructura de base de datos

El sistema SageClouds está compuesto por varias tablas interrelacionadas que permiten gestionar la conexión a diversos servicios de almacenamiento en la nube:

1. **cloud_providers**: Contiene la configuración principal de los proveedores cloud.
   - `id`: Identificador único del proveedor
   - `nombre`: Nombre descriptivo del proveedor (ej. "MINIO en OVH")
   - `tipo`: Tipo de proveedor (minio, s3, azure, gcp, sftp)
   - `credenciales`: JSON con credenciales (endpoint, access_key, secret_key)
   - `configuracion`: JSON con configuración (bucket, prefijo, etc.)
   - `secreto_id`: Referencia opcional a un secreto en la tabla `cloud_secrets`

2. **cloud_secrets**: Almacena credenciales de acceso a servicios cloud, separadas de los proveedores.
   - `id`: Identificador único del secreto
   - `nombre`: Nombre descriptivo del secreto
   - `tipo`: Tipo de proveedor (minio, s3, azure, gcp, sftp)
   - `secretos`: JSON con las credenciales

3. **emisores**: Emisores que pueden usar servicios cloud.
   - `id`: Identificador único del emisor
   - `nombre`: Nombre del emisor
   - `cloud_secret_id`: Referencia a un secreto en la tabla `cloud_secrets`
   - `bucket_nombre`: Nombre del bucket asociado al emisor

4. **emisores_por_casilla**: Relación entre emisores y casillas.
   - `emisor_id`: Referencia al emisor
   - `casilla_id`: Referencia a la casilla
   - `emisor_bucket_prefijo`: Prefijo opcional para determinar subdirectorios

## Flujo de funcionamiento para materialización cloud

1. **Inicio de la materialización**:
   - Se recibe una configuración de materialización que incluye `tipoProveedor: "cloud"` y `proveedorId: [ID]` (en este caso ID=5)
   - La configuración especifica el catálogo y formato de destino (parquet, iceberg, hudi)

2. **Resolución del proveedor**:
   - El sistema intenta localizar el proveedor en la tabla `cloud_providers` usando el ID (5)
   - De la tabla `cloud_providers` obtiene toda la información necesaria: tipo, credenciales, configuración

3. **Verificación de secretos**:
   - Si el proveedor tiene un `secreto_id`, el sistema busca las credenciales en la tabla `cloud_secrets`
   - Si no tiene secreto_id, usa directamente las credenciales almacenadas en el campo `credenciales`

4. **Verificación de prefijos de bucket**:
   - El sistema intenta determinar si existe una relación emisor-casilla que defina un prefijo específico
   - Para esto, consulta la tabla `emisores_por_casilla` mediante la relación con `emisores`

5. **Error actual**:
   - El error `e.bucket_secret_id does not exist` ocurre porque la consulta SQL busca una columna incorrecta
   - La consulta usa `e.bucket_secret_id` pero la columna real en la tabla `emisores` se llama `cloud_secret_id`

## Resolución propuesta

El problema se encuentra en la función `_get_cloud_provider_info` del archivo `process_materializations.py`. La consulta SQL está usando un nombre de columna incorrecto (`bucket_secret_id` en lugar de `cloud_secret_id`).

La solución sería modificar la consulta SQL para usar el nombre correcto de la columna:

```sql
SELECT epc.emisor_bucket_prefijo
FROM emisores_por_casilla epc
JOIN emisores e ON epc.emisor_id = e.id
WHERE e.cloud_secret_id = %s  -- Cambiar bucket_secret_id por cloud_secret_id
  AND epc.casilla_id = %s
```

Esta corrección permitirá que la consulta funcione correctamente y se pueda obtener el prefijo del bucket para la relación emisor-casilla cuando se materialicen múltiples catálogos.