"""
Parche para mejorar el manejo de valores NaN en campos numéricos de SAGE

Este módulo implementa un parche que se aplica al FileProcessor
para manejar correctamente valores NaN y vacíos en campos que requieren
ser valores numéricos (enteros o decimales).

Mejoras principales:
1. Detección y manejo de "nan" como texto (que genera pandas al leer Excel/CSV)
2. Mejor conversión de tipos para valores opcionales
3. Soporte para campos enteros opcionales que pueden estar vacíos
"""
import pandas as pd
import numpy as np
from typing import Any, Dict, List, Optional, Union, Callable

def _evaluate_rule_robust(self, rule_str: str, row_data: Dict[str, Any], row_index: int) -> bool:
    """
    Función mejorada para evaluar reglas con mejor manejo de valores NaN
    
    Args:
        rule_str: String con la regla a evaluar
        row_data: Datos de la fila
        row_index: Índice de la fila
        
    Returns:
        bool: Resultado de la evaluación
    """
    try:
        # Crear un DataFrame de una sola fila para la evaluación
        df = pd.DataFrame([row_data])
        
        # Reemplazar NaN con valores adecuados según el contexto
        # Para campos de tipo texto, NaN -> cadena vacía
        # Para campos numéricos, NaN -> None (que luego será manejado en la regla)
        for col in df.columns:
            if col in self.fields:
                field_type = self.fields[col].type.lower()
                if pd.isna(df.loc[0, col]) or df.loc[0, col] == 'nan':
                    if field_type in ['entero', 'decimal', 'numero']:
                        df.loc[0, col] = None
                    else:
                        df.loc[0, col] = ''
        
        # Evaluar la regla
        result = eval(rule_str)
        return bool(result)
    except Exception as e:
        error_msg = f"Error evaluando regla {rule_str}: {str(e)}"
        self.logger.error(error_msg)
        return False

def apply_nan_handling_patch():
    """
    Aplica el parche de manejo de NaN a FileProcessor
    
    Returns:
        Callable: La función original _evaluate_rule para poder restaurarla
    """
    from sage.file_processor import FileProcessor
    
    # Guardar la función original para poder restaurarla
    original_evaluate_rule = FileProcessor._evaluate_rule
    
    # Reemplazar con nuestra versión mejorada
    FileProcessor._evaluate_rule = _evaluate_rule_robust
    
    # Devolver la función original para poder restaurarla
    return original_evaluate_rule

def remove_nan_handling_patch(original_func):
    """
    Elimina el parche y restaura la función original
    
    Args:
        original_func: La función original guardada
    """
    from sage.file_processor import FileProcessor
    
    # Restaurar la función original
    FileProcessor._evaluate_rule = original_func