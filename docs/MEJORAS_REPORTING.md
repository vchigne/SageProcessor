# Mejoras en el Sistema de Reportes de SAGE

## Introducción

Este documento describe las mejoras implementadas en el sistema de reportes de SAGE para facilitar la visualización y descarga de reportes en diferentes formatos según el canal de procesamiento.

## Diferencias entre tipos de reportes

SAGE genera varios tipos de reportes durante el procesamiento de archivos:

1. **Log de procesamiento (output.log)**
   - Formato: HTML
   - Descripción: Muestra el detalle paso a paso del procesamiento, incluyendo mensajes de éxito, error y advertencia.
   - Uso: Principalmente para diagnóstico y verificación del proceso.

2. **Reporte HTML detallado (report.html)**
   - Formato: HTML
   - Descripción: Reporte completo y enriquecido con estilos avanzados, tablas formateadas y visualizaciones.
   - Uso: Para visualización en navegador, con completo detalle y elementos interactivos.

3. **Reporte HTML para email (email_report.html)**
   - Formato: HTML con estilos en línea
   - Descripción: Versión simplificada del reporte HTML optimizada para clientes de correo electrónico.
   - Uso: Para envío como parte del cuerpo del correo electrónico de notificación.

4. **Reporte JSON (report.json)**
   - Formato: JSON
   - Descripción: Versión estructurada y parseable de los resultados del procesamiento.
   - Uso: Para integración con otros sistemas o para análisis programático.

## Mejoras Implementadas

### 1. Acceso directo a reportes desde la interfaz web

Se han añadido botones y enlaces para acceder directamente a los distintos formatos de reporte:

- **Portal Externo (Datos Directos)**
  - Se agregaron enlaces para ver el reporte HTML detallado y descargar el JSON
  - Se mantiene el iframe para el log de procesamiento

### 2. Nuevos endpoints para servir reportes

Se crearon nuevos endpoints en la API para servir los diferentes formatos de reporte:

- **/api/executions/[uuid]/report-html**: Sirve el reporte HTML detallado
- **/api/executions/[uuid]/report-json**: Sirve el reporte JSON para descarga

### 3. Enriquecimiento de la respuesta API

La respuesta de la API ahora incluye URLs para todos los formatos de reporte:

```json
{
  "success": true,
  "message": "Datos procesados correctamente",
  "execution_uuid": "uuid",
  "log_url": "/api/executions/uuid/log",
  "report_html_url": "/api/executions/uuid/report-html",
  "report_json_url": "/api/executions/uuid/report-json"
}
```

## Plan de Implementación para futuras mejoras

### Fase 1: Ampliación a otros canales (Completado parcialmente)

- ✅ Portal Externo - Datos Directos
- ⬜ Portal Externo - Subir Archivo
- ⬜ Sistema de Casillas - Opción "Subir archivo"

### Fase 2: Funcionalidades adicionales

- ⬜ Configuración de preferencias de formato de reporte por usuario
- ⬜ Envío automático de reportes por email con formato configurable
- ⬜ Histórico de reportes accesible desde el panel de administración

### Fase 3: Mejoras en visualización y experiencia

- ⬜ Vista previa en miniatura de reportes
- ⬜ Filtrado y búsqueda dentro de reportes
- ⬜ Capacidad de exportar reportes en formatos adicionales (PDF, Excel)

## Beneficios esperados

1. **Mayor accesibilidad**: Los usuarios pueden acceder fácilmente a los reportes en el formato que prefieran.
2. **Mejor integración**: El formato JSON facilita la integración con otros sistemas.
3. **Flexibilidad**: Diferentes canales de procesamiento pueden utilizar diferentes formatos de reporte.
4. **Diagnóstico mejorado**: Acceso más rápido a información detallada para solución de problemas.

## Conclusión

Estas mejoras en el sistema de reportes de SAGE proporcionan una experiencia más completa y flexible para los usuarios, facilitando el acceso a la información procesada en diferentes formatos y contextos.