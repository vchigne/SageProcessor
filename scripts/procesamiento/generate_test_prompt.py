#!/usr/bin/env python3
"""
Script para generar un prompt de prueba utilizando el generador YAML de SAGE
pero de forma directa sin usar el generador completo
"""

import os
import sys
import yaml
import zipfile
import pandas as pd
import re
from sage.yaml_generator import detect_bom

def detect_delimiter(file_path, encoding='utf-8-sig'):
    """Detectar el delimitador usado en un archivo CSV"""
    with open(file_path, 'r', encoding=encoding) as f:
        first_line = f.readline().strip()
        
    # Probar diferentes delimitadores comunes
    delimiters = {'|': 0, ',': 0, ';': 0, '\t': 0}
    
    for delimiter in delimiters:
        delimiters[delimiter] = first_line.count(delimiter)
    
    # Encontrar el delimitador con más ocurrencias
    max_delimiter = max(delimiters.items(), key=lambda x: x[1])
    return max_delimiter[0] if max_delimiter[1] > 0 else ','

def has_header(file_path, delimiter='|', encoding='utf-8-sig'):
    """Determinar si un archivo CSV tiene cabecera basado en heurísticas"""
    try:
        # Leer las primeras filas del archivo
        df = pd.read_csv(file_path, delimiter=delimiter, encoding=encoding, nrows=5, header=None)
        
        if df.empty or len(df) < 2:
            return False
        
        first_row = df.iloc[0]
        
        # Reglas para determinar si es una cabecera
        numeric_cols = sum(1 for val in first_row if isinstance(val, (int, float)) or (isinstance(val, str) and val.replace('.', '', 1).isdigit()))
        long_cols = sum(1 for val in first_row if isinstance(val, str) and len(val.split()) > 2)
        very_long_cols = sum(1 for val in first_row if isinstance(val, str) and len(val) > 20)
        
        # Si hay columnas numéricas, o columnas largas, probablemente no es una cabecera
        if numeric_cols > 0 or long_cols > 0 or very_long_cols > 0:
            return False
            
        # Verificar si los tipos de datos en las primeras dos filas son diferentes
        if len(df) >= 2:
            second_row = df.iloc[1]
            type_differences = sum(1 for i in range(len(first_row)) 
                                if isinstance(first_row[i], str) and isinstance(second_row[i], (int, float)))
            if type_differences > len(first_row) / 3:  # Si más de 1/3 de las columnas cambian de tipo
                return True
        
        return False
    except Exception as e:
        print(f"Error al detectar cabecera: {str(e)}")
        return False

def create_column_names(n_columns):
    """Crear nombres de columnas en formato COLUMNA_N"""
    return [f"COLUMNA_{i+1}" for i in range(n_columns)]

def analyze_csv_in_zip(zip_path, csv_name):
    """Analizar un archivo CSV dentro de un ZIP"""
    try:
        # Extraer el archivo temporalmente
        with zipfile.ZipFile(zip_path, 'r') as z:
            # Crear directorio temporal si no existe
            os.makedirs('tmp', exist_ok=True)
            temp_csv_path = os.path.join('tmp', os.path.basename(csv_name))
            z.extract(csv_name, 'tmp')
        
        # Detectar BOM
        has_bom = detect_bom(temp_csv_path)
        encoding = 'utf-8-sig' if has_bom else 'utf-8'
        
        # Detectar delimitador
        delimiter = detect_delimiter(temp_csv_path, encoding)
        
        # Determinar si tiene cabecera
        header = has_header(temp_csv_path, delimiter, encoding)
        
        # Leer primeras filas para análisis
        df = pd.read_csv(temp_csv_path, delimiter=delimiter, encoding=encoding, 
                         nrows=5, header=0 if header else None)
        
        # Si no tiene cabecera, crear nombres tipo COLUMNA_N
        if not header:
            df.columns = create_column_names(len(df.columns))
        
        # Preparar ejemplos en formato JSON para el prompt
        examples = []
        for i in range(min(2, len(df))):
            row = df.iloc[i]
            example = {}
            
            # Convertir valores a tipos nativos de Python para facilitar la serialización
            for col in df.columns:
                value = row[col]
                # Verificar si es NaN y convertirlo a None (null en JSON)
                if pd.isna(value):
                    example[col] = None
                elif isinstance(value, (pd.Timestamp, pd.DatetimeTZDtype)):
                    # Convertir fechas a cadenas ISO
                    example[col] = value.isoformat() if hasattr(value, 'isoformat') else str(value)
                elif isinstance(value, (int, float, bool)):
                    # Usar directamente tipos nativos
                    example[col] = value
                else:
                    # Convertir cualquier otro tipo a cadena
                    example[col] = str(value)
            
            examples.append(example)
        
        # Información básica del archivo para el prompt
        file_info = {
            'name': os.path.basename(csv_name),
            'type': 'CSV',
            'bom_detected': has_bom,
            'delimiter': delimiter,
            'has_header': header,
            'examples': examples
        }
        
        # Limpiar archivo temporal
        os.remove(temp_csv_path)
        
        return file_info
    
    except Exception as e:
        print(f"Error al analizar CSV en ZIP: {str(e)}")
        return {
            'name': os.path.basename(csv_name),
            'type': 'CSV',
            'error': str(e)
        }

def build_prompt(file_infos, instructions):
    """Construir un prompt basado en la información de los archivos y las instrucciones"""
    prompt = """Eres un experto en la generación de archivos YAML para SAGE. 
Tu objetivo es analizar la estructura de los archivos de entrada, interpretar las instrucciones del usuario y generar un YAML válido y optimizado de acuerdo con las especificaciones de SAGE.

=== REGLAS CRÍTICAS ===
ESTAS REGLAS SON OBLIGATORIAS Y DEBEN SEGUIRSE SIN EXCEPCIÓN:
1. Para archivos CSV, usa EXACTAMENTE el delimitador detectado en el análisis del archivo (pipe (que es el mas comun) , coma, punto y coma, etc.)
2. Para archivos sin cabeceras, SIEMPRE usa nombres COLUMNA_N para los campos, nunca "Unnamed: X".
3. Nunca incluyas paths en el YAML.
4. La propiedad 'header' SIEMPRE debe estar DENTRO de la sección 'file_format'.
5. Usa type: 'texto' para cualquier campo con valores mixtos, alfanuméricos o especiales.

=== OBJETIVO ===
Generar un YAML que:
1. Defina reglas de validación claras y precisas.
2. Proporcione mensajes de error amigables y descriptivos.
3. Siga estrictamente las instrucciones dadas por el usuario.
4. Describa fielmente el o los archivos que debe recibir.
5. Asegure que la propiedad 'header' SIEMPRE esté dentro de la sección 'file_format' y NUNCA fuera de ella.
6. Coloque correctamente 'header: true' cuando el archivo tenga encabezados y 'header: false' cuando no los tenga.
7. La sección 'packages' SIEMPRE debe incluir 'file_format' con la propiedad 'type: ZIP' para cada paquete con múltiples catálogos.

=== ARCHIVOS RECIBIDOS ===
El usuario ha proporcionado los siguientes archivos para analizar:

- **Nombre del archivo:** output.zip
- **Tipo de archivo:** ZIP
- **Número de archivos en el ZIP:** {num_files}
- **Archivos dentro del ZIP:**
  {file_list}
- **Estructura de los archivos:**  
  
""".format(
        num_files=len(file_infos),
        file_list='\n  '.join([f'- {info["name"]}' for info in file_infos])
    )
    
    # Agregar información de cada archivo
    for info in file_infos:
        prompt += f"=== Catálogo: {info['name']} ===\n"
        prompt += f"Tipo: {info['type']}\n"
        prompt += f"BOM Detectado: {'Sí' if info.get('bom_detected', False) else 'No'}\n"
        prompt += f"Delimitador: '{info.get('delimiter', '|')}'\n"
        prompt += f"Tiene Cabecera: {'Sí' if info.get('has_header', False) else 'No'}\n"
        
        # Agregar ejemplos de datos
        prompt += "Ejemplos:\n"
        if 'examples' in info and info['examples']:
            prompt += "[\n"
            for i, example in enumerate(info['examples']):
                prompt += "  {\n"
                for key, value in example.items():
                    prompt += f'    "{key}": {repr(value)},\n'
                prompt = prompt.rstrip(",\n") + "\n  }"
                if i < len(info['examples']) - 1:
                    prompt += ","
                prompt += "\n"
            prompt += "]\n\n"
        else:
            prompt += "[]\n\n"
    
    # Agregar instrucciones del usuario
    prompt += "=== INSTRUCCIONES DEL USUARIO ===\n"
    prompt += "⚠️ IMPORTANTE: ESTAS INSTRUCCIONES TIENEN PRIORIDAD SOBRE LAS REGLAS GENERALES ⚠️\n"
    prompt += "El usuario ha dado las siguientes instrucciones sobre la validación y estructura del YAML que DEBES SEGUIR AL PIE DE LA LETRA:\n\n"
    prompt += instructions + "\n\n"
    
    # Agregar reglas generales y especificaciones
    prompt += """=== REGLAS GENERALES ===
1. **Tipos de datos permitidos en el YAML:**
   - **texto** (NO usar 'string' o 'str') - SIEMPRE usar 'texto' para:
     * Campos con valores alfanuméricos
     * Campos con valores mixtos (numéricos y texto)
     * Campos con valores vacíos o nulos
     * Campos con códigos o identificadores que contengan letras
     * Si hay duda sobre el tipo, usar 'texto' por defecto
   - **decimal** (para números con decimales) - SOLO usar cuando TODOS los valores son numéricos con decimales
   - **entero** (para números enteros) - SOLO usar cuando TODOS los valores son numéricos enteros sin excepción
   - **fecha** (para fechas) - SOLO usar cuando TODOS los valores son fechas válidas
   - **booleano** (para true/false) - SOLO usar cuando TODOS los valores son booleanos

2. **Validaciones numéricas:**
   - "Mayor a X": usar `df['columna'].astype(float) > X`
   - "Mayor o igual a X": usar `df['columna'].astype(float) >= X`

3. **Mensajes de error:**
   - Deben ser **claros, amigables y sugerir una solución**.
   - Se pueden usar **emojis** para mejorar la claridad.

4. **Rutas de archivos:**
   - En `filename` usar SOLO el nombre del archivo sin directorios.

5. **Detección de encabezados:**
   - SIEMPRE analizar cada archivo para determinar si tiene encabezados. 
   - Para archivos Excel o CSV:
     * Si la primera fila contiene textos descriptivos que no son datos (como "Código", "Nombre", "Descripción", etc.) usar `header: true`. Pero para que se pueda creer que un archivo tiene cabecera, todos los valores de la columna 1 deben ser descriptivos, no puede haber ningun numero como columna y no debe tener mas de dos palabras ni 20 caracteres ningun supuesto nombre de columna. Si no se cumple todo eso, anda a lo seguro y pon que el archivo no tiene cabecera, ya que en las instrcciones del usuario se hara la descripcion de los campos en caso de haberlos. ES IMPERATIVO que te des cuenta de que si en la primera fila algun campo empieza con un numero, o tiene decimales, o tiene mas de dos palabras o mas de 20 caracteres, entcones el archivo no tiene cabecera. si tienes motivos para pensar que un archivo csv tiene cabecera, debes estar seguro de que lo que ves en la primera fila no son datos normales. Tal vez la segunda fila sea muy parecida y eso ya te indica que no tiene cabecera. Por defecto los CSV NO TIENEN CABECERA
     * Si la primera fila ya contiene datos (como números, fechas, valores), usar `header: false`
   - La propiedad `header` SIEMPRE debe estar dentro de la sección `file_format` para cada catálogo.

6. **Manejo de campos únicos:**
   - SIEMPRE verificar si hay valores duplicados en columnas que podrían ser claves primarias.
   - Usar `unique: true` SOLO cuando se haya comprobado que todos los valores son distintos.
   - Para columnas como "Código", "ID", etc., verificar explícitamente si hay duplicados. Si existen, usar `unique: false`.
   - Cuando hay duda sobre la unicidad, establecer por defecto `unique: false`.

7. **Detección de tipos de datos:**
   - Analizar muestras representativas de cada columna para determinar el tipo correcto.
   - **IMPORTANTE**: Para campos con valores mixtos o datos especiales:
     * Si un campo contiene CUALQUIER texto alfanumérico (letras y números), debe usar type: "texto".
     * Si un campo contiene valores numéricos pero tiene valores faltantes (NaN, NA, null), usar type: "texto".
     * Si un campo contiene referencias como "N/A", cadenas vacías, o patrones especiales, usar type: "texto".
   - Reglas específicas por tipo:
     * `texto`: campos que contienen cualquier carácter no numérico o valores especiales.
     * `entero`: SOLO campos que contienen exclusivamente números enteros sin decimales ni valores especiales.
     * `decimal`: campos que contienen números con decimales (incluso si algunos valores son enteros).
     * `fecha`: campos que contienen fechas en cualquier formato reconocible.
     * `booleano`: campos que contienen exclusivamente valores true/false, 1/0, sí/no.
8. **Nombres de campo:**
Si no detectas cabeceras o no se proporcionan en el prompt, NUNCA uses nombres como "Unnamed: X". SIEMPRE usa COLUMNA(N) como nombre de campo (donde N es el número de columna). Por ejemplo: COLUMNA_1, COLUMNA_2, etc. Esta es una regla OBLIGATORIA. Además, para archivos sin cabeceras, asegúrate de establecer header: false en la sección file_format. Ten en cuenta que los csv CASI NUNCA usan cabeceras, asi que debes estar muy seguro antes de decir que un CSV si tiene cabecera.


9. **Delimitadores en CSV:**
Usa EXACTAMENTE el delimitador que se haya detectado en el análisis del archivo. Los delimitadores comunes son:
  * Pipe ('|') :este es el demitador mas comun y se usa por defecto.
  * Coma (',')
  * Punto y coma (';')
  * Tabulador ('\\t')
El sistema detectará automáticamente cuál de estos se usa en cada archivo y te proporcionará esta información. SIEMPRE usa el delimitador detectado, especialmente para archivos con BOM UTF-8.


=== GENERACIÓN DEL YAML ===
Ahora, con base en la información proporcionada, genera un **YAML válido y completo** que siga exactamente las instrucciones del usuario, respete la estructura de los archivos proporcionados y aplique correctamente las validaciones.

⚠️ **IMPORTANTE: Debes incluir SIEMPRE las tres secciones principales obligatorias:**
1. **sage_yaml**: Con la información general del YAML (nombre, descripción, versión, autor)
2. **catalogs**: Con la definición de todos los catálogos y sus campos
3. **packages**: Con la definición de al menos un paquete que agrupe los catálogos. Cada paquete DEBE contener:
   - name: Nombre descriptivo del paquete
   - description: Descripción de su propósito
   - file_format: Debe incluir 'type: ZIP' para paquetes con múltiples catálogos
   - catalogs: Lista de los IDs de catálogos que incluye

⚠️ **No generes texto antes ni después, solo genera el YAML basado en los archivos y las instrucciones del usuario y no pongas ningún texto más.**
"""
    
    return prompt

def main():
    """Función principal para generar un prompt de prueba"""
    # Rutas de archivos
    zip_file = "test_cli/output.zip"
    instructions_file = "test_cli/instruccionedetalladas.txt"
    output_prompt_file = "test_prompt.txt"
    
    # Verificar que los archivos existan
    if not os.path.exists(zip_file):
        print(f"Error: Archivo ZIP no encontrado: {zip_file}")
        return 1
        
    if not os.path.exists(instructions_file):
        print(f"Error: Archivo de instrucciones no encontrado: {instructions_file}")
        print(f"Intentando acceder a la ruta completa...")
        absolute_path = os.path.abspath(instructions_file)
        print(f"Ruta absoluta: {absolute_path}")
        
        # Verificar el directorio actual
        print(f"Directorio actual: {os.getcwd()}")
        print(f"Listado de archivos en test_cli:")
        try:
            if os.path.exists("test_cli"):
                print("\n".join(os.listdir("test_cli")))
            else:
                print("El directorio test_cli no existe")
        except Exception as e:
            print(f"Error listando directorio: {str(e)}")
            
        return 1
    
    try:
        # Obtener lista de archivos en el ZIP
        with zipfile.ZipFile(zip_file, 'r') as z:
            csv_files = [f for f in z.namelist() if f.lower().endswith('.csv')]
        
        # Analizar los primeros tres archivos CSV para no sobrecargar el sistema
        file_infos = []
        for csv_file in csv_files[:3]:  # Limitamos a 3 archivos para no sobrecargar
            print(f"Analizando: {csv_file}")
            info = analyze_csv_in_zip(zip_file, csv_file)
            file_infos.append(info)
        
        # Obtener instrucciones
        with open(instructions_file, 'r', encoding='utf-8') as f:
            instructions = f.read()
        
        # Generar el prompt
        prompt = build_prompt(file_infos, instructions)
        
        # Guardar el prompt en un archivo
        with open(output_prompt_file, 'w', encoding='utf-8') as f:
            f.write(prompt)
        
        print(f"Prompt generado correctamente en: {output_prompt_file}")
        return 0
    
    except Exception as e:
        print(f"Error al generar el prompt: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())