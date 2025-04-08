#!/usr/bin/env python3
"""
Script para eliminar el BOM (Byte Order Mark) de archivos CSV

Este script crea una copia sin BOM de los archivos CSV que tengan el marcador BOM.
"""

import sys
import os
import zipfile
import tempfile
import shutil
from datetime import datetime

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
            # BOM UTF-8: EF BB BF
            return f.read(3) == b'\xef\xbb\xbf'
    except Exception:
        return False

def remove_bom(input_file, output_file):
    """
    Crea una copia del archivo sin el BOM
    
    Args:
        input_file: Ruta al archivo original con BOM
        output_file: Ruta donde guardar la copia sin BOM
        
    Returns:
        bool: True si se eliminó el BOM, False si no tenía BOM o hubo un error
    """
    if not detect_bom(input_file):
        print(f"El archivo {input_file} no tiene BOM")
        if input_file != output_file:
            # Si son archivos diferentes, simplemente copiamos
            shutil.copy2(input_file, output_file)
        return False
    
    try:
        # Abrimos el archivo original en modo binario
        with open(input_file, 'rb') as f_in:
            content = f_in.read()
            # Eliminamos los 3 primeros bytes (BOM)
            content_no_bom = content[3:]
        
        # Guardamos el contenido sin BOM
        with open(output_file, 'wb') as f_out:
            f_out.write(content_no_bom)
        
        print(f"Se eliminó el BOM de {input_file} y se guardó en {output_file}")
        return True
    
    except Exception as e:
        print(f"Error al procesar {input_file}: {str(e)}")
        return False

def process_zip(zip_path, output_zip=None):
    """
    Procesa un archivo ZIP y crea una copia sin BOM de todos los archivos CSV
    
    Args:
        zip_path: Ruta al archivo ZIP original
        output_zip: Ruta donde guardar el ZIP sin BOM. Si es None, se añade "_no_bom" al nombre
        
    Returns:
        str: Ruta al archivo ZIP sin BOM
    """
    if output_zip is None:
        base_name = os.path.splitext(zip_path)[0]
        output_zip = f"{base_name}_no_bom.zip"
    
    # Crear directorios temporales
    temp_dir = tempfile.mkdtemp()
    processed_dir = tempfile.mkdtemp()
    
    try:
        # Extraer los archivos
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # Procesar todos los archivos CSV
        files_processed = 0
        files_with_bom = 0
        
        for root, _, files in os.walk(temp_dir):
            for file in files:
                if file.lower().endswith('.csv'):
                    input_file = os.path.join(root, file)
                    
                    # Ruta relativa para el archivo de salida
                    rel_path = os.path.relpath(input_file, temp_dir)
                    output_file = os.path.join(processed_dir, rel_path)
                    
                    # Crear directorio si no existe
                    os.makedirs(os.path.dirname(output_file), exist_ok=True)
                    
                    # Eliminar BOM
                    has_bom = remove_bom(input_file, output_file)
                    files_processed += 1
                    if has_bom:
                        files_with_bom += 1
                else:
                    # Copiar archivo no CSV
                    input_file = os.path.join(root, file)
                    rel_path = os.path.relpath(input_file, temp_dir)
                    output_file = os.path.join(processed_dir, rel_path)
                    os.makedirs(os.path.dirname(output_file), exist_ok=True)
                    shutil.copy2(input_file, output_file)
        
        # Crear nuevo ZIP
        with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zip_out:
            for root, _, files in os.walk(processed_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, processed_dir)
                    zip_out.write(file_path, arcname)
        
        print(f"\nProcesamiento completado:")
        print(f"- Archivos CSV procesados: {files_processed}")
        print(f"- Archivos con BOM eliminado: {files_with_bom}")
        print(f"- Archivo ZIP sin BOM: {output_zip}")
        
        return output_zip
    
    finally:
        # Limpiar directorios temporales
        shutil.rmtree(temp_dir, ignore_errors=True)
        shutil.rmtree(processed_dir, ignore_errors=True)

def main():
    """Función principal del script"""
    if len(sys.argv) < 2:
        print("Uso:")
        print("  Para procesar un archivo: python eliminar_bom.py <archivo_entrada> [archivo_salida]")
        print("  Para procesar un ZIP: python eliminar_bom.py <archivo_zip> [zip_salida]")
        return 1
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not os.path.exists(input_path):
        print(f"Error: El archivo {input_path} no existe")
        return 1
    
    print("=" * 60)
    print(f"ELIMINADOR DE BOM - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    if input_path.lower().endswith('.zip'):
        process_zip(input_path, output_path)
    else:
        if output_path is None:
            base_name = os.path.splitext(input_path)[0]
            ext = os.path.splitext(input_path)[1]
            output_path = f"{base_name}_no_bom{ext}"
        
        remove_bom(input_path, output_path)
    
    print("=" * 60)
    return 0

if __name__ == "__main__":
    sys.exit(main())