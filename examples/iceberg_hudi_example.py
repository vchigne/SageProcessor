"""
Ejemplo práctico de uso de los exportadores a formatos de data lake

Este script demuestra cómo exportar datos a formatos Apache Iceberg y Apache Hudi
utilizando los módulos implementados en SAGE.
"""

import os
import pandas as pd
from datetime import datetime, timedelta
import random

# Importar los módulos necesarios
from sage.data_format_converter import convert_data_format
from sage.exporters.data_lake_exporter import DataLakeExporter

# Crear directorio para ejemplos
os.makedirs('./examples/output', exist_ok=True)

def crear_datos_ejemplo():
    """Crea un DataFrame de ejemplo con datos de ventas"""
    # Configurar semilla aleatoria para reproducibilidad
    random.seed(42)
    
    # Crear datos de ejemplo
    paises = ['Argentina', 'Brasil', 'Chile', 'Colombia', 'México', 'Perú']
    categorias = ['Electrónica', 'Hogar', 'Moda', 'Alimentos', 'Deportes']
    metodos_pago = ['Tarjeta', 'Efectivo', 'Transferencia', 'PayPal']
    
    # Crear DataFrame con 100 registros de ventas
    registros = []
    fecha_base = datetime(2025, 1, 1)
    
    for i in range(1, 101):
        fecha = fecha_base + timedelta(days=random.randint(0, 90))
        registro = {
            'id': i,
            'fecha': fecha,
            'pais': random.choice(paises),
            'categoria': random.choice(categorias),
            'monto': round(random.uniform(100, 10000), 2),
            'metodo_pago': random.choice(metodos_pago),
            'cliente_id': random.randint(1000, 9999),
            'items': random.randint(1, 10)
        }
        registros.append(registro)
    
    # Crear DataFrame
    df = pd.DataFrame(registros)
    df['año'] = df['fecha'].dt.year
    df['mes'] = df['fecha'].dt.month
    
    return df

def ejemplo_conversion_directa():
    """Ejemplo de conversión directa a formatos Iceberg y Hudi"""
    print("\n=== Ejemplo de conversión directa a formatos Iceberg y Hudi ===")
    
    # Crear datos de ejemplo
    df = crear_datos_ejemplo()
    print(f"Datos de ejemplo creados: {len(df)} registros")
    
    # Guardar una copia en CSV para referencia
    csv_path = './examples/output/ventas_ejemplo.csv'
    df.to_csv(csv_path, index=False)
    print(f"Datos guardados en CSV: {csv_path}")
    
    # Convertir a formato Iceberg
    print("\nConvirtiendo a formato Iceberg...")
    iceberg_result = convert_data_format(
        df,
        'iceberg',
        'ventas_iceberg',
        partition_by=['año', 'mes', 'pais']
    )
    print("Conversión a Iceberg completada:")
    print(f"- Ubicación: {iceberg_result['location']}")
    print(f"- Filas: {iceberg_result['rows']}")
    print(f"- Columnas: {len(iceberg_result['columns'])}")
    
    # Convertir a formato Hudi
    print("\nConvirtiendo a formato Hudi...")
    hudi_result = convert_data_format(
        df,
        'hudi',
        'ventas_hudi',
        record_key_field='id',
        precombine_field='fecha',
        partition_by=['año', 'mes']
    )
    print("Conversión a Hudi completada:")
    print(f"- Ubicación: {hudi_result['location']}")
    print(f"- Filas: {hudi_result['rows']}")
    print(f"- Columnas: {len(hudi_result['columns'])}")
    
    return iceberg_result, hudi_result

def ejemplo_exportador():
    """Ejemplo de uso del exportador de data lake"""
    print("\n=== Ejemplo de uso del exportador de data lake ===")
    
    # Crear exportador
    exporter = DataLakeExporter(config={
        'output_dir': './examples/output/exports'
    })
    print(f"Exportador creado con directorio de salida: {exporter.output_dir}")
    
    # Crear datos de ejemplo
    df = crear_datos_ejemplo()
    
    # Simular datos de ejecución
    execution_data = {
        'id': 123,
        'casilla_id': 45,
        'casilla_nombre': 'Ventas Trimestrales',
        'fecha_ejecucion': datetime.now().isoformat(),
        'estado': 'Éxito',
        'datos': df
    }
    
    # Exportar datos a Iceberg
    print("\nExportando a formato Iceberg...")
    iceberg_result = exporter.export_execution_to_iceberg(
        execution_data,
        table_name='ventas_trimestrales',
        partition_by=['año', 'mes', 'categoria']
    )
    print("Exportación a Iceberg completada:")
    print(f"- Ubicación: {iceberg_result['location']}")
    print(f"- Filas: {iceberg_result['rows']}")
    print(f"- ID de ejecución: {iceberg_result['execution_id']}")
    
    # Exportar datos a Hudi
    print("\nExportando a formato Hudi...")
    hudi_result = exporter.export_execution_to_hudi(
        execution_data,
        table_name='ventas_trimestrales',
        record_key_field='id',
        partition_by=['pais', 'categoria']
    )
    print("Exportación a Hudi completada:")
    print(f"- Ubicación: {hudi_result['location']}")
    print(f"- Filas: {hudi_result['rows']}")
    print(f"- ID de ejecución: {hudi_result['execution_id']}")
    
    return iceberg_result, hudi_result

def ejemplo_desde_csv():
    """Ejemplo de exportación desde un archivo CSV"""
    print("\n=== Ejemplo de exportación desde un archivo CSV ===")
    
    # Ruta al archivo CSV de ejemplo
    csv_path = './examples/output/ventas_ejemplo.csv'
    
    if not os.path.exists(csv_path):
        # Crear datos de ejemplo si el CSV no existe
        df = crear_datos_ejemplo()
        df.to_csv(csv_path, index=False)
    
    print(f"Usando archivo CSV: {csv_path}")
    
    # Exportar directamente desde CSV a Iceberg
    print("\nExportando CSV a formato Iceberg...")
    iceberg_result = convert_data_format(
        csv_path,
        'iceberg',
        'csv_to_iceberg',
        partition_by=['pais']
    )
    print("Exportación a Iceberg completada:")
    print(f"- Ubicación: {iceberg_result['location']}")
    print(f"- Filas: {iceberg_result['rows']}")
    
    # Exportar directamente desde CSV a Hudi
    print("\nExportando CSV a formato Hudi...")
    hudi_result = convert_data_format(
        csv_path,
        'hudi',
        'csv_to_hudi',
        record_key_field='id'
    )
    print("Exportación a Hudi completada:")
    print(f"- Ubicación: {hudi_result['location']}")
    print(f"- Filas: {hudi_result['rows']}")
    
    return iceberg_result, hudi_result

def mostrar_estructura_archivos(directorio):
    """Muestra la estructura de archivos generados"""
    print(f"\n=== Estructura de archivos en {directorio} ===")
    
    if not os.path.exists(directorio):
        print(f"El directorio {directorio} no existe")
        return
    
    for root, dirs, files in os.walk(directorio):
        level = root.replace(directorio, '').count(os.sep)
        indent = ' ' * 4 * level
        print(f"{indent}{os.path.basename(root)}/")
        sub_indent = ' ' * 4 * (level + 1)
        for file in files:
            print(f"{sub_indent}{file}")

if __name__ == "__main__":
    print("====================================================")
    print("  EJEMPLOS DE USO DE EXPORTADORES A DATA LAKE")
    print("====================================================")
    
    # Ejemplo de conversión directa
    iceberg_direct, hudi_direct = ejemplo_conversion_directa()
    
    # Ejemplo de uso del exportador
    iceberg_export, hudi_export = ejemplo_exportador()
    
    # Ejemplo desde CSV
    iceberg_csv, hudi_csv = ejemplo_desde_csv()
    
    # Mostrar estructura de archivos generados
    print("\n\n====================================================")
    print("  ESTRUCTURA DE ARCHIVOS GENERADOS")
    print("====================================================")
    
    mostrar_estructura_archivos('./examples/output')
    
    print("\n====================================================")
    print("  EJEMPLOS COMPLETADOS")
    print("====================================================")
    print("\nPuede explorar los archivos generados en './examples/output'")
    print("Para inspeccionar los metadatos de Iceberg, consulte 'metadata.json'")
    print("Para inspeccionar los metadatos de Hudi, consulte '.hoodie/hoodie.properties'")