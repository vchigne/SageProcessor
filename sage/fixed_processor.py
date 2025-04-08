"""
Versión mejorada del procesador de archivos de SAGE 
con soporte para BOM en archivos CSV
"""

import os
import pandas as pd
from sage.file_processor import FileProcessor
from sage.exceptions import FileProcessingError

def detect_bom(file_path):
    """
    Detecta si un archivo tiene BOM (Byte Order Mark)
    
    Args:
        file_path: Ruta al archivo a comprobar
        
    Returns:
        bool: True si el archivo tiene BOM, False en caso contrario
    """
    try:
        with open(file_path, 'rb') as f:
            # BOM UTF-8: EF BB BF
            return f.read(3) == b'\xef\xbb\xbf'
    except Exception:
        return False

def patch_file_processor():
    """
    Aplica un parche mínimo al FileProcessor para soportar BOM
    Reemplaza solo el método _read_file para minimizar el impacto
    """
    # Guarda el método original
    original_read_file = FileProcessor._read_file
    
    # Define el método parcheado
    def patched_read_file(self, file_path, catalog):
        """Versión parcheada del método _read_file con soporte para BOM"""
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
                
                # Si tiene BOM, usar utf-8-sig, si no, intentar con encoding normal
                if has_bom:
                    df = pd.read_csv(
                        file_path,
                        delimiter=catalog.file_format.delimiter,
                        header=0 if catalog.file_format.header else None,
                        encoding='utf-8-sig'  # Esta codificación maneja automáticamente el BOM
                    )
                else:
                    # Mantener el comportamiento original
                    try:
                        df = pd.read_csv(
                            file_path,
                            delimiter=catalog.file_format.delimiter,
                            header=0 if catalog.file_format.header else None,
                            encoding='utf-8'
                        )
                    except UnicodeDecodeError:
                        # Si falla, intentar con latin1
                        df = pd.read_csv(
                            file_path,
                            delimiter=catalog.file_format.delimiter,
                            header=0 if catalog.file_format.header else None,
                            encoding='latin1'
                        )
            elif file_type == 'EXCEL':
                df = pd.read_excel(
                    file_path,
                    header=0 if catalog.file_format.header else None,
                    engine='openpyxl'
                )

            # Validar y convertir tipos de datos
            df = self._validate_data_types(df, catalog)
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