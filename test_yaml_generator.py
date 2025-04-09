"""
Script para probar la generación del prompt YAML mejorado

Este script prueba la extracción de ejemplos (5 primeras líneas, 5 del medio y 5 finales)
y la generación del formato JSON para el prompt.
"""
import os
import sys
from sage.yaml_generator import YAMLGenerator

def test_prompt_generation():
    """Probar la generación del prompt mejorado"""
    # Crear una instancia del generador
    generator = YAMLGenerator()
    
    # Ruta al archivo ZIP a analizar
    input_file = "executions/3b0db2c1-87c3-48de-a57e-32945a82c1ba/data.zip"
    
    # Instrucciones básicas de ejemplo
    instructions = """
    Genera un YAML para validar los archivos de productos, clientes y ventas. 
    Asegúrate de que los códigos sean únicos y que las cantidades sean mayores a cero.
    """
    
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
    test_prompt_generation()