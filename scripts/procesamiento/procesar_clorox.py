#!/usr/bin/env python3
"""
Script para procesar los datos de Clorox con manejo mejorado de BOM

Este script utiliza una versión modificada del procesador de archivos de SAGE
que maneja correctamente los archivos CSV con Byte Order Mark (BOM).
"""

import sys
import os
import logging
import yaml
import tempfile
import zipfile
from datetime import datetime

# Configurar el directorio de ejecución
execution_uuid = datetime.now().strftime("%Y%m%d_%H%M%S")
execution_dir = f"executions/{execution_uuid}"
os.makedirs(execution_dir, exist_ok=True)

def setup_logging():
    """Configurar el sistema de logging"""
    log_file = f"{execution_dir}/execution.log"
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    return logging.getLogger()

def process_clorox_data(yaml_path, zip_path):
    """Procesa los datos de Clorox utilizando el procesador modificado"""
    logger = setup_logging()
    
    logger.info(f"Iniciando procesamiento con YAML: {yaml_path}")
    logger.info(f"Archivo de datos: {zip_path}")
    
    # Cargar la configuración YAML
    try:
        with open(yaml_path, 'r', encoding='utf-8') as f:
            yaml_config = yaml.safe_load(f)
        logger.info("Configuración YAML cargada correctamente")
        
        # Extraer los archivos CSV del ZIP para inspección
        temp_dir = tempfile.mkdtemp()
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        logger.info(f"Archivos extraídos en: {temp_dir}")
        
        # Listar los archivos extraídos
        csv_files = []
        for root, _, files in os.walk(temp_dir):
            for file in files:
                if file.endswith('.csv'):
                    csv_files.append(os.path.join(root, file))
        
        logger.info(f"Archivos CSV encontrados: {csv_files}")
        
        # Análisis de los primeros bytes para detectar BOM
        for csv_file in csv_files:
            with open(csv_file, 'rb') as f:
                header = f.read(4)
                has_bom = header.startswith(b'\xef\xbb\xbf')
                logger.info(f"Archivo: {os.path.basename(csv_file)}, BOM detectado: {has_bom}")
                
                # Mostrar las primeras líneas del archivo
                with open(csv_file, 'r', encoding='utf-8-sig' if has_bom else 'utf-8', errors='replace') as f2:
                    first_lines = [next(f2) for _ in range(3)]
                    logger.info(f"Primeras líneas:\n{''.join(first_lines)}")
        
        # Para simplificar, no ejecutamos el procesador completo aquí
        logger.info("Análisis preliminar completado")
        logger.info("Para ejecutar el procesamiento completo, usa sage_con_bom.py")
        
        return True
        
    except Exception as e:
        logger.error(f"Error durante el procesamiento: {str(e)}", exc_info=True)
        return False

def main():
    """Función principal del script"""
    if len(sys.argv) != 3:
        print("Uso: python procesar_clorox.py <archivo_yaml> <archivo_zip>")
        return 1
    
    yaml_path = sys.argv[1]
    zip_path = sys.argv[2]
    
    # Verificar que los archivos existen
    if not os.path.exists(yaml_path):
        print(f"Error: El archivo YAML no existe: {yaml_path}")
        return 1
    
    if not os.path.exists(zip_path):
        print(f"Error: El archivo ZIP no existe: {zip_path}")
        return 1
    
    success = process_clorox_data(yaml_path, zip_path)
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)