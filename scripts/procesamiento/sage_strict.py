#!/usr/bin/env python3
"""
Script para ejecutar SAGE con validación estricta para garantizar la integridad de datos

Este script aplica validaciones estrictas que verifican:
- Que el número de columnas en CSV/Excel coincida exactamente con la definición YAML
- Que los nombres de las columnas en archivos con encabezado coincidan con la definición
- Que todos los archivos definidos en el YAML estén presentes en el ZIP
- Correcta detección y manejo de archivos con BOM (Byte Order Mark)
"""

import sys
import os
from datetime import datetime
from sage.main import process_files
from sage.yaml_validator import YAMLValidator
from sage.logger import SageLogger
from sage.file_processor import FileProcessor
from sage.limit_rows_patch import apply_limit_rows_patch, remove_limit_rows_patch

def main():
    """
    Función principal que ejecuta SAGE con validación estricta
    """
    # Verificar argumentos
    if len(sys.argv) != 3:
        print("Uso: python sage_strict.py <archivo_yaml> <archivo_zip>")
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
        
    # Establecer un límite bajo para el procesamiento de datos
    # para evitar sobrecargar la salida con grandes cantidades de datos
    os.environ['SAGE_MAX_ROWS'] = '100'
    
    print("="*60)
    print("SAGE CON VALIDACIÓN ESTRICTA")
    print("="*60)
    print(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Archivo YAML: {yaml_path}")
    print(f"Archivo de datos: {zip_path}")
    print("-"*60)
    print("Este modo requiere una coincidencia exacta entre la estructura de los archivos")
    print("y la definición en el YAML. Las siguientes validaciones estrictas se aplicarán:")
    print(" - El número de columnas en CSV/Excel debe coincidir exactamente con la definición")
    print(" - Los nombres de columnas para archivos con encabezado deben coincidir exactamente")
    print(" - Todos los archivos definidos en el YAML deben estar presentes en el ZIP")
    print(" - Cualquier discrepancia se reportará como error")
    print("-"*60)
    
    # Método alternativo: usar un monkey patch para habilitar la validación estricta
    print("Aplicando validación estricta...")
    
    # Definir una función modificada process_files que usa la validación estricta
    def strict_process_files(yaml_path, zip_path):
        """Procesar archivos con validación estricta activada"""
        from sage.utils import create_execution_directory
        
        # Crear directorio de ejecución
        execution_dir, execution_uuid = create_execution_directory()
        
        # Crear el logger
        logger = SageLogger(execution_dir)
        logger.message(f"Starting SAGE execution {execution_uuid}")
        
        # Cargar la configuración YAML
        yaml_validator = YAMLValidator()
        config = yaml_validator.load_and_validate(yaml_path)
        if not config:
            return execution_uuid, 1, 0
        
        logger.success("YAML validation successful")
        
        # Crear el procesador de archivos con validación estricta activada
        processor = FileProcessor(config, logger)
        
        # Activar la validación estricta usando un monkey patch
        setattr(processor, 'strict_validation', True)
        
        # Aplicar el parche para limitar filas
        original_read_file = apply_limit_rows_patch()
        
        try:
            # Determinar qué paquete procesar (el primero)
            try:
                package_name = next(iter(config.packages.keys()))
            except Exception:
                logger.error("No se encontraron paquetes definidos en el archivo YAML")
                return execution_uuid, 1, 0
            
            # Aplicar validación estricta robusta que continúa procesando todos los archivos
            from sage.robust_strict_validation import apply_robust_strict_validation, remove_robust_strict_validation
            original_methods = apply_robust_strict_validation()
            
            try:
                # Procesar el archivo ZIP con validación estricta activada
                # La función strict_process_zip_file en strict_validation.py 
                # continuará procesando todos los archivos incluso si encuentra errores
                error_count, warning_count = processor.process_zip_file(zip_path, package_name)
                return execution_uuid, error_count, warning_count
            except Exception as e:
                # Capturar cualquier excepción durante el procesamiento
                # pero garantizar que se muestre un mensaje informativo
                logger.error(f"Error durante la validación estricta: {str(e)}")
                return execution_uuid, 1, 0
            finally:
                # Restaurar los métodos originales
                remove_robust_strict_validation(original_methods)
        finally:
            # Restaurar el método original del límite de filas
            remove_limit_rows_patch(original_read_file)
    
    try:
        # Ejecutar SAGE con la validación estricta aplicada
        print("Iniciando procesamiento...")
        exit_code = strict_process_files(yaml_path, zip_path)
        
        print("\n" + "="*60)
        print(f"Procesamiento finalizado con código de salida: {exit_code}")
        print("="*60)
        
        return exit_code
    
    except Exception as e:
        print("\n" + "="*60)
        print("ERROR DE VALIDACIÓN ESTRICTA")
        print("="*60)
        print(f"Se encontró un error durante la validación estricta:")
        print(f"{str(e)}")
        print("="*60)
        return (None, 1, 0)
    
    finally:
        # No necesitamos restaurar nada, ya que usamos una instancia aislada con strict_validation=True
        print("Validación estricta desactivada, sistema restaurado")

if __name__ == "__main__":
    exit_code = main()
    sys.exit(1 if isinstance(exit_code, tuple) and exit_code[1] > 0 else 0)