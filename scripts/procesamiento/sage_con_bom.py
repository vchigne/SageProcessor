#!/usr/bin/env python3
"""
Script para ejecutar SAGE con soporte para BOM en archivos CSV
Este script aplica un parche mínimo a file_processor.py para manejar BOM
sin modificar el código original
"""

import sys
import os
from datetime import datetime
import pandas as pd
from sage.main import process_files

def detect_bom(file_path):
    """
    Detecta si un archivo tiene BOM (Byte Order Mark)
    
    Args:
        file_path: Ruta al archivo a comprobar
        
    Returns:
        bool: True si el archivo tiene BOM, False en caso contrario
    """
    try:
        with open(file_path, 'rb') as f:
            # BOM UTF-8: EF BB BF
            return f.read(3) == b'\xef\xbb\xbf'
    except Exception:
        return False

def patch_pandas_read_csv():
    """
    Reemplaza pd.read_csv con una versión que maneja mejor BOM
    Esta es una solución alternativa sin modificar file_processor.py
    """
    original_read_csv = pd.read_csv
    
    def patched_read_csv(filepath_or_buffer, **kwargs):
        """Versión parcheada de pd.read_csv con soporte para BOM"""
        if isinstance(filepath_or_buffer, str) and os.path.isfile(filepath_or_buffer):
            if detect_bom(filepath_or_buffer):
                # Si el archivo tiene BOM, asegurarse de usar 'utf-8-sig'
                kwargs['encoding'] = 'utf-8-sig'
        
        # Llamar a la función original con los parámetros actualizados
        return original_read_csv(filepath_or_buffer, **kwargs)
    
    # Reemplazar el método original
    pd.read_csv = patched_read_csv
    
    # Devolver el método original
    return original_read_csv

def main():
    """
    Función principal que ejecuta SAGE con soporte para BOM
    """
    # Verificar argumentos
    if len(sys.argv) != 3:
        print("Uso: python sage_con_bom.py <archivo_yaml> <archivo_zip>")
        sys.exit(1)
    
    yaml_path = sys.argv[1]
    zip_path = sys.argv[2]
    
    # Verificar que los archivos existen
    if not os.path.exists(yaml_path):
        print(f"Error: El archivo YAML no existe: {yaml_path}")
        sys.exit(1)
    
    if not os.path.exists(zip_path):
        print(f"Error: El archivo ZIP no existe: {zip_path}")
        sys.exit(1)
    
    print("="*60)
    print("SAGE CON SOPORTE PARA BOM")
    print("="*60)
    print(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Archivo YAML: {yaml_path}")
    print(f"Archivo de datos: {zip_path}")
    print("-"*60)
    
    # Aplicar el parche para manejar BOM
    print("Aplicando parche para soporte de BOM...")
    original_read_csv = patch_pandas_read_csv()
    
    try:
        # Ejecutar SAGE con el parche aplicado
        print("Iniciando procesamiento...")
        exit_code = process_files(yaml_path, zip_path)
        
        print("\n" + "="*60)
        print(f"Procesamiento finalizado con código de salida: {exit_code}")
        print("="*60)
        
        return exit_code
    
    finally:
        # Restaurar el método original (para limpieza)
        pd.read_csv = original_read_csv
        print("Parche BOM desactivado, sistema restaurado")

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)