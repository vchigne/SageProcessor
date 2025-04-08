#!/usr/bin/env python3
"""
Script para ejecutar file_processor.py con validación estricta de columnas
"""
import os
import sys
from datetime import datetime
from sage.file_processor import FileProcessor
from sage.yaml_validator import YAMLValidator
from sage.logger import SageLogger
from sage.strict_validation import apply_strict_validation_patch, remove_strict_validation_patch

def ejecutar_processor(yaml_path, zip_path):
    """Función para ejecutar file_processor.py con validación estricta"""
    # Verificar que los archivos existen
    if not os.path.exists(yaml_path):
        print(f"Error: El archivo YAML no existe: {yaml_path}")
        return 1
    
    if not os.path.exists(zip_path):
        print(f"Error: El archivo ZIP no existe: {zip_path}")
        return 1
    
    print("="*60)
    print("EJECUCIÓN DE FILE_PROCESSOR.PY CON VALIDACIÓN ESTRICTA")
    print("="*60)
    print(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Archivo YAML: {yaml_path}")
    print(f"Archivo de datos: {zip_path}")
    print("-"*60)
    
    # Cargar la configuración YAML
    print("Validando y cargando configuración YAML...")
    validator = YAMLValidator()
    try:
        config = validator.load_and_validate(yaml_path)
        print("✅ YAML validado correctamente")
    except Exception as e:
        print(f"❌ Error al validar el YAML: {str(e)}")
        return 1
    
    # Crear un directorio de logs
    log_dir = os.path.join(os.getcwd(), "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, f"processor_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
    print(f"Log guardado en: {log_file}")
    
    # Crear un logger
    logger = SageLogger(log_dir=log_dir, casilla_id=None, emisor_id=None, metodo_envio=None)
    
    # Aplicar la validación estricta al procesador
    print("Aplicando validación estricta de columnas...")
    original_methods = apply_strict_validation_patch()
    
    try:
        # Crear instancia del procesador de archivos
        file_processor = FileProcessor(config=config, logger=logger)
        
        # Obtener el nombre del paquete (primero en el YAML)
        package_name = list(config.packages.keys())[0]
        print(f"Procesando paquete: {package_name}")
        
        # Procesar el archivo ZIP
        print(f"Procesando archivo ZIP: {os.path.basename(zip_path)}")
        error_count = file_processor.process_zip_file(zip_path, package_name)
        
        # FileProcessor.process_zip_file puede devolver un entero o una tupla (error_count, warning_count)
        if isinstance(error_count, tuple):
            error_count, warning_count = error_count
            print(f"\nReporte final: {error_count} errores, {warning_count} advertencias")
        else:
            print(f"\nReporte final: {error_count} errores/advertencias")
        
        # Mostrar mensaje de éxito o error
        if error_count > 0:
            print("\n❌ VALIDACIÓN FALLIDA: Se encontraron errores en los archivos")
        else:
            print("\n✅ VALIDACIÓN EXITOSA: Todos los archivos cumplen con la configuración YAML")
        
        return error_count
    
    finally:
        # Restaurar los métodos originales
        remove_strict_validation_patch(original_methods)
        print("Validación estricta desactivada")

if __name__ == "__main__":
    if len(sys.argv) == 3:
        yaml_path = sys.argv[1]
        zip_path = sys.argv[2]
    else:
        # Usar valores predeterminados
        yaml_path = "test_cli/CanalTradicionalArchivosDistribuidora.yaml"
        zip_path = "test_cli/output.zip"
        print("Usando archivos predeterminados:")
        print(f"  YAML: {yaml_path}")
        print(f"  ZIP: {zip_path}")
        print("Para usar archivos diferentes: python ejecutar_processor.py <archivo_yaml> <archivo_zip>")
    
    error_count = ejecutar_processor(yaml_path, zip_path)
    
    # Salir con código de error si hay errores
    sys.exit(1 if error_count > 0 else 0)