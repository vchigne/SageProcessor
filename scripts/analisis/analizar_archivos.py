#!/usr/bin/env python3
"""
Script para analizar archivos YAML y CSV de SAGE
"""

import sys
import os
import csv
import re
import zipfile
import tempfile
import yaml
from datetime import datetime

def detectar_bom(archivo):
    """Detectar si un archivo tiene BOM UTF-8"""
    try:
        with open(archivo, 'rb') as f:
            return f.read(3) == b'\xef\xbb\xbf'
    except Exception:
        return False

def detectar_delimitador(archivo):
    """Detectar el delimitador usado en un archivo CSV"""
    try:
        has_bom = detectar_bom(archivo)
        encoding = 'utf-8-sig' if has_bom else 'utf-8'
        
        with open(archivo, 'r', encoding=encoding, errors='replace') as f:
            muestra = f.read(4096)
            
        # Contar posibles delimitadores
        conteos = {}
        for delim in [',', ';', '|', '\t']:
            conteos[delim] = muestra.count(delim)
        
        # El delimitador es el que aparece más veces (heurística simple)
        delimitador = max(conteos.items(), key=lambda x: x[1])[0]
        return delimitador
    except Exception:
        return ','  # Valor por defecto

def analizar_csv(archivo):
    """Analizar un archivo CSV y mostrar información sobre sus columnas"""
    try:
        has_bom = detectar_bom(archivo)
        encoding = 'utf-8-sig' if has_bom else 'utf-8'
        delimitador = detectar_delimitador(archivo)
        
        with open(archivo, 'r', encoding=encoding, errors='replace') as f:
            # Leer las primeras líneas
            reader = csv.reader(f, delimiter=delimitador)
            filas = []
            for i, fila in enumerate(reader):
                filas.append(fila)
                if i >= 5:  # Tomar solo las primeras 5 filas
                    break
        
        print(f"\nArchivo: {os.path.basename(archivo)}")
        print(f"  Codificación: {'utf-8 con BOM' if has_bom else 'utf-8 sin BOM'}")
        print(f"  Delimitador detectado: '{delimitador}'")
        print(f"  Número de columnas: {len(filas[0]) if filas else 0}")
        
        # Mostrar algunas filas
        if filas:
            print("  Muestra de datos:")
            for i, fila in enumerate(filas[:3]):  # Mostrar solo 3 filas
                print(f"    Fila {i+1}: {fila}")
        
        return {
            'encoding': encoding,
            'has_bom': has_bom,
            'delimiter': delimitador,
            'num_columns': len(filas[0]) if filas else 0,
            'sample_rows': filas[:5]
        }
    
    except Exception as e:
        print(f"Error al analizar {archivo}: {str(e)}")
        return None

def analizar_zip(archivo_zip):
    """Analizar todos los archivos CSV dentro de un ZIP"""
    print(f"\nAnalizando archivo ZIP: {archivo_zip}")
    
    temp_dir = tempfile.mkdtemp()
    try:
        # Extraer los archivos
        with zipfile.ZipFile(archivo_zip, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        resultados = {}
        
        # Buscar los archivos CSV
        for raiz, _, archivos in os.walk(temp_dir):
            for archivo in archivos:
                if archivo.lower().endswith('.csv'):
                    ruta_completa = os.path.join(raiz, archivo)
                    resultado = analizar_csv(ruta_completa)
                    if resultado:
                        resultados[archivo] = resultado
        
        if not resultados:
            print("No se encontraron archivos CSV en el ZIP")
        
        return resultados
    
    finally:
        # Limpiar directorio temporal
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

def analizar_yaml(archivo_yaml):
    """Analizar un archivo YAML de configuración SAGE"""
    print(f"\nAnalizando archivo YAML: {archivo_yaml}")
    
    try:
        with open(archivo_yaml, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # Verificar estructura básica
        if not isinstance(config, dict):
            print("Error: El archivo YAML no es un diccionario válido")
            return None
        
        # Verificar secciones principales
        secciones_requeridas = {'sage_yaml', 'catalogs', 'packages'}
        secciones_presentes = set(config.keys())
        
        print("Análisis de estructura YAML:")
        print(f"  Secciones presentes: {', '.join(secciones_presentes)}")
        
        faltantes = secciones_requeridas - secciones_presentes
        if faltantes:
            print(f"  Advertencia: Faltan secciones requeridas: {', '.join(faltantes)}")
        
        # Analizar catálogos
        if 'catalogs' in config:
            catalogs = config['catalogs']
            print(f"  Catálogos definidos: {len(catalogs)}")
            for nombre, catalogo in catalogs.items():
                print(f"    - {nombre}: {catalogo.get('filename', 'sin nombre de archivo')}")
                
                # Verificar formato de archivo
                formato = catalogo.get('file_format', {})
                tipo = formato.get('type', 'desconocido')
                delimitador = formato.get('delimiter', 'desconocido')
                tiene_cabecera = formato.get('header', False)
                
                print(f"      Tipo: {tipo}, Delimitador: '{delimitador}', Cabecera: {tiene_cabecera}")
                
                # Verificar campos
                campos = catalogo.get('fields', [])
                print(f"      Campos definidos: {len(campos)}")
        
        # Analizar paquetes
        if 'packages' in config:
            paquetes = config['packages']
            print(f"  Paquetes definidos: {len(paquetes)}")
            for nombre, paquete in paquetes.items():
                print(f"    - {nombre}: {paquete.get('name', 'sin nombre')}")
                catalogs_paquete = paquete.get('catalogs', [])
                print(f"      Catálogos incluidos: {len(catalogs_paquete)}")
                
                # Verificar validaciones
                validaciones = paquete.get('package_validation', [])
                print(f"      Reglas de validación: {len(validaciones)}")
        
        return config
    
    except Exception as e:
        print(f"Error al analizar YAML: {str(e)}")
        return None

def comparar_yaml_con_csv(config, resultados_csv):
    """Comparar la configuración YAML con los archivos CSV encontrados"""
    if not config or not resultados_csv:
        print("\nNo se puede realizar la comparación: faltan datos")
        return
    
    print("\nComparación de YAML con archivos CSV:")
    
    # Obtener catálogos del YAML
    catalogs = config.get('catalogs', {})
    
    # Comparar cada catálogo con su archivo CSV
    for nombre, catalogo in catalogs.items():
        nombre_archivo = catalogo.get('filename')
        if not nombre_archivo:
            print(f"  - {nombre}: No tiene nombre de archivo definido")
            continue
        
        if nombre_archivo not in resultados_csv:
            print(f"  - {nombre}: Archivo {nombre_archivo} no encontrado en los CSV")
            continue
        
        csv_info = resultados_csv[nombre_archivo]
        
        print(f"  - {nombre} ({nombre_archivo}):")
        
        # Comparar formato
        formato = catalogo.get('file_format', {})
        delimitador_yaml = formato.get('delimiter', ',')
        delimitador_csv = csv_info['delimiter']
        
        if delimitador_yaml != delimitador_csv:
            print(f"    Discrepancia en delimitador: YAML='{delimitador_yaml}', CSV='{delimitador_csv}'")
        else:
            print(f"    Delimitador: '{delimitador_yaml}' (coincide)")
        
        # Comparar número de campos
        campos_yaml = catalogo.get('fields', [])
        num_campos_yaml = len(campos_yaml)
        num_campos_csv = csv_info['num_columns']
        
        if num_campos_yaml != num_campos_csv:
            print(f"    Discrepancia en número de campos: YAML={num_campos_yaml}, CSV={num_campos_csv}")
        else:
            print(f"    Número de campos: {num_campos_yaml} (coincide)")

def main():
    """Función principal"""
    if len(sys.argv) < 2:
        print("Uso: python analizar_archivos.py <archivo_yaml> [archivo_zip]")
        return 1
    
    archivo_yaml = sys.argv[1]
    archivo_zip = sys.argv[2] if len(sys.argv) > 2 else None
    
    print("=" * 60)
    print(f"ANALIZADOR DE ARCHIVOS SAGE - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Analizar YAML
    config = analizar_yaml(archivo_yaml)
    
    # Analizar ZIP si se proporcionó
    resultados_csv = {}
    if archivo_zip:
        if not os.path.exists(archivo_zip):
            print(f"Error: El archivo ZIP {archivo_zip} no existe")
            return 1
        
        resultados_csv = analizar_zip(archivo_zip)
        
        # Comparar YAML con CSV
        comparar_yaml_con_csv(config, resultados_csv)
    
    print("\nAnálisis completado")
    print("=" * 60)
    return 0

if __name__ == "__main__":
    sys.exit(main())