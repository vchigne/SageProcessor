#!/usr/bin/env python3
"""
Script para analizar la estructura de un archivo YAML de SAGE
y verificar que coincida con la estructura de los archivos CSV
"""

import sys
import os
import yaml
import zipfile
import tempfile
import pandas as pd
from csv import reader

def cargar_yaml(yaml_path):
    """Cargar y validar un archivo YAML de SAGE"""
    try:
        with open(yaml_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # Validar que tenga las secciones requeridas
        if not config.get('sage_yaml'):
            print("Error: El archivo YAML no tiene la sección 'sage_yaml'")
            return None
        
        if not config.get('catalogs'):
            print("Error: El archivo YAML no tiene la sección 'catalogs'")
            return None
        
        if not config.get('packages'):
            print("Error: El archivo YAML no tiene la sección 'packages'")
            return None
        
        return config
    
    except Exception as e:
        print(f"Error al cargar el archivo YAML: {str(e)}")
        return None

def analizar_csv_en_zip(zip_path, delimiter='|', encoding='utf-8-sig'):
    """Analizar la estructura de todos los archivos CSV en un ZIP"""
    try:
        # Crear un directorio temporal para extraer los archivos
        temp_dir = tempfile.mkdtemp()
        
        # Extraer los archivos CSV del ZIP
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # Analizar cada archivo CSV
        csv_info = {}
        for root, _, files in os.walk(temp_dir):
            for file in files:
                if file.endswith('.csv'):
                    file_path = os.path.join(root, file)
                    
                    # Intentar diferentes codificaciones
                    encodings = ['utf-8-sig', 'utf-8', 'latin1']
                    csv_data = None
                    
                    for enc in encodings:
                        try:
                            # Leer las primeras 5 líneas para analizar
                            with open(file_path, 'r', encoding=enc) as f:
                                lines = []
                                csv_reader = reader(f, delimiter=delimiter)
                                for i, line in enumerate(csv_reader):
                                    if i >= 5:  # Solo leemos 5 líneas
                                        break
                                    lines.append(line)
                            
                            if lines:
                                # Si pudimos leer líneas, usamos esta codificación
                                csv_data = lines
                                break
                        except Exception:
                            continue
                    
                    if not csv_data:
                        print(f"No se pudo leer el archivo {file} con ninguna codificación")
                        continue
                    
                    # Obtener campos basados en las primeras filas
                    fields = []
                    for row in csv_data:
                        for i, value in enumerate(row):
                            if i >= len(fields):
                                fields.append({
                                    'index': i,
                                    'values': []
                                })
                            
                            if value and value not in fields[i]['values']:
                                fields[i]['values'].append(value)
                    
                    # Determinar tipo de datos para cada campo
                    for field in fields:
                        values = field['values']
                        if all(val.isdigit() for val in values if val):
                            field['type'] = 'entero'
                        elif all(is_float(val) for val in values if val):
                            field['type'] = 'decimal'
                        else:
                            field['type'] = 'texto'
                    
                    csv_info[file] = {
                        'fields': fields,
                        'sample_rows': csv_data,
                        'encoding': enc,
                        'delimiter': delimiter
                    }
        
        return csv_info
    
    except Exception as e:
        print(f"Error al analizar los archivos CSV: {str(e)}")
        return {}

def is_float(value):
    """Comprobar si un valor es un número decimal"""
    try:
        float(value)
        return True
    except ValueError:
        return False

def verificar_coincidencia(config, csv_info):
    """Verificar que la configuración YAML coincida con los archivos CSV"""
    if not config or not csv_info:
        return False
    
    catalogs = config.get('catalogs', {})
    
    coincidencias = True
    problemas = []
    
    for catalog_name, catalog in catalogs.items():
        filename = catalog.get('filename')
        
        if filename not in csv_info:
            problemas.append(f"El archivo {filename} no existe en el ZIP")
            coincidencias = False
            continue
        
        # Verificar campos
        yaml_fields = catalog.get('fields', [])
        csv_fields = csv_info[filename]['fields']
        
        if len(yaml_fields) != len(csv_fields):
            problemas.append(f"El número de campos en el YAML ({len(yaml_fields)}) no coincide con el CSV ({len(csv_fields)}) para {filename}")
            coincidencias = False
        
        # Verificar tipos
        for i, yaml_field in enumerate(yaml_fields):
            if i < len(csv_fields):
                yaml_type = yaml_field.get('type')
                csv_type = csv_fields[i].get('type')
                
                if yaml_type != csv_type and not (yaml_type == 'texto' and csv_type in ('entero', 'decimal')):
                    problemas.append(f"El tipo de dato del campo {yaml_field.get('name')} en el YAML ({yaml_type}) "
                                   f"no coincide con el CSV ({csv_type}) para {filename}")
                    coincidencias = False
    
    # Mostrar problemas
    if problemas:
        print("\nProblemas encontrados:")
        for problema in problemas:
            print(f"- {problema}")
    
    return coincidencias

def generar_yaml_corregido(config, csv_info, output_path):
    """Generar un archivo YAML corregido basado en el análisis de los CSV"""
    if not config or not csv_info:
        return False
    
    # Copiar la configuración original
    new_config = {
        'sage_yaml': config.get('sage_yaml', {}),
        'catalogs': {},
        'packages': config.get('packages', {})
    }
    
    # Actualizar los catálogos con la información real
    for catalog_name, catalog in config.get('catalogs', {}).items():
        filename = catalog.get('filename')
        
        if filename in csv_info:
            # Empezamos con la configuración original
            new_catalog = {
                'name': catalog.get('name'),
                'description': catalog.get('description'),
                'filename': filename,
                'file_format': catalog.get('file_format', {}),
                'fields': []
            }
            
            # Crear campos basados en el CSV
            for i, csv_field in enumerate(csv_info[filename]['fields']):
                field = {
                    'name': f"campo_{i+1}" if i >= len(catalog.get('fields', [])) else catalog['fields'][i].get('name'),
                    'type': csv_field.get('type', 'texto'),
                    'required': True,  # Asumimos que todos los campos son requeridos
                    'unique': False    # Asumimos que ningún campo es único
                }
                new_catalog['fields'].append(field)
            
            new_config['catalogs'][catalog_name] = new_catalog
        else:
            # Si no hay información del CSV, mantener la configuración original
            new_config['catalogs'][catalog_name] = catalog
    
    # Guardar el YAML corregido
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            yaml.dump(new_config, f, default_flow_style=False, sort_keys=False)
        return True
    except Exception as e:
        print(f"Error al guardar el YAML corregido: {str(e)}")
        return False

def main():
    """Función principal"""
    if len(sys.argv) != 4:
        print("Uso: python analizar_yaml.py <archivo_yaml> <archivo_zip> <archivo_yaml_salida>")
        return 1
    
    yaml_path = sys.argv[1]
    zip_path = sys.argv[2]
    output_path = sys.argv[3]
    
    # Verificar que los archivos existen
    if not os.path.exists(yaml_path):
        print(f"Error: El archivo YAML no existe: {yaml_path}")
        return 1
    
    if not os.path.exists(zip_path):
        print(f"Error: El archivo ZIP no existe: {zip_path}")
        return 1
    
    print(f"Analizando YAML: {yaml_path}")
    config = cargar_yaml(yaml_path)
    if not config:
        return 1
    
    print(f"Analizando archivos CSV en: {zip_path}")
    csv_info = analizar_csv_en_zip(zip_path)
    if not csv_info:
        return 1
    
    print("\nEstructura de los archivos CSV:")
    for filename, info in csv_info.items():
        print(f"\n{filename} (Codificación: {info['encoding']}, Delimitador: '{info['delimiter']}')")
        print("  Muestra de datos:")
        for i, row in enumerate(info['sample_rows']):
            print(f"    Fila {i+1}: {row}")
        
        print("  Campos detectados:")
        for i, field in enumerate(info['fields']):
            values_str = ", ".join(field['values'][:3])
            if len(field['values']) > 3:
                values_str += f"... ({len(field['values'])} valores)"
            print(f"    Campo {i+1}: Tipo: {field['type']}, Valores: {values_str}")
    
    print("\nVerificando coincidencia entre YAML y CSV...")
    coincide = verificar_coincidencia(config, csv_info)
    
    if coincide:
        print("\n✅ La estructura del YAML coincide con los archivos CSV")
    else:
        print("\n❌ La estructura del YAML NO coincide con los archivos CSV")
        print(f"Generando YAML corregido en: {output_path}")
        if generar_yaml_corregido(config, csv_info, output_path):
            print(f"✅ YAML corregido generado correctamente en: {output_path}")
        else:
            print(f"❌ Error al generar el YAML corregido")
    
    return 0 if coincide else 1

if __name__ == "__main__":
    sys.exit(main())