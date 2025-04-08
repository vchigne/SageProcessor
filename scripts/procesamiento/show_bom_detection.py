"""
Script para demostrar la detección automática de BOM en archivos CSV
"""
import os
import yaml
import pandas as pd

def detect_bom(file_path):
    """
    Detecta si un archivo tiene BOM (Byte Order Mark)
    
    Args:
        file_path: Ruta al archivo a comprobar
        
    Returns:
        bool: True si el archivo tiene BOM, False en caso contrario
    """
    try:
        with open(file_path, 'rb') as f:
            # Leer los primeros bytes para verificar BOM de UTF-8
            bom = f.read(3)
            return bom == b'\xef\xbb\xbf'
    except Exception as e:
        print(f"Error al verificar BOM: {str(e)}")
        return False

def patched_read_csv(file_path, **kwargs):
    """
    Versión mejorada de read_csv con detección automática de BOM
    
    Args:
        file_path: Ruta al archivo CSV
        **kwargs: Argumentos adicionales para pd.read_csv
        
    Returns:
        pd.DataFrame: DataFrame con los datos del CSV
    """
    # Detectar si el archivo tiene BOM
    has_bom = detect_bom(file_path)
    
    # Si tiene BOM, usar utf-8-sig como codificación
    if has_bom:
        print(f"BOM detectado en {file_path}, usando codificación 'utf-8-sig'")
        kwargs['encoding'] = 'utf-8-sig'
    else:
        print(f"No se detectó BOM en {file_path}, usando codificación predeterminada")
    
    # Leer el archivo con pandas
    return pd.read_csv(file_path, **kwargs)

def main():
    """Función principal para demostrar la detección automática de BOM"""
    print("=== Demostración de detección automática de BOM ===")
    
    # Mostrar el YAML corregido sin la propiedad encoding
    print("\n=== YAML de ejemplo sin la propiedad encoding ===")
    with open("example_bom_support_corrected.yaml", "r", encoding="utf-8") as f:
        yaml_content = f.read()
        print(yaml_content)
    
    # Explicar cómo funciona la detección automática
    print("\n=== Cómo funciona la detección automática de BOM ===")
    print("1. Cuando se lee un archivo CSV, se verifica si tiene BOM")
    print("2. Si el archivo tiene BOM, se usa la codificación 'utf-8-sig'")
    print("3. Si no tiene BOM, se usa la codificación predeterminada")
    print("4. No es necesario especificar la codificación en el YAML")
    print("5. La detección es transparente para el usuario")
    
    print("\n=== Ejemplo de detección automática (simulado) ===")
    print("Para el archivo 'clientes.csv' con BOM:")
    print("  BOM detectado, usando codificación 'utf-8-sig'")
    print("  DataFrame cargado correctamente con 15 filas y 10 columnas")
    
    print("\nPara el archivo 'productos.csv' sin BOM:")
    print("  No se detectó BOM, usando codificación predeterminada")
    print("  DataFrame cargado correctamente con 8 filas y 5 columnas")
    
    print("\n=== Ventajas de la detección automática ===")
    print("1. Transparencia: el usuario no necesita preocuparse por la codificación")
    print("2. Robustez: funciona con cualquier archivo, tenga BOM o no")
    print("3. Simplicidad: no requiere configuración adicional en el YAML")
    print("4. Compatibilidad: funciona con archivos existentes sin modificarlos")
    
    print("\n=== Implementación en SAGE ===")
    print("Para implementar esta solución en SAGE, se reemplaza la función pd.read_csv")
    print("con una versión parcheada que detecta automáticamente el BOM:")
    print("""
def patched_read_csv(filepath_or_buffer, **kwargs):
    # Si es un archivo, intentar detectar BOM
    if isinstance(filepath_or_buffer, str) and os.path.isfile(filepath_or_buffer):
        if detect_bom(filepath_or_buffer):
            # Si tiene BOM, usar utf-8-sig
            kwargs['encoding'] = 'utf-8-sig'
    
    # Llamar a la función original con los parámetros actualizados
    return original_read_csv(filepath_or_buffer, **kwargs)
    """)

if __name__ == "__main__":
    main()