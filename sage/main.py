"""Main entry point for SAGE"""
import os
import sys
import argparse
from typing import Tuple, Optional
from .yaml_validator import YAMLValidator
from .file_processor import FileProcessor
from .logger import SageLogger
from .utils import create_execution_directory, copy_input_files
from .exceptions import SAGEError

def process_files(yaml_path: str, data_path: str, casilla_id: Optional[int] = None, emisor_id: Optional[int] = None, metodo_envio: Optional[str] = "direct_upload") -> Tuple[str, int, int]:
    """
    Process files according to YAML configuration
    
    Args:
        yaml_path: Path to YAML file with validation rules
        data_path: Path to data file to process
        casilla_id: Optional ID of the mailbox (casilla)
        emisor_id: Optional ID of the sender (emisor)
        metodo_envio: Method used to send the file ('sftp', 'email', 'direct_upload', 'portal_upload', 'api')
        
    Returns: 
        Tuple containing (execution_uuid, error_count, warning_count)
    """
    # Initialize logger outside try block
    execution_dir, execution_uuid = create_execution_directory()
    logger = SageLogger(execution_dir, casilla_id, emisor_id, metodo_envio)
    logger.message(f"Starting SAGE execution {execution_uuid}")

    try:
        # Copy input files
        yaml_dest, data_dest = copy_input_files(execution_dir, yaml_path, data_path)

        # Validate YAML
        yaml_validator = YAMLValidator()
        config = yaml_validator.load_and_validate(yaml_dest)
        logger.success("YAML validation successful")

        # Process file
        processor = FileProcessor(config, logger)

        # Determine which package or catalog to use based on file type and YAML configuration
        file_extension = os.path.splitext(data_dest.lower())[1]
        is_zip = file_extension == '.zip'
        
        # Mapear la extensión al tipo de archivo que SAGE reconoce
        file_type = None
        if is_zip:
            file_type = "ZIP"
        elif file_extension in ['.xlsx', '.xls']:
            file_type = "EXCEL"
        elif file_extension == '.csv':
            file_type = "CSV"
        
        logger.message(f"Detectado archivo de tipo: {file_type or 'Desconocido'}")
        
        # Diagnóstico básico
        package_count = len(config.packages) if hasattr(config, 'packages') else 0
        catalog_count = len(config.catalogs) if hasattr(config, 'catalogs') else 0
        logger.message(f"Diagnóstico YAML - Paquetes: {package_count}, Catálogos: {catalog_count}")
        logger.message(f"Archivo a procesar: {os.path.basename(data_dest)} (tipo: {file_type or 'desconocido'})")
        
        # REGLA #1: Archivos ZIP siempre requieren un paquete de tipo ZIP
        if is_zip:
            logger.message("El archivo es ZIP - Buscando paquete compatible")
            
            # Verificar que haya paquetes definidos
            if package_count == 0:
                raise SAGEError(f"El archivo {os.path.basename(data_dest)} es ZIP pero no hay paquetes definidos en el YAML")
                
            # Buscar paquetes configurados como ZIP
            zip_packages = [
                pkg_name for pkg_name, pkg in config.packages.items()
                if pkg.file_format.type == "ZIP"
            ]
            
            if zip_packages:
                package_name = zip_packages[0]
                logger.message(f"Seleccionado paquete ZIP: '{package_name}'")
            else:
                raise SAGEError(
                    f"El archivo {os.path.basename(data_dest)} es ZIP pero no hay paquetes "
                    f"configurados como ZIP en el YAML"
                )
                
        # REGLA #2: Para archivos no-ZIP, buscar paquete coincidente por tipo
        elif file_type and package_count > 0:
            logger.message(f"Archivo es {file_type} - Buscando paquete del mismo tipo")
            
            # Buscar paquetes configurados con el mismo tipo de archivo
            matching_packages = [
                pkg_name for pkg_name, pkg in config.packages.items()
                if pkg.file_format.type == file_type
            ]
            
            if matching_packages:
                package_name = matching_packages[0]
                logger.message(f"Seleccionado paquete de tipo {file_type}: '{package_name}'")
                
                # Si hay un paquete con nombre idéntico al archivo, priorizar ese
                base_name = os.path.splitext(os.path.basename(data_dest))[0].lower()
                for pkg_name in matching_packages:
                    if pkg_name.lower() == base_name:
                        package_name = pkg_name
                        logger.message(f"¡Priorizado paquete con nombre coincidente: '{package_name}'!")
                        break
                
            # Si no hay paquetes que coincidan, buscar catálogo directo
            elif catalog_count > 0:
                # Primero intentar encontrar un catálogo cuyo nombre de archivo coincida exactamente
                matching_catalog = None
                for cat_name, cat in config.catalogs.items():
                    if hasattr(cat, 'filename') and cat.filename.lower() == os.path.basename(data_dest).lower():
                        matching_catalog = cat_name
                        break
                
                # Si encontramos un catálogo coincidente, usarlo
                if matching_catalog:
                    package_name = matching_catalog
                    logger.message(f"Usando catálogo con nombre de archivo coincidente: '{package_name}'")
                # Si no, usar el primer catálogo disponible
                else:
                    package_name = list(config.catalogs.keys())[0]
                    logger.message(f"Usando primer catálogo disponible: '{package_name}'")
            else:
                raise SAGEError(
                    f"No se encontró ningún paquete de tipo {file_type} ni catálogo "
                    f"compatible para procesar {os.path.basename(data_dest)}"
                )
                
        # REGLA #3: Si no podemos determinar el tipo, pero hay catálogos, intentar con el primero
        elif catalog_count > 0:
            package_name = list(config.catalogs.keys())[0]
            logger.message(
                f"No se pudo determinar tipo de archivo o no hay paquetes compatibles. "
                f"Intentando con catálogo: '{package_name}'"
            )
            
        # REGLA #4: No hay configuración compatible
        else:
            raise SAGEError(
                f"No se encontró ninguna configuración compatible para procesar "
                f"{os.path.basename(data_dest)}"
            )
                

        error_count, warning_count = processor.process_file(data_dest, package_name)

        # Log summary
        # Para archivos ZIP, no podemos contar líneas directamente - usamos el contador de registros del procesador
        if is_zip:
            if hasattr(processor, 'last_processed_df') and processor.last_processed_df is not None:
                # Si tenemos un DataFrame de resumen, sumamos los registros de cada archivo
                if 'registros' in processor.last_processed_df.columns:
                    # Convertir a int nativo de Python para evitar problemas de serialización
                    total_records = int(processor.last_processed_df['registros'].sum())
                else:
                    # Retrocompatibilidad: si no hay columna 'registros', usar el contador antiguo
                    total_records = int(getattr(processor, 'total_records', 0) or 0)
            else:
                # Retrocompatibilidad: si no hay DataFrame de resumen, usar el contador antiguo
                total_records = int(getattr(processor, 'total_records', 0) or 0)
        # Para archivos Excel, tampoco podemos contar líneas directamente
        elif file_type in ["EXCEL"]:
            # Para archivos Excel, obtener el conteo del último DataFrame procesado
            if hasattr(processor, 'last_processed_df') and processor.last_processed_df is not None:
                total_records = len(processor.last_processed_df)
            else:
                total_records = 0
            logger.message(f"Archivo Excel procesado con {total_records} registros")
        else:
            try:
                # Para archivos CSV y otros de texto, contar líneas ignorando la cabecera
                with open(data_dest, 'r', encoding='utf-8', errors='replace') as f:
                    total_records = sum(1 for _ in f) - 1  # -1 para la cabecera
            except Exception as e:
                logger.warning(f"No se pudieron contar registros en {data_dest}: {str(e)}")
                total_records = 0

        logger.summary(
            total_records=total_records,
            errors=error_count,
            warnings=warning_count
        )
        
        # Procesar materializaciones si hay un dataframe válido, un ID de casilla y no hay errores en el procesamiento YAML
        if casilla_id and hasattr(processor, 'last_processed_df') and processor.last_processed_df is not None and error_count == 0:
            try:
                from .process_materializations import process_materializations
                logger.message("Iniciando procesamiento de materializaciones...")
                
                # Si tenemos un dataframe de resumen y hay múltiples dataframes específicos por catálogo,
                # pasar ambos a process_materializations
                if hasattr(processor, 'dataframes') and processor.dataframes:
                    logger.message(f"Detectados {len(processor.dataframes)} dataframes por catálogo para materializaciones: {', '.join(processor.dataframes.keys())}")
                    process_materializations(
                        casilla_id=casilla_id,
                        execution_id=execution_uuid,
                        dataframe=processor.last_processed_df,
                        logger=logger,
                        dataframes_by_catalog=processor.dataframes
                    )
                else:
                    # Si no hay dataframes específicos, usar solo el dataframe principal
                    logger.message("No se detectaron dataframes específicos por catálogo, usando dataframe único")
                    process_materializations(
                        casilla_id=casilla_id,
                        execution_id=execution_uuid,
                        dataframe=processor.last_processed_df,
                        logger=logger
                    )
            except Exception as e:
                # No interrumpir el flujo principal si falla la materialización
                logger.warning(f"Error al procesar materializaciones: {str(e)}")
                logger.message("El procesamiento de materializaciones falló, pero la ejecución principal se completó correctamente")
        elif error_count > 0:
            logger.message("No se procesarán materializaciones debido a errores en el procesamiento YAML")

        return execution_uuid, error_count, warning_count

    except (SAGEError, Exception) as e:
        # Log the error and return with error counts
        logger.error(str(e))
        
        # Asegurar que la ejecución se registre con los IDs proporcionados
        # incluso en caso de fallo
        try:
            # Usar un valor por defecto para total_records en caso de error
            total_records = 0
            error_count = 1
            warning_count = 0
            
            # Registrar la ejecución antes de cerrar el log
            logger.summary(
                total_records=total_records,
                errors=error_count,
                warnings=warning_count
            )
        except Exception as summary_error:
            print(f"Error al registrar el resumen: {str(summary_error)}")
            # Make sure to close the log file
            logger._close_log_file()
            
        return execution_uuid, 1, 0

def main():
    parser = argparse.ArgumentParser(description="SAGE - Sistema de Análisis y Gestión de Errores")
    parser.add_argument("yaml_path", help="Path to YAML configuration file")
    parser.add_argument("data_path", help="Path to data file or ZIP package to process")
    parser.add_argument("--casilla-id", type=int, help="ID de la casilla asociada con esta ejecución")
    parser.add_argument("--emisor-id", type=int, help="ID del emisor asociado con esta ejecución")
    parser.add_argument("--metodo-envio", choices=["email", "sftp", "direct_upload", "portal_upload", "api"], 
                       help="Método de envío utilizado (email, sftp, direct_upload, portal_upload, api)")

    args = parser.parse_args()

    try:
        execution_uuid, errors, warnings = process_files(
            args.yaml_path, 
            args.data_path,
            casilla_id=args.casilla_id,
            emisor_id=args.emisor_id,
            metodo_envio=args.metodo_envio
        )
        print(f"\nExecution completed!")
        print(f"Execution UUID: {execution_uuid}")
        print(f"Total errors: {errors}")
        print(f"Total warnings: {warnings}")
        print(f"Results available at: ./executions/{execution_uuid}/")
        sys.exit(0 if errors == 0 else 1)
    except Exception as e:
        # No need to print the error here since it's already logged
        sys.exit(2)

if __name__ == "__main__":
    main()