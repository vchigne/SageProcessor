# Mejoras en YAML Studio con Soporte para BOM

## Descripción

Este documento describe las mejoras implementadas en YAML Studio para el correcto procesamiento de archivos CSV con BOM (Byte Order Mark) UTF-8 y la generación optimizada de archivos YAML.

## Cambios principales

### 1. Soporte para BOM en archivos CSV

- Se ha implementado la detección automática de BOM UTF-8 en archivos CSV
- Se utiliza la codificación `utf-8-sig` para procesar correctamente archivos con BOM
- Se mantiene la compatibilidad con archivos sin BOM

### 2. Mejoras en el generador YAML

- Se ha optimizado el proceso de extracción de ejemplos desde los archivos CSV
- Se muestra el texto exacto de las líneas en el archivo, preservando el formato original
- Se ha eliminado la prefijación arbitraria "Campo COLUMNA_X" en las sugerencias de validación

### 3. Integración con OpenRouter

- Se ha implementado el soporte para conectar con el modelo o3-mini a través de OpenRouter
- Se añadió configuración automática basada en la variable de entorno `OPENROUTER_API_KEY`
- Se ha reducido el tiempo de espera en las llamadas a la API de 300s a 30s para mejor experiencia

### 4. Mejoras en el procesamiento de instrucciones

- Las instrucciones del usuario ahora se insertan literalmente en el prompt sin procesamiento
- Se respeta el formato exacto del archivo de instrucciones
- Se ha eliminado la adición de líneas en blanco extra al principio de las instrucciones

### 5. Extracción inteligente de YAML

- Se ha mejorado el proceso de extracción de contenido YAML de las respuestas del modelo
- Se reconocen múltiples formatos de delimitación (backticks, líneas de guiones, etc.)
- Se eliminan automáticamente frases introductorias comunes

## Archivos modificados

- `sage/yaml_generator.py`: Implementación principal del generador YAML con soporte para BOM
- `sage/file_processor.py`: Mejoras en el procesamiento de archivos CSV con BOM
- `sage/yaml_studio_cli.py`: Integración de las mejoras en la interfaz de línea de comandos
- `sage/ai_prompt_yaml_studio.frm`: Actualización de la plantilla de prompt para mejor calidad

## Ejemplos de uso

### Procesar un archivo con BOM

```bash
python -m sage.yaml_studio_cli proceso.yaml datos.csv
```

### Generar YAML para un archivo ZIP con múltiples CSV

```bash
python -m sage.yaml_studio_cli --generate output.yaml input.zip
```

### Usar OpenRouter para la generación YAML

```bash
export OPENROUTER_API_KEY=tu_clave_api
python -m sage.yaml_studio_cli --generate output.yaml input.csv
```

## Documentación adicional

- [Uso de OpenRouter con SAGE](docs/usar_openrouter.md)
- [Especificación de formato YAML](docs/YAML_SPEC.md)

## Problemas conocidos

- Los tiempos de respuesta pueden variar dependiendo de la carga del servidor de API
- Algunos formatos CSV altamente irregulares pueden requerir ajustes manuales
- La detección de cabeceras puede fallar en casos muy específicos con formatos no estándar