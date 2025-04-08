#!/usr/bin/env python3
"""
Script para ejecutar SAGE con soporte para BOM en archivos CSV y nombres de columnas correctos
"""

import sys
import os
from datetime import datetime
from sage.main import process_files
from sage.file_processor import FileProcessor
import pandas as pd

def create_column_names(n_columns):
    """Crear nombres de columnas en formato COLUMNA_N"""
    return [f"COLUMNA_{i+1}" for i in range(n_columns)]

def patched_read_file(self, file_path, catalog):
    """Versión parcheada del método _read_file con soporte para BOM y nombres de columnas"""
    file_type = self._get_file_type(file_path)
    if not file_type:
        raise Exception(
            f"Formato de archivo no soportado: {os.path.splitext(file_path)[1]}. "
            f"Los formatos soportados son: CSV (.csv) y Excel (.xlsx, .xls)"
        )

    # Verificar que el tipo de archivo coincida con la configuración
    if file_type != catalog.file_format.type:
        raise Exception(
            f"El tipo de archivo {file_type} ({os.path.basename(file_path)}) "
            f"no coincide con la configuración del catálogo que espera {catalog.file_format.type}"
        )

    try:
        if file_type == 'CSV':
            # Detectar si el archivo tiene BOM
            has_bom = False
            with open(file_path, 'rb') as f:
                has_bom = f.read(3) == b'\xef\xbb\xbf'
            
            # Si tiene BOM, usar utf-8-sig, si no, intentar con encoding normal
            encoding = 'utf-8-sig' if has_bom else 'utf-8'
            
            # Para archivos sin encabezado, crear nombres de columnas personalizados
            if not catalog.file_format.header:
                # Primero determinar el número de columnas
                try:
                    df_temp = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                        header=None, encoding=encoding, nrows=1)
                except UnicodeDecodeError:
                    # Si falla, intentar con latin1
                    df_temp = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                        header=None, encoding='latin1', nrows=1)
                    encoding = 'latin1'
                
                n_columns = len(df_temp.columns)
                
                # Crear los nombres de columnas
                column_names = create_column_names(n_columns)
                print(f"Usando nombres de columnas: {column_names}")
                
                # Cargar el CSV completo con los nombres de columnas personalizados
                try:
                    df = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                    header=None, encoding=encoding, names=column_names)
                except UnicodeDecodeError:
                    # Si falla, intentar con latin1
                    df = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                    header=None, encoding='latin1', names=column_names)
            else:
                # Con encabezado, usar el método estándar
                try:
                    df = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                    header=0, encoding=encoding)
                except UnicodeDecodeError:
                    # Si falla, intentar con latin1
                    df = pd.read_csv(file_path, delimiter=catalog.file_format.delimiter, 
                                    header=0, encoding='latin1')
        
        elif file_type == 'EXCEL':
            df = pd.read_excel(file_path, header=0 if catalog.file_format.header else None, 
                              engine='openpyxl')
            
            # Si no tiene encabezado, crear nombres de columnas personalizados
            if not catalog.file_format.header:
                n_columns = len(df.columns)
                column_names = create_column_names(n_columns)
                df.columns = column_names

        # Adaptación del dataframe al esquema del catálogo
        # Obtener los nombres de campos definidos en el YAML
        yaml_field_names = [field.name for field in catalog.fields]
        
        # Verificar si hay más columnas en el CSV que en el YAML
        if len(df.columns) > len(yaml_field_names):
            # Seleccionar sólo las columnas que necesitamos según el YAML
            if not catalog.file_format.header:
                # Para archivos sin encabezado, seleccionar las primeras N columnas
                df = df.iloc[:, :len(yaml_field_names)]
                # Renombrar las columnas según los nombres del YAML
                df.columns = yaml_field_names
            else:
                # Si tiene encabezado, seleccionar las columnas por los nombres del YAML que existan
                # y descartar las demás
                existing_fields = [field for field in yaml_field_names if field in df.columns]
                df = df[existing_fields]
        
        # Si hay menos columnas en el CSV que en el YAML, añadimos las faltantes con valores null
        if len(df.columns) < len(yaml_field_names):
            for field_name in yaml_field_names:
                if field_name not in df.columns:
                    df[field_name] = None

        # Si el archivo no tiene encabezado, renombrar las columnas con los nombres definidos en el YAML
        if not catalog.file_format.header:
            # Asegurarnos de que tengamos la misma cantidad de columnas
            if len(df.columns) == len(yaml_field_names):
                df.columns = yaml_field_names

        # Validar y convertir tipos de datos
        df = self._validate_data_types(df, catalog)
        return df

    except Exception as e:
        raise Exception(
            f"Error al leer el archivo {os.path.basename(file_path)}: {str(e)}\n"
            "Asegúrate de que el archivo tenga el formato correcto y no esté dañado."
        )

def apply_patched_read_file():
    """Aplica el parche al método _read_file"""
    original_read_file = FileProcessor._read_file
    FileProcessor._read_file = patched_read_file
    return original_read_file

def main():
    """
    Función principal que ejecuta SAGE con soporte para BOM y nombres de columnas
    """
    # Verificar argumentos
    if len(sys.argv) != 3:
        print("Uso: python sage_names_patch.py <archivo_yaml> <archivo_zip>")
        sys.exit(1)
    
    yaml_path = sys.argv[1]
    zip_path = sys.argv[2]
    
    # Verificar que los archivos existen
    if not os.path.exists(yaml_path):
        print(f"Error: El archivo YAML no existe: {yaml_path}")
        sys.exit(1)
    
    if not os.path.exists(zip_path):
        print(f"Error: El archivo ZIP no existe: {zip_path}")
        sys.exit(1)
    
    print("="*60)
    print("SAGE CON SOPORTE PARA BOM Y NOMBRES DE COLUMNAS")
    print("="*60)
    print(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Archivo YAML: {yaml_path}")
    print(f"Archivo de datos: {zip_path}")
    print("-"*60)
    
    # Aplicar el parche para manejar BOM y nombres de columnas
    print("Aplicando parche para soporte de BOM y nombres de columnas...")
    original_read_file = apply_patched_read_file()
    
    try:
        # Ejecutar SAGE con el parche aplicado
        print("Iniciando procesamiento...")
        exit_code = process_files(yaml_path, zip_path)
        
        print("\n" + "="*60)
        print(f"Procesamiento finalizado con código de salida: {exit_code}")
        print("="*60)
        
        return exit_code
    
    finally:
        # Restaurar el método original (para limpieza)
        FileProcessor._read_file = original_read_file
        print("Parche desactivado, sistema restaurado")

if __name__ == "__main__":
    exit_code = main()
    sys.exit(1 if isinstance(exit_code, tuple) else exit_code)