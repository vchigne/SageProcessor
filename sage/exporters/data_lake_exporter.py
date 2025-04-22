"""
Exportador de datos a formatos de data lake

Este módulo proporciona funcionalidades para exportar datos procesados por SAGE
a formatos modernos de data lake como Apache Iceberg y Apache Hudi.
"""

import os
import logging
from typing import Dict, List, Union, Optional, Any, Tuple

try:
    import pandas as pd
    from ..data_format_converter import convert_data_format, load_data
except ImportError:
    logging.warning("Algunas dependencias para data_lake_exporter no están instaladas")

logger = logging.getLogger(__name__)

class DataLakeExporter:
    """
    Clase para exportar datos a formatos de data lake
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Inicializa el exportador con configuración personalizada
        
        Args:
            config: Diccionario de configuración opcional
                - output_dir: Directorio de salida para los archivos
                - default_format: Formato por defecto ('iceberg' o 'hudi')
        """
        self.config = config or {}
        self.output_dir = self.config.get('output_dir', 'data_lake_exports')
        self.default_format = self.config.get('default_format', 'iceberg')
        
        # Crear directorio de salida si no existe
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
    
    def _extract_data_from_execution(self, execution_data: Dict[str, Any]) -> Tuple[Dict[str, pd.DataFrame], Dict[str, Any]]:
        """
        Extrae datos y metadatos de una ejecución SAGE
        
        Args:
            execution_data: Datos de la ejecución (puede ser un objeto de ejecución o un diccionario)
            
        Returns:
            Tupla con (diccionario de DataFrames, metadatos)
        """
        dataframes = {}
        metadata = {}
        
        try:
            # Si es un diccionario directo con los datos
            if isinstance(execution_data, dict) and 'files' in execution_data:
                files = execution_data['files']
                metadata = {
                    'execution_id': execution_data.get('id'),
                    'name': execution_data.get('name'),
                    'source': execution_data.get('source')
                }
                
                for file_name, file_data in files.items():
                    if isinstance(file_data, pd.DataFrame):
                        dataframes[file_name] = file_data
                    elif isinstance(file_data, dict) and 'data' in file_data:
                        if isinstance(file_data['data'], pd.DataFrame):
                            dataframes[file_name] = file_data['data']
                        else:
                            # Intentar convertir a DataFrame si es posible
                            try:
                                dataframes[file_name] = pd.DataFrame(file_data['data'])
                            except Exception as e:
                                logger.warning(f"No se pudo convertir {file_name} a DataFrame: {str(e)}")
            
            # Si es un objeto de ejecución SAGE
            elif hasattr(execution_data, 'get_processed_files'):
                files = execution_data.get_processed_files()
                metadata = {
                    'execution_id': getattr(execution_data, 'id', None),
                    'name': getattr(execution_data, 'name', None),
                    'source': getattr(execution_data, 'source', None)
                }
                
                for file_name, file_data in files.items():
                    try:
                        if isinstance(file_data, pd.DataFrame):
                            dataframes[file_name] = file_data
                        else:
                            # Intentar convertir a DataFrame
                            dataframes[file_name] = pd.DataFrame(file_data)
                    except Exception as e:
                        logger.warning(f"No se pudo procesar el archivo {file_name}: {str(e)}")
            
            # Si es una ruta a un archivo o directorio
            elif isinstance(execution_data, str):
                if os.path.isfile(execution_data):
                    try:
                        file_name = os.path.basename(execution_data)
                        dataframes[file_name] = load_data(execution_data)
                        metadata = {'source_file': execution_data}
                    except Exception as e:
                        logger.error(f"Error al cargar el archivo {execution_data}: {str(e)}")
                elif os.path.isdir(execution_data):
                    metadata = {'source_dir': execution_data}
                    for file_name in os.listdir(execution_data):
                        file_path = os.path.join(execution_data, file_name)
                        if os.path.isfile(file_path):
                            try:
                                file_ext = os.path.splitext(file_name)[1].lower()
                                if file_ext in ['.csv', '.xlsx', '.xls', '.parquet', '.json']:
                                    dataframes[file_name] = load_data(file_path)
                            except Exception as e:
                                logger.warning(f"No se pudo procesar el archivo {file_name}: {str(e)}")
            
            else:
                raise ValueError("Formato de datos de ejecución no soportado")
            
            return dataframes, metadata
            
        except Exception as e:
            logger.error(f"Error al extraer datos de la ejecución: {str(e)}")
            raise
    
    def export_execution_to_iceberg(
        self,
        execution_data: Dict[str, Any],
        table_name: Optional[str] = None,
        partition_by: Optional[List[str]] = None,
        catalog_config: Optional[Dict[str, Any]] = None,
        output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Exporta los datos de una ejecución a formato Apache Iceberg
        
        Args:
            execution_data: Datos de la ejecución
            table_name: Nombre base para las tablas (se añadirá sufijo por archivo)
            partition_by: Columnas para particionar los datos
            catalog_config: Configuración del catálogo Iceberg
            output_dir: Directorio de salida específico
            
        Returns:
            Diccionario con información sobre la exportación
        """
        try:
            dataframes, metadata = self._extract_data_from_execution(execution_data)
            
            if not dataframes:
                raise ValueError("No se encontraron datos para exportar")
            
            # Configurar salida
            output_path = output_dir or os.path.join(self.output_dir, 'iceberg')
            if not os.path.exists(output_path):
                os.makedirs(output_path)
            
            # Configurar catálogo
            if catalog_config is None:
                catalog_config = {
                    'type': 'local',
                    'warehouse': output_path
                }
            
            # Generar nombre de tabla base si no se proporciona
            if table_name is None:
                if metadata.get('name'):
                    table_name = metadata['name'].replace(' ', '_').lower()
                elif metadata.get('execution_id'):
                    table_name = f"execution_{metadata['execution_id']}"
                else:
                    table_name = f"sage_export_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Exportar cada DataFrame como una tabla Iceberg
            results = {}
            for file_name, df in dataframes.items():
                # Crear nombre de tabla para este archivo
                file_table_name = f"{table_name}_{os.path.splitext(file_name)[0]}"
                
                # Exportar a Iceberg
                result = convert_data_format(
                    df,
                    'iceberg',
                    file_table_name,
                    catalog_config=catalog_config,
                    partition_by=partition_by,
                    output_dir=output_path
                )
                
                results[file_name] = result
            
            return {
                'format': 'iceberg',
                'tables': results,
                'metadata': metadata,
                'location': output_path
            }
            
        except Exception as e:
            logger.error(f"Error al exportar a Iceberg: {str(e)}")
            raise
    
    def export_execution_to_hudi(
        self,
        execution_data: Dict[str, Any],
        table_name: Optional[str] = None,
        record_key_field: Optional[str] = None,
        partition_by: Optional[List[str]] = None,
        output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Exporta los datos de una ejecución a formato Apache Hudi
        
        Args:
            execution_data: Datos de la ejecución
            table_name: Nombre base para las tablas (se añadirá sufijo por archivo)
            record_key_field: Campo clave para los registros
            partition_by: Columnas para particionar los datos
            output_dir: Directorio de salida específico
            
        Returns:
            Diccionario con información sobre la exportación
        """
        try:
            dataframes, metadata = self._extract_data_from_execution(execution_data)
            
            if not dataframes:
                raise ValueError("No se encontraron datos para exportar")
            
            # Configurar salida
            output_path = output_dir or os.path.join(self.output_dir, 'hudi')
            if not os.path.exists(output_path):
                os.makedirs(output_path)
            
            # Generar nombre de tabla base si no se proporciona
            if table_name is None:
                if metadata.get('name'):
                    table_name = metadata['name'].replace(' ', '_').lower()
                elif metadata.get('execution_id'):
                    table_name = f"execution_{metadata['execution_id']}"
                else:
                    table_name = f"sage_export_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Exportar cada DataFrame como una tabla Hudi
            results = {}
            for file_name, df in dataframes.items():
                # Crear nombre de tabla para este archivo
                file_table_name = f"{table_name}_{os.path.splitext(file_name)[0]}"
                
                # Intentar inferir record_key_field si no se proporciona
                file_record_key = record_key_field
                if file_record_key is None:
                    common_key_columns = ['id', 'ID', 'key', 'KEY', 'pk', 'PK']
                    for key in common_key_columns:
                        if key in df.columns:
                            file_record_key = key
                            break
                
                # Exportar a Hudi
                result = convert_data_format(
                    df,
                    'hudi',
                    file_table_name,
                    record_key_field=file_record_key,
                    partition_by=partition_by,
                    output_dir=output_path
                )
                
                results[file_name] = result
            
            return {
                'format': 'hudi',
                'tables': results,
                'metadata': metadata,
                'location': output_path
            }
            
        except Exception as e:
            logger.error(f"Error al exportar a Hudi: {str(e)}")
            raise
    
    def export_data(
        self,
        data: Union[Dict[str, Any], str, "pd.DataFrame"],
        format_type: Optional[str] = None,
        table_name: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Exporta datos al formato de data lake especificado
        
        Args:
            data: Datos a exportar (ejecución, DataFrame o ruta a archivo)
            format_type: Formato de salida ('iceberg' o 'hudi')
            table_name: Nombre base para las tablas
            **kwargs: Argumentos adicionales específicos del formato
            
        Returns:
            Diccionario con información sobre la exportación
        """
        format_type = format_type or self.default_format
        format_type = format_type.lower()
        
        if format_type == 'iceberg':
            if isinstance(data, pd.DataFrame):
                # Si es un DataFrame directo, usar convert_data_format
                return convert_data_format(data, 'iceberg', table_name or 'sage_export', **kwargs)
            else:
                # Si es una ejecución o ruta, usar export_execution_to_iceberg
                return self.export_execution_to_iceberg(data, table_name, **kwargs)
                
        elif format_type == 'hudi':
            if isinstance(data, pd.DataFrame):
                # Si es un DataFrame directo, usar convert_data_format
                return convert_data_format(data, 'hudi', table_name or 'sage_export', **kwargs)
            else:
                # Si es una ejecución o ruta, usar export_execution_to_hudi
                return self.export_execution_to_hudi(data, table_name, **kwargs)
                
        else:
            raise ValueError(f"Formato no soportado: {format_type}. Use 'iceberg' o 'hudi'.")