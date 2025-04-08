"""
Parche para manejo de BOM en archivos CSV de SAGE

Este módulo proporciona funciones para mejorar el manejo de archivos CSV 
con marcadores BOM (Byte Order Mark) en el sistema SAGE.
"""

import os
import pandas as pd
import numpy as np
from sage.file_processor import FileProcessor
from sage.exceptions import FileProcessingError

def detect_bom(file_path):
    """
    Detecta si un archivo tiene BOM (Byte Order Mark)
    
    Args:
        file_path (str): Ruta al archivo a comprobar
        
    Returns:
        bool: True si el archivo tiene BOM, False en caso contrario
    """
    try:
        with open(file_path, 'rb') as f:
            # BOM UTF-8: EF BB BF
            return f.read(3) == b'\xef\xbb\xbf'
    except Exception:
        return False
        
def create_column_names(n_columns):
    """
    Crear nombres de columnas en formato COLUMNA_N
    
    Args:
        n_columns: Número de columnas para las que crear nombres
        
    Returns:
        list: Lista de nombres de columnas en formato COLUMNA_1, COLUMNA_2, etc.
    """
    return [f"COLUMNA_{i+1}" for i in range(n_columns)]

def apply_bom_patch():
    """
    Aplica un parche al FileProcessor para soportar BOM
    """
    # Guarda el método original
    original_read_file = FileProcessor._read_file
    
    # Define el método parcheado
    def patched_read_file(self, file_path, catalog):
        """Versión parcheada del método _read_file con soporte para BOM y nombres de columnas"""
        file_type = self._get_file_type(file_path)
        if not file_type:
            raise FileProcessingError(
                f"Formato de archivo no soportado: {os.path.splitext(file_path)[1]}. "
                f"Los formatos soportados son: CSV (.csv) y Excel (.xlsx, .xls)"
            )

        # Verificar que el tipo de archivo coincida con la configuración
        if file_type != catalog.file_format.type:
            raise FileProcessingError(
                f"El tipo de archivo {file_type} ({os.path.basename(file_path)}) "
                f"no coincide con la configuración del catálogo que espera {catalog.file_format.type}"
            )

        try:
            if file_type == 'CSV':
                # Detectar si el archivo tiene BOM
                has_bom = detect_bom(file_path)
                encoding = 'utf-8-sig' if has_bom else 'utf-8'
                
                # Opciones adicionales para manejar tipos mixtos y valores problemáticos
                csv_options = {
                    'delimiter': catalog.file_format.delimiter,
                    'encoding': encoding,
                    'low_memory': False,  # Evita advertencias de tipos mixtos
                    'dtype': str,  # Leer todo como string inicialmente para evitar problemas de conversión
                    'on_bad_lines': 'warn'  # Advertir en lugar de fallar en líneas problemáticas
                }
                
                # Para archivos sin encabezado, necesitamos crear nombres de columnas personalizados
                if not catalog.file_format.header:
                    # Primero determinar el número de columnas
                    try:
                        df_temp = pd.read_csv(
                            file_path, 
                            header=None, 
                            nrows=1,
                            **csv_options
                        )
                    except UnicodeDecodeError:
                        # Si falla, intentar con latin1
                        csv_options['encoding'] = 'latin1'
                        df_temp = pd.read_csv(
                            file_path, 
                            header=None, 
                            nrows=1,
                            **csv_options
                        )
                    
                    # Obtener el número de columnas y crear los nombres
                    n_columns = len(df_temp.columns)
                    column_names = create_column_names(n_columns)
                    
                    # Cargar el CSV completo con los nombres de columnas personalizados
                    try:
                        df = pd.read_csv(
                            file_path,
                            header=None,
                            names=column_names,
                            **csv_options
                        )
                    except Exception as e:
                        # Si hay algún otro error, intentar un enfoque más flexible
                        try:
                            # Intentar con opción de manejo de errores más permisiva
                            csv_options['error_bad_lines'] = False
                            csv_options['warn_bad_lines'] = True
                            df = pd.read_csv(
                                file_path,
                                header=None,
                                names=column_names,
                                **csv_options
                            )
                        except Exception as inner_e:
                            # Si aún así falla, propagar el error original
                            raise FileProcessingError(f"Error al leer CSV: {str(e)}")
                else:
                    # Con encabezado, usar el método estándar
                    try:
                        df = pd.read_csv(
                            file_path,
                            header=0,
                            **csv_options
                        )
                    except Exception as e:
                        # Intentar con enfoque más permisivo
                        try:
                            csv_options['error_bad_lines'] = False
                            csv_options['warn_bad_lines'] = True
                            df = pd.read_csv(
                                file_path,
                                header=0,
                                **csv_options
                            )
                        except Exception as inner_e:
                            raise FileProcessingError(f"Error al leer CSV con encabezado: {str(e)}")
            elif file_type == 'EXCEL':
                try:
                    df = pd.read_excel(
                        file_path,
                        header=0 if catalog.file_format.header else None,
                        engine='openpyxl',
                        dtype=str  # Leer todo como string inicialmente
                    )
                    
                    # Si no tiene encabezado, crear nombres de columnas personalizados
                    if not catalog.file_format.header:
                        n_columns = len(df.columns)
                        column_names = create_column_names(n_columns)
                        df.columns = column_names
                except Exception as e:
                    raise FileProcessingError(f"Error al leer Excel: {str(e)}")

            # Aplicar ajustes adicionales si es necesario
            # ...
            
            # Validar y convertir tipos de datos
            # Usamos un bloque try-except separado para cada campo para manejo de errores más granular
            for field in catalog.fields:
                if field.type not in self.TYPE_MAPPING:
                    self.logger.warning(
                        f"Tipo de dato no soportado '{field.type}' para el campo '{field.name}'.",
                        file=catalog.filename,
                        field=field.name
                    )
                    continue  # Saltamos este campo en lugar de fallar por completo

                try:
                    # Para campos de texto, reemplazar NaN por None antes de convertir
                    if field.type == 'texto':
                        df[field.name] = df[field.name].replace({np.nan: None})
                        
                    # Convertir la columna al tipo especificado
                    if field.type == 'fecha':
                        # Para fechas, usar pd.to_datetime en lugar de astype
                        df[field.name] = pd.to_datetime(df[field.name], errors='coerce')
                    else:
                        df[field.name] = df[field.name].astype(self.TYPE_MAPPING[field.type])
                
                except Exception as e:
                    # Si hay error en la conversión, mantener como string y reportar un warning
                    self.logger.warning(
                        f"Error al convertir el campo '{field.name}' al tipo '{field.type}': {str(e)}. Se mantendrá como texto.",
                        file=catalog.filename,
                        field=field.name
                    )
            
            return df

        except Exception as e:
            raise FileProcessingError(
                f"Error al leer el archivo {os.path.basename(file_path)}: {str(e)}\n"
                "Asegúrate de que el archivo tenga el formato correcto y no esté dañado."
            )
    
    # Reemplaza el método original con el parcheado
    FileProcessor._read_file = patched_read_file
    
    # Devuelve el método original por si necesitamos restaurarlo
    return original_read_file