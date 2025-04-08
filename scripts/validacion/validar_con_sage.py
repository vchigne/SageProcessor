#!/usr/bin/env python3
"""
Script de validación completa de archivos para SAGE

Este script valida tanto el YAML como los archivos en el ZIP, verificando:
1. Que el archivo YAML sea válido según la estructura de SAGE
2. Que todos los archivos definidos en el YAML existan en el ZIP
3. Que el número de columnas en cada archivo coincida con la definición en el YAML
"""
import os
import sys
import yaml
import zipfile
import tempfile
from datetime import datetime
import pandas as pd

# Colores ANSI para la salida
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    ERROR = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text):
    """Imprimir un encabezado"""
    print(f"{Colors.HEADER}{Colors.BOLD}{text}{Colors.ENDC}")

def print_info(text):
    """Imprimir información"""
    print(f"{Colors.BLUE}{text}{Colors.ENDC}")

def print_success(text):
    """Imprimir un mensaje de éxito"""
    print(f"{Colors.GREEN}✓ {text}{Colors.ENDC}")

def print_warning(text):
    """Imprimir una advertencia"""
    print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")

def print_error(text):
    """Imprimir un error"""
    print(f"{Colors.ERROR}✘ {text}{Colors.ENDC}")

def load_yaml(yaml_path):
    """
    Cargar y validar un archivo YAML
    
    Args:
        yaml_path: Ruta al archivo YAML
        
    Returns:
        dict: Configuración del YAML
    """
    try:
        with open(yaml_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # Verificar estructura básica del YAML
        if 'sage_yaml' not in config:
            raise ValueError("Falta la sección 'sage_yaml' en el YAML")
        
        if 'catalogs' not in config:
            raise ValueError("Falta la sección 'catalogs' en el YAML")
        
        if 'packages' not in config:
            raise ValueError("Falta la sección 'packages' en el YAML")
        
        # Verificar al menos un paquete
        if not config['packages']:
            raise ValueError("No hay paquetes definidos en el YAML")
        
        return config
        
    except FileNotFoundError:
        print_error(f"No se encontró el archivo YAML: {yaml_path}")
        return None
        
    except yaml.YAMLError as e:
        print_error(f"Error al parsear el YAML: {e}")
        return None
        
    except ValueError as e:
        print_error(f"Error en la estructura del YAML: {e}")
        return None
        
    except Exception as e:
        print_error(f"Error inesperado al cargar el YAML: {e}")
        return None

def validate_yaml_structure(config):
    """
    Validar la estructura del YAML de SAGE
    
    Args:
        config: Configuración del YAML
        
    Returns:
        bool: True si el YAML es válido, False en caso contrario
    """
    errors = []
    
    # Validar sección sage_yaml
    if not isinstance(config.get('sage_yaml', {}), dict):
        errors.append("La sección 'sage_yaml' debe ser un objeto")
    
    # Validar sección catalogs
    catalogs = config.get('catalogs', {})
    if not isinstance(catalogs, dict):
        errors.append("La sección 'catalogs' debe ser un objeto")
    else:
        # Validar cada catálogo
        for catalog_name, catalog in catalogs.items():
            if not isinstance(catalog, dict):
                errors.append(f"El catálogo '{catalog_name}' debe ser un objeto")
                continue
                
            # Verificar campos básicos de cada catálogo
            if 'filename' not in catalog:
                errors.append(f"Falta el campo 'filename' en el catálogo '{catalog_name}'")
            
            if 'file_format' not in catalog:
                errors.append(f"Falta el campo 'file_format' en el catálogo '{catalog_name}'")
            elif not isinstance(catalog['file_format'], dict):
                errors.append(f"El campo 'file_format' en el catálogo '{catalog_name}' debe ser un objeto")
            elif 'type' not in catalog['file_format']:
                errors.append(f"Falta el campo 'type' en 'file_format' del catálogo '{catalog_name}'")
            
            if 'fields' not in catalog:
                errors.append(f"Falta el campo 'fields' en el catálogo '{catalog_name}'")
            elif not isinstance(catalog['fields'], list):
                errors.append(f"El campo 'fields' en el catálogo '{catalog_name}' debe ser una lista")
    
    # Validar sección packages
    packages = config.get('packages', {})
    if not isinstance(packages, dict):
        errors.append("La sección 'packages' debe ser un objeto")
    else:
        # Validar cada paquete
        for package_name, package in packages.items():
            if not isinstance(package, dict):
                errors.append(f"El paquete '{package_name}' debe ser un objeto")
                continue
                
            # Verificar campos básicos de cada paquete
            if 'catalogs' not in package:
                errors.append(f"Falta el campo 'catalogs' en el paquete '{package_name}'")
            elif not isinstance(package['catalogs'], list):
                errors.append(f"El campo 'catalogs' en el paquete '{package_name}' debe ser una lista")
            else:
                # Verificar que cada catálogo referenciado existe
                for catalog_name in package['catalogs']:
                    if catalog_name not in catalogs:
                        errors.append(f"El catálogo '{catalog_name}' referenciado en el paquete '{package_name}' no está definido")
    
    # Mostrar errores
    if errors:
        print_error("Errores en la estructura del YAML:")
        for error in errors:
            print(f"  - {error}")
        return False
    
    return True

def detect_bom(file_path):
    """
    Detectar si un archivo tiene BOM (Byte Order Mark)
    
    Args:
        file_path: Ruta al archivo a comprobar
        
    Returns:
        bool: True si el archivo tiene BOM, False en caso contrario
    """
    try:
        with open(file_path, 'rb') as f:
            # Leer los primeros bytes para detectar BOM
            first_bytes = f.read(3)
            # Verificar si son los bytes del BOM UTF-8
            return first_bytes == b'\xef\xbb\xbf'
    except Exception:
        return False

def validate_files(config, zip_path):
    """
    Validar que todos los archivos definidos en el YAML existen en el ZIP
    y que tienen el número correcto de columnas
    
    Args:
        config: Configuración del YAML
        zip_path: Ruta al archivo ZIP
        
    Returns:
        bool: True si todos los archivos son válidos, False en caso contrario
    """
    if not os.path.exists(zip_path):
        print_error(f"El archivo ZIP no existe: {zip_path}")
        return False
    
    try:
        # Verificar que el archivo ZIP es válido
        with zipfile.ZipFile(zip_path, 'r') as zip_file:
            # Obtener la lista de archivos en el ZIP
            files_in_zip = zip_file.namelist()
            
            # Crear un directorio temporal para extraer archivos
            temp_dir = tempfile.mkdtemp(prefix="sage_validate_")
            
            # Obtener el primer paquete
            first_package_name = next(iter(config['packages']))
            first_package = config['packages'][first_package_name]
            
            print_info(f"Verificando paquete: {first_package_name}")
            
            error_count = 0
            catalog_count = 0
            
            # Validar cada catálogo en el paquete
            for catalog_name in first_package['catalogs']:
                catalog_count += 1
                catalog = config['catalogs'][catalog_name]
                filename = catalog['filename']
                
                print_info(f"Verificando catálogo: {catalog_name} (archivo: {filename})")
                
                # Verificar si el archivo existe en el ZIP
                if filename not in files_in_zip:
                    print_error(f"El archivo '{filename}' no existe en el ZIP")
                    error_count += 1
                    continue
                
                # Extraer el archivo para verificarlo
                file_path = os.path.join(temp_dir, filename)
                zip_file.extract(filename, temp_dir)
                
                # Determinar los parámetros de lectura según el tipo de archivo
                file_format = catalog['file_format']
                file_type = file_format['type'].lower()
                expected_columns = len(catalog['fields'])
                
                # Verificar el número de columnas
                if file_type == 'csv':
                    # Verificar si el archivo tiene BOM
                    has_bom = detect_bom(file_path)
                    if has_bom:
                        print_info(f"  El archivo tiene BOM (Byte Order Mark)")
                    
                    # Configurar parámetros para CSV
                    delimiter = file_format.get('delimiter', ',')
                    header = 0 if file_format.get('header', False) else None
                    encoding = 'utf-8-sig'  # Manejar BOM automáticamente
                    
                    try:
                        # Leer solo las primeras filas para validar la estructura
                        df_sample = pd.read_csv(file_path, delimiter=delimiter, encoding=encoding, 
                                               header=header, nrows=5)
                        
                        # Verificar el número de columnas
                        actual_columns = len(df_sample.columns)
                        if actual_columns != expected_columns:
                            print_error(f"Error de estructura en el archivo {filename}: "
                                      f"El archivo tiene {actual_columns} columnas pero la definición YAML "
                                      f"tiene {expected_columns} campos.")
                            error_count += 1
                        else:
                            print_success(f"El número de columnas es correcto: {actual_columns}")
                            
                    except Exception as e:
                        print_error(f"Error al leer el archivo CSV {filename}: {str(e)}")
                        error_count += 1
                        
                elif file_type == 'excel':
                    # Configurar parámetros para Excel
                    header = 0 if file_format.get('header', False) else None
                    
                    try:
                        # Leer solo las primeras filas para validar la estructura
                        df_sample = pd.read_excel(file_path, header=header, nrows=5)
                        
                        # Verificar el número de columnas
                        actual_columns = len(df_sample.columns)
                        if actual_columns != expected_columns:
                            print_error(f"Error de estructura en el archivo {filename}: "
                                      f"El archivo tiene {actual_columns} columnas pero la definición YAML "
                                      f"tiene {expected_columns} campos.")
                            error_count += 1
                        else:
                            print_success(f"El número de columnas es correcto: {actual_columns}")
                            
                    except Exception as e:
                        print_error(f"Error al leer el archivo Excel {filename}: {str(e)}")
                        error_count += 1
                else:
                    print_error(f"Tipo de archivo no soportado: {file_type}")
                    error_count += 1
            
            # Limpiar directorio temporal
            import shutil
            shutil.rmtree(temp_dir)
            
            # Mostrar resumen
            print("")
            print_info("Resumen de la validación:")
            print(f"  Catálogos revisados: {catalog_count}")
            print(f"  Errores encontrados: {error_count}")
            
            if error_count > 0:
                print_error("La validación ha fallado")
                return False
            else:
                print_success("La validación ha sido exitosa")
                return True
                
    except zipfile.BadZipFile:
        print_error(f"El archivo ZIP no es válido: {zip_path}")
        return False
        
    except Exception as e:
        print_error(f"Error al validar los archivos: {str(e)}")
        return False

def validate(yaml_path, zip_path):
    """
    Validar un archivo YAML y los archivos en el ZIP
    
    Args:
        yaml_path: Ruta al archivo YAML
        zip_path: Ruta al archivo ZIP
        
    Returns:
        bool: True si la validación es exitosa, False en caso contrario
    """
    print_header("VALIDACIÓN DE SAGE")
    print_info(f"Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print_info(f"Archivo YAML: {yaml_path}")
    print_info(f"Archivo ZIP: {zip_path}")
    print("")
    
    # Cargar y validar el YAML
    print_header("1. VALIDACIÓN DEL YAML")
    config = load_yaml(yaml_path)
    if config is None:
        return False
    
    # Validar la estructura del YAML
    yaml_valid = validate_yaml_structure(config)
    if not yaml_valid:
        return False
    
    print_success("El archivo YAML es válido")
    print("")
    
    # Validar los archivos
    print_header("2. VALIDACIÓN DE LOS ARCHIVOS")
    files_valid = validate_files(config, zip_path)
    
    # Resultado final
    print("")
    print_header("RESULTADO FINAL")
    if yaml_valid and files_valid:
        print_success("La validación ha sido exitosa")
        return True
    else:
        print_error("La validación ha fallado")
        return False

def main():
    """Función principal"""
    if len(sys.argv) < 3:
        print("Uso: python validar_con_sage.py <archivo_yaml> <archivo_zip>")
        sys.exit(1)
    
    yaml_path = sys.argv[1]
    zip_path = sys.argv[2]
    
    success = validate(yaml_path, zip_path)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()