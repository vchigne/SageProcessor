#!/usr/bin/env python3
"""
Script para ejecutar SAGE con validación de columnas
Este script usa directamente file_processor.py con una modificación mínima
para verificar el número de columnas en CSV/Excel
"""
import os
import sys
from sage.cli import main as sage_main
from sage.file_processor import FileProcessor
import pandas as pd
import tempfile

def validate_column_count(self, file_path, catalog):
    """
    Verifica que el número de columnas coincida con la definición YAML
    sin modificar el flujo original de SAGE
    """
    # Determinar el tipo de archivo
    file_format = catalog.file_format
    file_type = file_format.type.lower()
    
    # Obtener el número esperado de columnas
    expected_columns = len(catalog.fields)
    
    try:
        # Leer solo unas pocas filas para validar la estructura
        if file_type == 'csv':
            delimiter = file_format.delimiter if hasattr(file_format, 'delimiter') else ','
            encoding = 'utf-8-sig'  # Manejar BOM automáticamente
            header = 0 if getattr(file_format, 'header', False) else None
            
            # Leer solo las primeras filas
            df_sample = pd.read_csv(file_path, delimiter=delimiter, encoding=encoding, 
                                    header=header, nrows=5)
            
            # Verificar el número de columnas
            actual_columns = len(df_sample.columns)
            if actual_columns != expected_columns:
                error_msg = (f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                             f"El archivo tiene {actual_columns} columnas pero la definición YAML "
                             f"tiene {expected_columns} campos. El número de columnas debe coincidir "
                             f"exactamente con la definición.")
                self.logger.error(f"Error processing catalog '{catalog.name}': {error_msg}")
                return False
                
        elif file_type == 'excel':
            # Leer solo las primeras filas del Excel
            df_sample = pd.read_excel(file_path, 
                                     header=0 if getattr(file_format, 'header', False) else None,
                                     nrows=5)
            
            # Verificar el número de columnas
            actual_columns = len(df_sample.columns)
            if actual_columns != expected_columns:
                error_msg = (f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                             f"El archivo tiene {actual_columns} columnas pero la definición YAML "
                             f"tiene {expected_columns} campos. El número de columnas debe coincidir "
                             f"exactamente con la definición.")
                self.logger.error(f"Error processing catalog '{catalog.name}': {error_msg}")
                return False
        
        return True
        
    except Exception as e:
        self.logger.error(f"Error validando estructura de {file_path}: {str(e)}")
        return False

def patch_file_processor():
    """
    Aplica el parche al FileProcessor para validar columnas
    """
    # Guardar el método original
    original_process_catalog = FileProcessor.process_catalog
    
    # Crear una nueva versión de process_catalog que valide columnas
    def patched_process_catalog(self, catalog_path, catalog):
        # Primero validar la estructura de columnas
        if not validate_column_count(self, catalog_path, catalog):
            # Si la validación falla, registrar el error y continuar con el siguiente catálogo
            return 1
            
        # Si la validación pasa, continuar con el procesamiento normal
        return original_process_catalog(self, catalog_path, catalog)
    
    # Aplicar el parche
    FileProcessor.process_catalog = patched_process_catalog
    
    return {
        'process_catalog': original_process_catalog
    }

def restore_file_processor(original_methods):
    """
    Restaura los métodos originales del FileProcessor
    """
    FileProcessor.process_catalog = original_methods['process_catalog']

def main():
    """
    Función principal que ejecuta SAGE con validación de columnas
    """
    # Verificar argumentos
    if len(sys.argv) < 3:
        print("Uso: python sage_column_validator.py <archivo_yaml> <archivo_zip>")
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
    
    # Crear un archivo temporal para redirigir la salida estándar
    with tempfile.NamedTemporaryFile(mode='w+', delete=False) as tmp:
        tmp_path = tmp.name
    
    # Aplicar el parche
    print("Aplicando validación de columnas...")
    original_methods = patch_file_processor()

    try:
        # Modificar los argumentos para SAGE
        sys.argv = [sys.argv[0], yaml_path, zip_path]
        
        # Ejecutar SAGE con el parche aplicado
        print("Ejecutando SAGE con validación de columnas...")
        sage_main()
        
        return 0
        
    finally:
        # Restaurar los métodos originales
        restore_file_processor(original_methods)
        print("Validación de columnas desactivada")
        
        # Eliminar el archivo temporal
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

if __name__ == "__main__":
    sys.exit(main())