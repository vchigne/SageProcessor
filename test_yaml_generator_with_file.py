"""
Script para probar la generación del prompt YAML con instrucciones desde archivo

Este script prueba la extracción de ejemplos (5 primeras líneas, 5 del medio y 5 finales)
y la generación del formato JSON para el prompt, usando instrucciones desde un archivo específico.
"""
import os
import sys
from sage.yaml_generator import YAMLGenerator

def test_prompt_generation_with_file(instruction_file="Archivos en el Proyecto de BI CLORO.txt"):
    """
    Probar la generación del prompt usando un archivo de instrucciones específico
    
    Args:
        instruction_file: Archivo con las instrucciones a utilizar
    """
    # Verificar que el archivo exista
    if not os.path.exists(instruction_file):
        print(f"Error: El archivo de instrucciones {instruction_file} no se encontró.")
        sys.exit(1)
    
    # Crear una instancia del generador
    generator = YAMLGenerator()
    
    # Ruta al archivo ZIP a analizar
    input_file = "executions/3b0db2c1-87c3-48de-a57e-32945a82c1ba/data.zip"
    
    # Obtener instrucciones del archivo a través de la función de YAMLGenerator
    instructions = generator.get_instructions(instruction_file)
    
    # Analizar la estructura del archivo
    file_info = generator.analyze_file_structure(input_file)
    
    # Cargar especificaciones
    yaml_spec = generator.load_yaml_spec()
    
    # Generar el prompt
    prompt = generator.generate_prompt(file_info, instructions, yaml_spec)
    
    # Guardar el prompt generado en un archivo temporal para revisión
    os.makedirs('tmp', exist_ok=True)
    with open('tmp/prompt_with_file.txt', 'w', encoding='utf-8') as f:
        f.write(prompt)
    
    print(f"Prompt generado y guardado en: {os.path.abspath('tmp/prompt_with_file.txt')}")
    print("Verifica que el prompt incluye las instrucciones del archivo específico")
    print("Y que los datos están en formato de arrays individuales JSON")

if __name__ == "__main__":
    # Si se proporciona un argumento, usarlo como archivo de instrucciones
    if len(sys.argv) > 1:
        test_prompt_generation_with_file(sys.argv[1])
    else:
        test_prompt_generation_with_file()