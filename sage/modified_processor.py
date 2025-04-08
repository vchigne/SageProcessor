"""Modified version of FileProcessor with BOM support"""
import os
import zipfile
import tempfile
import logging
from typing import Dict, List, Tuple, Optional, Set
import pandas as pd
import numpy as np
from sage.models import SageConfig, Catalog, Package, ValidationRule, Severity
from sage.logger import SageLogger
from sage.exceptions import FileProcessingError

class ModifiedFileProcessor:
    """
    Versión modificada de FileProcessor con soporte para BOM y diagnóstico mejorado
    """
    SUPPORTED_EXTENSIONS = {
        '.csv': 'CSV',
        '.xlsx': 'EXCEL',
        '.xls': 'EXCEL'
    }

    ALLOWED_FILE_TYPES = {"CSV", "EXCEL", "ZIP"}  # ZIP solo para paquetes

    # Constantes para la optimización de evaluación de reglas
    MAX_ERRORS_PER_RULE = 10       # Máximo número de errores a mostrar por regla
    SMALL_FILE_THRESHOLD = 30      # Número de filas bajo el cual un archivo se considera "pequeño"

    # Mapeo de tipos SAGE a tipos pandas
    TYPE_MAPPING = {
        'texto': str,
        'decimal': float,
        'entero': int,
        'fecha': 'datetime64[ns]',
        'booleano': bool
    }

    def __init__(self, config: SageConfig, logger: SageLogger):
        self.config = config
        self.logger = logger
        self.error_count = 0
        self.warning_count = 0
        self.dataframes = {}  # Store DataFrames for cross-catalog validation
        
        # Diccionarios para rastrear reglas que han excedido el límite de errores
        self.field_rules_skipped = {}   # {field_name: {rule_name: error_count}}
        self.row_rules_skipped = {}     # {catalog_name: {rule_name: error_count}}
        self.catalog_rules_skipped = {} # {catalog_name: {rule_name: error_count}}

    def detect_encoding(self, file_path):
        """
        Detecta la codificación apropiada para un archivo, con especial atención a BOM
        """
        # Lista de codificaciones a probar
        encodings = ['utf-8-sig', 'utf-8', 'latin1']
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    f.read(100)  # Leer un poco para ver si hay errores
                    return encoding
            except UnicodeDecodeError:
                continue
        
        return 'utf-8'  # Default fallback

    def _read_file(self, file_path: str, catalog: Catalog) -> pd.DataFrame:
        """Read a file based on its extension and catalog configuration"""
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
                # Detectar la codificación del archivo
                encoding = self.detect_encoding(file_path)
                
                # Leer el archivo con la codificación detectada
                df = pd.read_csv(
                    file_path,
                    delimiter=catalog.file_format.delimiter,
                    header=0 if catalog.file_format.header else None,
                    encoding=encoding,
                    error_bad_lines=False,  # Ignorar líneas con errores
                    warn_bad_lines=True     # Mostrar advertencias
                )
                
                logging.info(f"Archivo CSV leído con éxito, usando encoding: {encoding}")
                logging.info(f"Dimensiones del DataFrame: {df.shape}")
                logging.info(f"Primeras 5 filas: {df.head()}")
                
            elif file_type == 'EXCEL':
                df = pd.read_excel(
                    file_path,
                    header=0 if catalog.file_format.header else None,
                    engine='openpyxl'  # Especificar el engine explícitamente
                )

            # Si el archivo no tiene encabezado, asignar nombres de columna basados en la configuración
            if not catalog.file_format.header:
                field_names = [field.name for field in catalog.fields]
                
                # Si hay más columnas en el DataFrame que campos definidos, agregar nombres genéricos
                if len(df.columns) > len(field_names):
                    for i in range(len(field_names), len(df.columns)):
                        field_names.append(f"column_{i+1}")
                
                # Si hay menos columnas en el DataFrame que campos definidos, truncar la lista
                field_names = field_names[:len(df.columns)]
                
                df.columns = field_names
                logging.info(f"Columnas asignadas: {df.columns.tolist()}")

            # Validar y convertir tipos de datos
            df = self._validate_data_types(df, catalog)
            return df

        except Exception as e:
            logging.error(f"Error al leer el archivo {os.path.basename(file_path)}: {str(e)}")
            logging.error(f"Estructura del catálogo: {vars(catalog)}")
            
            # Manejar casos específicos de error
            if "No such file or directory" in str(e):
                raise FileProcessingError(
                    f"El archivo {os.path.basename(file_path)} no existe o no se puede encontrar."
                )
            elif "cannot convert" in str(e).lower() or "invalid literal" in str(e).lower():
                raise FileProcessingError(
                    f"Error de conversión de datos en {os.path.basename(file_path)}. "
                    "Verifica que los tipos de datos en la configuración coincidan con los datos reales."
                )
            else:
                raise FileProcessingError(
                    f"Error al leer el archivo {os.path.basename(file_path)}: {str(e)}\n"
                    "Asegúrate de que el archivo tenga el formato correcto y no esté dañado."
                )

    def _validate_data_types(self, df: pd.DataFrame, catalog: Catalog) -> pd.DataFrame:
        """Validate and convert data types according to field specifications"""
        for field in catalog.fields:
            # Verificar que el campo exista en el DataFrame
            if field.name not in df.columns:
                logging.warning(f"Campo '{field.name}' no encontrado en el DataFrame. "
                             f"Columnas disponibles: {df.columns.tolist()}")
                continue
                
            if field.type not in self.TYPE_MAPPING:
                raise FileProcessingError(
                    f"Tipo de dato no soportado '{field.type}' para el campo '{field.name}'. "
                    f"Los tipos soportados son: {', '.join(self.TYPE_MAPPING.keys())}"
                )

            try:
                # Intentar convertir al tipo especificado
                target_type = self.TYPE_MAPPING[field.type]

                # Para campos de texto, reemplazar NaN por None antes de convertir
                if field.type == 'texto':
                    df[field.name] = df[field.name].replace({np.nan: None})

                # Convertir la columna al tipo especificado
                df[field.name] = df[field.name].astype(target_type)

            except (ValueError, TypeError) as e:
                # Identificar las filas con errores de tipo
                if field.type in ['decimal', 'entero']:
                    invalid_mask = pd.to_numeric(df[field.name], errors='coerce').isna()
                    invalid_rows = df[invalid_mask]
                else:
                    invalid_rows = df[df[field.name].apply(lambda x: not isinstance(x, target_type))]

                # Para archivos grandes, limitar el número de errores de tipo a reportar
                is_large_file = len(df) > self.SMALL_FILE_THRESHOLD
                error_count = 0
                
                for idx, row in invalid_rows.iterrows():
                    self.error_count += 1
                    error_count += 1
                    
                    # Solo registrar los primeros MAX_ERRORS_PER_RULE errores para archivos grandes
                    if not is_large_file or error_count <= self.MAX_ERRORS_PER_RULE:
                        self.logger.error(
                            f"Error de tipo de dato: el valor '{row[field.name]}' no es del tipo {field.type}",
                            file=catalog.filename,
                            line=idx + 2,
                            field=field.name,
                            value=row[field.name]
                        )
                
                # Si hay más errores de los que mostramos, indicarlo
                if is_large_file and error_count > self.MAX_ERRORS_PER_RULE:
                    self.logger.warning(
                        f"Se encontraron {error_count} errores de tipo para el campo '{field.name}'. "
                        f"Solo se mostraron los primeros {self.MAX_ERRORS_PER_RULE} para mejorar el rendimiento.",
                        file=catalog.filename,
                        field=field.name
                    )

        return df

    def _get_file_type(self, file_path: str) -> Optional[str]:
        """Determine file type from extension"""
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        return self.SUPPORTED_EXTENSIONS.get(ext)
        
    # Otros métodos requeridos para el procesamiento completo
    def process_package(self, package_name: str) -> None:
        """Process a package of catalogs and perform cross-validation"""
        pass  # Implementación similar a la original
        
    def process_catalogs(self) -> None:
        """Process all catalogs in the configuration"""
        pass  # Implementación similar a la original
        
    def validate_field_rules(self) -> None:
        """Validate field-level rules across all catalogs"""
        pass  # Implementación similar a la original
        
    def validate_row_rules(self) -> None:
        """Validate row-level rules across all catalogs"""
        pass  # Implementación similar a la original
        
    def validate_catalog_rules(self) -> None:
        """Validate catalog-level rules"""
        pass  # Implementación similar a la original
        
    def validate_package_rules(self) -> None:
        """Validate package-level rules that span multiple catalogs"""
        pass  # Implementación similar a la original