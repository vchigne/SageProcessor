#!/usr/bin/env python3
"""
Script para ejecutar SAGE con soporte optimizado para:
- BOM en archivos CSV 
- Manejo de columnas adicionales o faltantes
- Detección automática de delimitadores
"""

import sys
import os
from datetime import datetime
from sage.main import process_files
from sage.bom_column_patch import apply_patched_read_file, remove_patched_read_file

def main():
    """
    Función principal que ejecuta SAGE con soporte para BOM y manejo de columnas adicionales
    """
    # Verificar argumentos
    if len(sys.argv) != 3:
        print("Uso: python sage_robust.py <archivo_yaml> <archivo_zip>")
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
    print("SAGE CON PROCESAMIENTO ROBUSTO")
    print("="*60)
    print(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Archivo YAML: {yaml_path}")
    print(f"Archivo de datos: {zip_path}")
    print("-"*60)
    
    # Aplicar el parche para manejar BOM y nombres de columnas
    print("Aplicando parche para procesamiento robusto...")
    original_read_file = apply_patched_read_file()
    
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
        remove_patched_read_file(original_read_file)
        print("Parche desactivado, sistema restaurado")

if __name__ == "__main__":
    exit_code = main()
    # Verificamos si exit_code es una tupla y si el segundo elemento (recuento de errores) es mayor que cero
    sys.exit(1 if isinstance(exit_code, tuple) and exit_code[1] > 0 else 0)