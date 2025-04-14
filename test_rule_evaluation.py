"""
Script para probar la evaluación de reglas YAML en SAGE

Este script implementa una versión simplificada del evaluador de reglas
para entender el comportamiento del error 'Error evaluating catalog rule validar_num_columnas: -2'
"""

import pandas as pd
import numpy as np
import traceback
import os

def test_yaml_rule_evaluation():
    """Prueba específica para evaluar reglas de catálogo"""
    
    # Crear un DataFrame de prueba con 22 columnas
    columns = [f"col_{i}" for i in range(22)]
    data = {col: [1, 2, 3] for col in columns}
    df_22 = pd.DataFrame(data)
    
    # Crear un DataFrame de prueba con 24 columnas
    columns = [f"col_{i}" for i in range(24)]
    data = {col: [1, 2, 3] for col in columns}
    df_24 = pd.DataFrame(data)
    
    # Evaluar la regla con distintos DataFrames
    rules_to_test = [
        "len(df.columns) == 24",
        "len(df.columns) - 24",
        "len(df.columns) - 24 == 0"
    ]
    
    print("\n=== PRUEBA DE EVALUACIÓN DE REGLAS ===")
    print("Evaluando diferentes reglas con DataFrames de 22 y 24 columnas")
    
    for rule in rules_to_test:
        print(f"\nRegla: {rule}")
        
        # Evaluación con DataFrame de 22 columnas
        try:
            print(f"  - DataFrame con 22 columnas:")
            eval_globals = {
                'df': df_22,
                'np': np,
                'pd': pd,
                'str': str
            }
            result = eval(rule, eval_globals, {})
            print(f"    Resultado: {result}")
            if isinstance(result, (int, float)):
                print(f"    Es un valor numérico: {result}")
            if isinstance(result, bool):
                print(f"    Es un valor booleano: {result}")
        except Exception as e:
            print(f"    Error: {str(e)}")
        
        # Evaluación con DataFrame de 24 columnas
        try:
            print(f"  - DataFrame con 24 columnas:")
            eval_globals = {
                'df': df_24,
                'np': np,
                'pd': pd,
                'str': str
            }
            result = eval(rule, eval_globals, {})
            print(f"    Resultado: {result}")
            if isinstance(result, (int, float)):
                print(f"    Es un valor numérico: {result}")
            if isinstance(result, bool):
                print(f"    Es un valor booleano: {result}")
        except Exception as e:
            print(f"    Error: {str(e)}")

def test_rule_exceptions():
    """Prueba específica para capturar excepciones en la evaluación de reglas"""
    
    # Crear un DataFrame de prueba con 22 columnas
    columns = [f"col_{i}" for i in range(22)]
    data = {col: [1, 2, 3] for col in columns}
    df = pd.DataFrame(data)
    
    # Regla que causará el error
    rule = "len(df.columns) - 24"
    
    print("\n=== PRUEBA DE CAPTURA DE EXCEPCIONES ===")
    
    try:
        eval_globals = {
            'df': df,
            'np': np,
            'pd': pd,
            'str': str
        }
        result = eval(rule, eval_globals, {})
        print(f"Resultado exitoso: {result}")
        
        # Simular lógica del procesador de archivos
        if not isinstance(result, bool):
            print(f"ADVERTENCIA: La regla '{rule}' evalúa a un valor no booleano: {result}")
            # Convertir a booleano si es posible
            boolean_result = bool(result)
            print(f"Convertido a booleano: {boolean_result}")
            
            # Calcular filas inválidas
            invalid_rows = df[~boolean_result] if boolean_result is True else df
            print(f"Filas inválidas: {len(invalid_rows)}")
        else:
            print(f"La regla evalúa a un valor booleano: {result}")
            # Calcular filas inválidas
            invalid_rows = df[~result]
            print(f"Filas inválidas: {len(invalid_rows)}")
    except Exception as e:
        print(f"Error capturado: {str(e)}")
        print(f"Tipo de error: {type(e).__name__}")
        traceback.print_exc()

def test_exception_handling():
    """Test para ver cómo se comporta la captura de excepciones con los errores de reglas"""
    
    print("\n=== PRUEBA DE MANEJO DE EXCEPCIONES ===")
    
    try:
        # Este es un error matemático común
        result = 1/0
    except Exception as e:
        print(f"1/0 Error: {str(e)}")
    
    try:
        # Otro error común
        result = "abc" + 123
    except Exception as e:
        print(f"'abc' + 123 Error: {str(e)}")
    
    try:
        # Un error que incluye un número negativo
        result = int("abc")
    except Exception as e:
        print(f"int('abc') Error: {str(e)}")
    
    # Prueba específica de resta entre longitud y valor esperado
    try:
        eval_result = eval("22 - 24")
        print(f"Evaluación de '22 - 24': {eval_result}")
        raise Exception(f"Error evaluating rule validar_num_columnas: {eval_result}")
    except Exception as e:
        print(f"Excepción con resta negativa en mensaje: {str(e)}")
        
if __name__ == "__main__":
    test_yaml_rule_evaluation()
    test_rule_exceptions()
    test_exception_handling()