# Documentación del Módulo SAGE.main

## Descripción General

El módulo `sage.main` es el punto de entrada principal para el procesador SAGE (Sistema Avanzado de Gestión de Estructuras) y coordina el flujo completo de procesamiento y validación de archivos según reglas definidas en archivos YAML.

Este componente es crítico en el sistema SAGE ya que:

1. Coordina el procesamiento de archivos (CSV, Excel, ZIP) según configuraciones YAML
2. Gestiona la creación de directorios de ejecución con identificadores UUID
3. Establece el flujo de validación y procesamiento
4. Genera informes detallados de resultados
5. Mantiene registro de errores y advertencias

## Estructura del Módulo

### Funciones Principales

#### `process_files()`

```python
def process_files(yaml_path: str, data_path: str, casilla_id: Optional[int] = None, 
                 emisor_id: Optional[int] = None, metodo_envio: Optional[str] = "direct_upload",
                 specific_uuid: Optional[str] = None) -> Tuple[str, int, int]:
```

**Descripción:** Procesa archivos según la configuración YAML especificada.

**Parámetros:**
- `yaml_path` (str): Ruta al archivo YAML con reglas de validación
- `data_path` (str): Ruta al archivo de datos a procesar
- `casilla_id` (Optional[int]): ID opcional del buzón (casilla)
- `emisor_id` (Optional[int]): ID opcional del remitente (emisor)
- `metodo_envio` (Optional[str]): Método utilizado para enviar el archivo ('sftp', 'email', 'direct_upload', 'portal_upload', 'api')
- `specific_uuid` (Optional[str]): UUID específico a utilizar para el directorio de ejecución (si se omite, se genera uno)

**Retorno:** 
- Tupla (execution_uuid, error_count, warning_count)
  - `execution_uuid` (str): Identificador único de la ejecución
  - `error_count` (int): Número de errores detectados
  - `warning_count` (int): Número de advertencias detectadas

**Flujo de ejecución:**
1. Crea o utiliza el directorio de ejecución con UUID
2. Configura el logger de SAGE
3. Copia los archivos de entrada al directorio de ejecución
4. Valida la estructura del archivo YAML
5. Determina el tipo de archivo y selecciona el paquete/catálogo correspondiente
6. Invoca al `FileProcessor` para procesar el archivo
7. Genera un resumen de ejecución
8. Retorna el UUID de ejecución y conteo de errores/advertencias

#### `create_execution_directory()`

```python
def create_execution_directory(specific_uuid: Optional[str] = None) -> Tuple[str, str]:
```

**Descripción:** Crea un nuevo directorio de ejecución con UUID y retorna su ruta.

**Parámetros:**
- `specific_uuid` (Optional[str]): UUID específico a utilizar (opcional)

**Retorno:**
- Tupla (execution_dir, execution_uuid)
  - `execution_dir` (str): Ruta completa al directorio de ejecución
  - `execution_uuid` (str): UUID de la ejecución

**Comportamiento:**
- Si no se proporciona un UUID específico, genera uno nuevo
- Crea un directorio en la ruta `<cwd>/executions/<uuid>`
- Garantiza que el directorio exista con `os.makedirs()`

#### `copy_input_files()`

```python
def copy_input_files(execution_dir: str, yaml_path: str, data_path: str) -> Tuple[str, str]:
```

**Descripción:** Copia los archivos de entrada al directorio de ejecución y retorna las nuevas rutas.

**Parámetros:**
- `execution_dir` (str): Directorio de ejecución
- `yaml_path` (str): Ruta al archivo YAML
- `data_path` (str): Ruta al archivo de datos

**Retorno:**
- Tupla (yaml_dest, data_dest)
  - `yaml_dest` (str): Nueva ruta del archivo YAML
  - `data_dest` (str): Nueva ruta del archivo de datos

**Comportamiento:**
- Preserva la extensión original del archivo de datos
- Copia el archivo YAML como "input.yaml"
- Copia el archivo de datos como "data.<extensión_original>"

#### `main()`

**Descripción:** Punto de entrada principal para el script cuando se ejecuta desde línea de comandos.

**Comportamiento:**
- Configura el análisis de argumentos de línea de comandos
- Valida la existencia de archivos de entrada
- Invoca a `process_files()` con los parámetros proporcionados
- Gestiona excepciones y muestra mensajes de error

## Clases relacionadas

### `FileProcessor`

La clase `FileProcessor` (del módulo `sage.file_processor`) es responsable de:

1. Validar y procesar archivos según configuraciones YAML
2. Aplicar reglas de validación a nivel de campo, fila y catálogo
3. Extraer datos de archivos ZIP, CSV y Excel
4. Convertir y validar tipos de datos
5. Generar informes detallados de errores y advertencias

**Métodos clave:**
- `process_file()`: Procesa un archivo según configuración
- `_validate_data_types()`: Valida y convierte tipos de datos
- `_process_zip_package()`: Procesa archivos en paquetes ZIP
- `_process_catalog()`: Procesa un catálogo específico
- `_evaluate_field_rules()`: Evalúa reglas a nivel de campo
- `_evaluate_row_rules()`: Evalúa reglas a nivel de fila
- `_evaluate_catalog_rules()`: Evalúa reglas a nivel de catálogo

### `SageLogger`

La clase `SageLogger` (del módulo `sage.logger`) es responsable de:

1. Registrar eventos durante el procesamiento (errores, advertencias, mensajes)
2. Generar reportes en múltiples formatos (HTML, texto plano, JSON)
3. Mantener estadísticas de procesamiento
4. Proporcionar información de diagnóstico detallada

**Archivos generados:**
- `report.html`: Reporte detallado en formato HTML para visualización
- `output.log`: Registro del sistema en texto plano
- `error.log`: Registro específico de errores
- `results.txt`: Resumen de resultados en texto plano
- `report.json`: Reporte estructurado en formato JSON

**Métodos clave:**
- `error()`: Registra un error
- `warning()`: Registra una advertencia
- `message()`: Registra un mensaje informativo
- `success()`: Registra un éxito
- `rule_validation()`: Registra resultado de validación de regla
- `finalize_report()`: Finaliza y genera todos los reportes

### `YAMLValidator`

La clase `YAMLValidator` (del módulo `sage.yaml_validator`) es responsable de:

1. Cargar y validar archivos YAML según el esquema de SAGE
2. Convertir la configuración YAML en objetos Python utilizables
3. Verificar la coherencia y validez de las reglas definidas

**Métodos clave:**
- `load_and_validate()`: Carga y valida un archivo YAML
- `validate_schema()`: Valida el esquema del YAML
- `_validate_catalogs()`: Valida la sección de catálogos
- `_validate_packages()`: Valida la sección de paquetes

## Relaciones entre Componentes

```
                  ┌─────────────────┐
                  │   sage.main.py  │
                  │ (Punto entrada) │
                  └─────────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
    ┌─────────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
    │ YAMLValidator  │ │ SageLogger│ │FileProcessor│
    │(Valida config) │ │(Registros)│ │(Procesado) │
    └────────────────┘ └───────────┘ └────────────┘
```

## Parámetros de Línea de Comandos

Cuando se ejecuta como script, `sage.main.py` acepta los siguientes parámetros:

- **Posicionales:**
  - `yaml_path`: Ruta al archivo YAML con reglas
  - `data_path`: Ruta al archivo de datos a procesar

- **Opcionales:**
  - `--casilla-id`: ID de la casilla asociada
  - `--emisor-id`: ID del emisor asociado
  - `--metodo-envio`: Método de envío (sftp, email, direct_upload, portal_upload, api)
  - `--uuid`: UUID específico a utilizar

## Códigos de Retorno

- **0**: Ejecución exitosa (puede tener advertencias)
- **1**: Error de validación (errores en datos, no en configuración)
- **2**: Error crítico (problemas con archivos, configuración o sistema)

## Estructura del Directorio de Ejecución

Para cada ejecución, se crea un directorio con la siguiente estructura:

```
executions/<UUID>/
  ├── input.yaml         # Archivo YAML con reglas
  ├── data.<ext>         # Archivo de datos original
  ├── report.html        # Reporte detallado en HTML
  ├── output.log         # Log en texto plano
  ├── error.log          # Log específico de errores
  ├── results.txt        # Resumen de resultados
  └── report.json        # Reporte estructurado en JSON
```

## Ejemplo de Uso

### Desde línea de comandos:

```bash
python -m sage.main ruta/al/config.yaml ruta/al/datos.csv --casilla-id 45 --metodo-envio direct_upload
```

### Desde código Python:

```python
from sage.main import process_files

execution_uuid, error_count, warning_count = process_files(
    yaml_path="ruta/al/config.yaml",
    data_path="ruta/al/datos.csv",
    casilla_id=45,
    metodo_envio="direct_upload"
)

print(f"Ejecución {execution_uuid} completada con {error_count} errores y {warning_count} advertencias")
```

### Desde API de datos directos:

El API de ingreso de datos directos (/api/casillas/[id]/datos-directos) sigue este proceso:

1. Valida los datos recibidos contra la estructura YAML de la casilla
2. Crea un archivo temporal en el directorio `tmp/` (CSV o Excel según la configuración del YAML)
3. Genera un UUID para la ejecución
4. Registra la ejecución en la base de datos con estado inicial "Parcial"
5. Ejecuta SAGE a través de un script Python temporal que invoca `process_files()`
6. Elimina los archivos temporales una vez completado el procesamiento
7. Actualiza el registro de ejecución con el resultado (errores, advertencias)

Este enfoque permite aprovechar la funcionalidad completa del procesador SAGE mientras se mantiene la integridad del proceso de ejecución, generando todos los archivos de resultados necesarios en el directorio `executions/<UUID>/` de manera estándar.

## Comportamiento de Process_Files

La función `process_files` tiene un comportamiento especializado para manejar diferentes tipos de archivos:

1. **Archivos ZIP**:
   - Solo procesa con paquetes configurados como tipo ZIP
   - Extrae y analiza cada archivo según la configuración
   
2. **Archivos Excel (XLSX/XLS)**:
   - Busca paquetes o catálogos configurados como EXCEL
   - Aplica la configuración específica para Excel (hojas, columnas, etc.)

3. **Archivos CSV**:
   - Busca paquetes o catálogos configurados como CSV
   - Respeta configuraciones de delimitadores y codificación

A nivel de implementación, sigue estos pasos en detalle:

1. Genera o usa el UUID específico para crear el directorio de ejecución
2. Configura el logger con los IDs de casilla y emisor
3. Copia los archivos de entrada al directorio de ejecución
4. Valida la configuración YAML
5. Determina el tipo de archivo a procesar basado en la extensión
6. Selecciona el paquete o catálogo más adecuado según:
   - Si es ZIP, busca paquetes de tipo ZIP
   - Si es Excel/CSV, busca coincidencias por tipo en paquetes primero
   - Si no hay paquetes coincidentes, busca en catálogos
7. Procesa el archivo con el `FileProcessor` usando el paquete/catálogo seleccionado
8. Genera informes detallados a través del logger
9. Retorna UUID, conteo de errores y advertencias