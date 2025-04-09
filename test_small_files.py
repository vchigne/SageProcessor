"""
Script para probar la lógica de extracción de ejemplos en archivos pequeños

Este script verifica que la lógica de extracción de muestras funcione correctamente
para archivos con pocas líneas (menos de 15).
"""
import os
import sys
import json
from sage.yaml_generator import YAMLGenerator

def create_test_csv(filename, num_lines):
    """Crear un archivo CSV de prueba con un número determinado de líneas"""
    os.makedirs('tmp', exist_ok=True)
    filepath = os.path.join('tmp', filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        # Escribir líneas de ejemplo con formato CSV usando pipe como delimitador
        for i in range(1, num_lines + 1):
            f.write(f"10001|C00001|{i:08d}|Producto {i}|Categoría {i}|{i*10}.50|{i*5}|1|2025-04-09\n")
    
    return filepath

def test_small_file_extraction(num_lines=5):
    """Probar la extracción de ejemplos en un archivo pequeño"""
    # Crear archivo de prueba
    test_filename = f"test_small_{num_lines}.csv"
    filepath = create_test_csv(test_filename, num_lines)
    
    # Crear una instancia del generador
    generator = YAMLGenerator()
    
    # Analizar la estructura del archivo
    file_info = generator.analyze_file_structure(filepath)
    
    # Instrucciones básicas
    instructions = "Genera un YAML para validar este archivo pequeño."
    
    # Cargar especificaciones
    yaml_spec = generator.load_yaml_spec()
    
    # Generar el prompt
    prompt = generator.generate_prompt(file_info, instructions, yaml_spec)
    
    # Guardar el prompt generado
    prompt_filepath = os.path.join('tmp', f'prompt_small_{num_lines}.txt')
    with open(prompt_filepath, 'w', encoding='utf-8') as f:
        f.write(prompt)
    
    # Extraer y verificar la parte JSON del prompt
    start_marker = "Datos en formato JSON:"
    json_start = prompt.find(start_marker) + len(start_marker)
    
    # Buscar el final del JSON - será el siguiente encabezado que empiece con "==="
    end_marker = "==="
    end_pos = prompt.find(end_marker, json_start)
    if end_pos == -1:
        # Si no hay marcador de fin, tomamos hasta el final del texto
        json_text = prompt[json_start:].strip()
    else:
        # Si encontramos un marcador, extraemos hasta ahí
        json_text = prompt[json_start:end_pos].strip()
    
    # Vamos a imprimir los primeros caracteres para depuración
    print(f"Primeros caracteres del JSON: {json_text[:50]}")
    
    # Si comienza con salto de línea (común en los templates), ajustamos
    if json_text.startswith("\n"):
        json_text = json_text[1:].strip()
    
    # Para depuración, guardar el JSON extraído
    with open(os.path.join('tmp', f'extracted_json_{num_lines}.json'), 'w', encoding='utf-8') as f:
        f.write(json_text)
    
    try:
        json_data = json.loads(json_text)
        
        # Extraer las muestras del primer archivo (solo hay uno en nuestro caso)
        archivo_id = list(json_data["archivos"].keys())[0]
        muestras = json_data["archivos"][archivo_id]
        
        # Verificar la distribución de líneas
        print(f"\nArchivo con {num_lines} líneas:")
        print(f"Primeras líneas: {len(muestras['primeras_lineas'])}")
        print(f"Líneas del medio: {len(muestras['lineas_del_medio'])}")
        print(f"Últimas líneas: {len(muestras['ultimas_lineas'])}")
        
        # Mostrar las líneas
        print("\nPrimeras líneas:")
        for line in muestras['primeras_lineas']:
            print(f"  {line}")
        
        print("\nLíneas del medio:")
        for line in muestras['lineas_del_medio']:
            print(f"  {line}")
        
        print("\nÚltimas líneas:")
        for line in muestras['ultimas_lineas']:
            print(f"  {line}")
        
        # Verificar líneas totales en todas las secciones
        total_lineas = (
            len(muestras['primeras_lineas']) + 
            len(muestras['lineas_del_medio']) + 
            len(muestras['ultimas_lineas'])
        )
        
        # Para archivos pequeños, verificar que se repiten adecuadamente
        if num_lines <= 5:
            # Se espera que cada línea original aparezca en las tres secciones
            expected_total = num_lines * 3
            print(f"\nNúmero total de líneas en muestras: {total_lineas}")
            print(f"Número esperado (al repetir líneas): {expected_total}")
            assert total_lineas == expected_total, f"Esperaba {expected_total} líneas en total, pero hay {total_lineas}"
        
        # Verificar si se está siguiendo la lógica correcta
        if num_lines <= 5:
            # Para 5 o menos líneas, todas deben estar en primeras, medias y últimas
            assert len(muestras['primeras_lineas']) == num_lines
            assert len(muestras['lineas_del_medio']) == num_lines
            assert len(muestras['ultimas_lineas']) == num_lines
        
        print(f"\nPrompt guardado en: {os.path.abspath(prompt_filepath)}")
        
    except json.JSONDecodeError:
        print(f"Error al decodificar JSON del prompt: {json_text[:100]}...")
    except Exception as e:
        print(f"Error al analizar datos: {str(e)}")

def run_tests():
    """Ejecutar pruebas con diferentes tamaños de archivo"""
    print("=== Pruebas de extracción para archivos pequeños ===")
    
    for size in [3, 5, 8, 12, 15]:
        test_small_file_extraction(size)
        print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    run_tests()