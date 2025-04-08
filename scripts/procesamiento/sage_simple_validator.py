#!/usr/bin/env python3
"""
Script simple para ejecutar file_processor.py con validación de columnas

Este script modifica file_processor.py para verificar que el número de columnas
en archivos CSV/Excel coincida con la definición YAML.
"""
import os
import sys
import yaml
import zipfile
import tempfile
from datetime import datetime
from sage.yaml_validator import YAMLValidator
from sage.file_processor import FileProcessor
from sage.logger import SageLogger
import pandas as pd

def validate_columns(yaml_path, zip_path):
    """
    Validar que los archivos en el ZIP tienen el número correcto de columnas
    según la definición en el YAML.
    """
    # Validar y cargar el YAML
    print("Validando y cargando el YAML...")
    validator = YAMLValidator()
    try:
        config = validator.load_and_validate(yaml_path)
    except Exception as e:
        print(f"Error al validar el YAML: {str(e)}")
        return False
    
    # Crear un directorio temporal para logs
    log_dir = tempfile.mkdtemp(prefix="sage_logs_")
    print(f"Logs guardados en: {log_dir}")
    
    # Crear el logger
    logger = SageLogger(log_dir=log_dir, casilla_id=None, emisor_id=None, metodo_envio=None)
    
    # Verificar que el ZIP existe
    if not os.path.exists(zip_path):
        logger.error(f"El archivo ZIP no existe: {zip_path}")
        return False
    
    # Obtener el primer paquete definido en el YAML
    package_name = list(config.packages.keys())[0]
    package = config.packages[package_name]
    
    # Obtener la lista de catálogos en el paquete
    catalog_names = package.catalogs
    
    print(f"Verificando columnas para el paquete: {package_name}")
    
    error_count = 0
    
    # Extraer y validar cada catálogo
    with zipfile.ZipFile(zip_path, 'r') as zip_file:
        # Iterar sobre cada catálogo en el paquete
        for catalog_name in catalog_names:
            if catalog_name not in config.catalogs:
                logger.error(f"El catálogo '{catalog_name}' está definido en el paquete pero no existe en la configuración")
                error_count += 1
                continue
                
            catalog = config.catalogs[catalog_name]
            filename = catalog.filename
            
            print(f"Verificando columnas para el catálogo: {catalog_name} (archivo: {filename})")
            
            # Verificar si el archivo existe en el ZIP
            try:
                # Extraer el archivo a un directorio temporal
                temp_dir = tempfile.mkdtemp(prefix="sage_extract_")
                file_path = os.path.join(temp_dir, filename)
                
                # Extraer el archivo
                try:
                    zip_file.extract(filename, temp_dir)
                except KeyError:
                    logger.error(f"El archivo '{filename}' no existe en el ZIP")
                    error_count += 1
                    continue
                
                # Determinar los parámetros de lectura según el tipo de archivo
                file_format = catalog.file_format
                file_type = file_format.type.lower()
                expected_columns = len(catalog.fields)
                
                if file_type == 'csv':
                    # Configurar parámetros para CSV
                    delimiter = file_format.delimiter if hasattr(file_format, 'delimiter') else ','
                    header = 0 if getattr(file_format, 'header', False) else None
                    encoding = 'utf-8-sig'  # Manejar BOM automáticamente
                    
                    # Leer solo las primeras filas para validar la estructura
                    try:
                        df_sample = pd.read_csv(file_path, delimiter=delimiter, encoding=encoding, 
                                               header=header, nrows=5)
                        
                        # Verificar el número de columnas
                        actual_columns = len(df_sample.columns)
                        if actual_columns != expected_columns:
                            error_msg = (f"Error de estructura en el archivo {filename}: "
                                        f"El archivo tiene {actual_columns} columnas pero la definición YAML "
                                        f"tiene {expected_columns} campos. El número de columnas debe coincidir "
                                        f"exactamente con la definición.")
                            logger.error(f"Error processing catalog '{catalog_name}': {error_msg}")
                            error_count += 1
                        else:
                            print(f"✅ El número de columnas es correcto: {actual_columns}")
                            
                    except Exception as e:
                        logger.error(f"Error al leer el archivo CSV {filename}: {str(e)}")
                        error_count += 1
                        
                elif file_type == 'excel':
                    # Configurar parámetros para Excel
                    header = 0 if getattr(file_format, 'header', False) else None
                    
                    # Leer solo las primeras filas para validar la estructura
                    try:
                        df_sample = pd.read_excel(file_path, header=header, nrows=5)
                        
                        # Verificar el número de columnas
                        actual_columns = len(df_sample.columns)
                        if actual_columns != expected_columns:
                            error_msg = (f"Error de estructura en el archivo {filename}: "
                                        f"El archivo tiene {actual_columns} columnas pero la definición YAML "
                                        f"tiene {expected_columns} campos. El número de columnas debe coincidir "
                                        f"exactamente con la definición.")
                            logger.error(f"Error processing catalog '{catalog_name}': {error_msg}")
                            error_count += 1
                        else:
                            print(f"✅ El número de columnas es correcto: {actual_columns}")
                            
                    except Exception as e:
                        logger.error(f"Error al leer el archivo Excel {filename}: {str(e)}")
                        error_count += 1
                else:
                    logger.error(f"Tipo de archivo no soportado: {file_type}")
                    error_count += 1
                    
            except Exception as e:
                logger.error(f"Error al procesar el catálogo '{catalog_name}': {str(e)}")
                error_count += 1
                
            finally:
                # Limpiar directorio temporal
                if os.path.exists(temp_dir):
                    import shutil
                    shutil.rmtree(temp_dir)
    
    # Mostrar el resultado final
    print("\nResumen de la validación:")
    print(f"Total de errores: {error_count}")
    
    if error_count > 0:
        print("❌ VALIDACIÓN FALLIDA: Se encontraron errores de estructura en los archivos")
    else:
        print("✅ VALIDACIÓN EXITOSA: Todos los archivos tienen la estructura correcta")
    
    return error_count == 0

def main():
    """Función principal"""
    if len(sys.argv) < 3:
        print("Uso: python sage_simple_validator.py <archivo_yaml> <archivo_zip>")
        sys.exit(1)
    
    yaml_path = sys.argv[1]
    zip_path = sys.argv[2]
    
    print("="*60)
    print("VALIDACIÓN SIMPLE DE COLUMNAS")
    print("="*60)
    print(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Archivo YAML: {yaml_path}")
    print(f"Archivo ZIP: {zip_path}")
    print("-"*60)
    
    success = validate_columns(yaml_path, zip_path)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()