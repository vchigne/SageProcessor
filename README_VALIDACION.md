# Guía de Validación de SAGE con Reporte Detallado

Este documento explica cómo utilizar las nuevas características de validación de SAGE, que incluyen soporte mejorado para BOM, validación de columnas y generación de reportes detallados.

## Nuevas Características

La versión mejorada de SAGE ahora incluye:

1. **Soporte completo para BOM (Byte Order Mark)** - Detecta y maneja correctamente archivos CSV con marcador BOM UTF-8.

2. **Validación de columnas** - Verifica que los archivos CSV/Excel tengan el número correcto de columnas según la definición YAML.

3. **Manejo de archivos faltantes** - Detecta y reporta cuando faltan archivos definidos en el YAML dentro de un paquete ZIP.

4. **Generación de reportes detallados** - Crea archivos `results.txt` y `details.json` con estadísticas completas y detalles de errores.

5. **Continuación de validación** - Continúa procesando y validando todos los archivos en un paquete ZIP incluso después de encontrar errores.

6. **Exportación a JSON** - Genera un archivo JSON estructurado con todos los logs, errores y estadísticas para facilitar la integración con otras herramientas.

## Herramientas de Validación

### 1. Script Simple de Validación

Usa el script `validar_con_reporte.py` para validar un archivo y generar un reporte detallado:

```bash
python validar_con_reporte.py config.yaml datos.zip
```

### 2. Script de Shell para Validación

Usa el script shell `validar_con_reporte.sh` para una validación rápida:

```bash
./validar_con_reporte.sh config.yaml datos.zip
```

## Interpretación de Resultados

SAGE genera tres tipos de reportes para cada validación:

### 1. Archivo `output.log` (HTML)

Log detallado en formato HTML con todos los mensajes, errores y advertencias generados durante el proceso de validación. Ideal para revisión detallada.

### 2. Archivo `results.txt` (Texto)

El archivo `results.txt` contiene un resumen detallado de la validación con las siguientes secciones:

1. **INFORMACIÓN GENERAL**
   - Fecha y hora de ejecución
   - Duración del proceso
   - Configuración utilizada

2. **RESUMEN GLOBAL**
   - Total de registros procesados
   - Total de errores y advertencias
   - Tasa de éxito

3. **ESTADÍSTICAS POR ARCHIVO**
   - Nombre del archivo
   - Número de registros
   - Número de errores y advertencias
   - Tiempo de procesamiento

4. **ERRORES DE FORMATO**
   - Discrepancias en el número de columnas
   - Formato incorrecto de los archivos

5. **ARCHIVOS FALTANTES**
   - Lista de archivos definidos en YAML pero no encontrados en el ZIP

6. **OPTIMIZACIÓN DE RENDIMIENTO** (si aplica)
   - Reglas omitidas para archivos grandes
   - Recomendaciones de optimización

### 3. Archivo `details.json` (JSON)

El archivo `details.json` contiene toda la información de la validación en formato JSON estructurado, facilitando la integración con otras herramientas y el procesamiento automatizado.

Estructura del archivo:

```json
{
  "general_info": {
    "timestamp": "2025-03-31T12:34:56.789",
    "start_time": "2025-03-31T12:30:00.000",
    "end_time": "2025-03-31T12:34:56.789",
    "execution_time_seconds": 296.78,
    "config_file": "config.yaml"
  },
  "summary": {
    "total_records": 1000,
    "total_errors": 5,
    "total_warnings": 2,
    "success_rate": 99.5
  },
  "file_stats": {
    "clientes.csv": {
      "records": 500,
      "errors": 2,
      "warnings": 1,
      "processing_time": 150.45
    },
    "productos.csv": {
      "records": 500,
      "errors": 3,
      "warnings": 1,
      "processing_time": 146.33
    }
  },
  "format_errors": [
    "clientes.csv: Número incorrecto de columnas. Esperadas: 10, Encontradas: 9"
  ],
  "missing_files": [],
  "skipped_rules": [],
  "logs": [
    {
      "timestamp": "2025-03-31T12:30:05.123",
      "level": "ERROR",
      "message": "Valor inválido",
      "details": "Columna 'precio' debe ser numérica",
      "file": "productos.csv",
      "line": 42,
      "rule": "validar_numerico",
      "value": "abc"
    }
  ]
}
```

Este formato es ideal para:
- Integración con dashboards y herramientas de análisis
- Procesamiento automatizado de errores
- Generación de reportes personalizados
- Seguimiento histórico de validaciones

## Ejemplos de Uso

### Ejemplo 1: Validación Básica

```bash
./validar_con_reporte.sh example.yaml datos.zip
```

### Ejemplo 2: Validación con Exportación JSON

Para validar y generar un archivo JSON detallado con todos los errores y mensajes:

```bash
./validar_con_json.sh example.yaml datos.zip
```

### Ejemplo 3: Validación de Archivos con BOM

Los archivos con BOM se procesan automáticamente sin necesidad de configuración adicional:

```bash
./validar_con_reporte.sh example.yaml datos_con_bom.zip
```

### Ejemplo 4: Validación de Archivo CSV Individual

También puedes validar un único archivo CSV:

```bash
./validar_con_reporte.sh example.yaml datos.csv
```

## Solución de Problemas

### Discrepancias de Columnas

Si el reporte muestra errores de "Número incorrecto de columnas", compara el número real de columnas en el archivo CSV con la definición en el YAML:

```
ERRORES DE FORMATO:
- clientes.csv: Número incorrecto de columnas. Esperadas: 10, Encontradas: 9
```

### Archivos Faltantes

Si el reporte muestra "Archivos faltantes", verifica que todos los archivos definidos en el YAML estén presentes en el ZIP:

```
ARCHIVOS FALTANTES:
- productos.csv
```

## Integración en Otros Scripts

### Integración Básica

Para integrar la validación con reporte en tus propios scripts, utiliza el siguiente código:

```python
from sage.models import SageConfig
from sage.file_processor import FileProcessor
from sage.logger import SageLogger

# Cargar configuración
config = SageConfig(yaml_data)

# Inicializar logger y processor
logger = SageLogger("ruta/a/logs")
processor = FileProcessor(config, logger)

# Procesar archivo
errors, warnings = processor.process_file("datos.zip", "nombre_paquete")

# Calcular total de registros procesados
total_records = sum(stats['records'] for stats in logger.file_stats.values())

# Generar resumen (genera automáticamente output.log, results.txt y details.json)
logger.summary(total_records, errors, warnings)
```

### Integración con Exportación JSON Manual

Si necesitas exportar el JSON en cualquier momento (sin ejecutar summary) o a una ubicación personalizada:

```python
# ... Código de configuración y procesamiento anterior ...

# Exportar JSON a una ubicación específica
json_path = "/ruta/personalizada/reporte.json"
logger.export_json(json_path)

# O simplemente exportar al directorio de logs por defecto
logger.export_json()
```

### Procesamiento de Resultados JSON

Puedes procesar el archivo JSON resultante para integrarlo con otras herramientas:

```python
import json

# Cargar el archivo JSON
with open("ruta/a/logs/details.json", "r") as f:
    data = json.load(f)

# Acceder a la información
tasa_exito = data["summary"]["success_rate"]
errores_por_archivo = {file: stats["errors"] for file, stats in data["file_stats"].items()}

# Procesar todos los errores
for log in data["logs"]:
    if log["level"] == "ERROR":
        print(f"Error en {log['file']}, línea {log.get('line', 'N/A')}: {log['message']}")
```

---

Para más información, consulta la documentación completa de SAGE.