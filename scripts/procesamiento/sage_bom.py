#!/usr/bin/env python3
"""
Script para ejecutar SAGE con soporte para BOM en archivos CSV

Este script aplica un parche al procesador de archivos de SAGE para 
manejar correctamente los archivos CSV con Byte Order Mark (BOM).
"""

import sys
import os
from datetime import datetime
from sage.main import process_files
from sage.bom_patch import apply_bom_patch

def main():
    """
    Función principal que ejecuta SAGE con soporte para BOM
    """
    # Verificar argumentos
    if len(sys.argv) != 3:
        print("Uso: python sage_bom.py <archivo_yaml> <archivo_zip>")
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
    original_read_file = apply_bom_patch()
    
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
        from sage.file_processor import FileProcessor
        FileProcessor._read_file = original_read_file
        print("Parche BOM desactivado, sistema restaurado")

if __name__ == "__main__":
    exit_code = main()
    sys.exit(1 if isinstance(exit_code, tuple) else exit_code)