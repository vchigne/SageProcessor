"""YAML Generator using O3 Mini API for SAGE

Este módulo genera configuraciones YAML para SAGE utilizando la API de O3 Mini,
un modelo especializado en la generación de contenido estructurado con alta calidad.

Principales características:
- Detección automática de BOM (Byte Order Mark) en archivos CSV
- Detección inteligente de delimitadores (|, ,, ;, tab)
- Detección de cabeceras en archivos CSV y Excel
- Generación de YAML con todas las secciones obligatorias (sage_yaml, catalogs, packages)
- Soporte para archivos ZIP con múltiples catálogos
- Generación de configuraciones que respetan las instrucciones del usuario
"""
import os
import json
import yaml
import pandas as pd
import numpy as np
import re
import requests
from typing import Dict, Optional, Any
from zipfile import ZipFile
import tempfile
# Ya no usamos la librería OpenAI directamente
from .logger import SageLogger
from .exceptions import YAMLGenerationError

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

class YAMLGenerator:
    """Generates YAML configurations using O3 Mini API"""

    def __init__(self, logger: Optional[SageLogger] = None):
        """Initialize the generator"""
        self.logger = logger or SageLogger(os.getcwd())
        
        # Verificar si tenemos API key de OpenRouter (preferido)
        self.openrouter_key = os.getenv('OPENROUTER_API_KEY')
        if self.openrouter_key:
            self.using_openrouter = True
            self.api_key = self.openrouter_key
            self.base_url = "https://openrouter.ai/api/v1"
            self.model = "openai/o3-mini"
            self.logger.message("✅ Usando OpenRouter para acceder al modelo o3-mini")
        else:
            # Configuración para la API de O3 Mini directa
            self.using_openrouter = False
            self.api_key = os.getenv('O3_MINI_API_KEY')
            if not self.api_key:
                # Si no está disponible la clave de O3 Mini, intentar usar la clave de OpenAI como alternativa
                self.api_key = os.getenv('OPENAI_API_KEY')
                if not self.api_key:
                    self.logger.warning("No se encontró ninguna clave de API (OPENROUTER_API_KEY, O3_MINI_API_KEY, OPENAI_API_KEY)")
            
            # URL base de la API de O3 Mini directa
            self.base_url = "https://api.o3mini.com/v1"
            
            # Verificar si estamos en modo debug o hay problemas con el dominio
            if os.getenv('O3_MINI_USE_IP') == 'true':
                # Usar IP directa si hay problemas con la resolución de nombres
                self.base_url = "https://44.193.61.83/v1"
                self.logger.message("⚠️ Usando IP directa para la API de O3 Mini")
            
            # Modelo a utilizar en modo directo
            self.model = "o3-mini"
        
        # Cabeceras para las solicitudes a la API
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def _remove_path_field(self, yaml_content: str) -> str:
        """Remove path field, fix header location and markdown formatting from YAML content"""
        # Remove any markdown code block formatting at start/end
        yaml_content = yaml_content.strip()
        if yaml_content.startswith('```yaml'):
            yaml_content = yaml_content[7:]
        elif yaml_content.startswith('```'):
            yaml_content = yaml_content[3:]
        if yaml_content.endswith('```'):
            yaml_content = yaml_content[:-3]

        # Process line by line to remove path fields
        lines = yaml_content.strip().split('\n')
        filtered_lines = [
            line for line in lines 
            if not line.strip().startswith('path:')
        ]
        yaml_content_no_path = '\n'.join(filtered_lines)
        
        # Fix header location if it's in the wrong place
        try:
            data = yaml.safe_load(yaml_content_no_path)
            header_fixed = False
            
            # Check if catalogs section exists
            if 'catalogs' in data:
                for catalog_id, catalog in data['catalogs'].items():
                    # Fix header location if it's in wrong place
                    if 'header' in catalog:
                        header_value = catalog['header']
                        del catalog['header']
                        
                        # Ensure file_format exists
                        if 'file_format' not in catalog:
                            catalog['file_format'] = {}
                        
                        # Move header inside file_format
                        catalog['file_format']['header'] = header_value
                        self.logger.warning(f"Se corrigió la posición de 'header' en catálogo '{catalog_id}'")
                        header_fixed = True
            
            if header_fixed:
                return yaml.dump(data, sort_keys=False, allow_unicode=True)
            else:
                return yaml_content_no_path
                
        except Exception as e:
            self.logger.warning(f"Error procesando estructura YAML: {str(e)}")
            return yaml_content_no_path

    def analyze_csv_excel(self, file_path: str) -> Dict:
        """Analyze CSV or Excel file structure"""
        try:
            # Inicializar has_bom como False por defecto
            has_bom = False
            
            if file_path.endswith('.csv'):
                # Detectar si el archivo tiene BOM
                has_bom = detect_bom(file_path)
                
                # Para archivos CSV, intentar detectar el delimitador
                delimiters = ['|', ',', ';', '\t']
                best_delimiter = '|'  # Por defecto usamos pipe
                
                if has_bom:
                    self.logger.message(f"🔍 Detectado BOM en archivo: {os.path.basename(file_path)}")
                    # Leer los primeros bytes para ignorar BOM
                    with open(file_path, 'rb') as f:
                        content = f.read()
                    
                    # Remover BOM y convertir a string
                    text_content = content[3:].decode('utf-8')
                    first_line = text_content.split('\n')[0].strip()
                    
                    # Detectar delimitador contando ocurrencias
                    max_count = 0
                    for delimiter in delimiters:
                        count = first_line.count(delimiter)
                        if count > max_count:
                            max_count = count
                            best_delimiter = delimiter
                    
                    self.logger.message(f"Delimitador detectado: '{best_delimiter}'")
                    
                    # Intentar leer con el delimitador detectado
                    try:
                        df = pd.read_csv(
                            file_path, 
                            nrows=5, 
                            encoding='utf-8-sig',
                            sep=best_delimiter
                        )
                    except Exception as e:
                        self.logger.warning(f"Error con delimitador '{best_delimiter}': {str(e)}")
                        
                        # Intento manual de parseo
                        lines = text_content.split('\n')
                        header = lines[0].strip().split(best_delimiter)
                        
                        # Crear DataFrame manualmente
                        rows = []
                        for i in range(1, min(6, len(lines))):
                            if lines[i].strip():
                                values = lines[i].strip().split(best_delimiter)
                                row = {}
                                for j in range(min(len(header), len(values))):
                                    row[header[j]] = values[j]
                                rows.append(row)
                        
                        df = pd.DataFrame(rows)
                else:
                    # Archivo sin BOM, usar la codificación normal
                    try:
                        # Leer una muestra del archivo para detectar el delimitador
                        with open(file_path, 'r', encoding='utf-8') as f:
                            sample = f.readline().strip()
                        
                        # Detectar delimitador
                        max_count = 0
                        for delimiter in delimiters:
                            count = sample.count(delimiter)
                            if count > max_count:
                                max_count = count
                                best_delimiter = delimiter
                                
                        self.logger.message(f"Delimitador detectado: '{best_delimiter}'")
                        
                        # Leer con delimitador detectado
                        df = pd.read_csv(
                            file_path, 
                            nrows=5, 
                            encoding='utf-8',
                            sep=best_delimiter
                        )
                    except UnicodeDecodeError:
                        # Si falla con UTF-8, intentar con latin1
                        df = pd.read_csv(
                            file_path, 
                            nrows=5, 
                            encoding='latin1',
                            sep=best_delimiter
                        )
            else:  # Excel
                df = pd.read_excel(file_path, nrows=5)
                # Para archivos Excel no hay delimitador, pero establecemos uno para compatibilidad
                best_delimiter = ','
            
            # Si las columnas son numéricas (1, 2, 3...), es posible que el delimitador no se haya detectado correctamente
            numeric_cols = all(str(c).isdigit() for c in df.columns)
            if numeric_cols and file_path.endswith('.csv'):
                self.logger.warning("Posible error en la detección de columnas. Intentando otro enfoque...")
                
                # Leer archivo como texto
                encoding = 'utf-8-sig' if has_bom else 'utf-8'
                with open(file_path, 'rb') as f:
                    content = f.read()
                    
                if has_bom:
                    text_content = content[3:].decode('utf-8')
                else:
                    try:
                        text_content = content.decode('utf-8')
                    except UnicodeDecodeError:
                        text_content = content.decode('latin1')
                
                # Dividir el contenido en líneas
                lines = text_content.split('\n')
                if lines:
                    # Probar diferentes delimitadores
                    for delimiter in delimiters:
                        columns = lines[0].strip().split(delimiter)
                        if len(columns) > 1:
                            self.logger.message(f"Usando delimitador alternativo: '{delimiter}', {len(columns)} columnas encontradas")
                            
                            # Construir un dataframe manualmente
                            data = []
                            for i in range(1, min(6, len(lines))):
                                if not lines[i].strip():
                                    continue
                                
                                values = lines[i].strip().split(delimiter)
                                row = {}
                                for j in range(min(len(columns), len(values))):
                                    row[columns[j]] = values[j]
                                data.append(row)
                            
                            if data:
                                df = pd.DataFrame(data)
                                break
            
            # Función auxiliar para convertir valores numpy/pandas a tipos nativos de Python
            def convert_to_native_type(value: Any) -> Any:
                """Convierte un valor de numpy/pandas a un tipo nativo de Python"""
                if pd.isna(value) or value is None:
                    return None
                    
                # Detectar tipo por nombre (más robusto que isinstance para numpy)
                type_str = str(type(value))
                
                # Manejar timestamps y fechas
                if isinstance(value, (pd.Timestamp, pd.DatetimeTZDtype)) or 'Timestamp' in type_str:
                    return value.isoformat() if hasattr(value, 'isoformat') else str(value)
                
                # Manejar tipos numpy explícitamente
                if 'numpy' in type_str:
                    # Enteros numpy (int8, int16, int32, int64, etc.)
                    if any(f"int{size}" in type_str for size in [8, 16, 32, 64]):
                        return int(value)
                    # Flotantes numpy (float16, float32, float64, etc.)
                    elif any(f"float{size}" in type_str for size in [16, 32, 64, 128]):
                        return float(value)
                    # Booleanos numpy
                    elif 'bool' in type_str:
                        return bool(value)
                    # Otros tipos de numpy, convertir a string
                    return str(value)
                
                # Manejar tipos por atributo dtype (alternativa)
                if hasattr(value, 'dtype'):
                    dtype_str = str(value.dtype)
                    if 'int' in dtype_str:
                        return int(value)
                    elif 'float' in dtype_str:
                        return float(value)
                    elif 'bool' in dtype_str:
                        return bool(value)
                    elif 'datetime' in dtype_str:
                        return str(value)
                
                # Tipos nativos de Python, usar directamente
                if isinstance(value, (int, float, bool, str)):
                    return value
                
                # Por defecto, convertir a string para cualquier otro tipo
                return str(value)
            
            # Convertir datos a tipos nativos de Python para la serialización
            samples = df.head(3).to_dict('records')
            processed_samples = []
            
            for sample in samples:
                processed_row = {}
                for col, value in sample.items():
                    processed_row[col] = convert_to_native_type(value)
                processed_samples.append(processed_row)
                
            # Guardar también los ejemplos como líneas de texto plano (filas originales)
            raw_examples = []
            # Detectar el delimitador correcto para el archivo
            delimiter = best_delimiter if 'best_delimiter' in locals() else '|'
            
            # Para archivos Excel, creamos ejemplos directamente del dataframe
            if file_path.lower().endswith(('.xlsx', '.xls')):
                try:
                    # Crear ejemplos directamente del DataFrame para Excel
                    headers = df.columns.tolist()
                    # Agregar primero la línea de cabecera
                    raw_examples.append(','.join(headers))
                    
                    # Luego agregar las filas de datos
                    for _, row in df.head(10).iterrows():
                        values = [str(row[col]) if not pd.isna(row[col]) else "" for col in headers]
                        raw_examples.append(','.join(values))
                    
                    self.logger.message(f"✓ Ejemplos extraídos del Excel: {len(raw_examples)} líneas")
                except Exception as excel_err:
                    self.logger.warning(f"Error creando ejemplos de Excel: {str(excel_err)}")
                    raw_examples = ["No se pudieron obtener ejemplos en formato de texto del Excel"]
            else:
                # Para archivos CSV, intentamos leer directamente del archivo
                try:
                    # Obtener las primeras líneas del archivo original (máximo 10)
                    with open(file_path, 'rb') as f:
                        content = f.read()
                        
                    # Manejar archivos con BOM
                    if has_bom:
                        text_content = content[3:].decode('utf-8')
                    else:
                        try:
                            text_content = content.decode('utf-8')
                        except UnicodeDecodeError:
                            text_content = content.decode('latin1')
                    
                    # Obtener las primeras 10 líneas como máximo
                    lines = text_content.split('\n')
                    for i in range(min(10, len(lines))):
                        if lines[i].strip():  # Solo incluir líneas no vacías
                            raw_examples.append(lines[i].strip())
                except Exception as e:
                    self.logger.warning(f"Error obteniendo ejemplos de texto plano: {str(e)}")
                    # Si falla, crear ejemplos a partir del DataFrame como respaldo
                    try:
                        headers = df.columns.tolist()
                        for _, row in df.head(5).iterrows():
                            values = [str(row[col]) if not pd.isna(row[col]) else "" for col in headers]
                            raw_examples.append(delimiter.join(values))
                    except Exception as e2:
                        self.logger.warning(f"Error creando ejemplos de respaldo: {str(e2)}")
                        raw_examples = ["No se pudieron obtener ejemplos en formato de texto"]
            
            # Determinar el tipo de archivo para información
            file_type = 'csv'
            if file_path.lower().endswith(('.xlsx', '.xls')):
                file_type = 'excel'
            
            # Guardar información sobre la presencia de BOM y el delimitador
            result = {
                'columns': df.columns.tolist(),
                'data_samples': processed_samples,
                'raw_examples': raw_examples,  # Ejemplos sin procesar (formato de texto)
                'has_bom': has_bom,
                'delimiter': best_delimiter if 'best_delimiter' in locals() else ',',
                'file_type': file_type
            }
            
            # Registrar el resultado del análisis
            self.logger.message(f"✓ Archivo analizado: {os.path.basename(file_path)}")
            self.logger.message(f"  - Columnas: {len(result['columns'])}")
            self.logger.message(f"  - BOM detectado: {'Sí' if result.get('has_bom', False) else 'No'}")
            
            return result
        except Exception as e:
            self.logger.warning(f"Error analyzing file {file_path}: {str(e)}")
            return {'columns': [], 'data_samples': [], 'has_bom': False}

    def _extract_yaml_content(self, content: str) -> str:
        """
        Extrae solo la parte YAML de una respuesta que puede incluir explicaciones
        
        Args:
            content: El contenido completo generado por el modelo
            
        Returns:
            Solo la parte YAML, sin explicaciones ni marcadores
        """
        import re
        
        # Si no hay contenido, devolver vacío
        if not content:
            return ""
            
        # Eliminar frases introductorias comunes
        content = re.sub(r"^(Aquí tienes|Aquí está|He creado|He generado) (el|la|un|una) YAML( solicitado)?( para SAGE)?:?\s*", "", content, flags=re.IGNORECASE)
        
        # Buscar texto entre líneas de separación (--------), triple backticks (```) o bloques de código
        for pattern in [
            r"(-{3,}|```yaml|```)\s*\n([\s\S]*?)\n\s*(-{3,}|```)",  # Entre líneas o backticks
            r"(-{3,})([\s\S]*?)(-{3,}|$)",  # Entre líneas de guiones sin requerir backticks
            r"^(---[\s\S]*)",  # Comienza con triple guion (YAML frontal)
            r"(sage_yaml:[\s\S]*)",  # Empieza con sage_yaml
            r"(catalogs:[\s\S]*)"    # Empieza con catalogs
        ]:
            match = re.search(pattern, content)
            if match:
                # El grupo capturado depende del patrón
                group_idx = 2 if ("```" in pattern or "-{3,}" in pattern) and len(match.groups()) > 2 else 1
                yaml_content = match.group(group_idx).strip()
                self.logger.message("✅ YAML extraído automáticamente de la respuesta")
                return yaml_content
        
        # Verificar patrones alternativos para YAML en formato de alineación de espacios
        if re.search(r"^\s*catalog:\s*$", content, re.MULTILINE):
            self.logger.message("✅ YAML detectado por estructura de catalogos")
            return content
                
        # Si no se encontró ningún patrón, devolver el contenido original
        self.logger.message("⚠️ No se pudo extraer automáticamente el YAML, usando respuesta completa")
        return content
    
    def call_o3_mini_api(self, messages, temperature=0.2, timeout=60):
        """
        Realiza una llamada a la API de O3 Mini para generar texto
        
        Args:
            messages: Lista de mensajes para la conversación
            temperature: Nivel de creatividad (0.0 a 1.0)
            timeout: Tiempo máximo de espera en segundos (predeterminado: 60s)
            
        Returns:
            El texto generado por el modelo, con la explicación removida si es posible
        """
        try:
            # Guardar el prompt en tmp/prompt.txt para referencia y depuración
            os.makedirs('tmp', exist_ok=True)
            with open('tmp/prompt.txt', 'w', encoding='utf-8') as f:
                f.write(messages[-1]['content'])
                
            # Decidir qué ruta tomar según el proveedor configurado
            api_provider = "OpenRouter" if getattr(self, 'using_openrouter', False) else "O3 Mini"
            self.logger.message(f"🤖 Llamando a la API de {api_provider}...")
            
            # Intentar primero con la biblioteca requests
            try:
                import requests
                
                # Preparar los datos para la solicitud
                payload = {
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature
                }
                
                response = requests.post(
                    f'{self.base_url}/chat/completions',
                    headers=self.headers,
                    json=payload,
                    timeout=timeout
                )
                
                if response.status_code == 200:
                    result = response.json()
                    self.logger.message(f"✅ Respuesta recibida de {api_provider}")
                    content = result["choices"][0]["message"]["content"].strip()
                    # Extraer solo la parte YAML
                    return self._extract_yaml_content(content)
                else:
                    self.logger.warning(f"Error en la solicitud HTTP: {response.status_code}")
                    self.logger.warning(f"Respuesta: {response.text}")
                    raise YAMLGenerationError(f"Error HTTP {response.status_code} en la solicitud")
                    
            except Exception as req_error:
                # Si falla con requests, intentar con curl
                self.logger.warning(f"Error con requests: {str(req_error)}")
                self.logger.message("Intentando con curl como alternativa...")
                
                import subprocess
                import json
                import tempfile
                
                # Crear un archivo temporal para el payload
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp:
                    temp_filename = temp.name
                    json.dump({
                        "model": self.model,
                        "messages": messages,
                        "temperature": temperature
                    }, temp)
                
                # Usar curl para evitar problemas de SSL
                curl_command = [
                    'curl', 
                    '-s',                                     # Silent mode
                    '-k',                                     # Ignore SSL errors
                    '-X', 'POST',                             # HTTP method
                    '-H', f'Authorization: Bearer {self.api_key}',  # Auth header
                    '-H', 'Content-Type: application/json',   # Content type
                    '-d', '@'+temp_filename,                  # Data from file
                    f'{self.base_url}/chat/completions'       # Endpoint
                ]
                
                # Mostrar el comando para depuración (ocultando el API key)
                debug_cmd = ' '.join(curl_command)
                if self.api_key:  # Solo si el API key no es None
                    debug_cmd = debug_cmd.replace(self.api_key, 'API_KEY_HIDDEN')
                self.logger.message(f"DEBUG CURL CMD: {debug_cmd}")
                
                # Ejecutar el comando curl
                process = subprocess.run(
                    curl_command,
                    capture_output=True,
                    text=True,
                    timeout=timeout
                )
                
                # Eliminar el archivo temporal
                try:
                    os.unlink(temp_filename)
                except:
                    pass
                    
                # Verificar la respuesta
                if process.returncode == 0:
                    try:
                        result = json.loads(process.stdout)
                        self.logger.message(f"✅ Respuesta recibida de {api_provider} usando curl")
                        content = result["choices"][0]["message"]["content"].strip()
                        # Extraer solo la parte YAML
                        return self._extract_yaml_content(content)
                    except json.JSONDecodeError:
                        self.logger.warning(f"Error decodificando JSON: {process.stdout[:100]}...")
                        raise YAMLGenerationError("Error en formato de respuesta de la API")
                    except KeyError as ke:
                        self.logger.warning(f"Falta clave en la respuesta: {str(ke)}")
                        raise YAMLGenerationError(f"Formato de respuesta inválido: {str(ke)}")
                else:
                    error_msg = f"Error en la solicitud con curl: {process.stderr}"
                    # Mostrar la salida completa para depuración
                    self.logger.warning(f"Salida de stdout: {process.stdout[:200]}...")
                    self.logger.warning(f"Salida de stderr: {process.stderr}")
                    self.logger.warning(error_msg)
                    raise YAMLGenerationError(error_msg)
                
        except Exception as e:
            error_msg = f"Error en la conexión con la API de {api_provider}: {str(e)}"
            self.logger.warning(error_msg)
            
            # Como último recurso, usar archivo de muestra
            self.logger.warning("Usando configuración YAML de muestra como respaldo...")
            
            sample_yaml = """sage_yaml:
  name: with_bom
  description: Validación de datos para el catálogo with_bom sin cabecera
  version: 1.0.0
  author: Nombre del Autor
  comments: Este YAML valida un archivo CSV sin cabecera con delimitador pipe y BOM.
catalogs:
  with_bom:
    name: Catálogo with_bom
    description: Catálogo de productos sin cabecera
    filename: with_bom.csv
    file_format:
      type: CSV
      delimiter: '|'
      header: false
    fields:
    - name: COLUMNA_1
      type: entero
      unique: true
      validation_rules:
      - name: Valor Positivo
        description: El valor debe ser positivo y menor o igual a 100. 🚀
        rule: df['COLUMNA_1'].astype(int).between(0, 100)
        severity: error
      required: false
    - name: COLUMNA_2
      type: texto
      unique: false
      required: false
      validation_rules: []
    - name: COLUMNA_3
      type: decimal
      unique: false
      validation_rules:
      - name: Valor Positivo
        description: El valor debe ser positivo. 💹
        rule: df['COLUMNA_3'].astype(float) >= 0
        severity: error
      required: false
    - name: COLUMNA_4
      type: fecha
      unique: true
      validation_rules:
      - name: Formato de Fecha
        description: La fecha debe estar en formato YYYY-MM-DD. 📅
        rule: pd.to_datetime(df['COLUMNA_4'], errors='coerce').notnull()
        severity: error
      required: false
    catalog_validation:
    - name: validar_num_columnas
      rule: len(df.columns) == 4
      description: El archivo debe tener exactamente 4 columnas
      severity: ERROR
packages:
  paquete_with_bom:
    name: Paquete de Validación with_bom
    description: Paquete que contiene el catálogo with_bom para validación de datos.
    file_format:
      type: ZIP
    catalogs:
    - with_bom"""
            
            return sample_yaml
            
    def analyze_file_structure(self, file_path: str) -> Dict:
        """Analyze structure of input file"""
        file_info = {
            'filename': os.path.basename(file_path),
            'extension': os.path.splitext(file_path)[1].lower(),
            'file_path': file_path,
            'files_info': {}
        }

        try:
            if file_info['extension'] == '.zip':
                self.logger.message(f"📦 Procesando archivo ZIP: {file_path}")
                with tempfile.TemporaryDirectory() as temp_dir:
                    with ZipFile(file_path) as zf:
                        contained_files = [
                            f for f in zf.namelist()
                            if f.endswith(('.csv', '.xlsx', '.xls'))
                        ]
                        self.logger.message(f"📑 Archivos encontrados: {', '.join(contained_files)}")
                        file_info['contained_files'] = contained_files

                        for filename in contained_files:
                            self.logger.message(f"🔍 Analizando archivo: {filename}")
                            zf.extract(filename, temp_dir)
                            extracted_path = os.path.join(temp_dir, filename)
                            file_analysis = self.analyze_csv_excel(extracted_path)
                            self.logger.message(f"✓ Columnas encontradas: {', '.join(file_analysis['columns'])}")
                            file_info['files_info'][filename] = file_analysis

            else:  # Single CSV/Excel file
                self.logger.message(f"📄 Procesando archivo individual: {file_path}")
                file_analysis = self.analyze_csv_excel(file_path)
                file_info.update(file_analysis)

            return file_info

        except Exception as e:
            raise YAMLGenerationError(f"Error analyzing file structure: {str(e)}")

    def load_yaml_spec(self) -> str:
        """Load YAML specification from documentation"""
        try:
            docs_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'docs', 'YAML_SPEC.md')
            with open(docs_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Get all relevant content between Introducción and Ciclo de Vida
            start_idx = content.find('## 🎯 Introducción')
            end_idx = content.find('## 🔄 Ciclo de Vida de un YAML')
            if end_idx == -1:
                end_idx = len(content)

            return content[start_idx:end_idx].strip()
        except Exception as e:
            self.logger.warning(f"Error loading YAML spec: {str(e)}")
            return "Error loading YAML spec"

    def load_prompt_template(self) -> str:
        """Load AI prompt template"""
        try:
            template_path = os.path.join(os.path.dirname(__file__), 'ai_prompt_yaml_studio.frm')
            with open(template_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except Exception as e:
            self.logger.warning(f"Error loading prompt template: {str(e)}")
            return "Error loading prompt template"

    def generate_prompt(self, file_info: Dict, instructions: str, yaml_spec: str) -> str:
        """Generate the prompt that will be sent to O3 Mini API"""
        template = self.load_prompt_template()
        if not template:
            raise YAMLGenerationError("Could not load prompt template")

        # Obtener nombre del archivo
        nombre_archivo = file_info['filename']
        
        # Obtener tipo de archivo
        if 'file_type' in file_info and file_info['file_type'] == 'excel':
            tipo_archivo = 'EXCEL'
        else:
            tipo_archivo = file_info['extension'].upper()[1:]
        
        # Número de archivos en el ZIP
        if file_info['extension'] == '.zip' and 'contained_files' in file_info:
            num_archivos = len(file_info['contained_files'])
            # Lista de archivos dentro del ZIP
            lista_archivos_zip = "\n".join(f"  - {f}" for f in file_info['contained_files'])
        else:
            # Para archivos individuales, indicar claramente que no es un ZIP
            num_archivos = "0 (No aplica - Este es un archivo individual, no un ZIP)"
            lista_archivos_zip = "No hay archivos contenidos - Este es un archivo individual de tipo " + tipo_archivo
        
        # Preparar ejemplos de datos (5 primeras líneas, 5 del medio y 5 finales de cada archivo)
        ejemplos_de_datos = []
        datos_json = {}
        
        def extract_samples(raw_examples, delimiter='|'):
            """
            Extrae muestras representativas del archivo y convierte cada línea en un array de valores
            individuales separados por el delimitador.
            
            Args:
                raw_examples: Lista de líneas de ejemplo
                delimiter: El delimitador usado en el archivo (por defecto pipe '|')
            
            Returns:
                Tuple: (líneas combinadas como strings, diccionario JSON con arrays de valores)
            """
            if not raw_examples:
                empty_result = ["No hay ejemplos disponibles"]
                empty_array = [[]]
                return empty_result, {
                    "muestras": {
                        "primeras_lineas": empty_array,
                        "lineas_del_medio": empty_array,
                        "ultimas_lineas": empty_array
                    }
                }
                
            # Función para dividir una línea en valores individuales
            def split_line_to_values(line):
                # Dividir por el delimitador y preservar campos vacíos
                if isinstance(line, str):
                    values = line.split(delimiter)
                    # Trimming de espacios
                    return [v.strip() for v in values]
                return [""]  # En caso de recibir algo que no sea un string
            
            # Para archivos pequeños (15 líneas o menos), usamos todas las líneas disponibles
            if len(raw_examples) <= 15:
                # Distribuir equitativamente las líneas si es posible
                if len(raw_examples) <= 5:
                    # Si hay 5 o menos líneas, todo va en las tres secciones
                    # para asegurar que se incluyan todas las líneas del archivo
                    primeras = raw_examples
                    medias = raw_examples
                    ultimas = raw_examples
                elif len(raw_examples) <= 10:
                    # Si hay entre 6 y 10 líneas, usar todas las líneas distribuidas equitativamente
                    # Primeras: primeras 3-5 líneas
                    # Medias: todas las líneas (para garantizar que se vean todas)
                    # Últimas: últimas 3-5 líneas
                    mid_point = len(raw_examples) // 2
                    primeras = raw_examples[:mid_point]
                    medias = raw_examples  # Todas las líneas
                    ultimas = raw_examples[mid_point:]
                else:
                    # Si hay entre 11 y 15 líneas, usarlas todas pero distribuidas en tres partes
                    # con cierto solapamiento para asegurar que se vean todas
                    third = len(raw_examples) // 3
                    primeras = raw_examples[:third+1]  # Añadir solapamiento
                    medias = raw_examples  # Todas para garantizar que se vean todas
                    ultimas = raw_examples[-(third+1):]  # Añadir solapamiento
                
                # Para archivos pequeños no usamos separadores
                combined = raw_examples
            else:
                # Para archivos grandes, usar el enfoque original
                primeras = raw_examples[:5]
                
                # Calcular el índice del medio (desde donde tomar 5 líneas)
                mid_index = len(raw_examples) // 2 - 2
                if mid_index < 5:
                    mid_index = 5
                
                # Extraer 5 líneas del medio
                medias = raw_examples[mid_index:mid_index+5]
                
                # Extraer las 5 últimas líneas
                ultimas = raw_examples[-5:]
                
                # Juntar todo con marcadores
                combined = (
                    primeras + 
                    ["..."] +  # Separador para indicar que hay datos omitidos
                    medias + 
                    ["..."] +  # Separador para indicar que hay datos omitidos
                    ultimas
                )
            
            # Convertir líneas a arrays de valores para el JSON
            primeras_valores = [split_line_to_values(line) for line in primeras]
            medias_valores = [split_line_to_values(line) for line in medias]
            ultimas_valores = [split_line_to_values(line) for line in ultimas]
            
            # Para texto, mantenemos las líneas originales
            # Para JSON, convertimos a arrays de valores
            return combined, {
                "muestras": {
                    "primeras_lineas": primeras_valores,
                    "lineas_del_medio": medias_valores,
                    "ultimas_lineas": ultimas_valores
                }
            }
        
        if file_info['extension'] == '.zip' and 'files_info' in file_info:
            datos_json["archivos"] = {}
            for filename, info in file_info['files_info'].items():
                raw_examples = info.get('raw_examples', ['No hay ejemplos disponibles'])
                
                # Detectar delimitador y extraer muestras representativas
                delim = info.get('delimiter', '|')  # Usar pipe como valor por defecto si no se especifica
                samples_text, samples_json = extract_samples(raw_examples, delim)
                
                # Agregar al texto de ejemplos
                ejemplos_de_datos.append(f"archivo {filename} contenido ejemplo:")
                ejemplos_de_datos.extend(samples_text)
                ejemplos_de_datos.append("")  # Línea en blanco entre archivos
                
                # Agregar al JSON de datos
                datos_json["archivos"][filename] = samples_json["muestras"]
        else:
            raw_examples = file_info.get('raw_examples', ['No hay ejemplos disponibles'])
            
            # Detectar delimitador y extraer muestras representativas
            delim = file_info.get('delimiter', '|')  # Usar pipe como predeterminado
            samples_text, samples_json = extract_samples(raw_examples, delim)
            
            # Agregar al texto de ejemplos
            ejemplos_de_datos.append(f"archivo {nombre_archivo} contenido ejemplo:")
            ejemplos_de_datos.extend(samples_text)
            
            # Agregar al JSON de datos
            datos_json["archivos"] = {nombre_archivo: samples_json["muestras"]}
        
        ejemplos_texto = "\n".join(ejemplos_de_datos)
        json_texto = json.dumps(datos_json, ensure_ascii=False, indent=2)
        
        # Cargar las especificaciones de YAML SAGE
        especificaciones_yaml = yaml_spec
        
        # Instrucciones del usuario (sin modificar)
        instrucciones_usuario = instructions
        
        # Fill template placeholders with correct data
        # The template uses 'datos_json' for JSON data
        prompt = template.format(
            nombre_archivo=nombre_archivo,
            tipo_archivo=tipo_archivo,
            num_archivos=num_archivos,
            lista_archivos_zip=lista_archivos_zip,
            estructura_archivos="",  # Ya no se usa
            ejemplos_de_datos=ejemplos_texto,
            datos_json=json_texto,
            instrucciones_usuario=instrucciones_usuario,
            especificaciones_YAML_SAGE=especificaciones_yaml
        )

        # Save complete prompt for verification
        os.makedirs('tmp', exist_ok=True)
        with open('tmp/prompt.txt', 'w', encoding='utf-8') as f:
            f.write(prompt)

        return prompt

    def generate_yaml(self, input_file: str, instruction_file: Optional[str] = None) -> str:
        """Generate YAML configuration using O3 Mini API"""
        try:
            self.logger.message("=== Iniciando generación de YAML ===")
            file_info = self.analyze_file_structure(input_file)
            instructions = self.get_instructions(instruction_file)
            yaml_spec = self.load_yaml_spec()
            
            # Verificar si es un archivo ZIP con múltiples archivos
            if (file_info['extension'] == '.zip' and 
                'contained_files' in file_info and 
                len(file_info['contained_files']) > 3):
                
                # Para archivos ZIP grandes, procesar en lotes
                self.logger.message(f"⚠️ ZIP con {len(file_info['contained_files'])} archivos detectado. Procesando en lotes...")
                
                # Procesar en lotes de máximo 3 archivos
                batch_size = 3
                num_batches = (len(file_info['contained_files']) + batch_size - 1) // batch_size
                
                # Diccionario para almacenar todos los catálogos generados
                all_catalogs = {}
                
                for batch_num in range(num_batches):
                    start_idx = batch_num * batch_size
                    end_idx = min((batch_num + 1) * batch_size, len(file_info['contained_files']))
                    
                    batch_files = file_info['contained_files'][start_idx:end_idx]
                    self.logger.message(f"📦 Procesando lote {batch_num + 1}/{num_batches}: {', '.join(batch_files)}")
                    
                    # Crear una copia del file_info con solo los archivos del lote actual
                    batch_info = file_info.copy()
                    batch_info['contained_files'] = batch_files
                    batch_info['files_info'] = {f: file_info['files_info'][f] for f in batch_files}
                    
                    # Generar prompt para este lote
                    batch_prompt = self.generate_prompt(batch_info, instructions, yaml_spec)
                    
                    # Llamar a la API para este lote
                    self.logger.message(f"🤖 Llamando a O3 Mini API para lote {batch_num + 1}...")
                    messages = [
                        {
                            "role": "system",
                            "content": "You are a YAML expert for SAGE. Generate a valid YAML configuration following all instructions in the prompt. Pay special attention to the user's specific instructions under the === INSTRUCCIONES DEL USUARIO === section."
                        },
                        {
                            "role": "user",
                            "content": batch_prompt
                        }
                    ]
                    
                    # Usar nuestra función personalizada para llamar a la API de O3 Mini
                    batch_yaml = self.call_o3_mini_api(
                        messages=messages,
                        temperature=0.2,
                        timeout=300  # 5 minutos para cada lote
                    )
                    batch_yaml = self._remove_path_field(batch_yaml)
                    batch_yaml = self._post_process_yaml(batch_yaml, batch_info)
                    
                    # Extraer catálogos de este lote
                    batch_dict = yaml.safe_load(batch_yaml)
                    if 'catalogs' in batch_dict:
                        all_catalogs.update(batch_dict['catalogs'])
                    
                # Construir YAML final con las tres secciones obligatorias
                final_yaml = {
                    'sage_yaml': {
                        'name': os.path.splitext(os.path.basename(input_file))[0],
                        'description': f"Configuración generada para {len(all_catalogs)} catálogos",
                        'version': '1.0.0',
                        'author': 'YAML Studio'
                    },
                    'catalogs': all_catalogs,
                    'packages': {
                        'paquete_principal': {
                            'name': 'Paquete Principal',
                            'description': 'Paquete que agrupa todos los catálogos',
                            'file_format': {
                                'type': 'ZIP'
                            },
                            'catalogs': list(all_catalogs.keys())
                        }
                    }
                }
                
                yaml_content = yaml.dump(final_yaml, sort_keys=False, allow_unicode=True)
                
            else:
                # Procesamiento normal para archivos únicos o ZIP pequeños
                prompt = self.generate_prompt(file_info, instructions, yaml_spec)
                
                self.logger.message("🤖 Llamando a O3 Mini API...")
                messages = [
                    {
                        "role": "system",
                        "content": "You are a YAML expert for SAGE. Generate a valid YAML configuration following all instructions in the prompt. Pay special attention to the user's specific instructions under the === INSTRUCCIONES DEL USUARIO === section."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
                
                # Usar nuestra función personalizada para llamar a la API de O3 Mini
                yaml_content = self.call_o3_mini_api(
                    messages=messages,
                    temperature=0.2,
                    timeout=300  # 5 minutos para manejar archivos grandes
                )
                yaml_content = self._remove_path_field(yaml_content)
                yaml_content = self._post_process_yaml(yaml_content, file_info)
                
                # Verificar si el YAML generado tiene las secciones obligatorias
                yaml_dict = yaml.safe_load(yaml_content)
                if 'catalogs' in yaml_dict and not ('sage_yaml' in yaml_dict and 'packages' in yaml_dict):
                    # Si falta alguna sección obligatoria, completamos el YAML
                    catalogs = yaml_dict.get('catalogs', {})
                    
                    # Crear un YAML completo
                    complete_yaml = {
                        'sage_yaml': {
                            'name': os.path.splitext(os.path.basename(input_file))[0],
                            'description': f"Configuración generada para {len(catalogs)} catálogos",
                            'version': '1.0.0',
                            'author': 'YAML Studio'
                        },
                        'catalogs': catalogs,
                        'packages': {
                            'paquete_principal': {
                                'name': 'Paquete Principal',
                                'description': 'Paquete que agrupa todos los catálogos',
                                'file_format': {
                                    'type': 'ZIP'
                                },
                                'catalogs': list(catalogs.keys())
                            }
                        }
                    }
                    yaml_content = yaml.dump(complete_yaml, sort_keys=False, allow_unicode=True)
            
            # Guardar la respuesta para verificación
            os.makedirs('tmp', exist_ok=True)
            with open('tmp/response.yaml', 'w', encoding='utf-8') as f:
                f.write(yaml_content)
                
            return yaml_content

        except Exception as e:
            error_msg = str(e)
            
            # Mejorar el mensaje para el timeout
            if "timeout" in error_msg.lower():
                error_msg = "Se agotó el tiempo de espera al llamar a la API de O3 Mini. El archivo es demasiado grande o complejo. Intente con un archivo más pequeño o espere un momento y vuelva a intentarlo."
                
            raise YAMLGenerationError(f"Error generando YAML: {error_msg}")

    def _generate_validation_suggestions(self, file_info: Dict, column_names: list, filename: str) -> str:
        """Generar sugerencias de validación basadas en el análisis de los datos"""
        # Eliminamos las sugerencias específicas de columnas y en su lugar indicamos que se deben 
        # seguir las instrucciones proporcionadas por el usuario para las validaciones
        
        msg = """
Para validaciones específicas, sigue las instrucciones proporcionadas por el usuario.
Algunos tipos de validaciones recomendadas en general:
- Verifica los campos que podrían ser claves primarias (valores únicos)
- Valida formatos de fechas (como YYYY-MM-DD)
- Asegura que los campos numéricos tengan rangos apropiados
- Valida que los códigos e identificadores tengan el formato correcto
- Verifica las relaciones entre catálogos para mantener integridad referencial

No asignes nombres de columna arbitrarios. Utiliza exactamente los nombres proporcionados en las instrucciones del usuario.
"""
        return msg
        
    def get_instructions(self, instruction_file: Optional[str] = None) -> str:
        """Get instructions from file or use defaults"""
        if instruction_file:
            # Intentar diferentes rutas para el archivo de instrucciones
            possible_paths = [
                instruction_file,
                os.path.join(os.path.dirname(__file__), instruction_file),
                os.path.join(os.getcwd(), instruction_file),
                os.path.join('test_cli', os.path.basename(instruction_file))
            ]
            
            for path in possible_paths:
                self.logger.message(f"Intentando leer instrucciones desde: {path}")
                if os.path.exists(path):
                    try:
                        with open(path, 'rb') as f:  # Usar modo binario para preservar exactamente el contenido
                            # Leer como bytes y convertir a string sin modificar el contenido
                            content = f.read()
                            # Detectar codificación, incluyendo posible BOM
                            if content.startswith(b'\xef\xbb\xbf'):  # UTF-8 con BOM
                                instructions = content[3:].decode('utf-8')
                            else:
                                try:
                                    instructions = content.decode('utf-8')
                                except UnicodeDecodeError:
                                    instructions = content.decode('latin1')
                                    
                            self.logger.message(f"✓ Instrucciones cargadas desde {path}: {len(instructions)} caracteres")
                            # Devolver las instrucciones exactamente como están, sin modificar
                            return instructions
                    except Exception as e:
                        self.logger.warning(f"Error leyendo archivo de instrucciones {path}: {str(e)}")
                        continue
            
            # Si llegamos aquí, no se pudo leer ninguna de las rutas posibles
            self.logger.warning(f"No se pudo encontrar o leer el archivo de instrucciones en ninguna ubicación.")
            self.logger.message(f"Directorio actual: {os.getcwd()}")
            
            # Mostrar contenido del directorio test_cli si existe
            test_cli_dir = os.path.join(os.getcwd(), 'test_cli')
            if os.path.exists(test_cli_dir):
                self.logger.message(f"Archivos en test_cli: {os.listdir(test_cli_dir)}")
            
            return f"No se pudo encontrar o leer el archivo de instrucciones: {instruction_file}"

        # Default instructions if no file is provided
        return """
        Genera una configuración YAML para SAGE que:
        1. Valide todos los campos requeridos según su importancia en el negocio
        2. Asegure que los tipos de datos sean correctos según los ejemplos
        3. Implemente reglas de validación apropiadas para cada tipo de campo
        4. Incluya validaciones entre catálogos relacionados
        5. Siga la estructura YAML de SAGE con todas las secciones obligatorias (sage_yaml, catalogs, packages)
        6. Proporcione mensajes de error claros y útiles
        7. Asegúrese de usar los tipos de datos correctos según el esquema de SAGE:
           - 'texto' para valores alfanuméricos
           - 'decimal' para números con decimales
           - 'entero' para números enteros
           - 'fecha' para fechas
           - 'booleano' para valores true/false
        8. Configure correctamente la propiedad 'header' dentro de 'file_format' según corresponda
        """

    def _post_process_yaml(self, yaml_content: str, file_info: Dict) -> str:
        """Post-procesar el YAML para corregir delimitadores, nombres de columna y validaciones"""
        try:
            # Cargar el YAML como diccionario
            yaml_dict = yaml.safe_load(yaml_content)
            
            # Verificar que el YAML tenga las tres secciones obligatorias
            if not yaml_dict:
                self.logger.warning("YAML vacío o inválido generado. Creando un esqueleto básico.")
                yaml_dict = {
                    'sage_yaml': {
                        'name': os.path.splitext(os.path.basename(file_info.get('filename', 'config'))).split('.')[0],
                        'description': "Configuración generada automáticamente",
                        'version': '1.0.0',
                        'author': 'YAML Studio'
                    },
                    'catalogs': {},
                    'packages': {}
                }
            else:
                # Asegurar que exista la sección sage_yaml
                if 'sage_yaml' not in yaml_dict:
                    self.logger.warning("Agregando sección sage_yaml faltante")
                    yaml_dict['sage_yaml'] = {
                        'name': os.path.splitext(os.path.basename(file_info.get('filename', 'config'))).split('.')[0],
                        'description': "Configuración generada automáticamente",
                        'version': '1.0.0',
                        'author': 'YAML Studio'
                    }
                
                # Asegurar que exista la sección packages
                if 'packages' not in yaml_dict and 'catalogs' in yaml_dict:
                    self.logger.warning("Agregando sección packages faltante")
                    package_type = 'ZIP' if file_info.get('extension') == '.zip' else file_info.get('extension', '.CSV').upper()[1:]
                    yaml_dict['packages'] = {
                        'paquete_principal': {
                            'name': 'Paquete Principal',
                            'description': 'Paquete que agrupa todos los catálogos',
                            'file_format': {
                                'type': package_type
                            },
                            'catalogs': list(yaml_dict['catalogs'].keys())
                        }
                    }
            
            # Función para procesar un único catálogo
            def process_catalog(catalog_dict, detected_delimiter, has_bom, has_header, catalog_id):
                # Verificar si el catálogo tiene la sección file_format
                if 'file_format' not in catalog_dict:
                    catalog_dict['file_format'] = {
                        'type': 'CSV',
                        'delimiter': detected_delimiter,
                        'header': has_header
                    }
                else:
                    # Corregir el delimitador para los archivos con BOM
                    if 'delimiter' not in catalog_dict['file_format']:
                        catalog_dict['file_format']['delimiter'] = detected_delimiter
                    elif has_bom and catalog_dict['file_format']['delimiter'] != detected_delimiter:
                        self.logger.warning(f"Corrigiendo delimitador: '{catalog_dict['file_format']['delimiter']}' -> '{detected_delimiter}'")
                        catalog_dict['file_format']['delimiter'] = detected_delimiter
                    
                    # Asegurar que header esté configurado correctamente
                    if 'header' not in catalog_dict['file_format']:
                        catalog_dict['file_format']['header'] = has_header
                    elif catalog_dict['file_format']['header'] != has_header:
                        self.logger.warning(f"Corrigiendo header: {catalog_dict['file_format']['header']} -> {has_header}")
                        catalog_dict['file_format']['header'] = has_header
                
                # Corregir campos si no hay cabecera o si faltan
                if 'fields' not in catalog_dict:
                    self.logger.warning(f"Catálogo {catalog_id} sin campos definidos. Generando esqueleto.")
                    catalog_dict['fields'] = []
                
                if not has_header and 'fields' in catalog_dict:
                    renamed_fields = []
                    for i, field in enumerate(catalog_dict['fields']):
                        if 'name' not in field:
                            field['name'] = f"COLUMNA_{i+1}"
                            self.logger.warning(f"Agregando nombre faltante para campo: 'COLUMNA_{i+1}'")
                        # Si el campo tiene un nombre como "Unnamed: X", cambiarlo a "COLUMNA_N"
                        elif field['name'].startswith('Unnamed:'):
                            field['name'] = f"COLUMNA_{i+1}"
                            self.logger.warning(f"Renombrando campo '{field['name']}' a 'COLUMNA_{i+1}'")
                        
                        # Asegurar que todos los campos tengan un tipo válido
                        if 'type' not in field or field['type'] not in ['texto', 'entero', 'decimal', 'fecha', 'booleano']:
                            field['type'] = 'texto'  # Por defecto, usar texto para campos sin tipo o con tipo inválido
                            self.logger.warning(f"Corrigiendo tipo para campo '{field['name']}' a 'texto'")
                        
                        renamed_fields.append(field)
                    catalog_dict['fields'] = renamed_fields
                
                # Asegurar que cada campo tenga validaciones mínimas
                for field in catalog_dict['fields']:
                    # Si falta la propiedad required, agregarla como false por defecto
                    if 'required' not in field:
                        field['required'] = False
                    
                    # Si falta la propiedad unique, agregarla como false por defecto
                    if 'unique' not in field:
                        field['unique'] = False
                    
                    # Asegurar que haya al menos algunas reglas de validación básicas
                    if 'validation_rules' not in field:
                        field['validation_rules'] = []
                        
                        # Agregar validaciones según el tipo
                        if field['type'] == 'entero':
                            field['validation_rules'].append({
                                'name': 'validar_entero',
                                'rule': f"df['{field['name']}'].astype(str).str.match(r'^-?\\d+$')",
                                'description': f"El campo {field['name']} debe ser un número entero",
                                'severity': 'ERROR'
                            })
                        elif field['type'] == 'decimal':
                            field['validation_rules'].append({
                                'name': 'validar_decimal',
                                'rule': f"df['{field['name']}'].astype(str).str.match(r'^-?\\d+(\\.\\d+)?$')",
                                'description': f"El campo {field['name']} debe ser un número decimal",
                                'severity': 'ERROR'
                            })
                        elif field['type'] == 'fecha':
                            field['validation_rules'].append({
                                'name': 'validar_fecha',
                                'rule': f"pd.to_datetime(df['{field['name']}'], errors='coerce').notna()",
                                'description': f"El campo {field['name']} debe ser una fecha válida",
                                'severity': 'ERROR'
                            })
                
                # Si el catálogo no tiene reglas de validación, agregar al menos una básica
                if 'catalog_validation' not in catalog_dict:
                    catalog_dict['catalog_validation'] = []
                    
                    # Agregar una regla que valide el número de columnas esperado
                    if 'fields' in catalog_dict and catalog_dict['fields']:
                        num_fields = len(catalog_dict['fields'])
                        catalog_dict['catalog_validation'].append({
                            'name': 'validar_num_columnas',
                            'rule': f"len(df.columns) == {num_fields}",
                            'description': f"El archivo debe tener exactamente {num_fields} columnas",
                            'severity': 'ERROR'
                        })
                
                return catalog_dict
            
            # Para archivos ZIP, procesar cada catálogo individualmente
            if 'extension' in file_info and file_info['extension'] == '.zip':
                if 'catalogs' in yaml_dict and 'files_info' in file_info:
                    for catalog_id, catalog in yaml_dict['catalogs'].items():
                        # Buscar información correspondiente en file_info
                        filename = None
                        for fname in file_info['files_info']:
                            if catalog_id == os.path.splitext(fname)[0]:
                                filename = fname
                                break
                        
                        if filename and filename in file_info['files_info']:
                            file_data = file_info['files_info'][filename]
                            detected_delimiter = file_data.get('delimiter', '|')
                            has_bom = file_data.get('has_bom', False)
                            
                            # Para CSVs, aplicar reglas más estrictas para determinar si tiene cabecera
                            if filename.lower().endswith('.csv'):
                                unnamed_count = sum(1 for col in file_data['columns'] if str(col).startswith('Unnamed:'))
                                has_unnamed_columns = unnamed_count > len(file_data['columns']) / 3
                                has_numeric_column_names = any(re.search(r'\d', str(col)) for col in file_data['columns'] if not str(col).startswith('Unnamed:'))
                                has_long_column_names = any(len(str(col).split()) > 2 for col in file_data['columns'] if not str(col).startswith('Unnamed:'))
                                has_very_long_names = any(len(str(col)) > 20 for col in file_data['columns'] if not str(col).startswith('Unnamed:'))
                                
                                # Por defecto para CSV, no tiene cabecera
                                has_header = False
                                
                                # Solo si todas las condiciones son falsas, considerar que puede tener cabecera
                                if not (has_unnamed_columns or has_numeric_column_names or has_long_column_names or has_very_long_names):
                                    # Verificar si la primera fila es claramente diferente de las demás (posibles encabezados)
                                    if len(file_data.get('data_samples', [])) >= 2:
                                        first_row_cols = list(file_data['data_samples'][0].values())
                                        second_row_cols = list(file_data['data_samples'][1].values() if len(file_data['data_samples']) > 1 else [])
                                        
                                        # Si la primera fila contiene principalmente texto y la segunda principalmente números, 
                                        # es probable que sea un encabezado
                                        first_row_text = sum(1 for val in first_row_cols if isinstance(val, str) and not re.search(r'^[\d\.]+$', str(val)))
                                        if first_row_text > len(first_row_cols) * 0.7:  # Si más del 70% son texto claro
                                            has_header = True
                            else:
                                # Para archivos Excel, es más común que tengan cabecera
                                has_header = True
                            
                            if not has_header:
                                self.logger.warning(f"Detectado CSV sin cabecera para {filename}")
                            
                            # Procesar el catálogo
                            yaml_dict['catalogs'][catalog_id] = process_catalog(
                                catalog, detected_delimiter, has_bom, has_header, catalog_id
                            )
            
            # Para un único archivo
            elif 'catalogs' in yaml_dict:
                # Obtener el primer (y único) catálogo
                if len(yaml_dict['catalogs']) == 1:
                    catalog_id = list(yaml_dict['catalogs'].keys())[0]
                    detected_delimiter = file_info.get('delimiter', '|')
                    has_bom = file_info.get('has_bom', False)
                    
                    # Para CSVs, aplicar reglas más estrictas para determinar si tiene cabecera
                    if file_info.get('extension', '').lower() == '.csv':
                        columns = file_info.get('columns', [])
                        unnamed_count = sum(1 for col in columns if str(col).startswith('Unnamed:'))
                        has_unnamed_columns = unnamed_count > len(columns) / 3 if columns else True
                        has_numeric_column_names = any(re.search(r'\d', str(col)) for col in columns if not str(col).startswith('Unnamed:'))
                        has_long_column_names = any(len(str(col).split()) > 2 for col in columns if not str(col).startswith('Unnamed:'))
                        has_very_long_names = any(len(str(col)) > 20 for col in columns if not str(col).startswith('Unnamed:'))
                        
                        # Por defecto para CSV, no tiene cabecera
                        has_header = False
                        
                        # Solo si todas las condiciones son falsas, considerar que puede tener cabecera
                        if not (has_unnamed_columns or has_numeric_column_names or has_long_column_names or has_very_long_names):
                            # Verificar si la primera fila es claramente diferente de las demás (posibles encabezados)
                            if len(file_info.get('data_samples', [])) >= 2:
                                first_row_cols = list(file_info['data_samples'][0].values())
                                second_row_cols = list(file_info['data_samples'][1].values() if len(file_info['data_samples']) > 1 else [])
                                
                                # Si la primera fila contiene principalmente texto y la segunda principalmente números, 
                                # es probable que sea un encabezado
                                first_row_text = sum(1 for val in first_row_cols if isinstance(val, str) and not re.search(r'^[\d\.]+$', str(val)))
                                if first_row_text > len(first_row_cols) * 0.7:  # Si más del 70% son texto claro
                                    has_header = True
                    else:
                        # Para archivos Excel, es más común que tengan cabecera
                        has_header = True
                    
                    if not has_header:
                        self.logger.warning(f"Detectado CSV sin cabecera para archivo individual")
                    
                    # Procesar el catálogo
                    yaml_dict['catalogs'][catalog_id] = process_catalog(
                        yaml_dict['catalogs'][catalog_id], detected_delimiter, has_bom, has_header, catalog_id
                    )
            
            # Convertir de nuevo a YAML y devolver
            return yaml.dump(yaml_dict, sort_keys=False, allow_unicode=True)
            
        except Exception as e:
            self.logger.warning(f"Error en post-procesamiento del YAML: {str(e)}")
            # Si hay un error, devolver el contenido original
            return yaml_content
    
    def save_yaml(self, yaml_content: str, output_path: str) -> None:
        """Save generated YAML to file"""
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(yaml_content)
            self.logger.success(f"💾 YAML guardado en: {output_path}")
        except Exception as e:
            raise YAMLGenerationError(f"Error guardando YAML: {str(e)}")