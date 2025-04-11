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
        
        # Log para diagnóstico: Verificar si hay paquetes definidos en el YAML
        package_count = len(config.packages) if hasattr(config, 'packages') else 0
        catalog_count = len(config.catalogs) if hasattr(config, 'catalogs') else 0
        logger.message(f"Configuración YAML - Paquetes: {package_count}, Catálogos: {catalog_count}")
        
        # Para archivos EXCEL o CSV, priorizar usar catálogos directamente si existen
        if file_type in ["EXCEL", "CSV"] and catalog_count > 0:
            # Usar el primer catálogo disponible (comportamiento más seguro)
            package_name = list(config.catalogs.keys())[0]
            logger.message(f"Seleccionando catálogo '{package_name}' para archivo {os.path.basename(data_dest)} de tipo {file_type}")
            
            # Pero intentar encontrar un catálogo que coincida exactamente con el nombre del archivo
            for catalog_name, catalog in config.catalogs.items():
                if catalog.filename.lower() == os.path.basename(data_dest).lower():
                    package_name = catalog_name
                    logger.message(f"¡Encontrado catálogo exacto! Usando '{package_name}' para {os.path.basename(data_dest)}")
                    break
        
        # Para archivos ZIP, es obligatorio usar un paquete ZIP
        elif is_zip:
            if package_count > 0:
                # Buscar paquetes ZIP
                zip_packages = [
                    pkg_name for pkg_name, pkg in config.packages.items()
                    if pkg.file_format.type == "ZIP"
                ]
                if zip_packages:
                    package_name = zip_packages[0]
                    logger.message(f"Usando paquete ZIP '{package_name}' para archivo {os.path.basename(data_dest)}")
                else:
                    raise SAGEError(f"No se encontró configuración de paquete ZIP en el YAML para procesar {os.path.basename(data_dest)}")
            else:
                raise SAGEError(f"No hay paquetes definidos en YAML para procesar archivos ZIP")
        
        # Búsqueda de paquetes que coincidan con el tipo de archivo (vía file_format.type)
        elif package_count > 0 and file_type:
            matching_packages = [
                pkg_name for pkg_name, pkg in config.packages.items()
                if pkg.file_format.type == file_type
            ]
            
            if matching_packages:
                package_name = matching_packages[0]
                logger.message(f"Usando paquete '{package_name}' de tipo {file_type} para archivo {os.path.basename(data_dest)}")
            else:
                # Si no encontramos paquetes que coincidan pero hay catálogos
                if catalog_count > 0:
                    package_name = list(config.catalogs.keys())[0]
                    logger.message(f"No se encontró paquete para tipo {file_type}. Usando catálogo '{package_name}' como alternativa")
                else:
                    raise SAGEError(f"No se encontró ningún catálogo ni paquete compatible en YAML para procesar {os.path.basename(data_dest)}")
        else:
            # Si no hay paquetes pero sí catálogos, usamos el primer catálogo
            if catalog_count > 0:
                package_name = list(config.catalogs.keys())[0]
                logger.message(f"No hay paquetes definidos en YAML. Usando catálogo '{package_name}' para {os.path.basename(data_dest)}")
            else:
                raise SAGEError(f"No se encontró ningún catálogo ni paquete en YAML para procesar {os.path.basename(data_dest)}")
                

        error_count, warning_count = processor.process_file(data_dest, package_name)

        # Log summary
        # Para archivos ZIP, no podemos contar líneas directamente - usamos el contador de registros del procesador
        if is_zip:
            # Obtener el conteo de registros del procesador o usar 0 si no está disponible
            total_records = getattr(processor, 'total_records', 0) or 0
        else:
            try:
                # Para archivos regulares, contar líneas ignorando la cabecera
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