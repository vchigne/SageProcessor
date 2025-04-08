# Soporte para BOM en YAML Studio 

## Descripción

Este documento describe las mejoras implementadas para el manejo de archivos CSV con BOM (Byte Order Mark) en YAML Studio. El BOM es un marcador invisible al inicio de algunos archivos de texto que indica la codificación Unicode utilizada (UTF-8, UTF-16, etc.).

## Problemas Resueltos

1. **Detección errónea de columnas**: Anteriormente, los archivos CSV con BOM eran interpretados incorrectamente, detectando solo una columna o generando nombres de columnas erróneos.

2. **Delimitadores no reconocidos**: El BOM interfería con la detección correcta de delimitadores en archivos CSV, causando que la estructura de datos se interpretara incorrectamente.

3. **Errores en la generación de YAML**: Las configuraciones generadas para archivos con BOM no reflejaban correctamente la estructura de los datos.

## Mejoras Implementadas

### Frontend (API de Previsualización)

El endpoint `/api/preview-file` ahora:

1. **Detecta automáticamente** la presencia de BOM en archivos CSV.
2. **Identifica inteligentemente** el delimitador utilizado (|, ,, ;, \t).
3. **Maneja adecuadamente** el contenido del archivo removiendo el BOM cuando es necesario.
4. **Implementa un sistema de respaldo** para cuando la detección automática falla.
5. **Incluye información sobre BOM** en la respuesta (`has_bom: true/false`).

### Backend (Generador de YAML)

El componente `YAMLGenerator` ahora:

1. **Detecta y maneja BOM** en archivos CSV antes de procesarlos.
2. **Identifica correctamente** los delimitadores incluso en presencia de BOM.
3. **Mejoró la detección de columnas** para archivos con codificaciones especiales.
4. **Implementa métodos alternativos** de parseo cuando los métodos estándar fallan.
5. **Incluye información sobre BOM** en la generación de YAML.

## Ejemplos de Uso

### Previsualización de Archivos con BOM

```javascript
// Ejemplo de respuesta para un archivo CSV con BOM
{
  "total_records": 100,
  "preview_records": [ ... ],
  "columns": ["id", "nombre", "valor"],
  "has_bom": true,
  "type": "csv"
}
```

### Generación de YAML para Archivos con BOM

```yaml
# Configuración generada para un archivo con BOM
name: "MiConfiguracion"
version: "1.0.0"
author: "SAGE"
description: "Configuración generada automáticamente"
catalogs:
  clientes:
    file_format:
      type: "csv"
      delimiter: "|"
      encoding: "utf-8-sig"  # Codificación que maneja BOM correctamente
      header: true
    fields:
      # Campos correctamente detectados a pesar del BOM
```

## Buenas Prácticas

1. **Preferir UTF-8 sin BOM**: Aunque el sistema ahora maneja correctamente archivos con BOM, se recomienda usar UTF-8 sin BOM cuando sea posible.

2. **Validar la Estructura**: Siempre validar que la estructura detectada sea correcta antes de generar el YAML final.

3. **Revisar los Delimitadores**: En algunos casos puede ser necesario ajustar manualmente el delimitador en el YAML generado.

## Notas Técnicas

- El BOM para UTF-8 consta de 3 bytes: `EF BB BF` en hexadecimal.
- La codificación `utf-8-sig` en Python maneja automáticamente los archivos con BOM.
- La librería `csv-parse` en JavaScript requiere manejo especial para archivos con BOM.