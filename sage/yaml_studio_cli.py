"""YAML Studio CLI - Command line tool for processing YAML configurations"""
import os
import sys
import argparse
from typing import Optional, Dict, Tuple
import importlib.util
import pathlib

# Importar módulos desde el mismo directorio
current_dir = pathlib.Path(__file__).parent
sys.path.append(str(current_dir))

# Importar los módulos necesarios
from sage.yaml_validator import YAMLValidator
from sage.yaml_generator import YAMLGenerator

class YAMLStudioCLI:
    """YAML Studio command line interface"""

    def __init__(self):
        """Initialize the CLI"""
        self.validator = YAMLValidator()
        self.generator = YAMLGenerator()

    def print_section(self, title: str, content: str = "", emoji: str = "") -> None:
        """Print a section with decorative separators"""
        print(f"\n{emoji} {title}")
        if content:
            print(f"{content}")

    def generate_prompt_only(self, input_file: str, output_file: str, instructions_file: Optional[str] = None, 
                             original_filename: Optional[str] = None) -> str:
        """Generate and save only the prompt without calling the API"""
        try:
            self.print_section("GENERANDO PROMPT", "Procesando archivo de entrada...", "📝")
            
            # Analizar la estructura del archivo
            file_info = self.generator.analyze_file_structure(input_file)
            
            # Si tenemos el nombre original, actualizamos el filename en file_info
            if original_filename:
                file_info['filename'] = original_filename
            
            # Obtener instrucciones y especificaciones
            instructions = self.generator.get_instructions(instructions_file)
            yaml_spec = self.generator.load_yaml_spec()
            
            # Generar el prompt
            prompt = self.generator.generate_prompt(file_info, instructions, yaml_spec)
            
            # Guardar el prompt
            output_dir = os.path.dirname(output_file)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(prompt)
                
            self.print_section(
                "PROMPT GENERADO EXITOSAMENTE", 
                f"Archivo guardado en: {output_file}",
                "✅"
            )
            
            return prompt
            
        except Exception as e:
            print(f"\n❌ Error generando prompt: {str(e)}")
            sys.exit(1)
            
    def generate_yaml(self, input_file: str, output_file: str, 
                 instructions_file: Optional[str] = None,
                 original_filename: Optional[str] = None) -> str:
        """Generate YAML configuration using AI"""
        try:
            self.print_section("INICIANDO GENERACIÓN", "Procesando archivo de entrada...", "🚀")

            # Obtener información del archivo
            file_info = self.generator.analyze_file_structure(input_file)
            
            # Si se proporciona el nombre original, usarlo
            if original_filename:
                file_info['filename'] = original_filename
                        
            # Obtener instrucciones y especificaciones
            instructions = self.generator.get_instructions(instructions_file)
            yaml_spec = self.generator.load_yaml_spec()
            
            # Modificar el analizador del generador para usar el nombre original del archivo
            original_analyze_func = self.generator.analyze_file_structure
            def modified_analyze(*args, **kwargs):
                return file_info
            
            # Reemplazar temporalmente la función de análisis
            self.generator.analyze_file_structure = modified_analyze
            
            # Generate YAML
            yaml_content = self.generator.generate_yaml(input_file, instructions_file)
            
            # Restaurar la función original
            self.generator.analyze_file_structure = original_analyze_func

            # Save YAML
            output_dir = os.path.dirname(output_file)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(yaml_content)

            self.print_section(
                "YAML GENERADO EXITOSAMENTE", 
                f"Archivo guardado en: {output_file}",
                "✅"
            )

            return yaml_content

        except Exception as e:
            print(f"\n❌ Error generando YAML: {str(e)}")
            sys.exit(1)

def main():
    """Main entry point for YAML Studio CLI"""
    parser = argparse.ArgumentParser(
        description="YAML Studio CLI - Process and validate YAML configurations"
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Generate YAML command
    generate_yaml_parser = subparsers.add_parser("generate", help="Generate YAML using AI")
    generate_yaml_parser.add_argument("input_file", help="Input file to analyze (.csv, .xlsx, .zip)")
    generate_yaml_parser.add_argument("output_file", help="Output YAML file path")
    generate_yaml_parser.add_argument("--instructions", help="File with additional instructions")
    generate_yaml_parser.add_argument("--original-filename", help="Original filename of the uploaded file")

    # Generate prompt only command
    generate_prompt_parser = subparsers.add_parser("generate-prompt", help="Generate only the prompt without calling the API")
    generate_prompt_parser.add_argument("input_file", help="Input file to analyze (.csv, .xlsx, .zip)")
    generate_prompt_parser.add_argument("output_file", help="Output file path for saving the prompt")
    generate_prompt_parser.add_argument("--instructions", help="File with additional instructions")
    generate_prompt_parser.add_argument("--original-filename", help="Original filename of the uploaded file")

    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate YAML file")
    validate_parser.add_argument("yaml_file", help="Path to YAML file")

    args = parser.parse_args()

    cli = YAMLStudioCLI()

    if args.command == "generate":
        cli.generate_yaml(args.input_file, args.output_file, args.instructions, getattr(args, 'original_filename', None))
    elif args.command == "generate-prompt":
        cli.generate_prompt_only(args.input_file, args.output_file, args.instructions, getattr(args, 'original_filename', None))
    elif args.command == "validate":
        if cli.validator.load_and_validate(args.yaml_file):
            print("✅ YAML válido")
            sys.exit(0)
        sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()