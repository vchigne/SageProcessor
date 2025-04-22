"""
Módulo para conversión de datos a formatos de lago de datos
Soporta:
- Apache Iceberg
- Apache Hudi (implementación básica)

Este módulo permite la conversión de datos desde formatos tradicionales (CSV, Excel, etc.)
a formatos modernos para lagos de datos.
"""

import os
import uuid
import logging
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime
from pyiceberg.catalog import load_catalog
from pyiceberg.schema import Schema
from pyiceberg.types import (
    BooleanType, IntegerType, LongType, FloatType, 
    DoubleType, StringType, TimestampType, DateType
)

# Configurar logging
logger = logging.getLogger("sage.data_format_converter")

# Mapeos de tipos para Iceberg
PANDAS_TO_ICEBERG_TYPES = {
    'bool': BooleanType(),
    'int8': IntegerType(),
    'int16': IntegerType(),
    'int32': IntegerType(),
    'int64': LongType(),
    'float32': FloatType(),
    'float64': DoubleType(),
    'datetime64[ns]': TimestampType(),
    'object': StringType(),
    'category': StringType(),
    'date': DateType(),
    'string': StringType(),
}

class DataLakeFormatConverter:
    """
    Clase para conversión de datos a formatos de lago de datos
    Soporta Apache Iceberg y Apache Hudi
    """
    
    def __init__(self, config=None):
        """Inicializa el convertidor con la configuración proporcionada"""
        self.config = config or {}
        self.temp_dir = self.config.get('temp_dir', './tmp/data_lake')
        
        # Crear directorio temporal si no existe
        os.makedirs(self.temp_dir, exist_ok=True)
    
    def _infer_iceberg_schema_from_df(self, df):
        """
        Infiere un esquema Iceberg a partir de un DataFrame de pandas
        
        Args:
            df (pandas.DataFrame): DataFrame de entrada
            
        Returns:
            pyiceberg.schema.Schema: Esquema Iceberg inferido
        """
        fields = []
        
        for col_name, col_type in zip(df.columns, df.dtypes):
            # Convertir tipo pandas a tipo Iceberg
            col_type_str = str(col_type)
            iceberg_type = PANDAS_TO_ICEBERG_TYPES.get(col_type_str, StringType())
            
            # Crear campo de esquema
            field = (col_name, iceberg_type, "field " + col_name)
            fields.append(field)
        
        return Schema(*fields)
    
    def convert_to_iceberg(self, data, table_name, catalog_config=None, partition_by=None):
        """
        Convierte datos a formato Apache Iceberg
        
        Args:
            data: DataFrame de pandas o ruta a archivo CSV/Excel
            table_name (str): Nombre de la tabla Iceberg a crear
            catalog_config (dict): Configuración del catálogo Iceberg (opcional)
            partition_by (list): Lista de columnas para particionamiento (opcional)
            
        Returns:
            dict: Información sobre la tabla Iceberg creada
        """
        # Configuración del catálogo por defecto (local)
        default_catalog = {
            'type': 'rest',
            'uri': 'http://localhost:8181',
            'warehouse': os.path.join(self.temp_dir, 'iceberg_warehouse')
        }
        
        catalog_config = catalog_config or default_catalog
        
        # Asegurarse de que tenemos un DataFrame
        if isinstance(data, str):
            # Determinar formato de archivo por extensión
            if data.endswith('.csv'):
                df = pd.read_csv(data)
            elif data.endswith(('.xls', '.xlsx')):
                df = pd.read_excel(data)
            else:
                raise ValueError(f"Formato de archivo no soportado: {data}")
        elif isinstance(data, pd.DataFrame):
            df = data
        else:
            raise ValueError("Los datos deben ser un DataFrame o ruta a un archivo")
        
        try:
            # Configurar warehouse directory
            warehouse_dir = catalog_config.get('warehouse', os.path.join(self.temp_dir, 'iceberg_warehouse'))
            os.makedirs(warehouse_dir, exist_ok=True)
            
            # Crear nombre de catálogo único si no se proporciona
            catalog_name = catalog_config.get('name', f'catalog_{uuid.uuid4().hex[:8]}')
            
            # Inferir esquema
            schema = self._infer_iceberg_schema_from_df(df)
            
            logger.info(f"Creando tabla Iceberg '{table_name}' con esquema: {schema}")
            
            # Si no hay un servidor REST Iceberg, creamos una representación del formato
            # guardando como Parquet con metadatos de Iceberg
            if catalog_config.get('type') != 'rest' or 'uri' not in catalog_config:
                table_path = os.path.join(warehouse_dir, table_name)
                os.makedirs(table_path, exist_ok=True)
                
                # Convertir a tabla Arrow
                table = pa.Table.from_pandas(df)
                
                # Generar metadatos de Iceberg (simplificados)
                iceberg_metadata = {
                    'format-version': 2,
                    'table-uuid': str(uuid.uuid4()),
                    'schema': schema.model_dump() if hasattr(schema, 'model_dump') else str(schema),
                    'current-schema-id': 0,
                    'partition-spec': partition_by or [],
                    'created-at': datetime.now().isoformat()
                }
                
                # Guardar metadatos
                metadata_path = os.path.join(table_path, 'metadata.json')
                import json
                with open(metadata_path, 'w') as f:
                    json.dump(iceberg_metadata, f, indent=2)
                
                # Guardar datos como Parquet
                data_path = os.path.join(table_path, 'data.parquet')
                pq.write_table(table, data_path)
                
                logger.info(f"Tabla Iceberg simulada creada en: {table_path}")
                
                return {
                    'success': True,
                    'format': 'iceberg',
                    'table_name': table_name,
                    'location': table_path,
                    'rows': len(df),
                    'columns': list(df.columns),
                    'metadata_path': metadata_path,
                    'data_path': data_path
                }
            
            # Para una implementación real con REST API de Iceberg:
            else:
                # Intentar conectarse al servidor REST
                try:
                    catalog = load_catalog(
                        catalog_name,
                        **catalog_config
                    )
                    
                    # Crear namespace si no existe
                    namespace = table_name.split('.')[0] if '.' in table_name else 'default'
                    full_table_name = table_name if '.' in table_name else f'default.{table_name}'
                    
                    if namespace not in catalog.list_namespaces():
                        catalog.create_namespace(namespace)
                    
                    # Crear tabla con el esquema inferido
                    catalog.create_table(
                        full_table_name,
                        schema,
                        partition_spec=partition_by or []
                    )
                    
                    # Obtener referencia a la tabla
                    table = catalog.load_table(full_table_name)
                    
                    # Escribir datos
                    with table.new_append() as append:
                        append.append_table(pa.Table.from_pandas(df))
                    
                    logger.info(f"Tabla Iceberg '{full_table_name}' creada exitosamente")
                    
                    return {
                        'success': True,
                        'format': 'iceberg',
                        'table_name': full_table_name,
                        'location': table.location(),
                        'rows': len(df),
                        'columns': list(df.columns)
                    }
                
                except Exception as e:
                    logger.error(f"Error al crear tabla Iceberg: {str(e)}")
                    # Fallback a la versión simulada si falla la conexión REST
                    return self.convert_to_iceberg(
                        data, 
                        table_name, 
                        {**catalog_config, 'type': 'local'}, 
                        partition_by
                    )
        
        except Exception as e:
            logger.error(f"Error al convertir a formato Iceberg: {str(e)}")
            raise
    
    def convert_to_hudi(self, data, table_name, record_key_field, precombine_field=None, partition_by=None):
        """
        Convierte datos a formato Apache Hudi (implementación básica)
        
        Sin una biblioteca oficial completa para Python, implementamos una versión básica 
        que genera archivos Parquet con la estructura y metadatos de Hudi.
        
        Args:
            data: DataFrame de pandas o ruta a archivo CSV/Excel
            table_name (str): Nombre de la tabla Hudi a crear
            record_key_field (str): Campo clave para registros
            precombine_field (str): Campo para combinar actualizaciones (opcional)
            partition_by (list): Lista de columnas para particionamiento (opcional)
            
        Returns:
            dict: Información sobre la tabla Hudi creada
        """
        # Asegurarse de que tenemos un DataFrame
        if isinstance(data, str):
            # Determinar formato de archivo por extensión
            if data.endswith('.csv'):
                df = pd.read_csv(data)
            elif data.endswith(('.xls', '.xlsx')):
                df = pd.read_excel(data)
            else:
                raise ValueError(f"Formato de archivo no soportado: {data}")
        elif isinstance(data, pd.DataFrame):
            df = data
        else:
            raise ValueError("Los datos deben ser un DataFrame o ruta a un archivo")
        
        try:
            # Configurar directorio para la tabla Hudi
            table_dir = os.path.join(self.temp_dir, 'hudi_tables', table_name)
            os.makedirs(table_dir, exist_ok=True)
            
            # Verificar que los campos clave existen
            if record_key_field not in df.columns:
                raise ValueError(f"El campo clave '{record_key_field}' no existe en los datos")
            
            if precombine_field and precombine_field not in df.columns:
                raise ValueError(f"El campo de combinación '{precombine_field}' no existe en los datos")
            
            # Generar columnas adicionales requeridas por Hudi si no existen
            if '_hoodie_commit_time' not in df.columns:
                df['_hoodie_commit_time'] = datetime.now().strftime('%Y%m%d%H%M%S')
            
            if '_hoodie_commit_seqno' not in df.columns:
                df['_hoodie_commit_seqno'] = [f"{i:010d}" for i in range(len(df))]
            
            if '_hoodie_record_key' not in df.columns:
                df['_hoodie_record_key'] = df[record_key_field].astype(str)
            
            if '_hoodie_partition_path' not in df.columns:
                if partition_by:
                    df['_hoodie_partition_path'] = df[partition_by].astype(str).agg('/'.join, axis=1)
                else:
                    df['_hoodie_partition_path'] = ''
            
            # Convertir a tabla Arrow
            table = pa.Table.from_pandas(df)
            
            # Generar metadatos de Hudi
            commit_time = datetime.now().strftime('%Y%m%d%H%M%S')
            hudi_metadata = {
                'hoodie.table.name': table_name,
                'hoodie.table.type': 'COPY_ON_WRITE',
                'hoodie.table.version': '0.12.0',
                'hoodie.table.precombine.field': precombine_field or record_key_field,
                'hoodie.table.recordkey.field': record_key_field,
                'hoodie.table.partition.fields': ','.join(partition_by) if partition_by else '',
                'hoodie.table.base.file.format': 'PARQUET',
                'hoodie.commits.latest': commit_time
            }
            
            # Guardar metadatos
            metadata_path = os.path.join(table_dir, '.hoodie', 'hoodie.properties')
            os.makedirs(os.path.dirname(metadata_path), exist_ok=True)
            
            with open(metadata_path, 'w') as f:
                for key, value in hudi_metadata.items():
                    f.write(f"{key}={value}\n")
            
            # Si hay particiones, guardar en estructura de directorios
            if partition_by:
                # Agrupar por particiones
                for partition_value, group_df in df.groupby(partition_by):
                    # Manejar partición simple o múltiple
                    if isinstance(partition_value, tuple):
                        partition_path = '/'.join([f"{col}={val}" for col, val in zip(partition_by, partition_value)])
                    else:
                        partition_path = f"{partition_by[0]}={partition_value}"
                    
                    # Crear directorio de partición
                    partition_dir = os.path.join(table_dir, partition_path)
                    os.makedirs(partition_dir, exist_ok=True)
                    
                    # Crear archivo de datos para esta partición
                    file_name = f"{commit_time}_{str(uuid.uuid4())[:8]}.parquet"
                    data_path = os.path.join(partition_dir, file_name)
                    
                    # Convertir el grupo a tabla Arrow y guardar como Parquet
                    part_table = pa.Table.from_pandas(group_df)
                    pq.write_table(part_table, data_path)
                    
                    logger.info(f"Datos Hudi guardados en partición: {partition_path}")
            else:
                # Si no hay particiones, guardar todo en un solo archivo
                file_name = f"{commit_time}_{str(uuid.uuid4())[:8]}.parquet"
                data_path = os.path.join(table_dir, file_name)
                pq.write_table(table, data_path)
                
                logger.info(f"Datos Hudi guardados en: {data_path}")
            
            logger.info(f"Tabla Hudi '{table_name}' creada exitosamente en {table_dir}")
            
            return {
                'success': True,
                'format': 'hudi',
                'table_name': table_name,
                'location': table_dir,
                'rows': len(df),
                'columns': list(df.columns),
                'metadata_path': metadata_path
            }
        
        except Exception as e:
            logger.error(f"Error al convertir a formato Hudi: {str(e)}")
            raise

# Función utilitaria para convertir datos desde formatos estándar a formatos de lago de datos
def convert_data_format(input_data, output_format, table_name, **kwargs):
    """
    Convierte datos desde formatos estándar a formatos de lago de datos
    
    Args:
        input_data: DataFrame o ruta a archivo
        output_format (str): 'iceberg' o 'hudi'
        table_name (str): Nombre de la tabla a crear
        **kwargs: Argumentos adicionales específicos del formato
        
    Returns:
        dict: Información sobre la conversión
    """
    converter = DataLakeFormatConverter()
    
    if output_format.lower() == 'iceberg':
        return converter.convert_to_iceberg(
            input_data, 
            table_name, 
            catalog_config=kwargs.get('catalog_config'),
            partition_by=kwargs.get('partition_by')
        )
    elif output_format.lower() == 'hudi':
        return converter.convert_to_hudi(
            input_data,
            table_name,
            record_key_field=kwargs.get('record_key_field'),
            precombine_field=kwargs.get('precombine_field'),
            partition_by=kwargs.get('partition_by')
        )
    else:
        raise ValueError(f"Formato no soportado: {output_format}. Debe ser 'iceberg' o 'hudi'")