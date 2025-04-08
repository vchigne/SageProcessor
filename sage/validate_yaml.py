"""Script for validating SAGE YAML files"""
import sys
import argparse
from typing import List, Dict, Any
from .yaml_validator import YAMLValidator
from .logger import SageLogger
from .utils import create_execution_directory
from .exceptions import YAMLValidationError

def validate_yaml(yaml_path: str) -> bool:
    """
    Validate a YAML file and return True if valid
    """
    # Create execution directory for logs
    execution_dir, execution_uuid = create_execution_directory()
    logger = SageLogger(execution_dir)
    
    logger.message(f"🔍 Iniciando validación del archivo YAML: {yaml_path}")
    
    try:
        validator = YAMLValidator()
        config = validator.load_and_validate(yaml_path)
        
        # Log successful validation with details
        logger.success(
            "¡El archivo YAML es válido! 🎉 La estructura y configuración son correctas.\n\n"
            f"📋 Detalles de la configuración:\n"
            f"  • Nombre: {config.name}\n"
            f"  • Descripción: {config.description}\n"
            f"  • Versión: {config.version}\n"
            f"  • Autor: {config.author}\n"
            f"  • Catálogos configurados: {', '.join(config.catalogs.keys())}\n"
            f"  • Paquetes configurados: {', '.join(config.packages.keys())}"
        )
        return True
        
    except YAMLValidationError as e:
        logger.error(
            "¡Ups! Encontramos algunos problemas en tu archivo YAML 😅\n\n"
            f"💡 {str(e)}\n\n"
            "🔍 Revisa la documentación para ver ejemplos de la estructura correcta:\n"
            "   https://docs.sage.com/yaml-structure"
        )
        return False
        
    except Exception as e:
        logger.error(
            "¡Vaya! Ocurrió un error inesperado al procesar tu archivo YAML 😕\n\n"
            f"❌ Error: {str(e)}\n\n"
            "🔧 Por favor, verifica que:\n"
            "   1. El archivo existe y tiene permisos de lectura\n"
            "   2. El contenido es un YAML válido\n"
            "   3. No hay caracteres especiales o encoding incorrecto"
        )
        return False

def main():
    parser = argparse.ArgumentParser(
        description="SAGE - Validador de archivos YAML",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
🎯 Ejemplo de uso:
  python -m sage.validate_yaml mi_configuracion.yaml

📖 El validador verificará:
  • Estructura básica del YAML
  • Campos requeridos
  • Tipos de datos correctos
  • Reglas de validación
  • Formato de los catálogos y paquetes
        """
    )
    
    parser.add_argument(
        "yaml_path",
        help="Ruta al archivo YAML que deseas validar"
    )
    
    args = parser.parse_args()
    
    success = validate_yaml(args.yaml_path)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
