#!/usr/bin/env python3
"""
Script para procesar el archivo CloroxGenerico.yaml usando el procesador de archivos con soporte BOM
"""

import os
import sys
import logging
from sage.main import process_files
from sage.yaml_validator import YAMLValidator
from sage.models import SageConfig

def setup_logging():
    """Configurar el sistema de logging"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('procesar_clorox_bom.log')
        ]
    )
    return logging.getLogger(__name__)

def process_clorox():
    """Procesa los datos de Clorox con el procesador modificado"""
    yaml_path = "test_cli/CloroxGenerico.yaml"
    zip_path = "test_cli/output.zip"
    
    if not os.path.exists(yaml_path):
        raise FileNotFoundError(f"No se encontró el archivo YAML: {yaml_path}")
    
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f"No se encontró el archivo ZIP: {zip_path}")
    
    # Crear directorio para la ejecución
    execution_dir = f"executions/clorox_{os.getpid()}"
    os.makedirs(execution_dir, exist_ok=True)
    
    # En este punto, file_processor.py ya ha sido modificado con soporte para BOM
    # El tercer parámetro es el directorio de ejecución (no el casilla_id)
    result = process_files(yaml_path, zip_path, execution_dir)
    
    # Procesar el resultado según la estructura esperada
    if isinstance(result, tuple) and len(result) == 2:
        errors, warnings = result
    else:
        errors = result  # En versiones anteriores solo retornaba un código de error
        warnings = 0
    
    return execution_dir, errors, warnings

def main():
    """Función principal"""
    logger = setup_logging()
    logger.info("Iniciando procesamiento de CloroxGenerico usando procesador con soporte BOM")
    
    try:
        execution_dir, errors, warnings = process_clorox()
        logger.info(f"Procesamiento completado con {errors} errores y {warnings} advertencias")
        logger.info(f"Revisa el archivo de log: {os.path.join(execution_dir, 'output.log')}")
    except Exception as e:
        logger.error(f"Error al procesar el archivo: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    main()