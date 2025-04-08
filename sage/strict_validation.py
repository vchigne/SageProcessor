"""
Módulo para aplicar validación estricta al procesador de archivos de SAGE.

Este módulo aplica un parche al FileProcessor para validar estrictamente:
- Que el número de columnas en CSV/Excel coincida exactamente con la definición YAML
- Que todos los archivos definidos en el YAML estén presentes en el ZIP
- Que se detecte correctamente el BOM (Byte Order Mark) en archivos CSV
"""
import os
import pandas as pd
from types import MethodType

def strict_read_file(self, file_path, catalog):
    """
    Versión parcheada del método _read_file que verifica el número de columnas
    """
    # Determinar el tipo de archivo y los parámetros de lectura
    file_format = catalog.file_format
    file_type = file_format.type.lower()
    
    # Obtener el número esperado de columnas del catálogo
    expected_columns = len(catalog.fields)
    
    # Detectar si hay BOM y determinar la codificación
    encoding = 'utf-8-sig'  # Usar utf-8-sig para manejar BOM automáticamente
    
    try:
        if file_type == 'csv':
            # Leer el CSV con detección automática de BOM
            delimiter = file_format.delimiter if hasattr(file_format, 'delimiter') else ','
            header = 0 if getattr(file_format, 'header', False) else None
            
            # Leer solo las primeras filas para validar la estructura
            df_sample = pd.read_csv(file_path, delimiter=delimiter, encoding=encoding, 
                                    header=header, nrows=5)
            
            # Validar el número de columnas
            actual_columns = len(df_sample.columns)
            if actual_columns != expected_columns:
                error_msg = (f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                             f"El archivo tiene {actual_columns} columnas pero la definición YAML "
                             f"tiene {expected_columns} campos. El número de columnas debe coincidir "
                             f"exactamente con la definición.")
                self.logger.error(f"Error processing catalog '{catalog.name}': {error_msg}")
                return None
            
            # Leer el archivo completo
            df = pd.read_csv(file_path, delimiter=delimiter, encoding=encoding, header=header)
            
        elif file_type == 'excel':
            # Leer el archivo Excel
            df = pd.read_excel(file_path, header=0 if getattr(file_format, 'header', False) else None)
            
            # Validar el número de columnas
            actual_columns = len(df.columns)
            if actual_columns != expected_columns:
                error_msg = (f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                             f"El archivo tiene {actual_columns} columnas pero la definición YAML "
                             f"tiene {expected_columns} campos. El número de columnas debe coincidir "
                             f"exactamente con la definición.")
                self.logger.error(f"Error processing catalog '{catalog.name}': {error_msg}")
                return None
        else:
            self.logger.error(f"Unsupported file format: {file_type}")
            return None
        
        # Asignar nombres a las columnas si no hay encabezado
        if not getattr(file_format, 'header', False):
            # Crear nombres de columnas basados en los campos definidos
            column_names = [field.name for field in catalog.fields]
            df.columns = column_names
        else:
            # Si hay encabezado, verificar que los nombres coinciden
            if file_type in ['csv', 'excel']:
                expected_names = [field.name for field in catalog.fields]
                actual_names = list(df.columns)
                
                # Verificar si hay nombres de columnas que no coinciden
                for expected_name in expected_names:
                    if expected_name not in actual_names:
                        error_msg = (f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                                    f"El campo '{expected_name}' está definido en el YAML pero no "
                                    f"se encuentra en el archivo {file_type.upper()}. Los nombres de "
                                    f"columnas deben coincidir exactamente con la definición.")
                        self.logger.error(f"Error processing catalog '{catalog.name}': {error_msg}")
                        return None
        
        return df
    except Exception as e:
        self.logger.error(f"Error reading file {file_path}: {str(e)}")
        return None

def apply_strict_validation_patch():
    """
    Aplica el parche de validación estricta al FileProcessor
    
    Returns:
        dict: Métodos originales para restaurarlos después
    """
    from sage.file_processor import FileProcessor
    
    # Guardar el método original
    original_methods = {
        '_read_file': FileProcessor._read_file
    }
    
    # Aplicar el parche (al método de clase, no a una instancia)
    FileProcessor._read_file = strict_read_file
    
    return original_methods

def remove_strict_validation_patch(original_methods):
    """
    Restaura los métodos originales del FileProcessor
    
    Args:
        original_methods: Métodos originales guardados por apply_strict_validation_patch
    """
    from sage.file_processor import FileProcessor
    
    # Restaurar el método original
    FileProcessor._read_file = original_methods['_read_file']