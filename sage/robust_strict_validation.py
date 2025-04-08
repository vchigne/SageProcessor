"""
Módulo con validaciones estrictas para SAGE con manejo mejorado de errores

Este módulo proporciona funciones para la validación estricta de archivos CSV y Excel
según las definiciones YAML, garantizando que las estructuras coincidan exactamente.
Incluye manejo robusto de errores para continuar con la validación a pesar de encontrar problemas.
"""
import os
import zipfile
import tempfile
import pandas as pd
from typing import Tuple, Dict, List, Any
from .file_processor import detect_bom, create_column_names
from .exceptions import FileProcessingError

def strict_read_file(self, file_path, catalog):
    """
    Versión estricta del método _read_file que verifica que el número de columnas
    coincida exactamente con la definición YAML.
    
    Args:
        file_path: Ruta al archivo a leer
        catalog: Configuración del catálogo con la definición esperada
        
    Returns:
        pd.DataFrame: DataFrame con los datos del archivo
        
    Raises:
        FileProcessingError: Si el número de columnas no coincide exactamente
    """
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
            encoding = 'utf-8-sig' if has_bom else 'utf-8'
            
            # Para archivos sin encabezado, crear nombres de columnas personalizados
            if not catalog.file_format.header:
                # Primero determinar el número de columnas
                try:
                    df_temp = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                      header=None, encoding=encoding, nrows=1)
                except UnicodeDecodeError:
                    # Si falla, intentar con latin1
                    df_temp = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                      header=None, encoding='latin1', nrows=1)
                    encoding = 'latin1'
                
                n_columns = len(df_temp.columns)
                
                # Obtener los nombres de campos definidos en el YAML
                yaml_field_names = [field.name for field in catalog.fields]
                
                # Verificar estrictamente que el número de columnas coincida
                if n_columns != len(yaml_field_names):
                    raise FileProcessingError(
                        f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                        f"El archivo tiene {n_columns} columnas pero la definición YAML "
                        f"tiene {len(yaml_field_names)} campos. El número de columnas debe "
                        f"coincidir exactamente con la definición."
                    )
                
                # Crear los nombres de columnas
                column_names = yaml_field_names
                
                # Cargar el CSV completo con los nombres de columnas personalizados
                try:
                    df = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                  header=None, encoding=encoding, names=column_names)
                except UnicodeDecodeError:
                    # Si falla, intentar con latin1
                    df = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                  header=None, encoding='latin1', names=column_names)
            else:
                # Con encabezado, usar el método estándar
                try:
                    df = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                  header=0, encoding=encoding)
                except UnicodeDecodeError:
                    # Si falla, intentar con latin1
                    df = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                  header=0, encoding='latin1')
                
                # Obtener los nombres de campos definidos en el YAML
                yaml_field_names = [field.name for field in catalog.fields]
                
                # Verificar estrictamente que el número de columnas coincida
                if len(df.columns) != len(yaml_field_names):
                    raise FileProcessingError(
                        f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                        f"El archivo tiene {len(df.columns)} columnas pero la definición YAML "
                        f"tiene {len(yaml_field_names)} campos. El número de columnas debe "
                        f"coincidir exactamente con la definición."
                    )
                
                # Verificar que los nombres de las columnas coincidan con la definición
                for field_name in yaml_field_names:
                    if field_name not in df.columns:
                        raise FileProcessingError(
                            f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                            f"El campo '{field_name}' está definido en el YAML pero no "
                            f"se encuentra en el archivo CSV. Los nombres de columnas deben "
                            f"coincidir exactamente con la definición."
                        )
        
        elif file_type == 'EXCEL':
            df = pd.read_excel(file_path, header=0 if catalog.file_format.header else None, 
                            engine='openpyxl')
            
            # Obtener los nombres de campos definidos en el YAML
            yaml_field_names = [field.name for field in catalog.fields]
            
            # Verificar estrictamente que el número de columnas coincida
            if len(df.columns) != len(yaml_field_names):
                raise FileProcessingError(
                    f"Error de estructura en el archivo {os.path.basename(file_path)}: "
                    f"El archivo tiene {len(df.columns)} columnas pero la definición YAML "
                    f"tiene {len(yaml_field_names)} campos. El número de columnas debe "
                    f"coincidir exactamente con la definición."
                )
            
            # Si no tiene encabezado, renombrar las columnas
            if not catalog.file_format.header:
                df.columns = yaml_field_names

        # Validar y convertir tipos de datos
        df = self._validate_data_types(df, catalog)
        return df

    except FileProcessingError as e:
        # Reenviar excepciones específicas de procesamiento de archivos
        raise e
    except Exception as e:
        raise FileProcessingError(
            f"Error al leer el archivo {os.path.basename(file_path)}: {str(e)}\n"
            "Asegúrate de que el archivo tenga el formato correcto y no esté dañado."
        )

def robust_strict_process_zip_file(self, zip_path: str, package_name: str) -> Tuple[int, int]:
    """
    Versión robusta y estricta del método process_zip_file que verifica que todos los archivos
    definidos en el YAML estén presentes en el ZIP y que valida la estructura de todos
    los archivos, reportando errores sin detener el procesamiento en ningún caso.
    
    Esta versión garantiza que todos los catálogos sean procesados incluso si algunos tienen errores.
    
    Args:
        zip_path: Ruta al archivo ZIP
        package_name: Nombre del paquete a procesar
        
    Returns:
        Tuple[int, int]: (error_count, warning_count)
    """
    package = self.config.packages.get(package_name)
    if not package:
        self.logger.error(f"Package '{package_name}' not found in configuration")
        return 1, 0

    self.logger.message(f"Processing ZIP package: {os.path.basename(zip_path)}")

    # Lista para almacenar los errores encontrados durante la validación
    structure_errors = []
    
    # Lista para registrar todos los catálogos que procesamos
    processed_catalogs = []
    all_catalogs = []
    
    # Primero verificar que todos los archivos definidos en el YAML estén presentes en el ZIP
    zip_files = []
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_files = zip_ref.namelist()
            
            # Crear una lista de todos los archivos requeridos según el YAML
            required_files = []
            for catalog_name in package.catalogs:
                catalog = self.config.catalogs.get(catalog_name)
                if catalog:
                    all_catalogs.append(catalog_name)
                    required_files.append(catalog.filename)
            
            # Verificar que cada archivo requerido esté presente en el ZIP
            missing_files = []
            for required_file in required_files:
                if required_file not in zip_files:
                    missing_files.append(required_file)
            
            if missing_files:
                error_msg = (
                    f"Los siguientes archivos definidos en la configuración YAML no están "
                    f"presentes en el ZIP: {', '.join(missing_files)}. Todos los archivos "
                    f"definidos en el YAML deben estar incluidos en el paquete ZIP."
                )
                # Registrar el error pero continuar con los archivos disponibles
                self.logger.error(error_msg)
                self.error_count += 1
                structure_errors.append(error_msg)
                
    except zipfile.BadZipFile:
        self.logger.error(f"El archivo {os.path.basename(zip_path)} no es un archivo ZIP válido.")
        return 1, 0
    except Exception as e:
        self.logger.error(f"Error al abrir el archivo ZIP: {str(e)}")
        return 1, 0
    
    # Continuar con el procesamiento normal, incluso si faltan archivos
    total_records = 0
    processed_catalogs_count = 0
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Extraer contenido del ZIP, manejando cualquier error
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
        except Exception as e:
            self.logger.error(f"Error al extraer el archivo ZIP: {str(e)}")
            return self.error_count, self.warning_count

        # Procesar cada catálogo en el paquete
        for catalog_name in package.catalogs:
            # Registrar el inicio del procesamiento de este catálogo
            self.logger.message(f"Processing catalog: {catalog_name}")
            
            catalog = self.config.catalogs.get(catalog_name)
            if not catalog:
                self.logger.error(f"Catalog '{catalog_name}' not found in configuration")
                self.error_count += 1
                continue

            file_path = os.path.join(temp_dir, catalog.filename)
            if not os.path.exists(file_path):
                # Esta comprobación podría ser redundante si ya verificamos los archivos faltantes,
                # pero la mantenemos por seguridad
                self.logger.error(f"Required file '{catalog.filename}' not found in ZIP package")
                self.error_count += 1
                continue

            # Intentar procesar el archivo con manejo completo de excepciones
            try:
                # Procesar el catálogo (validar y aplicar reglas)
                df = self._read_file(file_path, catalog)
                
                # Si llegamos aquí, pudimos leer el archivo correctamente
                processed_catalogs.append(catalog_name)
                processed_catalogs_count += 1
                
                # Validar filas (si el método existe)
                if hasattr(self, '_validate_rows'):
                    errors, warnings = self._validate_rows(df, catalog)
                    self.error_count += len(errors)
                    self.warning_count += len(warnings)
                else:
                    errors, warnings = [], []
                
                # Aplicar validaciones a nivel de catálogo (si el método existe)
                if hasattr(self, '_apply_catalog_validations'):
                    cat_errors, cat_warnings = self._apply_catalog_validations(df, catalog)
                    self.error_count += len(cat_errors)
                    self.warning_count += len(cat_warnings)
                else:
                    cat_errors, cat_warnings = [], []
                
                # Actualizar recuento total de registros
                total_records += len(df)
                
                # Mostrar resumen para este catálogo
                error_percentage = 0 if len(df) == 0 else (len(errors) / len(df)) * 100
                success_rate = 100 - error_percentage
                
                self.logger.message(
                    f"Summary for {catalog.filename}: "
                    f"Total records: {len(df)} "
                    f"Errors: {len(errors)} "
                    f"Warnings: {len(warnings)} "
                    f"Success rate: {success_rate:.2f}%"
                )
                
            except Exception as e:
                # Capturar cualquier excepción durante el procesamiento de este catálogo
                error_msg = f"Error processing catalog '{catalog_name}': {str(e)}"
                self.logger.error(error_msg)
                self.error_count += 1
                structure_errors.append(error_msg)
                continue
        
        # Al finalizar, ver si hay archivos en el ZIP que no están definidos en el YAML
        undefined_files = set(zip_files) - set(os.path.basename(f) for f in required_files)
        if undefined_files:
            warning_msg = (
                f"Los siguientes archivos están presentes en el ZIP pero no están definidos "
                f"en la configuración YAML: {', '.join(undefined_files)}. Estos archivos no serán procesados."
            )
            self.logger.warning(warning_msg)
            self.warning_count += 1
        
        # Mostrar resumen global
        self.logger.message(
            f"Global Summary: "
            f"Total records: {total_records} "
            f"Errors: {self.error_count} "
            f"Warnings: {self.warning_count}"
        )
        
        # Si no se procesó ningún catálogo, es un error crítico
        if processed_catalogs_count == 0 and len(all_catalogs) > 0:
            critical_error = (
                f"No se pudo procesar ningún catálogo correctamente. "
                f"Todos los archivos fallaron en la validación: {', '.join(structure_errors)}"
            )
            self.logger.error(critical_error)
            # Incrementamos el contador de errores aunque ya se hayan registrado los errores específicos
            self.error_count += 1
            
        # Aplicar validaciones a nivel de paquete
        if processed_catalogs and package.package_validation:
            # TODO: Implementar validaciones a nivel de paquete
            pass

    return self.error_count, self.warning_count

def apply_robust_strict_validation():
    """Aplica la validación estricta robusta al procesador de archivos"""
    from .file_processor import FileProcessor
    original_read_file = FileProcessor._read_file
    original_process_zip_file = FileProcessor.process_zip_file
    
    FileProcessor._read_file = strict_read_file
    FileProcessor.process_zip_file = robust_strict_process_zip_file
    
    return (original_read_file, original_process_zip_file)

def remove_robust_strict_validation(original_methods):
    """Restaura la implementación original de los métodos"""
    from .file_processor import FileProcessor
    original_read_file, original_process_zip_file = original_methods
    
    FileProcessor._read_file = original_read_file
    FileProcessor.process_zip_file = original_process_zip_file