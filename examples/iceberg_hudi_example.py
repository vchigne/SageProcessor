"""
Ejemplo de uso de los exportadores de data lake

Este script muestra cómo utilizar los exportadores para convertir datos
a formatos Apache Iceberg y Apache Hudi.
"""

import os
import sys
import logging
import pandas as pd
from datetime import datetime

# Añadir directorio raíz al path para poder importar los módulos
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from sage.data_format_converter import convert_data_format
    from sage.exporters import DataLakeExporter
except ImportError:
    print("Error: No se pudieron importar los módulos necesarios")
    print("Asegúrate de estar ejecutando este script desde el directorio raíz o que el directorio 'sage' esté en el PYTHONPATH")
    sys.exit(1)

# Configurar logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def generar_datos_ejemplo():
    """
    Genera un DataFrame de ejemplo para las pruebas
    
    Returns:
        DataFrame con datos de ventas de ejemplo
    """
    # Datos de ventas ficticios
    data = {
        'id': list(range(1, 101)),
        'fecha': [datetime.now().date() for _ in range(100)],
        'producto': ['Producto ' + str(i % 10 + 1) for i in range(100)],
        'categoria': ['Categoría ' + str(i % 5 + 1) for i in range(100)],
        'cantidad': [i % 10 + 1 for i in range(100)],
        'precio_unitario': [(i % 10 + 1) * 10.5 for i in range(100)],
        'total': [(i % 10 + 1) * (i % 10 + 1) * 10.5 for i in range(100)]
    }
    
    return pd.DataFrame(data)

def ejemplo_conversion_directa():
    """
    Ejemplo de conversión directa usando convert_data_format
    """
    logger.info("Ejemplo 1: Conversión directa con convert_data_format")
    
    # Generar datos de ejemplo
    df = generar_datos_ejemplo()
    
    # Directorio de salida
    output_dir = os.path.join(os.path.dirname(__file__), 'outputs', 'conversion_directa')
    os.makedirs(output_dir, exist_ok=True)
    
    # Convertir a Iceberg
    logger.info("Convirtiendo datos a formato Iceberg...")
    iceberg_result = convert_data_format(
        df,
        'iceberg',
        'ventas_ejemplo',
        partition_by=['categoria'],
        output_dir=os.path.join(output_dir, 'iceberg')
    )
    
    logger.info(f"Resultado de conversión a Iceberg: {iceberg_result}")
    
    # Convertir a Hudi
    logger.info("Convirtiendo datos a formato Hudi...")
    hudi_result = convert_data_format(
        df,
        'hudi',
        'ventas_ejemplo',
        record_key_field='id',
        partition_by=['categoria'],
        output_dir=os.path.join(output_dir, 'hudi')
    )
    
    logger.info(f"Resultado de conversión a Hudi: {hudi_result}")

def ejemplo_exportador_data_lake():
    """
    Ejemplo de uso del exportador DataLakeExporter
    """
    logger.info("Ejemplo 2: Uso del exportador DataLakeExporter")
    
    # Generar datos de ejemplo
    df_ventas = generar_datos_ejemplo()
    
    # Crear un conjunto de datos simulando una ejecución SAGE
    ejemplo_ejecucion = {
        'id': 12345,
        'name': 'Ventas Mensuales',
        'source': 'Sistema ERP',
        'files': {
            'ventas.csv': df_ventas,
            'productos.csv': pd.DataFrame({
                'id_producto': list(range(1, 11)),
                'nombre': ['Producto ' + str(i) for i in range(1, 11)],
                'precio_base': [i * 10.5 for i in range(1, 11)]
            })
        }
    }
    
    # Crear el exportador
    output_dir = os.path.join(os.path.dirname(__file__), 'outputs', 'exportador')
    exporter = DataLakeExporter(config={
        'output_dir': output_dir,
        'default_format': 'iceberg'
    })
    
    # Exportar a Iceberg
    logger.info("Exportando datos a formato Iceberg...")
    iceberg_export = exporter.export_execution_to_iceberg(
        ejemplo_ejecucion,
        partition_by=['categoria']
    )
    
    logger.info(f"Resultado de exportación a Iceberg: {iceberg_export}")
    
    # Exportar a Hudi
    logger.info("Exportando datos a formato Hudi...")
    hudi_export = exporter.export_execution_to_hudi(
        ejemplo_ejecucion,
        record_key_field='id',
        partition_by=['categoria']
    )
    
    logger.info(f"Resultado de exportación a Hudi: {hudi_export}")
    
    # Usar la interfaz unificada
    logger.info("Usando la interfaz unificada del exportador...")
    unified_export = exporter.export_data(
        ejemplo_ejecucion,
        format_type='iceberg',
        table_name='ventas_unificado',
        partition_by=['categoria', 'producto']
    )
    
    logger.info(f"Resultado de exportación unificada: {unified_export}")

def ejemplo_integracion_con_materializacion():
    """
    Ejemplo que simula la integración con el sistema de materialización
    """
    logger.info("Ejemplo 3: Integración con el sistema de materialización")
    
    # Generar datos de ejemplo
    df_ventas = generar_datos_ejemplo()
    
    # Directorio de salida
    output_dir = os.path.join(os.path.dirname(__file__), 'outputs', 'materializacion')
    os.makedirs(output_dir, exist_ok=True)
    
    # Crear el exportador
    exporter = DataLakeExporter(config={'output_dir': output_dir})
    
    # Simular proceso de materialización
    logger.info("Simulando proceso de materialización...")
    
    # 1. Obtener datos de la ejecución
    datos_ejecucion = {
        'id': 54321,
        'name': 'Ventas_Diarias',
        'source': 'API Ventas',
        'files': {
            'ventas_diarias.csv': df_ventas.copy()
        }
    }
    
    # 2. Definir destino (Iceberg en S3)
    destino_config = {
        'tipo': 'cloud',
        'formato': 'iceberg',
        'config': {
            'catalog_config': {
                'type': 'local',  # En producción sería 'glue', 'rest', etc.
                'warehouse': os.path.join(output_dir, 'iceberg_warehouse')
            }
        }
    }
    
    # 3. Aplicar la materialización
    logger.info("Materializando datos a formato Iceberg...")
    
    # Obtener información de particionamiento
    particion_config = {
        'columns': ['categoria', 'fecha'],
        'transform': None  # Transformación de identidad (valor directo)
    }
    
    # Realizar la exportación (materialización)
    result = exporter.export_data(
        datos_ejecucion,
        format_type=destino_config['formato'],
        table_name='ventas_materializadas',
        partition_by=particion_config['columns'],
        catalog_config=destino_config['config'].get('catalog_config')
    )
    
    logger.info(f"Materialización completada: {result}")
    logger.info(f"Datos disponibles en: {result['location']}")

if __name__ == "__main__":
    logger.info("Iniciando ejemplos de exportación a data lake...")
    
    try:
        ejemplo_conversion_directa()
        ejemplo_exportador_data_lake()
        ejemplo_integracion_con_materializacion()
        
        logger.info("Todos los ejemplos ejecutados correctamente")
    except Exception as e:
        logger.error(f"Error al ejecutar ejemplos: {str(e)}", exc_info=True)