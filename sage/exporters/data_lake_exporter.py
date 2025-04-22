"""
Exportador de datos a formatos de lago de datos.

Permite exportar datos de ejecuciones SAGE a formatos Apache Iceberg y Apache Hudi.
"""

import os
import logging
import pandas as pd
from datetime import datetime
from sage.data_format_converter import convert_data_format

# Configurar logging
logger = logging.getLogger("sage.exporters.data_lake_exporter")

class DataLakeExporter:
    """
    Exportador de datos a formatos de lago de datos.
    Soporta Apache Iceberg y Apache Hudi.
    """
    
    def __init__(self, config=None):
        """
        Inicializa el exportador con la configuración proporcionada.
        
        Args:
            config (dict): Configuración del exportador
        """
        self.config = config or {}
        self.output_dir = self.config.get('output_dir', './tmp/data_lake_exports')
        
        # Crear directorio de salida si no existe
        os.makedirs(self.output_dir, exist_ok=True)
    
    def export_execution_to_iceberg(self, execution_data, table_name=None, partition_by=None):
        """
        Exporta los datos de una ejecución a formato Apache Iceberg.
        
        Args:
            execution_data (dict): Datos de la ejecución
            table_name (str): Nombre de la tabla Iceberg (opcional)
            partition_by (list): Columnas para particionar (opcional)
            
        Returns:
            dict: Información sobre la tabla Iceberg creada
        """
        # Generar nombre de tabla por defecto si no se proporciona
        if not table_name:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            prefix = execution_data.get('casilla_nombre', 'ejecucion').lower().replace(' ', '_')
            table_name = f"{prefix}_{timestamp}"
        
        # Obtener DataFrame de los datos
        try:
            # Si los datos ya son un DataFrame
            if isinstance(execution_data.get('datos'), pd.DataFrame):
                df = execution_data['datos']
            # Si hay datos en formato CSV, Excel, etc.
            elif execution_data.get('ruta_datos'):
                ruta_datos = execution_data['ruta_datos']
                if ruta_datos.endswith('.csv'):
                    df = pd.read_csv(ruta_datos)
                elif ruta_datos.endswith(('.xls', '.xlsx')):
                    df = pd.read_excel(ruta_datos)
                else:
                    raise ValueError(f"Formato de archivo no soportado: {ruta_datos}")
            # Si no hay datos
            else:
                raise ValueError("No se encontraron datos para exportar")
            
            # Configuración del catálogo
            catalog_config = {
                'type': 'local',
                'warehouse': os.path.join(self.output_dir, 'iceberg')
            }
            
            # Exportar a Iceberg
            result = convert_data_format(
                df,
                'iceberg',
                table_name,
                catalog_config=catalog_config,
                partition_by=partition_by
            )
            
            # Registrar la exportación
            logger.info(f"Datos exportados a formato Iceberg: {result['location']}")
            
            # Agregar detalles adicionales
            result.update({
                'execution_id': execution_data.get('id'),
                'casilla_id': execution_data.get('casilla_id'),
                'export_time': datetime.now().isoformat()
            })
            
            return result
        
        except Exception as e:
            logger.error(f"Error al exportar a Iceberg: {str(e)}")
            raise
    
    def export_execution_to_hudi(self, execution_data, table_name=None, record_key_field=None, partition_by=None):
        """
        Exporta los datos de una ejecución a formato Apache Hudi.
        
        Args:
            execution_data (dict): Datos de la ejecución
            table_name (str): Nombre de la tabla Hudi (opcional)
            record_key_field (str): Campo clave para registros
            partition_by (list): Columnas para particionar (opcional)
            
        Returns:
            dict: Información sobre la tabla Hudi creada
        """
        # Generar nombre de tabla por defecto si no se proporciona
        if not table_name:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            prefix = execution_data.get('casilla_nombre', 'ejecucion').lower().replace(' ', '_')
            table_name = f"{prefix}_{timestamp}"
        
        # Obtener DataFrame de los datos
        try:
            # Si los datos ya son un DataFrame
            if isinstance(execution_data.get('datos'), pd.DataFrame):
                df = execution_data['datos']
            # Si hay datos en formato CSV, Excel, etc.
            elif execution_data.get('ruta_datos'):
                ruta_datos = execution_data['ruta_datos']
                if ruta_datos.endswith('.csv'):
                    df = pd.read_csv(ruta_datos)
                elif ruta_datos.endswith(('.xls', '.xlsx')):
                    df = pd.read_excel(ruta_datos)
                else:
                    raise ValueError(f"Formato de archivo no soportado: {ruta_datos}")
            # Si no hay datos
            else:
                raise ValueError("No se encontraron datos para exportar")
            
            # Determinar campo clave si no se proporciona
            if not record_key_field:
                # Intentar encontrar un campo clave adecuado
                possible_key_fields = ['id', 'ID', 'codigo', 'CODIGO', 'key', 'KEY']
                for field in possible_key_fields:
                    if field in df.columns:
                        record_key_field = field
                        break
                
                # Si no se encuentra un campo clave, usar el índice
                if not record_key_field:
                    df = df.reset_index()
                    record_key_field = 'index'
            
            # Exportar a Hudi
            result = convert_data_format(
                df,
                'hudi',
                table_name,
                record_key_field=record_key_field,
                partition_by=partition_by
            )
            
            # Registrar la exportación
            logger.info(f"Datos exportados a formato Hudi: {result['location']}")
            
            # Agregar detalles adicionales
            result.update({
                'execution_id': execution_data.get('id'),
                'casilla_id': execution_data.get('casilla_id'),
                'export_time': datetime.now().isoformat()
            })
            
            return result
        
        except Exception as e:
            logger.error(f"Error al exportar a Hudi: {str(e)}")
            raise
    
    def export_data(self, data, format_type, table_name=None, **kwargs):
        """
        Exporta datos al formato de lago de datos especificado.
        
        Args:
            data: DataFrame o diccionario con datos de ejecución
            format_type (str): 'iceberg' o 'hudi'
            table_name (str): Nombre de la tabla (opcional)
            **kwargs: Argumentos adicionales específicos del formato
            
        Returns:
            dict: Información sobre la exportación
        """
        if format_type.lower() == 'iceberg':
            if isinstance(data, pd.DataFrame):
                return convert_data_format(
                    data,
                    'iceberg',
                    table_name or f"table_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    **kwargs
                )
            else:
                return self.export_execution_to_iceberg(data, table_name, **kwargs)
        
        elif format_type.lower() == 'hudi':
            if isinstance(data, pd.DataFrame):
                return convert_data_format(
                    data,
                    'hudi',
                    table_name or f"table_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    **kwargs
                )
            else:
                return self.export_execution_to_hudi(data, table_name, **kwargs)
        
        else:
            raise ValueError(f"Formato no soportado: {format_type}. Debe ser 'iceberg' o 'hudi'")