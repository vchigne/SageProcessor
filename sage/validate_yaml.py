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
        # Primero, verificar que el archivo existe y se puede leer
        if not os.path.exists(yaml_path):
            logger.error(
                "¡No encontramos el archivo YAML! 😮\n\n"
                f"❌ Error: El archivo {yaml_path} no existe o no se puede acceder.\n\n"
                "🔧 Por favor, verifica que el archivo existe y tiene permisos de lectura."
            )
            return False
            
        # Verificar contenido básico del archivo
        with open(yaml_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Comprobar si está vacío o es demasiado corto
        if not content or len(content.strip()) < 10:
            logger.error(
                "¡El archivo YAML está vacío o es demasiado corto! 😮\n\n"
                "🔧 Por favor, asegúrate de que el archivo contiene contenido YAML válido."
            )
            return False
            
        # Ahora podemos intentar validarlo formalmente
        validator = YAMLValidator()
        
        # Intentar validar el YAML básico antes de procesarlo con el validador
        try:
            import yaml
            parsed_yaml = yaml.safe_load(content)
            
            # Verificar que el resultado sea un diccionario y no una cadena o lista
            if not isinstance(parsed_yaml, dict):
                logger.error(
                    "¡El formato del YAML no es correcto! 😕\n\n"
                    "❌ Error: El YAML debe contener un objeto/diccionario principal, pero se encontró: "
                    f"{type(parsed_yaml).__name__}\n\n"
                    "🔧 Por favor, verifica que:\n"
                    "   1. El YAML comienza con las secciones principales (sage_yaml, catalogs, packages)\n"
                    "   2. No tiene elementos de lista (líneas que comienzan con -) en el nivel superior\n"
                    "   3. Sigue el formato correcto de YAML con las indentaciones adecuadas"
                )
                return False
                
            # Verificar que tiene las secciones básicas
            required_sections = ['sage_yaml', 'catalogs', 'packages']
            missing_sections = [s for s in required_sections if s not in parsed_yaml]
            
            if missing_sections:
                logger.error(
                    "¡El YAML no tiene todas las secciones requeridas! 📋\n\n"
                    f"❌ Error: Faltan las siguientes secciones: {', '.join(missing_sections)}\n\n"
                    "🔧 Tu YAML debe incluir estas tres secciones principales:\n"
                    "   - sage_yaml: Información general de la configuración\n"
                    "   - catalogs: Definición de la estructura de tus archivos\n"
                    "   - packages: Agrupación de catálogos relacionados"
                )
                return False
        
        except Exception as yaml_error:
            # Solo capturar errores del parsing básico, no del validador
            logger.error(
                "¡El YAML tiene problemas de formato! 📝\n\n"
                f"❌ Error de parsing: {str(yaml_error)}\n\n"
                "🔧 Por favor, verifica que:\n"
                "   1. No hay errores de sintaxis (como indentación incorrecta)\n"
                "   2. Los dos puntos (:) y guiones (-) están correctamente espaciados\n"
                "   3. Los valores especiales o con caracteres especiales están entre comillas"
            )
            return False
            
        # Si pasó la validación básica, proceder con la validación completa
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
