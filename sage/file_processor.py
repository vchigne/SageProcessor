"""File processing functionality for SAGE"""
import os
import zipfile
import tempfile
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Set, Union
from .models import SageConfig, Catalog, Package, ValidationRule, Severity
from .logger import SageLogger
from .exceptions import FileProcessingError

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

def create_column_names(n_columns):
    """
    Crear nombres de columnas en formato COLUMNA_N

    Args:
        n_columns: Número de columnas para las que crear nombres

    Returns:
        list: Lista de nombres de columnas en formato COLUMNA_1, COLUMNA_2, etc.
    """
    return [f"COLUMNA_{i+1}" for i in range(n_columns)]

class FileProcessor:
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
        'fecha': pd.DatetimeTZDtype(tz='UTC'),  # Usar DatetimeTZDtype para fechas
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

    def _validate_data_types(self, df: pd.DataFrame, catalog: Catalog) -> pd.DataFrame:
        """Validate and convert data types according to field specifications"""
        for field in catalog.fields:
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
                if field.type == 'fecha':
                    # Para fechas, usar pd.to_datetime en lugar de astype
                    df[field.name] = pd.to_datetime(df[field.name], errors='coerce')
                elif field.type in ['entero', 'decimal'] and not field.required:
                    # Para campos numéricos opcionales, usar pd.to_numeric con coerce
                    # para convertir a numéricos pero preservar NaN donde corresponda
                    df[field.name] = pd.to_numeric(df[field.name], errors='coerce')

                    # Si es campo entero, convertir a entero los números sin decimales
                    if field.type == 'entero':
                        # Verificar si cada valor es efectivamente un entero
                        mask = df[field.name].notna() & df[field.name].apply(lambda x: float(x).is_integer() if pd.notnull(x) and not isinstance(x, bool) else False)
                        if mask.any():
                            df.loc[mask, field.name] = df.loc[mask, field.name].astype('Int64')
                elif field.type == 'entero':
                    # Si es campo entero, convertir a entero los números sin decimales
                    mask = df[field.name].notna()
                    if mask.any():
                        # Convertir solo valores numéricos que son enteros
                        numeric_mask = mask & df[field.name].apply(lambda x: isinstance(x, (int, float)) and float(x).is_integer())
                        if numeric_mask.any():
                            df.loc[numeric_mask, field.name] = df.loc[numeric_mask, field.name].astype('int64')
                else:
                    df[field.name] = df[field.name].astype(target_type)

            except (ValueError, TypeError) as e:
                # Identificar las filas con errores de tipo
                if field.type in ['decimal', 'entero']:
                    # Si el campo es opcional, permitir valores NaN y cadenas vacías
                    if not field.required:
                        # Convertir a numérico con coerce, pero considerar válidos los NaN/vacíos originales
                        numeric_values = pd.to_numeric(df[field.name], errors='coerce')
                        # Solo marcar como inválidos los valores que no son numéricos y no son NaN/vacíos originales
                        invalid_mask = numeric_values.isna() & ~(
                            df[field.name].isna() | 
                            (df[field.name] == '') | 
                            (df[field.name] == 'nan') | 
                            (df[field.name].astype(str) == 'nan')
                        )
                    else:
                        # Si el campo es requerido, cualquier NaN o valor no numérico es inválido
                        invalid_mask = pd.to_numeric(df[field.name], errors='coerce').isna()

                    invalid_rows = df[invalid_mask]
                elif field.type == 'fecha':
                    # Para fechas, usar pd.to_datetime con coerce para detectar valores inválidos
                    invalid_mask = pd.to_datetime(df[field.name], errors='coerce').isna()
                    invalid_rows = df[invalid_mask]
                elif field.type == 'texto':
                    # Para texto, verificar los valores que no son str o son NaN
                    invalid_mask = df[field.name].apply(lambda x: x is not None and not isinstance(x, str))
                    invalid_rows = df[invalid_mask]
                elif field.type == 'booleano':
                    # Para booleanos, permitir valores "verdaderos": True, 1, "1", "true", "True", etc.
                    # y valores "falsos": False, 0, "0", "false", "False", etc.
                    # Todo lo demás se considera inválido
                    invalid_mask = df[field.name].apply(lambda x: not isinstance(x, bool) and
                                                     not (isinstance(x, (int, float)) and (x == 0 or x == 1)) and
                                                     not (isinstance(x, str) and x.lower() in ["true", "false", "1", "0"]))
                    invalid_rows = df[invalid_mask]
                else:
                    # Para cualquier otro tipo, intentar una conversión forzada y capturar errores
                    invalid_rows = pd.DataFrame()  # DataFrame vacío por defecto
                    try:
                        invalid_mask = df[field.name].apply(lambda x: not isinstance(x, target_type))
                        invalid_rows = df[invalid_mask]
                    except TypeError:
                        # Si hay error en la conversión, reportar que no se puede validar este tipo
                        self.logger.warning(
                            f"No se puede validar el tipo '{field.type}' de manera efectiva. Verificando valores manualmente.",
                            file=catalog.filename,
                            field=field.name
                        )

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
                # Detectar BOM en el archivo CSV
                has_bom = detect_bom(file_path)
                encoding = 'utf-8-sig' if has_bom else 'utf-8'

                # Para archivos sin encabezado, necesitamos crear nombres de columnas personalizados
                if not catalog.file_format.header:
                    # Primero determinar el número de columnas
                    try:
                        df_temp = pd.read_csv(
                            file_path, 
                            delimiter=catalog.file_format.delimiter, 
                            header=None, 
                            encoding=encoding, 
                            nrows=1
                        )
                    except UnicodeDecodeError:
                        # Si falla, intentar con latin1
                        df_temp = pd.read_csv(
                            file_path, 
                            delimiter=catalog.file_format.delimiter, 
                            header=None, 
                            encoding='latin1', 
                            nrows=1
                        )
                        encoding = 'latin1'

                    # Obtener el número de columnas y crear los nombres
                    n_columns = len(df_temp.columns)
                    column_names = create_column_names(n_columns)

                    # Cargar el CSV completo con los nombres de columnas personalizados
                    try:
                        df = pd.read_csv(
                            file_path,
                            delimiter=catalog.file_format.delimiter,
                            header=None,
                            encoding=encoding,
                            names=column_names
                        )
                    except Exception:
                        # Si falla, intentar con latin1
                        df = pd.read_csv(
                            file_path,
                            delimiter=catalog.file_format.delimiter,
                            header=None,
                            encoding='latin1',
                            names=column_names
                        )
                else:
                    # Con encabezado, usar el método estándar
                    try:
                        df = pd.read_csv(
                            file_path,
                            delimiter=catalog.file_format.delimiter,
                            header=0,
                            encoding=encoding
                        )
                    except UnicodeDecodeError:
                        # Si falla, intentar con latin1
                        df = pd.read_csv(
                            file_path,
                            delimiter=catalog.file_format.delimiter,
                            header=0,
                            encoding='latin1'
                        )
            elif file_type == 'EXCEL':
                df = pd.read_excel(
                    file_path,
                    header=0 if catalog.file_format.header else None,
                    engine='openpyxl'  # Especificar el engine explícitamente
                )

                # Si no tiene encabezado, crear nombres de columnas personalizados
                if not catalog.file_format.header:
                    n_columns = len(df.columns)
                    column_names = create_column_names(n_columns)
                    df.columns = column_names

            # Preprocesar campos numéricos antes de validación
            for field in catalog.fields:
                if field.type == 'entero':
                    # Detectar y convertir números que son efectivamente enteros
                    mask = df[field.name].notna()
                    if mask.any():
                        df.loc[mask, field.name] = pd.to_numeric(df.loc[mask, field.name], downcast='integer')

            # Nuevo código: Adaptar dataframe al esquema del catálogo
            # Obtener los nombres de campos definidos en el YAML
            yaml_field_names = [field.name for field in catalog.fields]

            # Verificar si hay más columnas en el CSV que en el YAML
            if len(df.columns) > len(yaml_field_names):
                # Comportamiento por defecto: reportar error pero continuar
                error_msg = (f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                            f"El archivo tiene {len(df.columns)} columnas pero la definición YAML tiene {len(yaml_field_names)} campos. "
                            f"El número de columnas debe coincidir exactamente con la definición.")
                self.logger.error(error_msg, file=catalog.filename)
                self.error_count += 1

                # Registrar el error de formato para el reporte
                self.logger.register_format_error(
                    message="Error de columnas: demasiadas columnas en el archivo", 
                    file=catalog.filename,
                    expected=f"{len(yaml_field_names)} columnas",
                    found=f"{len(df.columns)} columnas"
                )

                # Continuar con el proceso seleccionando solo las columnas que necesitamos
                if not catalog.file_format.header:
                    # Para archivos sin encabezado, seleccionar las primeras N columnas
                    df = df.iloc[:, :len(yaml_field_names)]
                    # Renombrar las columnas según los nombres del YAML
                    df.columns = yaml_field_names
                else:
                    # Si tiene encabezado, seleccionar las columnas por los nombres del YAML que existan
                    # y descartar las demás
                    existing_fields = [field for field in yaml_field_names if field in df.columns]
                    df = df[existing_fields]

            # Si hay menos columnas en el CSV que en el YAML
            if len(df.columns) < len(yaml_field_names):
                # Comportamiento por defecto: reportar error pero continuar
                error_msg = (f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                            f"El archivo tiene {len(df.columns)} columnas pero la definición YAML tiene {len(yaml_field_names)} campos. "
                            f"El número de columnas debe coincidir exactamente con la definición.")
                self.logger.error(error_msg, file=catalog.filename)
                self.error_count += 1

                # Registrar el error de formato para el reporte
                self.logger.register_format_error(
                    message="Error de columnas: faltan columnas en el archivo", 
                    file=catalog.filename,
                    expected=f"{len(yaml_field_names)} columnas",
                    found=f"{len(df.columns)} columnas"
                )

                # Continuar con el proceso añadiendo columnas faltantes con valores null
                for field_name in yaml_field_names:
                    if field_name not in df.columns:
                        df[field_name] = None

            # Si el archivo no tiene encabezado, renombrar las columnas con los nombres definidos en el YAML
            if not catalog.file_format.header:
                # Asegurarnos de que tengamos la misma cantidad de columnas
                if len(df.columns) == len(yaml_field_names):
                    df.columns = yaml_field_names

            # Validar y convertir tipos de datos
            df = self._validate_data_types(df, catalog)
            return df

        except Exception as e:
            raise FileProcessingError(
                f"Error al leer el archivo {os.path.basename(file_path)}: {str(e)}\n"
                "Asegúrate de que el archivo tenga el formato correcto y no esté dañado."
            )

    def _handle_series_result(self, result: Union[pd.Series, bool], df: pd.DataFrame) -> pd.DataFrame:
        """Maneja resultados que pueden ser Series o booleanos"""
        if isinstance(result, pd.Series):
            # Si es una Serie, usarla como máscara
            return df[~result]  # Invertir porque queremos las filas inválidas
        elif isinstance(result, bool):
            # Si es booleano, aplicar a todo el DataFrame
            return df if not result else pd.DataFrame()
        else:
            raise ValueError(f"Resultado de validación no soportado: {type(result)}")

    def validate_field(self, df: pd.DataFrame, field_name: str, rules: List[ValidationRule],
                       catalog_name: str) -> None:
        """Validate a single field according to its rules"""
        is_large_file = len(df) > self.SMALL_FILE_THRESHOLD

        # Inicializar el diccionario para este campo si aún no existe
        if is_large_file and field_name not in self.field_rules_skipped:
            self.field_rules_skipped[field_name] = {}

        for rule in rules:
            # Verificar si la regla ya ha sido descartada por exceso de errores
            if is_large_file and rule.name in self.field_rules_skipped.get(field_name, {}):
                continue

            try:
                # Contador de errores para esta regla específica
                rule_error_count = 0

                # Filtrar el DataFrame para excluir filas con valores NaN en este campo
                # Esto evita que se apliquen reglas de validación a campos opcionales vacíos
                df_filtered = df.dropna(subset=[field_name])

                # Si todas las filas tienen NaN en este campo, no hay nada que validar
                if len(df_filtered) == 0:
                    continue

                # Usamos eval() regular en lugar de pd.eval() para permitir acceso a métodos completos de pandas
                try:
                    # Crear un entorno de ejecución con acceso a pandas, numpy y str
                    eval_globals = {
                        'df': df_filtered,  # Usar el DataFrame filtrado sin NaNs
                        'np': np,
                        'pd': pd,
                        'str': str  # Añadir str explícitamente para que esté disponible
                    }
                    result = eval(rule.rule, eval_globals, {})
                except NameError as e:
                    # Capturar errores específicos de nombres no definidos para dar mejor feedback
                    raise NameError(f"Error evaluando regla {rule.name}: {str(e)}")
                except Exception as e:
                    # Otras excepciones durante la evaluación
                    raise Exception(f"Error evaluando regla {rule.name}: {str(e)}")

                invalid_rows = self._handle_series_result(result, df_filtered)

                if len(invalid_rows) > 0:
                    for idx, row in invalid_rows.iterrows():
                        value = row[field_name]

                        if rule.severity == Severity.ERROR:
                            self.error_count += 1
                            rule_error_count += 1
                            self.logger.error(
                                f"Field validation failed: {rule.description}",
                                file=catalog_name,
                                line=idx + 2,  # +2 for header and 0-based index
                                value=value,
                                rule=rule.rule
                            )
                        elif rule.severity == Severity.WARNING:
                            self.warning_count += 1
                            self.logger.warning(
                                f"Field validation warning: {rule.description}",
                                file=catalog_name,
                                line=idx + 2,
                                value=value,
                                rule=rule.rule
                            )

                        # Para archivos grandes, limitar el número de errores por regla
                        if is_large_file and rule.severity == Severity.ERROR and rule_error_count >= self.MAX_ERRORS_PER_RULE:
                            # Registrar esta regla como descartada
                            self.field_rules_skipped[field_name][rule.name] = rule_error_count

                            # Registrar un aviso de que se omitieron errores adicionales
                            self.logger.warning(
                                f"Se encontraron al menos {rule_error_count} errores para la regla '{rule.name}' en '{field_name}'. "
                                f"Se omitieron errores adicionales para mejorar el rendimiento.",
                                file=catalog_name,
                                rule=rule.name,
                                field=field_name
                            )
                            break
            except Exception as e:
                raise FileProcessingError(f"Error evaluating rule {rule.name}: {str(e)}")

    def validate_catalog(self, df: pd.DataFrame, catalog: Catalog) -> None:
        """Validate an entire catalog"""
        # Validate required fields
        is_large_file = len(df) > self.SMALL_FILE_THRESHOLD

        for field in catalog.fields:
            # Pre-procesar campos numéricos antes de la validación
            if field.type == 'entero':
                # Detectar y convertir números que son efectivamente enteros
                mask = df[field.name].notna() & df[field.name].apply(lambda x: float(x).is_integer() if pd.notnull(x) and not isinstance(x, bool) else True)
                df.loc[mask, field.name] = df.loc[mask, field.name].astype('Int64')  # Usar Int64 para permitir NaN

            if field.required:
                mask = df[field.name].isnull()
                missing = df[mask]
                if not missing.empty:
                    error_count = 0

                    for idx, row in missing.iterrows():
                        self.error_count += 1
                        error_count += 1

                        # Solo registrar los primeros MAX_ERRORS_PER_RULE errores para archivos grandes
                        if not is_large_file or error_count <= self.MAX_ERRORS_PER_RULE:
                            self.logger.error(
                                f"Required field '{field.name}' is missing",
                                file=catalog.filename,
                                line=idx + 2
                            )

                    # Si hay más errores de los que mostramos, indicarlo
                    if is_large_file and error_count > self.MAX_ERRORS_PER_RULE:
                        self.logger.warning(
                            f"Se encontraron {error_count} valores nulos para el campo requerido '{field.name}'. "
                            f"Solo se mostraron los primeros {self.MAX_ERRORS_PER_RULE} para mejorar el rendimiento.",
                            file=catalog.filename,
                            field=field.name
                        )

            # Validate unique fields
            if field.unique:
                duplicates = df[df[field.name].duplicated()]
                if not duplicates.empty:
                    error_count = 0

                    for idx, row in duplicates.iterrows():
                        self.error_count += 1
                        error_count += 1

                        # Solo registrar los primeros MAX_ERRORS_PER_RULE errores para archivos grandes
                        if not is_large_file or error_count <= self.MAX_ERRORS_PER_RULE:
                            self.logger.error(
                                f"Field '{field.name}' must be unique",
                                file=catalog.filename,
                                line=idx + 2,
                                value=row[field.name]
                            )

                    # Si hay más errores de los que mostramos, indicarlo
                    if is_large_file and error_count > self.MAX_ERRORS_PER_RULE:
                        self.logger.warning(
                            f"Se encontraron {error_count} valores duplicados para el campo único '{field.name}'. "
                            f"Solo se mostraron los primeros {self.MAX_ERRORS_PER_RULE} para mejorar el rendimiento.",
                            file=catalog.filename,
                            field=field.name
                        )

            # Apply field validation rules
            self.validate_field(df, field.name, field.validation_rules, catalog.filename)

        # Apply row validations
        is_large_file = len(df) > self.SMALL_FILE_THRESHOLD

        # Inicializar el diccionario para este catálogo si aún no existe
        if is_large_file and catalog.filename not in self.row_rules_skipped:
            self.row_rules_skipped[catalog.filename] = {}

        for rule in catalog.row_validation:
            # Verificar si la regla ya ha sido descartada por exceso de errores
            if is_large_file and rule.name in self.row_rules_skipped.get(catalog.filename, {}):
                continue

            try:
                # Contador de errores para esta regla específica
                rule_error_count = 0

                # Usamos eval() regular en lugar de pd.eval() para permitir acceso a métodos completos de pandas
                try:
                    # Crear un entorno de ejecución con acceso a pandas, numpy y str
                    eval_globals = {
                        'df': df,
                        'np': np,
                        'pd': pd,
                        'str': str  # Añadir str explícitamente para que esté disponible
                    }
                    result = eval(rule.rule, eval_globals, {})
                except NameError as e:
                    # Capturar errores específicos de nombres no definidos para dar mejor feedback
                    raise NameError(f"Error evaluando regla {rule.name}: {str(e)}")
                except Exception as e:
                    # Otras excepciones durante la evaluación
                    raise Exception(f"Error evaluando regla {rule.name}: {str(e)}")

                invalid_rows = self._handle_series_result(result, df)

                for idx, row in invalid_rows.iterrows():
                    if rule.severity == Severity.ERROR:
                        self.error_count += 1
                        rule_error_count += 1
                        self.logger.error(
                            f"Row validation failed: {rule.description}",
                            file=catalog.filename,
                            line=idx + 2,
                            rule=rule.rule
                        )
                    elif rule.severity == Severity.WARNING:
                        self.warning_count += 1
                        self.logger.warning(
                            f"Row validation warning: {rule.description}",
                            file=catalog.filename,
                            line=idx + 2,
                            rule=rule.rule
                        )

                    # Para archivos grandes, limitar el número de errores por regla
                    if is_large_file and rule.severity == Severity.ERROR and rule_error_count >= self.MAX_ERRORS_PER_RULE:
                        # Registrar esta regla como descartada
                        self.row_rules_skipped[catalog.filename][rule.name] = rule_error_count

                        # Registrar un aviso de que se omitieron errores adicionales
                        self.logger.warning(
                            f"Se encontraron al menos {rule_error_count} errores para la regla de fila '{rule.name}'. "
                            f"Se omitieron errores adicionales para mejorar el rendimiento.",
                            file=catalog.filename,
                            rule=rule.name
                        )
                        break
            except Exception as e:
                raise FileProcessingError(f"Error evaluating row rule {rule.name}: {str(e)}")

        # Apply catalog validations
        # Inicializar el diccionario para este catálogo si aún no existe
        if is_large_file and catalog.filename not in self.catalog_rules_skipped:
            self.catalog_rules_skipped[catalog.filename] = {}

        for rule in catalog.catalog_validation:
            # Verificar si la regla ya ha sido descartada por exceso de errores
            if is_large_file and rule.name in self.catalog_rules_skipped.get(catalog.filename, {}):
                continue

            try:
                # Contador de errores para esta regla específica
                rule_error_count = 0

                # Usamos eval() regular en lugar de pd.eval() para permitir acceso a métodos completos de pandas
                try:
                    # Crear un entorno de ejecución con acceso a pandas, numpy y str
                    eval_globals = {
                        'df': df,
                        'np': np,
                        'pd': pd,
                        'str': str  # Añadir str explícitamente para que esté disponible
                    }
                    result = eval(rule.rule, eval_globals, {})
                except NameError as e:
                    # Capturar errores específicos de nombres no definidos para dar mejor feedback
                    raise NameError(f"Error evaluando regla {rule.name}: {str(e)}")
                except Exception as e:
                    # Otras excepciones durante la evaluación
                    raise Exception(f"Error evaluando regla {rule.name}: {str(e)}")

                invalid_rows = self._handle_series_result(result, df)

                if len(invalid_rows) > 0:
                    if rule.severity == Severity.ERROR:
                        self.error_count += 1
                        rule_error_count += 1
                        self.logger.error(
                            f"Catalog validation failed: {rule.description}",
                            file=catalog.filename,
                            rule=rule.rule
                        )

                        # Para archivos grandes, limitar el número de errores para reglas de catálogo
                        # Nota: Esto aplica principalmente cuando hay múltiples reglas de catálogo
                        if is_large_file and rule_error_count >= self.MAX_ERRORS_PER_RULE:
                            self.catalog_rules_skipped[catalog.filename][rule.name] = rule_error_count
                            self.logger.warning(
                                f"Se omitieron evaluaciones adicionales para la regla de catálogo '{rule.name}'.",
                                file=catalog.filename,
                                rule=rule.name
                            )
                    elif rule.severity == Severity.WARNING:
                        self.warning_count += 1
                        self.logger.warning(
                            f"Catalog validation warning: {rule.description}",
                            file=catalog.filename,
                            rule=rule.rule
                        )
            except Exception as e:
                # Añadir más detalles sobre el error
                rule_name = getattr(rule, 'name', 'unknown')
                rule_rule = getattr(rule, 'rule', 'unknown')
                if hasattr(df, 'columns'):
                    cols_count = len(df.columns)
                    self.logger.error(f"DEBUG - Evaluando regla '{rule_name}' con {cols_count} columnas. Regla: '{rule_rule}'")
                raise FileProcessingError(f"Error evaluating catalog rule {rule_name}: {str(e)}")

    def validate_package(self, package: Package) -> None:
        """Apply package-level validations"""
        for rule in package.package_validation:
            try:
                # Usamos eval() regular en lugar de pd.eval() para permitir acceso a métodos completos de pandas
                try:
                    # Crear un entorno de ejecución con acceso a pandas, numpy y str
                    eval_globals = {
                        'df': self.dataframes,
                        'np': np,
                        'pd': pd,
                        'str': str  # Añadir str explícitamente para que esté disponible
                    }
                    result = eval(rule.rule, eval_globals, {})
                except NameError as e:
                    # Capturar errores específicos de nombres no definidos para dar mejor feedback
                    raise NameError(f"Error evaluando regla {rule.name}: {str(e)}")
                except Exception as e:
                    # Otras excepciones durante la evaluación
                    raise Exception(f"Error evaluando regla {rule.name}: {str(e)}")

                # Para Series, procesamos cada valor que no cumple
                if isinstance(result, pd.Series):
                    failed_mask = ~result  # Usar negación bitwise en lugar de 'not'
                    if failed_mask.any():
                        if rule.severity == Severity.ERROR:
                            self.error_count += 1
                            self.logger.error(
                                f"Package validation failed: {rule.description}",
                                rule=rule.rule,
                                values=result[failed_mask].index.tolist()
                            )
                        else:
                            self.warning_count += 1
                            self.logger.warning(
                                f"Package validation warning: {rule.description}",
                                rule=rule.rule,
                                values=result[failed_mask].index.tolist()
                            )

                # Para resultados escalares (True/False)
                elif isinstance(result, bool):
                    if not result:
                        if rule.severity == Severity.ERROR:
                            self.error_count += 1
                            self.logger.error(
                                f"Package validation failed: {rule.description}",
                                rule=rule.rule
                            )
                        else:
                            self.warning_count += 1
                            self.logger.warning(
                                f"Package validation warning: {rule.description}",
                                rule=rule.rule
                            )

            except Exception as e:
                raise FileProcessingError(
                    f"Error evaluating package rule {rule.name}: {str(e)}\n"
                    "Asegúrate de que la regla sea válida y los catálogos requeridos existan."
                )

    def process_zip_file(self, zip_path: str, package_name: str) -> Tuple[int, int]:
        """Process a ZIP file containing multiple catalogs"""
        package = self.config.packages.get(package_name)
        if not package:
            raise FileProcessingError(f"Package '{package_name}' not found in configuration")

        self.logger.message(f"Processing ZIP package: {zip_path}")

        total_records = 0
        # Lista para almacenar las estadísticas de cada archivo para el DataFrame resumen
        files_summary_data = []
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Extract ZIP contents
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
            except Exception as e:
                raise FileProcessingError(f"Error extracting ZIP file: {str(e)}")

            # Process each catalog in the package
            for catalog_name in package.catalogs:
                catalog = self.config.catalogs.get(catalog_name)
                if not catalog:
                    raise FileProcessingError(f"Catalog '{catalog_name}' not found in configuration")

                file_path = os.path.join(temp_dir, catalog.filename)
                if not os.path.exists(file_path):
                    # Registrar el archivo faltante en el logger
                    self.logger.register_missing_file(catalog.filename, package_name)
                    # Lanzar la excepción pero continuar con otros archivos
                    self.error_count += 1
                    self.logger.error(
                        f"Required file '{catalog.filename}' not found in ZIP package",
                        file=catalog.filename,
                        package=package_name
                    )
                    # Añadir entrada para archivo faltante en el resumen
                    files_summary_data.append({
                        'archivo': catalog.filename,
                        'catalogo': catalog_name,
                        'registros': 0,
                        'errores': 1,
                        'advertencias': 0,
                        'estado': 'Faltante'
                    })
                    continue

                try:
                    df = self._read_file(file_path, catalog)
                    self.logger.message(f"Processing catalog: {catalog_name}")

                    # Store initial error and warning counts
                    initial_errors = self.error_count
                    initial_warnings = self.warning_count

                    self.validate_catalog(df, catalog)

                    # Calculate records and errors/warnings for this file
                    file_records = len(df)
                    file_errors = self.error_count - initial_errors
                    file_warnings = self.warning_count - initial_warnings

                    # Log summary for this file in a clean format
                    success_rate = ((file_records - file_errors) / file_records * 100) if file_records > 0 else 0
                    summary = f"""Summary for {catalog.filename}:
Total records: {file_records}
Errors: {file_errors}
Warnings: {file_warnings}
Success rate: {success_rate:.2f}%

"""
                    self.logger.message(summary)

                    # Registrar estadísticas de este archivo para el reporte
                    self.logger.register_file_stats(
                        catalog.filename, 
                        file_records, 
                        file_errors, 
                        file_warnings
                    )

                    # Añadir información a la lista para el DataFrame resumen
                    files_summary_data.append({
                        'archivo': catalog.filename,
                        'catalogo': catalog_name,
                        'registros': file_records,
                        'errores': file_errors,
                        'advertencias': file_warnings,
                        'estado': 'Procesado'
                    })

                    total_records += file_records

                    # Store DataFrame for package-level validations
                    self.dataframes[catalog_name] = df

                except Exception as e:
                    # Registrar el error pero continuar con otros archivos
                    self.error_count += 1
                    error_msg = f"Error processing catalog '{catalog_name}': {str(e)}"
                    self.logger.error(error_msg, file=catalog.filename, exception=e)

                    # Registrar estadísticas con 0 registros procesados correctamente
                    self.logger.register_file_stats(
                        catalog.filename, 
                        0,  # ningún registro procesado correctamente
                        1,  # un error crítico
                        0   # sin advertencias
                    )
                    
                    # Añadir información a la lista para el DataFrame resumen
                    files_summary_data.append({
                        'archivo': catalog.filename,
                        'catalogo': catalog_name,
                        'registros': 0,
                        'errores': 1,
                        'advertencias': 0,
                        'estado': 'Error'
                    })
                    continue  # Continuar con el siguiente catálogo

            # Apply package-level validations
            self.validate_package(package)

            # Log global summary
            global_summary = f"""Global Summary:
Total records: {total_records}
Errors: {self.error_count}
Warnings: {self.warning_count}

"""
            self.logger.message(global_summary)

            # Mostrar resumen de reglas omitidas para archivos grandes
            self._log_skipped_rules_summary()
            
            # Crear DataFrame de resumen y asignarlo a last_processed_df
            import pandas as pd
            # Convertir tipos numpy a tipos nativos de Python para evitar problemas de serialización JSON
            summary_data = []
            for item in files_summary_data:
                summary_data.append({
                    'archivo': item['archivo'],
                    'catalogo': item['catalogo'],
                    'registros': int(item['registros']),
                    'errores': int(item['errores']),
                    'advertencias': int(item['advertencias']),
                    'estado': item['estado']
                })
            self.last_processed_df = pd.DataFrame(summary_data)
            
            # Loguear el DataFrame creado
            self.logger.message(f"Created summary DataFrame with {len(summary_data)} files information")

        return self.error_count, self.warning_count

    def _log_skipped_rules_summary(self) -> None:
        """Registra un resumen de las reglas que fueron omitidas durante el procesamiento"""
        any_rules_skipped = (
            bool(self.field_rules_skipped) or 
            bool(self.row_rules_skipped) or 
            bool(self.catalog_rules_skipped)
        )

        if not any_rules_skipped:
            return

        self.logger.message("=" * 80)
        self.logger.message("RESUMEN DE OPTIMIZACIÓN DE RENDIMIENTO")
        self.logger.message("Algunas reglas fueron omitidas parcialmente para archivos grandes para mejorar el rendimiento.")
        self.logger.message("=" * 80)

        # Reportar reglas de campo omitidas
        if self.field_rules_skipped:
            self.logger.message("\nReglas de campo omitidas parcialmente:")
            for field_name, rules in self.field_rules_skipped.items():
                for rule_name, count in rules.items():
                    self.logger.warning(
                        f"Campo '{field_name}', Regla '{rule_name}': Se detectaron al menos {count} errores",
                        field=field_name,
                        rule=rule_name
                    )

        # Reportar reglas de fila omitidas
        if self.row_rules_skipped:
            self.logger.message("\nReglas de fila omitidas parcialmente:")
            for catalog_name, rules in self.row_rules_skipped.items():
                for rule_name, count in rules.items():
                    self.logger.warning(
                        f"Catálogo '{catalog_name}', Regla de fila '{rule_name}': Se detectaron al menos {count} errores",
                        file=catalog_name,
                        rule=rule_name
                    )

        # Reportar reglas de catálogo omitidas
        if self.catalog_rules_skipped:
            self.logger.message("\nReglas de catálogo omitidas parcialmente:")
            for catalog_name, rules in self.catalog_rules_skipped.items():
                for rule_name, count in rules.items():
                    self.logger.warning(
                        f"Catálogo '{catalog_name}', Regla de catálogo '{rule_name}': Se omitieron evaluaciones adicionales",
                        file=catalog_name,
                        rule=rule_name
                    )

        self.logger.message("\nNOTA: El conteo total de errores es preciso, pero no todos fueron detallados en el log.")
        self.logger.message("Para ver todos los errores, ejecute la validación con archivos más pequeños.")
        self.logger.message("=" * 80)

    def process_file(self, file_path: str, package_name: str) -> Tuple[int, int]:
        """Process either a single file or a ZIP package"""
        # Obtener información básica del archivo
        file_extension = os.path.splitext(file_path.lower())[1]
        is_zip_file = file_extension == '.zip'
        file_type = self._get_file_type(file_path)  # Mapea extensión a tipo SAGE (CSV, EXCEL, etc.)

        # Diagnóstico inicial
        self.logger.message("=" * 80)
        self.logger.message(f"DIAGNÓSTICO DE PROCESAMIENTO DE ARCHIVO")
        self.logger.message(f"Archivo: {os.path.basename(file_path)}")
        self.logger.message(f"Extensión: {file_extension}")
        self.logger.message(f"Tipo detectado: {file_type or 'DESCONOCIDO'}")
        self.logger.message(f"Configuración a usar: '{package_name}'")

        # Verificar si la configuración existe como paquete o catálogo
        package = self.config.packages.get(package_name) if hasattr(self.config, 'packages') else None
        catalog = self.config.catalogs.get(package_name) if hasattr(self.config, 'catalogs') else None

        self.logger.message(f"¿Existe como paquete? {'Sí' if package else 'No'}")
        self.logger.message(f"¿Existe como catálogo? {'Sí' if catalog else 'No'}")

        # CASO 1: Es un archivo ZIP
        if is_zip_file:
            self.logger.message(f"El archivo es de tipo ZIP")

            # CASO 1.1: Si se especificó un paquete compatible con ZIP
            if package and package.file_format.type == "ZIP":
                self.logger.message(f"Usando paquete '{package_name}' configurado como ZIP")
                return self.process_zip_file(file_path, package_name)

            # CASO 1.2: Si se especificó un paquete, pero NO es compatible con ZIP
            elif package:
                raise FileProcessingError(
                    f"Error al procesar {os.path.basename(file_path)}: "
                    f"El archivo es ZIP pero el paquete '{package_name}' está configurado como {package.file_format.type}"
                )

            # CASO 1.3: Si se especificó un catálogo directamente (no debería ocurrir con ZIPs)
            else:
                raise FileProcessingError(
                    f"Error al procesar {os.path.basename(file_path)}: "
                    f"Los archivos ZIP requieren un paquete configurado como ZIP, pero se proporcionó '{package_name}'"
                )

        # CASO 2: No es un archivo ZIP (es un EXCEL, CSV, etc.)
        else:
            self.logger.message(f"El archivo NO es ZIP, es de tipo {file_type}")

            # CASO 2.1: Es un catálogo directo
            if catalog:
                self.logger.message(f"Procesando archivo mediante el catálogo '{package_name}'")
                return self._process_single_file(file_path, catalog)

            # CASO 2.2: Es un paquete
            elif package:
                # Verificar compatibilidad de tipo
                if package.file_format.type != file_type:
                    raise FileProcessingError(
                        f"Error al procesar {os.path.basename(file_path)}: "
                        f"El paquete '{package_name}' está configurado para {package.file_format.type}, "
                        f"pero el archivo es {file_type}"
                    )

                # Asegurarse de que el paquete tenga exactamente un catálogo para archivos no-ZIP
                if len(package.catalogs) != 1:
                    raise FileProcessingError(
                        f"Error al procesar {os.path.basename(file_path)}: "
                        f"El paquete '{package_name}' tiene {len(package.catalogs)} catálogos, "
                        f"pero los paquetes no-ZIP deben tener exactamente 1 catálogo"
                    )

                # Obtener y usar el catálogo único
                catalog_name = package.catalogs[0]
                catalog = self.config.catalogs.get(catalog_name)

                if not catalog:
                    raise FileProcessingError(
                        f"Error al procesar {os.path.basename(file_path)}: "
                        f"El catálogo '{catalog_name}' referenciado por el paquete '{package_name}' no existe"
                    )

                self.logger.message(f"Procesando archivo mediante el catálogo '{catalog_name}' del paquete '{package_name}'")
                return self._process_single_file(file_path, catalog)

            # CASO 2.3: No se encontró configuración
            else:
                raise FileProcessingError(
                    f"Error al procesar {os.path.basename(file_path)}: "
                    f"No se encontró '{package_name}' como catálogo ni como paquete en la configuración"
                )

    def _process_single_file(self, file_path: str, catalog) -> Tuple[int, int]:
        """Procesa un archivo individual usando un catálogo específico"""
        try:
            df = self._read_file(file_path, catalog)
            self.last_processed_df = df
            cols_count = len(df.columns)
            column_names = ", ".join(df.columns.tolist())

            # Información detallada sobre el archivo y su estructura
            self.logger.message(f"Processing file: {file_path}")
            self.logger.message(f"DataFrame columns count: {cols_count}")
            self.logger.message(f"DataFrame columns: {column_names}")

            # Store initial error and warning counts
            initial_errors = self.error_count
            initial_warnings = self.warning_count

            self.validate_catalog(df, catalog)

            # Calculate records and errors/warnings for this file
            file_records = len(df)
            file_errors = self.error_count - initial_errors
            file_warnings = self.warning_count - initial_warnings

            # Log summary for this file
            success_rate = ((file_records - file_errors) / file_records * 100) if file_records > 0 else 0
            summary = f"""Summary for {os.path.basename(file_path)}:
Total records: {file_records}
Errors: {file_errors}
Warnings: {file_warnings}
Success rate: {success_rate:.2f}%

"""
            self.logger.message(summary)

            # Registrar estadísticas de este archivo para el reporte
            self.logger.register_file_stats(
                os.path.basename(file_path), 
                file_records, 
                file_errors, 
                file_warnings
            )

            # También mostrar resumen para archivos individuales
            self._log_skipped_rules_summary()

            return self.error_count, self.warning_count

        except Exception as e:
            # Registrar el error y continuar
            self.error_count += 1
            error_msg = f"Error processing file {file_path}: {str(e)}"
            self.logger.error(error_msg, file=os.path.basename(file_path), exception=e)

            # Registrar estadísticas con 0 registros procesados correctamente
            self.logger.register_file_stats(
                os.path.basename(file_path), 
                0,  # ningún registro procesado correctamente
                1,  # un error crítico
                0   # sin advertencias
            )

            return self.error_count, self.warning_count