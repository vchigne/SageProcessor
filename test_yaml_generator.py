"""
Script para probar la generación del prompt YAML mejorado

Este script prueba la extracción de ejemplos (5 primeras líneas, 5 del medio y 5 finales)
y la generación del formato JSON para el prompt.
"""
import os
import sys
from sage.yaml_generator import YAMLGenerator

def test_prompt_generation(input_file=None, instruction_source=None):
    """
    Probar la generación del prompt mejorado
    
    Args:
        input_file: Ruta al archivo a analizar (default: data.zip en executions)
        instruction_source: Puede ser un archivo o texto directo con instrucciones
    """
    # Crear una instancia del generador
    generator = YAMLGenerator()
    
    # Ruta al archivo ZIP a analizar (usar el valor por defecto si no se proporciona)
    if input_file is None:
        input_file = "executions/3b0db2c1-87c3-48de-a57e-32945a82c1ba/data.zip"
    
    # Determinar instrucciones a usar
    if instruction_source:
        # Si instruction_source es un archivo existente, leer su contenido
        if os.path.exists(instruction_source):
            print(f"Usando archivo de instrucciones: {instruction_source}")
            # Leer directamente el contenido del archivo para asegurar que se envía completo
            with open(instruction_source, 'r', encoding='utf-8') as f:
                instructions = f.read()
            print(f"✓ Instrucciones cargadas: {len(instructions)} caracteres")
        else:
            # Si no es un archivo, asumir que es texto de instrucciones directas
            print("Usando instrucciones proporcionadas directamente como texto")
            instructions = instruction_source
    else:
        # Usar instrucciones predeterminadas
        print("Usando instrucciones predeterminadas del generador")
        instructions = generator.get_instructions()
    
    # Analizar la estructura del archivo
    file_info = generator.analyze_file_structure(input_file)
    
    # Cargar especificaciones
    yaml_spec = generator.load_yaml_spec()
    
    # Generar el prompt
    prompt = generator.generate_prompt(file_info, instructions, yaml_spec)
    
    # Guardar el prompt generado en un archivo temporal para revisión
    os.makedirs('tmp', exist_ok=True)
    with open('tmp/test_prompt.txt', 'w', encoding='utf-8') as f:
        f.write(prompt)
    
    print(f"Prompt generado y guardado en: {os.path.abspath('tmp/test_prompt.txt')}")
    print("Verifica que el prompt incluye 5 primeras líneas, 5 del medio y 5 finales de cada archivo")
    print("Y que incluye los datos en formato JSON")

if __name__ == "__main__":
    # Procesar argumentos de línea de comandos
    import argparse
    
    parser = argparse.ArgumentParser(description='Probar la generación de YAML con diferentes instrucciones')
    parser.add_argument('-i', '--input', help='Archivo de entrada a analizar (ZIP, CSV, etc.)')
    parser.add_argument('-is', '--instruction-source', help='Archivo o texto con instrucciones')
    
    args = parser.parse_args()
    
    # Llamar a la función con los argumentos proporcionados
    test_prompt_generation(
        input_file=args.input,
        instruction_source=args.instruction_source
    )