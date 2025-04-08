#!/usr/bin/env python3
"""
Script para mostrar cómo se comporta el file_processor de SAGE ante errores estructurales
"""
import os
import sys
from sage.yaml_validator import YAMLValidator
from sage.file_processor import FileProcessor
from sage.logger import SageLogger
from sage.strict_validation import apply_strict_validation_patch, remove_strict_validation_patch

def main():
    """Función principal para probar file_processor"""
    # Configurar el logger
    logger = SageLogger(log_dir=os.getcwd(), casilla_id=None, emisor_id=None, metodo_envio=None)
    
    # Aplicar el parche de validación estricta
    original_methods = apply_strict_validation_patch()
    
    try:
        # Cargar la configuración YAML
        yaml_path = "test_multi_error/ProbarMulti.yaml"
        validator = YAMLValidator()
        config = validator.load_and_validate(yaml_path)
        
        # Crear instancia del procesador de archivos
        file_processor = FileProcessor(config=config, logger=logger)
        
        # Obtener el nombre del paquete
        package_name = list(config.packages.keys())[0]
        
        # Procesar el archivo ZIP
        zip_path = "test_multi_error/multi_error.zip"
        try:
            print("Procesando archivo ZIP con validación estricta...")
            error_count = file_processor.process_zip_file(zip_path, package_name)
            print(f"Resultado: {error_count}")
        except Exception as e:
            print(f"Error al procesar el ZIP: {str(e)}")
    
    finally:
        # Restaurar los métodos originales
        remove_strict_validation_patch(original_methods)

if __name__ == "__main__":
    main()