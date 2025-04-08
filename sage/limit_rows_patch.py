"""
Parche para limitar el número de filas procesadas en FileProcessor
"""

import os
import pandas as pd
from sage.file_processor import FileProcessor

def apply_limit_rows_patch():
    """
    Aplica un parche al método _read_file para limitar el número de filas
    procesadas según la variable de entorno SAGE_MAX_ROWS
    """
    original_read_file = FileProcessor._read_file
    
    def patched_read_file(self, file_path, catalog):
        """
        Versión modificada de _read_file que limita el número de filas
        """
        try:
            # Obtener el límite de filas de la variable de entorno (predeterminado: sin límite)
            max_rows = int(os.environ.get('SAGE_MAX_ROWS', 0))
            
            # Llamar al método original pero pasando nrows si hay un límite
            if max_rows > 0:
                # Guardar el método original para poder llamarlo
                original_method = original_read_file
                
                # Modificar temporalmente pd.read_csv y pd.read_excel para limitar las filas
                original_read_csv = pd.read_csv
                original_read_excel = pd.read_excel
                
                def limited_read_csv(*args, **kwargs):
                    kwargs['nrows'] = max_rows
                    return original_read_csv(*args, **kwargs)
                
                def limited_read_excel(*args, **kwargs):
                    kwargs['nrows'] = max_rows
                    return original_read_excel(*args, **kwargs)
                
                # Aplicar los parches
                pd.read_csv = limited_read_csv
                pd.read_excel = limited_read_excel
                
                try:
                    # Llamar al método original con las funciones parcheadas
                    result = original_method(self, file_path, catalog)
                    return result
                finally:
                    # Restaurar las funciones originales
                    pd.read_csv = original_read_csv
                    pd.read_excel = original_read_excel
            else:
                # Si no hay límite, simplemente llamar al método original
                return original_read_file(self, file_path, catalog)
                
        except Exception as e:
            # Si ocurre un error en nuestro código, devolver al método original
            return original_read_file(self, file_path, catalog)
    
    # Reemplazar el método original con nuestra versión parcheada
    FileProcessor._read_file = patched_read_file
    
    # Devolver el método original por si necesitamos restaurarlo
    return original_read_file

def remove_limit_rows_patch(original_read_file):
    """
    Restaura la implementación original del método _read_file
    """
    FileProcessor._read_file = original_read_file