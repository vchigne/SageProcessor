#!/usr/bin/env python3
"""
Script para corregir el problema en file_processor.py donde len(df.columns) == 5 está dando -2
"""
import os
import re

# Ruta al archivo file_processor.py
file_path = "/home/runner/workspace/sage/file_processor.py"

# Leer el archivo original
with open(file_path, 'r') as f:
    content = f.read()

# Patrón a buscar: resultado de la evaluación de reglas sin verificación de tipo
pattern = r'result = eval\(rule\.rule, eval_globals, \{\}\)'

# Reemplazo que incluye verificación de tipo y manejo especial para reglas de columnas
replacement = '''# Para reglas de validación de columnas, verificamos especialmente
                    if rule.name == "validar_num_columnas" or "columnas" in rule.name.lower():
                        cols_count = len(df.columns)
                        # Extraer el número esperado de columnas si la regla usa '=='
                        if "==" in rule.rule:
                            try:
                                expected_cols = int(rule.rule.split("==")[1].strip())
                                self.logger.message(f"DIAGNÓSTICO - Validando columnas. Reales: {cols_count}, Esperadas: {expected_cols}")
                                result = cols_count == expected_cols
                            except:
                                # Si no podemos extraer el número, evaluamos normalmente
                                result = eval(rule.rule, eval_globals, {})
                        else:
                            result = eval(rule.rule, eval_globals, {})
                    else:
                        result = eval(rule.rule, eval_globals, {})
                    
                    # Asegurarnos de que el resultado sea booleano para evitar problemas con ~result
                    if not isinstance(result, bool):
                        self.logger.warning(f"DIAGNÓSTICO - Resultado no booleano en regla '{rule.name}': {result} (tipo: {type(result).__name__})")
                        # Si es un número, lo convertimos a booleano adecuadamente
                        if isinstance(result, (int, float)):
                            result = bool(result)'''

# Reemplazar la primera ocurrencia
new_content = re.sub(pattern, replacement, content, count=1)

# Guardar el archivo modificado
with open(file_path, 'w') as f:
    f.write(new_content)

print(f"Archivo {file_path} actualizado correctamente.")