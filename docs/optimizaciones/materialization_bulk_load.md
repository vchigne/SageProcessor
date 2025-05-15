# Optimización de Materialización para Bases de Datos Legacy

## Problema Actual

El proceso actual de materialización a bases de datos inserta registros en lotes (actualmente configurado a 10,000 registros por lote). Para conjuntos de datos muy grandes (como los 218,000 registros de prueba), este método puede ser ineficiente y lento, pudiendo tardar varias horas en completarse.

## Solución Propuesta

Implementar una estrategia alternativa de materialización que utilice archivos comprimidos (ZIP) conteniendo datos en formato CSV como intermediarios, para luego descomprimirlos en el servidor remoto y utilizar comandos de carga masiva (bulk insert) nativos de cada base de datos.

## Esquema de Implementación

### 1. Configuración

Añadir nuevos parámetros de configuración a nivel de materialización:

```json
{
  "use_bulk_load": true,
  "temp_directory": "/ruta/al/directorio/temporal",
  "compression": "zip",
  "format": "csv",
  "remove_temp_files": true
}
```

### 2. Proceso de Materialización Mejorado

1. **Generación del archivo intermedio**:
   - Convertir el DataFrame a formato CSV
   - Comprimir el archivo en formato ZIP
   - Guardar en directorio temporal local

2. **Transferencia al servidor remoto**:
   - Transferir el archivo ZIP al servidor remoto usando SFTP o equivalente
   - Para conexiones locales, usar el directorio temporal directamente

3. **Procesamiento en servidor**:
   - Descomprimir el archivo ZIP en el servidor remoto
   - Ejecutar el comando de carga masiva apropiado para el tipo de base de datos
   - Eliminar archivos temporales después de completar la carga

### 3. Implementación específica por tipo de base de datos

#### PostgreSQL

```sql
COPY table_name FROM '/path/to/temp/data.csv' 
WITH (FORMAT csv, DELIMITER ',', HEADER);
```

Implementación en Python:
```python
def bulk_load_postgres(engine, csv_path, table_name, schema=None):
    connection = engine.raw_connection()
    cursor = connection.cursor()
    qualified_table = f'"{schema}"."{table_name}"' if schema else f'"{table_name}"'
    
    with open(csv_path, 'r') as f:
        cursor.copy_expert(f'COPY {qualified_table} FROM STDIN WITH CSV HEADER', f)
    
    connection.commit()
    cursor.close()
    connection.close()
```

#### MySQL

```sql
LOAD DATA INFILE '/path/to/temp/data.csv' 
INTO TABLE table_name
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"' 
LINES TERMINATED BY '\n'
IGNORE 1 LINES;
```

Implementación en Python:
```python
def bulk_load_mysql(connection, csv_path, table_name, schema=None):
    cursor = connection.cursor()
    qualified_table = f'`{schema}`.`{table_name}`' if schema else f'`{table_name}`'
    
    load_query = f"""
    LOAD DATA LOCAL INFILE '{csv_path}'
    INTO TABLE {qualified_table}
    FIELDS TERMINATED BY ',' 
    ENCLOSED BY '"' 
    LINES TERMINATED BY '\n'
    IGNORE 1 LINES;
    """
    
    cursor.execute(load_query)
    connection.commit()
    cursor.close()
```

#### SQL Server

```sql
BULK INSERT schema_name.table_name
FROM '/path/to/temp/data.csv'
WITH (
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FIRSTROW = 2,
    TABLOCK
);
```

Implementación en Python:
```python
def bulk_load_sqlserver(connection, csv_path, table_name, schema='dbo'):
    cursor = connection.cursor()
    qualified_table = f'[{schema}].[{table_name}]'
    
    bulk_query = f"""
    BULK INSERT {qualified_table}
    FROM '{csv_path}'
    WITH (
        FIELDTERMINATOR = ',',
        ROWTERMINATOR = '\\n',
        FIRSTROW = 2,
        TABLOCK
    );
    """
    
    cursor.execute(bulk_query)
    connection.commit()
    cursor.close()
```

### 4. Ejemplo de integración en el código actual

Modificar el método `_materialize_to_database` en la clase `MaterializationProcessor`:

```python
def _materialize_to_database(self, df: pd.DataFrame, db_conn_id: int, config: Dict[str, Any], 
                          materialization_id: int, execution_id: str) -> None:
    # ... código existente ...
    
    # Verificar si se debe usar carga masiva
    use_bulk_load = config.get('use_bulk_load', False)
    
    if use_bulk_load:
        self._materialize_to_database_bulk(df, db_connection_info, config, 
                                          schema_name, table_name,
                                          materialization_id, execution_id)
    else:
        # Continuar con el método actual de inserción por lotes
        # ... código existente ...
```

### 5. Gestión SFTP para servidores remotos

Para servidores remotos, implementar una función que:
1. Establezca conexión SFTP con el servidor
2. Transfiera el archivo ZIP
3. Ejecute comandos de shell remoto para descomprimir
4. Ejecute el comando de carga masiva
5. Limpie los archivos temporales

```python
def _transfer_and_execute_remote(self, zip_path, remote_temp_dir, connection_info, db_type, schema, table):
    # Establecer conexión SSH
    ssh_client = paramiko.SSHClient()
    ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh_client.connect(
        hostname=connection_info['servidor'],
        port=int(connection_info.get('puerto_ssh', 22)),
        username=connection_info.get('usuario_ssh'),
        password=connection_info.get('contraseña_ssh')
    )
    
    # Abrir conexión SFTP
    sftp = ssh_client.open_sftp()
    
    # Nombre del archivo ZIP en remoto
    remote_zip = os.path.join(remote_temp_dir, os.path.basename(zip_path))
    
    try:
        # Subir el archivo
        sftp.put(zip_path, remote_zip)
        
        # Ejecutar comandos para descomprimir
        unzip_cmd = f'unzip -o {remote_zip} -d {remote_temp_dir}'
        stdin, stdout, stderr = ssh_client.exec_command(unzip_cmd)
        
        # Nombre del archivo CSV dentro del ZIP (asumimos mismo nombre sin extensión .zip)
        csv_name = os.path.basename(zip_path).replace('.zip', '.csv')
        remote_csv = os.path.join(remote_temp_dir, csv_name)
        
        # Ejecutar comando de carga según tipo de base de datos
        if db_type == 'postgresql':
            load_cmd = f'psql -c "\\COPY {schema}.{table} FROM {remote_csv} CSV HEADER"'
        elif db_type == 'mysql':
            load_cmd = f'mysql -e "LOAD DATA INFILE \'{remote_csv}\' INTO TABLE {schema}.{table} FIELDS TERMINATED BY \',\' ENCLOSED BY \'"\' LINES TERMINATED BY \'\\n\' IGNORE 1 LINES;"'
        elif db_type == 'sqlserver':
            # Para SQL Server, podría requerir BCP u otra herramienta
            load_cmd = f'sqlcmd -Q "BULK INSERT {schema}.{table} FROM \'{remote_csv}\' WITH (FIELDTERMINATOR = \',\', ROWTERMINATOR = \'\\n\', FIRSTROW = 2);"'
        
        stdin, stdout, stderr = ssh_client.exec_command(load_cmd)
        
        # Verificar resultado
        exit_status = stdout.channel.recv_exit_status()
        if exit_status != 0:
            error = stderr.read().decode('utf-8')
            raise Exception(f"Error en carga masiva: {error}")
        
        # Limpiar archivos temporales
        if config.get('remove_temp_files', True):
            ssh_client.exec_command(f'rm {remote_zip} {remote_csv}')
            
    finally:
        sftp.close()
        ssh_client.close()
```

## Ventajas

1. **Rendimiento significativamente mejorado**: La carga masiva es órdenes de magnitud más rápida que la inserción por lotes, especialmente para grandes conjuntos de datos.

2. **Menor uso de recursos**: Reduce la carga en la conexión de red y en la base de datos durante las inserciones.

3. **Mayor robustez**: Si ocurre un error, es más fácil retomar desde el punto de fallo.

4. **Compatible con bases de datos legacy**: Este método funciona bien incluso con bases de datos más antiguas o con recursos limitados.

## Consideraciones

1. **Permisos**: El servidor de base de datos debe tener permisos para leer archivos locales.

2. **Seguridad**: Los archivos CSV temporales podrían contener datos sensibles, por lo que deben gestionarse adecuadamente.

3. **Requisitos adicionales**: 
   - Para PostgreSQL: acceso a la función COPY
   - Para MySQL: permisos FILE
   - Para SQL Server: permisos BULK INSERT o acceso a BCP

4. **Compatibilidad con tipos de datos**: Asegurar que el formato CSV preserve correctamente los tipos de datos complejos.

## Implementación en la Interfaz de Usuario

Añadir una sección en la configuración de materialización:

```
[ ] Usar carga masiva para mejor rendimiento
    Directorio temporal: [_____________________]
    Formato: [CSV ▼]
    Compresión: [ZIP ▼]
    [ ] Eliminar archivos temporales después de la carga
```

Con una nota explicativa sobre los requisitos y ventajas.

## Conclusión

Esta optimización permitirá materializar eficientemente grandes conjuntos de datos a bases de datos legacy, reduciendo significativamente los tiempos de procesamiento sin comprometer la fiabilidad o la seguridad del sistema.