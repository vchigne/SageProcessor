"""
Módulo para convertir datos a diferentes formatos de data lake 

Este módulo proporciona utilidades para convertir dataframes o archivos CSV/Excel
a formatos modernos de data lake como Apache Iceberg y Apache Hudi.
"""

import os
import logging
from typing import Dict, List, Union, Optional, Any

try:
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq
    
    from pyiceberg.catalog import load_catalog
    from pyiceberg.schema import Schema
    from pyiceberg.types import (
        BooleanType, IntegerType, LongType, FloatType, 
        DoubleType, StringType, TimestampType, DateType
    )
except ImportError:
    logging.warning("Algunas dependencias para data_format_converter no están instaladas")

logger = logging.getLogger(__name__)

def _infer_iceberg_schema(df: "pd.DataFrame") -> Schema:
    """
    Infiere un esquema Iceberg a partir de un DataFrame de pandas
    
    Args:
        df: DataFrame de pandas
        
    Returns:
        Schema de Iceberg
    """
    fields = []
    
    # Mapeo de tipos de pandas a tipos de Iceberg
    for col_name, dtype in df.dtypes.items():
        if pd.api.types.is_bool_dtype(dtype):
            field_type = BooleanType()
        elif pd.api.types.is_integer_dtype(dtype):
            if dtype == 'int64':
                field_type = LongType()
            else:
                field_type = IntegerType()
        elif pd.api.types.is_float_dtype(dtype):
            field_type = DoubleType()
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            field_type = TimestampType()
        elif dtype == 'object' and all(isinstance(x, str) for x in df[col_name].dropna()):
            field_type = StringType()
        else:
            # Tipo predeterminado: cadena
            field_type = StringType()
            
        fields.append((col_name, field_type))
    
    return Schema(*fields)

def load_data(data_source: Union[str, "pd.DataFrame"]) -> "pd.DataFrame":
    """
    Carga datos desde una fuente que puede ser un DataFrame o ruta a archivo
    
    Args:
        data_source: DataFrame de pandas o ruta a archivo CSV/Excel
        
    Returns:
        DataFrame de pandas
    """
    if isinstance(data_source, pd.DataFrame):
        return data_source
    
    if not isinstance(data_source, str):
        raise TypeError("data_source debe ser un DataFrame o una ruta a archivo")
    
    if not os.path.exists(data_source):
        raise FileNotFoundError(f"El archivo {data_source} no existe")
    
    # Cargar según la extensión
    file_ext = os.path.splitext(data_source)[1].lower()
    
    if file_ext == '.csv':
        return pd.read_csv(data_source)
    elif file_ext in ['.xls', '.xlsx']:
        return pd.read_excel(data_source)
    elif file_ext == '.parquet':
        return pd.read_parquet(data_source)
    elif file_ext == '.json':
        return pd.read_json(data_source)
    else:
        raise ValueError(f"Formato de archivo no soportado: {file_ext}")

def convert_to_iceberg(
    data: Union[str, "pd.DataFrame"],
    table_name: str,
    catalog_config: Optional[Dict[str, Any]] = None,
    partition_by: Optional[List[str]] = None,
    output_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convierte datos a formato Apache Iceberg
    
    Args:
        data: DataFrame de pandas o ruta a archivo CSV/Excel
        table_name: Nombre de la tabla Iceberg a crear
        catalog_config: Configuración del catálogo Iceberg
        partition_by: Lista de columnas para particionar los datos
        output_dir: Directorio de salida para los archivos
        
    Returns:
        Diccionario con información sobre la tabla creada
    """
    try:
        # Cargar datos
        df = load_data(data)
        
        # Configuración por defecto para el catálogo (local)
        if catalog_config is None:
            warehouse_path = output_dir or 'iceberg_warehouse'
            if not os.path.exists(warehouse_path):
                os.makedirs(warehouse_path)
                
            catalog_config = {
                'type': 'local',
                'warehouse': warehouse_path
            }
        
        # Cargar catálogo
        catalog = load_catalog('local', **catalog_config)
        
        # Inferir esquema de Iceberg
        schema = _infer_iceberg_schema(df)
        
        # Configurar particionamiento
        partition_spec = None
        if partition_by:
            if isinstance(partition_by, str):
                partition_by = [partition_by]
                
            partition_spec = []
            for col in partition_by:
                if col in df.columns:
                    partition_spec.append(col)
        
        # Crear tabla
        table = catalog.create_table(
            identifier=table_name,
            schema=schema,
            partition_spec=partition_spec
        )
        
        # Convertir DataFrame a tabla PyArrow
        table_pa = pa.Table.from_pandas(df)
        
        # Escribir datos a la tabla
        # Nota: Esta es una simplificación; en un entorno real, usaríamos 
        # las APIs de escritura de Iceberg directamente o integración con Spark
        pq.write_table(
            table_pa,
            os.path.join(catalog_config['warehouse'], f"{table_name}.parquet")
        )
        
        return {
            'table_name': table_name,
            'format': 'iceberg',
            'schema': schema.as_struct(),
            'partition_spec': partition_spec,
            'num_records': len(df),
            'table_location': os.path.join(catalog_config['warehouse'], table_name)
        }
        
    except Exception as e:
        logger.error(f"Error al convertir a Iceberg: {str(e)}")
        raise

def convert_to_hudi(
    data: Union[str, "pd.DataFrame"],
    table_name: str,
    record_key_field: Optional[str] = None,
    partition_by: Optional[List[str]] = None,
    output_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convierte datos a formato Apache Hudi
    
    Args:
        data: DataFrame de pandas o ruta a archivo CSV/Excel
        table_name: Nombre de la tabla Hudi a crear
        record_key_field: Campo clave para los registros
        partition_by: Lista de columnas para particionar los datos
        output_dir: Directorio de salida para los archivos
        
    Returns:
        Diccionario con información sobre la tabla creada
    """
    try:
        # Cargar datos
        df = load_data(data)
        
        # Inferir campo clave si no se proporciona
        if record_key_field is None:
            common_key_columns = ['id', 'ID', 'key', 'KEY', 'pk', 'PK']
            for key in common_key_columns:
                if key in df.columns:
                    record_key_field = key
                    break
            
            if record_key_field is None:
                logger.warning("No se pudo inferir el campo clave. Se utilizará el índice.")
                # Asegurar que el índice sea único
                df = df.reset_index().rename(columns={'index': 'hudi_key'})
                record_key_field = 'hudi_key'
        
        # Configurar directorio de salida
        hudi_path = output_dir or 'hudi_tables'
        if not os.path.exists(hudi_path):
            os.makedirs(hudi_path)
        
        table_path = os.path.join(hudi_path, table_name)
        if not os.path.exists(table_path):
            os.makedirs(table_path)
        
        # Configurar particionamiento
        partition_spec = None
        if partition_by:
            if isinstance(partition_by, str):
                partition_by = [partition_by]
                
            partition_spec = []
            for col in partition_by:
                if col in df.columns:
                    partition_spec.append(col)
        
        # En un entorno real, utilizaríamos las APIs de Hudi o integración con Spark
        # Esta es una simplificación que guarda los datos en Parquet con metadatos adicionales
        
        # Guardar metadatos
        metadata = {
            'table_name': table_name,
            'format': 'hudi',
            'record_key_field': record_key_field,
            'partition_spec': partition_spec,
            'schema': {col: str(dtype) for col, dtype in df.dtypes.items()},
            'num_records': len(df)
        }
        
        # Guardar DataFrame como Parquet
        df.to_parquet(os.path.join(table_path, f"{table_name}.parquet"))
        
        # Guardar metadatos
        with open(os.path.join(table_path, 'hudi_metadata.json'), 'w') as f:
            import json
            json.dump(metadata, f, indent=2)
        
        return metadata
        
    except Exception as e:
        logger.error(f"Error al convertir a Hudi: {str(e)}")
        raise

def convert_data_format(
    data: Union[str, "pd.DataFrame"],
    format_type: str,
    table_name: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Convierte datos al formato especificado
    
    Args:
        data: DataFrame de pandas o ruta a archivo CSV/Excel
        format_type: Formato de salida ('iceberg' o 'hudi')
        table_name: Nombre de la tabla a crear
        **kwargs: Argumentos adicionales específicos del formato
        
    Returns:
        Diccionario con información sobre la conversión
    """
    format_type = format_type.lower()
    
    if format_type == 'iceberg':
        return convert_to_iceberg(data, table_name, **kwargs)
    elif format_type == 'hudi':
        return convert_to_hudi(data, table_name, **kwargs)
    else:
        raise ValueError(f"Formato no soportado: {format_type}. Use 'iceberg' o 'hudi'.")