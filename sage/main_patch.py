"""
Versión mejorada de sage/main.py que aplica el parche de manejo de NaN
"""
import os
import sys
import uuid
import shutil
from typing import Tuple, Dict, Any, List, Optional
from .yaml_validator import YAMLValidator
from .file_processor import FileProcessor
from .logger import SageLogger
from .utils import create_execution_directory, check_file_type
from .nan_handling_patch import apply_nan_handling_patch, remove_nan_handling_patch
from .models import SageConfig
from pathlib import Path

def process_files_with_nan_handling(
    yaml_path: str,
    data_path: str,
    casilla_id: Optional[int] = None,
    metodo_envio: str = "sftp",
    execution_dir: Optional[str] = None,
    execution_uuid: Optional[str] = None
) -> Tuple[str, int, int]:
    """
    Versión mejorada de process_files que aplica el parche de manejo de NaN
    
    Args:
        yaml_path: Ruta al archivo YAML
        data_path: Ruta al archivo de datos
        casilla_id: ID de la casilla (opcional)
        metodo_envio: Método de envío (por defecto 'sftp')
        execution_dir: Directorio de ejecución (opcional)
        execution_uuid: UUID de ejecución (opcional)
        
    Returns:
        Tuple[str, int, int]: UUID de ejecución, número de errores, número de advertencias
    """
    # Aplicar el parche de manejo de NaN
    original_evaluate_rule = apply_nan_handling_patch()
    
    try:
        from sage.main import process_files
        # Llamar a la función original pero con nuestro parche aplicado
        return process_files(
            yaml_path=yaml_path,
            data_path=data_path,
            casilla_id=casilla_id,
            metodo_envio=metodo_envio,
            execution_dir=execution_dir,
            execution_uuid=execution_uuid
        )
    finally:
        # Siempre eliminar el parche al finalizar
        remove_nan_handling_patch(original_evaluate_rule)

# Reemplazar la función original para usarla automáticamente
from sage.main import process_files as original_process_files
import sage.main
sage.main.process_files = process_files_with_nan_handling