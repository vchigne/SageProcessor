#!/usr/bin/env python3
"""
Script simplificado para procesar los datos de Clorox
con manejo mejorado de codificación BOM en archivos CSV
"""

import os
import sys
import logging
import pandas as pd
from sage.main import process_files

def detect_encoding(file_path):
    """
    Detecta la codificación apropiada para un archivo, con especial atención a BOM
    """
    # Lista de codificaciones a probar
    encodings = ['utf-8-sig', 'utf-8', 'latin1']
    
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                f.read(100)  # Leer un poco para ver si hay errores
                return encoding
        except UnicodeDecodeError:
            continue
    
    return 'utf-8'  # Default fallback

def patch_pandas_read_csv():
    """
    Reemplaza pd.read_csv con una versión que maneja mejor BOM
    """
    original_read_csv = pd.read_csv
    
    def patched_read_csv(filepath_or_buffer, **kwargs):
        # Si el archivo existe y es un string, intentamos determinar la codificación
        if isinstance(filepath_or_buffer, str) and os.path.isfile(filepath_or_buffer):
            # Si no se especifica encoding, intentamos detectarlo
            if 'encoding' not in kwargs:
                encoding = detect_encoding(filepath_or_buffer)
                kwargs['encoding'] = encoding
                
        # Llamar a la función original con los parámetros actualizados
        return original_read_csv(filepath_or_buffer, **kwargs)
    
    # Reemplazar la función
    pd.read_csv = patched_read_csv
    
    return original_read_csv

def procesar_clorox(yaml_path, zip_path):
    """Procesa los datos de Clorox usando el procesador modificado"""
    if not os.path.exists(yaml_path):
        print(f"Error: El archivo YAML no existe: {yaml_path}")
        return 1
    
    if not os.path.exists(zip_path):
        print(f"Error: El archivo ZIP no existe: {zip_path}")
        return 1
    
    print(f"Procesando YAML: {yaml_path}")
    print(f"Procesando ZIP: {zip_path}")
    
    # Configurar logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    # Aplicar el parche a pandas.read_csv
    print("Aplicando parche para manejo de BOM...")
    original_read_csv = patch_pandas_read_csv()
    
    try:
        # Ejecutar el procesamiento
        print("Iniciando procesamiento de archivos...")
        result = process_files(yaml_path, zip_path)
        print(f"Procesamiento finalizado con resultado: {result}")
        return result
    finally:
        # Restaurar la función original
        pd.read_csv = original_read_csv
        print("Función read_csv restaurada")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python procesar_clorox_simple.py <archivo_yaml> <archivo_zip>")
        sys.exit(1)
    
    yaml_path = sys.argv[1]
    zip_path = sys.argv[2]
    
    exit_code = procesar_clorox(yaml_path, zip_path)
    sys.exit(exit_code if isinstance(exit_code, int) else 1)