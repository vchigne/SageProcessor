"""
Parche mejorado para SAGE con detección automática de BOM en archivos CSV
Sin dependencia de una propiedad encoding en el YAML
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
            # Leer los primeros bytes para verificar BOM de UTF-8
            bom = f.read(3)
            return bom == b'\xef\xbb\xbf'
    except Exception:
        return False

def create_column_names(n_columns):
    """
    Crear nombres de columnas en formato COLUMNA_N
    
    Args:
        n_columns: Número de columnas
        
    Returns:
        list: Lista de nombres de columnas
    """
    return [f"COLUMNA_{i+1}" for i in range(n_columns)]

def apply_bom_patch():
    """
    Aplica un parche al FileProcessor para soportar BOM con detección automática
    """
    # Guarda el método original
    original_read_file = FileProcessor._read_file
    
    # Define el método parcheado
    def patched_read_file(self, file_path, catalog):
        """Versión parcheada del método _read_file con detección automática de BOM"""
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
            if file_type == "CSV":
                # Detectar automáticamente si el archivo tiene BOM
                has_bom = detect_bom(file_path)
                encoding = 'utf-8-sig' if has_bom else 'utf-8'
                
                # Leer el archivo CSV con la codificación apropiada
                df = pd.read_csv(
                    file_path,
                    delimiter=catalog.file_format.delimiter,
                    header=0 if catalog.file_format.header else None,
                    encoding=encoding
                )
                
                # Si el archivo no tiene cabecera, crear nombres de columnas COLUMNA_N
                if not catalog.file_format.header:
                    # Verificar si el número de columnas coincide con los campos definidos
                    n_columns = df.shape[1]
                    n_fields = len(catalog.fields)
                    
                    if n_columns != n_fields and n_fields > 0:
                        self.logger.warning(
                            f"El número de columnas en el archivo ({n_columns}) no coincide "
                            f"con el número de campos definidos en el YAML ({n_fields})"
                        )
                    
                    # Crear nombres de columnas en formato COLUMNA_N
                    df.columns = create_column_names(n_columns)
                
            elif file_type in ("EXCEL", "XLS", "XLSX"):
                # Leer el archivo Excel
                df = pd.read_excel(
                    file_path,
                    header=0 if catalog.file_format.header else None
                )
                
                # Si el archivo no tiene cabecera, crear nombres de columnas COLUMNA_N
                if not catalog.file_format.header:
                    df.columns = create_column_names(df.shape[1])
            else:
                raise FileProcessingError(f"Tipo de archivo no soportado: {file_type}")

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