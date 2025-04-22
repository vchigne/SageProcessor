"""
Script de ejemplo para probar la conversión de datos a formatos de lago de datos
- Apache Iceberg
- Apache Hudi
"""

import os
import pandas as pd
from sage.data_format_converter import convert_data_format, DataLakeFormatConverter

def test_convert_to_iceberg():
    """
    Prueba la conversión de datos a formato Apache Iceberg
    """
    print("\n--- Prueba de conversión a formato Apache Iceberg ---")
    
    # Crear datos de ejemplo
    data = {
        'id': [1, 2, 3, 4, 5],
        'nombre': ['Juan', 'María', 'Pedro', 'Ana', 'Luis'],
        'edad': [25, 30, 35, 40, 45],
        'ciudad': ['Lima', 'Bogotá', 'Santiago', 'Madrid', 'México'],
        'fecha': pd.date_range('2025-01-01', periods=5)
    }
    
    df = pd.DataFrame(data)
    print("Datos de ejemplo:")
    print(df.head())
    
    # Convertir a formato Iceberg
    result = convert_data_format(
        df,
        'iceberg',
        'ejemplo_iceberg',
        partition_by=['ciudad']
    )
    
    print("\nResultado de la conversión:")
    for key, value in result.items():
        print(f"{key}: {value}")
    
    # Verificar archivos generados
    print("\nArchivos generados:")
    if os.path.exists(result['location']):
        for root, dirs, files in os.walk(result['location']):
            for file in files:
                print(f" - {os.path.join(root, file)}")

def test_convert_to_hudi():
    """
    Prueba la conversión de datos a formato Apache Hudi
    """
    print("\n--- Prueba de conversión a formato Apache Hudi ---")
    
    # Crear datos de ejemplo
    data = {
        'id': [1, 2, 3, 4, 5],
        'nombre': ['Juan', 'María', 'Pedro', 'Ana', 'Luis'],
        'edad': [25, 30, 35, 40, 45],
        'ciudad': ['Lima', 'Bogotá', 'Santiago', 'Madrid', 'México'],
        'fecha': pd.date_range('2025-01-01', periods=5).astype(str)
    }
    
    df = pd.DataFrame(data)
    print("Datos de ejemplo:")
    print(df.head())
    
    # Convertir a formato Hudi
    result = convert_data_format(
        df,
        'hudi',
        'ejemplo_hudi',
        record_key_field='id',
        precombine_field='fecha',
        partition_by=['ciudad']
    )
    
    print("\nResultado de la conversión:")
    for key, value in result.items():
        print(f"{key}: {value}")
    
    # Verificar archivos generados
    print("\nArchivos generados:")
    if os.path.exists(result['location']):
        for root, dirs, files in os.walk(result['location']):
            for file in files:
                print(f" - {os.path.join(root, file)}")

def test_convert_from_csv():
    """
    Prueba la conversión de datos desde CSV a formatos de lago de datos
    """
    print("\n--- Prueba de conversión desde CSV ---")
    
    # Crear un CSV de ejemplo
    data = {
        'id': [1, 2, 3, 4, 5],
        'nombre': ['Juan', 'María', 'Pedro', 'Ana', 'Luis'],
        'edad': [25, 30, 35, 40, 45],
        'ciudad': ['Lima', 'Bogotá', 'Santiago', 'Madrid', 'México'],
        'fecha': pd.date_range('2025-01-01', periods=5).astype(str)
    }
    
    df = pd.DataFrame(data)
    csv_path = './tmp/datos_ejemplo.csv'
    os.makedirs('./tmp', exist_ok=True)
    df.to_csv(csv_path, index=False)
    
    print(f"CSV de ejemplo creado en: {csv_path}")
    
    # Convertir desde CSV a Iceberg
    iceberg_result = convert_data_format(
        csv_path,
        'iceberg',
        'csv_a_iceberg'
    )
    
    print("\nResultado de la conversión a Iceberg:")
    for key, value in iceberg_result.items():
        print(f"{key}: {value}")
    
    # Convertir desde CSV a Hudi
    hudi_result = convert_data_format(
        csv_path,
        'hudi',
        'csv_a_hudi',
        record_key_field='id'
    )
    
    print("\nResultado de la conversión a Hudi:")
    for key, value in hudi_result.items():
        print(f"{key}: {value}")

if __name__ == "__main__":
    print("=== Pruebas de conversión a formatos de lago de datos ===")
    
    test_convert_to_iceberg()
    test_convert_to_hudi()
    test_convert_from_csv()
    
    print("\n=== Pruebas completadas ===")