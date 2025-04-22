# Exportadores a Formatos de Data Lake en SAGE

Este documento describe la implementación y uso de los exportadores de datos a formatos modernos de data lake como Apache Iceberg y Apache Hudi en SAGE.

## Introducción

Los formatos de data lake como Apache Iceberg y Apache Hudi proporcionan capacidades avanzadas para la gestión de datos en lagos de datos, incluyendo:

- **Control de versiones de datos**: Mantienen un historial de los cambios realizados.
- **Operaciones de actualización/eliminación eficientes**: Permiten modificar datos existentes sin reescribir todos los archivos.
- **Esquemas evolutivos**: Permiten que los esquemas evolucionen con el tiempo sin romper la compatibilidad.
- **Particionamiento inteligente**: Soportan estrategias de particionamiento avanzadas para optimizar el rendimiento de consultas.
- **Transacciones atómicas**: Garantizan consistencia en operaciones de escritura concurrentes.

## Módulos Implementados

### 1. Convertidor de Formato de Datos (`sage/data_format_converter.py`)

Este módulo proporciona la funcionalidad básica para convertir datos a formatos de data lake:

```python
from sage.data_format_converter import convert_data_format

# Convertir un DataFrame a formato Iceberg
result = convert_data_format(
    df,                      # DataFrame de pandas o ruta a archivo CSV/Excel
    'iceberg',               # Formato de salida ('iceberg' o 'hudi')
    'nombre_tabla',          # Nombre de la tabla a crear
    catalog_config={...},    # Configuración del catálogo (opcional)
    partition_by=['columna'] # Columnas para particionamiento (opcional)
)

# Convertir un DataFrame a formato Hudi
result = convert_data_format(
    df,                     # DataFrame de pandas o ruta a archivo CSV/Excel 
    'hudi',                 # Formato de salida ('iceberg' o 'hudi')
    'nombre_tabla',         # Nombre de la tabla a crear
    record_key_field='id',  # Campo clave para registros (requerido para Hudi)
    partition_by=['columna'] # Columnas para particionamiento (opcional)
)
```

### 2. Exportador de Data Lake (`sage/exporters/data_lake_exporter.py`)

Este módulo proporciona una interfaz más completa para exportar datos de ejecuciones SAGE a formatos de data lake:

```python
from sage.exporters.data_lake_exporter import DataLakeExporter

# Crear exportador
exporter = DataLakeExporter(config={
    'output_dir': './exports/data_lake'  # Directorio de salida (opcional)
})

# Exportar datos de ejecución a Iceberg
result = exporter.export_execution_to_iceberg(
    execution_data,         # Datos de la ejecución
    table_name='mi_tabla',  # Nombre de la tabla (opcional)
    partition_by=['columna'] # Columnas para particionamiento (opcional)
)

# Exportar datos de ejecución a Hudi
result = exporter.export_execution_to_hudi(
    execution_data,         # Datos de la ejecución
    table_name='mi_tabla',  # Nombre de la tabla (opcional)
    record_key_field='id',  # Campo clave para registros (opcional, se infiere)
    partition_by=['columna'] # Columnas para particionamiento (opcional)
)

# Interfaz unificada para ambos formatos
result = exporter.export_data(
    data,                   # DataFrame o datos de ejecución
    format_type='iceberg',  # Formato de salida ('iceberg' o 'hudi')
    table_name='mi_tabla',  # Nombre de la tabla (opcional)
    **kwargs                # Argumentos específicos del formato
)
```

## Configuraciones Importantes

### Particionamiento

El particionamiento es crucial para el rendimiento en lagos de datos. Permite organizar los datos en "particiones" basadas en valores de columna específicos, lo que optimiza las consultas al reducir la cantidad de datos escaneados.

#### Ejemplos de estrategias de particionamiento:

1. **Por fecha**: Útil para datos con componente temporal.
   ```python
   partition_by=['año', 'mes', 'dia']
   ```

2. **Por categoría**: Útil cuando las consultas filtran por categorías específicas.
   ```python
   partition_by=['pais', 'categoria']
   ```

3. **Por rango**: Útil para columnas numéricas.
   ```
   # Esto se configuraría a nivel de esquema:
   partitioning = {"column": "edad", "ranges": [[0, 18], [19, 40], [41, 65], [66, 100]]}
   ```

### Configuración de Catálogo para Iceberg

Iceberg utiliza un "catálogo" para almacenar los metadatos de las tablas. La configuración varía según el entorno:

```python
# Catálogo local (para desarrollo)
catalog_config = {
    'type': 'local',
    'warehouse': '/path/to/warehouse'
}

# Catálogo REST (para producción con REST API)
catalog_config = {
    'type': 'rest',
    'uri': 'http://iceberg-rest-server:8181',
    'warehouse': '/path/to/warehouse'
}

# Catálogo AWS Glue
catalog_config = {
    'type': 'glue',
    'warehouse': 's3://bucket/warehouse',
    'region': 'us-east-1',
    'catalog-name': 'glue_catalog'
}
```

### Configuración de Campo Clave para Hudi

Apache Hudi requiere un campo clave (`record_key_field`) para identificar registros únicos:

- Debe ser único dentro de cada partición.
- Se utiliza para operaciones de actualización/eliminación.
- Si no se especifica, se intenta inferir automáticamente de columnas comunes como 'id', 'ID', etc.
- Si no se puede inferir, se utiliza el índice del DataFrame.

## Extensiones Futuras Recomendadas

1. **API REST para exportaciones**: Crear endpoints para permitir exportaciones a data lake desde la interfaz web.

2. **Integración con herramientas de consulta**: Agregar soporte para consultar datos con herramientas como Trino o Spark.

3. **Métricas y estadísticas de tablas**: Almacenar metadatos sobre el tamaño, distribución y estructura de las tablas.

4. **Evolución de esquema automática**: Detectar y aplicar cambios de esquema automáticamente.

5. **Catálogos remotos**: Soporte para catálogos como AWS Glue, Hive Metastore, etc.

6. **Compresión y optimización**: Configurar estrategias de compresión y optimización para reducir el tamaño de los archivos.

## Ejemplo de Uso en Sistema de Reportes

```python
def exportar_resultados_a_data_lake(ejecucion_id, formato, configuracion=None):
    """Exporta los resultados de una ejecución a un formato de data lake"""
    from sage.exporters.data_lake_exporter import DataLakeExporter
    
    # Obtener datos de la ejecución
    ejecucion = obtener_ejecucion(ejecucion_id)
    
    # Configuración por defecto si no se proporciona
    configuracion = configuracion or {}
    
    # Crear exportador
    exporter = DataLakeExporter()
    
    # Configurar particionamiento según el tipo de datos
    if 'fecha' in ejecucion['datos'].columns:
        configuracion['partition_by'] = configuracion.get('partition_by') or ['fecha']
    
    # Exportar datos
    if formato.lower() == 'iceberg':
        return exporter.export_execution_to_iceberg(
            ejecucion,
            table_name=configuracion.get('table_name'),
            partition_by=configuracion.get('partition_by')
        )
    elif formato.lower() == 'hudi':
        return exporter.export_execution_to_hudi(
            ejecucion,
            table_name=configuracion.get('table_name'),
            record_key_field=configuracion.get('record_key_field'),
            partition_by=configuracion.get('partition_by')
        )
    else:
        raise ValueError(f"Formato no soportado: {formato}")
```

## Notas Importantes

- **Dependencias**: Se requieren las bibliotecas `pyarrow`, `pyiceberg` y otras dependencias específicas para cada formato.
- **Compatibilidad**: La implementación actual es básica y puede requerir ajustes según el entorno de destino.
- **Seguridad**: Para entornos de producción, se recomienda implementar controles de acceso y encriptación.
- **Rendimiento**: El particionamiento incorrecto puede degradar el rendimiento; es importante diseñar una estrategia adecuada.
- **Migración**: Para migrar datos existentes, considere utilizar herramientas como Apache Spark para conversiones a gran escala.