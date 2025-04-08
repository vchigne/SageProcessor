# Reportes Detallados JSON en SAGE Daemon

Este documento describe la implementación y funcionamiento de los reportes detallados en formato JSON generados por el sistema SAGE durante el procesamiento de archivos.

## Descripción General

Los reportes JSON proporcionan una estructura de datos detallada y estandarizada que permite:

1. Acceso programático a los resultados de procesamiento
2. Integración sencilla con otros sistemas
3. Análisis automatizado de errores y estadísticas
4. Almacenamiento eficiente en bases de datos
5. Visualización en dashboards y herramientas de análisis

## Estructura del Reporte JSON

El reporte se genera en `report.json` y contiene la siguiente estructura:

```json
{
  "execution_info": {
    "start_time": "2025-04-01T12:00:00",
    "end_time": "2025-04-01T12:01:30",
    "duration": "00:01:30",
    "log_directory": "/ruta/al/directorio/de/logs",
    "casilla_id": 45,
    "emisor_id": 12,
    "metodo_envio": "email"
  },
  "summary": {
    "total_records": 1500,
    "errors": 15,
    "warnings": 25,
    "success_rate": 99.0,
    "status": "Parcial"
  },
  "files": {
    "statistics": {
      "archivo1.csv": {
        "records": 1000,
        "errors": 10,
        "warnings": 15
      },
      "archivo2.csv": {
        "records": 500,
        "errors": 5,
        "warnings": 10
      }
    },
    "missing_files": [
      {
        "filename": "opcional.csv",
        "package": "paquete_principal"
      }
    ],
    "format_errors": [
      {
        "message": "El formato del archivo no coincide con lo esperado",
        "file": "archivo3.csv",
        "expected": "10 columnas",
        "found": "9 columnas"
      }
    ]
  },
  "validation": {
    "failures": [
      {
        "timestamp": "2025-04-01T12:00:15",
        "severity": "error",
        "message": "El valor no cumple con el formato requerido",
        "type": "validation_error",
        "file": "archivo1.csv",
        "line": 25,
        "column": "CODIGO",
        "value": "ABC",
        "rule": "debe contener solo dígitos"
      }
    ],
    "skipped_rules": {
      "field_rules": {
        "CODIGO": {
          "regex_validation": 5
        }
      },
      "row_rules": {},
      "catalog_rules": {}
    }
  },
  "events": [
    {
      "timestamp": "2025-04-01T12:00:10",
      "severity": "message",
      "message": "Iniciando procesamiento de archivo",
      "details": {
        "file": "archivo1.csv"
      }
    },
    {
      "timestamp": "2025-04-01T12:00:15",
      "severity": "error",
      "message": "Error en validación de campo",
      "details": {
        "file": "archivo1.csv",
        "line": 25,
        "field": "CODIGO",
        "value": "ABC",
        "rule": "debe contener solo dígitos"
      }
    }
  ]
}
```

## Secciones Principales

### 1. Información de Ejecución (`execution_info`)

Contiene metadatos sobre la ejecución, incluyendo:
- Fechas y horas de inicio y fin
- Duración del procesamiento
- Directorio de logs
- IDs de casilla y emisor (cuando están disponibles)
- Método de envío

### 2. Resumen (`summary`)

Proporciona estadísticas agregadas del procesamiento:
- Total de registros procesados
- Número de errores detectados
- Número de advertencias
- Tasa de éxito (porcentaje)
- Estado general de la ejecución (Éxito, Parcial, Fallido)

### 3. Archivos (`files`)

Contiene información detallada sobre los archivos procesados:
- Estadísticas por archivo (registros, errores, advertencias)
- Archivos faltantes (requeridos pero no encontrados)
- Errores de formato (discrepancias en estructura)

### 4. Validación (`validation`)

Detalles específicos sobre las validaciones realizadas:
- Lista de errores de validación
- Reglas omitidas para optimización
- Información sobre campos, filas o catálogos con problemas

### 5. Eventos (`events`)

Registro cronológico completo de todos los eventos durante el procesamiento:
- Mensajes informativos
- Advertencias
- Errores
- Detalles específicos de cada evento

## Integración con SAGE Daemon

El reporte JSON se genera automáticamente durante el procesamiento de archivos:

1. El método `summary()` en la clase `SageLogger` invoca a `generate_report_json()`
2. El archivo `report.json` se guarda en el directorio de logs
3. Se adjunta al correo de respuesta como "reporte_detallado.json"
4. El mismo directorio contiene también el reporte HTML compatible con correo electrónico

## Formato Email-Friendly HTML

Junto con el reporte JSON, ahora también se genera un archivo HTML especialmente diseñado para ser incluido en correos electrónicos (`email_report.html`). Este archivo usa estilos en línea y una estructura simplificada para máxima compatibilidad con clientes de correo.

## Beneficios

1. **Programabilidad**: Facilita la integración con APIs y sistemas externos
2. **Estructura Estandarizada**: Formato consistente para todos los procesamientos
3. **Detalle Completo**: Contiene información exhaustiva para diagnóstico
4. **Eficiencia**: Optimizado para procesamiento automático
5. **Compatibilidad**: Complementa los formatos existentes (TXT, HTML)

## Uso Recomendado

Se recomienda usar el reporte JSON para:
- Integraciones con sistemas de monitoreo
- Almacenamiento estructurado en bases de datos
- Análisis automatizados de errores
- Generación de dashboards y reportes personalizados

La estructura está diseñada para ser versátil y expandible, permitiendo añadir nuevos elementos en el futuro sin comprometer la compatibilidad con implementaciones existentes.