# Mejora en Procesamiento de Logs en SAGE Daemon 2

## Contexto

SAGE Daemon 2 es un componente del sistema que monitorea casillas de correo configuradas en la base de datos, procesa los correos entrantes con sus archivos adjuntos utilizando los validadores del sistema SAGE, y envía respuestas automáticas a los remitentes con los resultados del procesamiento.

## Mejora Implementada

En esta actualización, se han mejorado las respuestas automáticas que envía el sistema a los remitentes cuando procesan archivos, identificando correctamente y adjuntando automáticamente los archivos de log generados por el procesamiento SAGE.

### Cambios Específicos:

1. **Identificación Correcta de Logs**: Ahora el sistema identifica correctamente los tres archivos generados por el logger de SAGE:
   - `output.log` - Log completo de todas las operaciones
   - `error.log` - Log específico de errores
   - `results.txt` - Resumen de resultados

2. **Adjunto de Log Completo**: Cada correo de respuesta incluye un archivo adjunto `resultados_procesamiento.log` que contiene el log detallado generado por el procesador SAGE.

3. **HTML Enriquecido**: Se ha mejorado la presentación HTML del correo para incluir:
   - Información resumida de resultados del procesamiento
   - Contenido del archivo de resultados en formato pre-formateado
   - Log completo para diagnóstico detallado (cuando está disponible)
   - Todo con estilos que facilitan la lectura (fondo gris, fuente monoespaciada, etc.)

4. **Estructura del HTML Mejorada**: El correo ahora incluye:
   - Encabezado con información del procesamiento
   - Sección de resultados generales
   - Detalles del procesamiento por archivo con estados coloreados
   - Secciones específicas para resultados y logs
   - Pie con información de contacto

## Beneficios

- **Mayor Transparencia**: Los usuarios reciben información completa sobre cómo se procesaron sus archivos.
- **Diagnóstico Facilitado**: Al tener el log completo, es más fácil identificar problemas en los archivos enviados.
- **Experiencia Mejorada**: La respuesta es más profesional, con código de colores que indican claramente éxitos y errores.
- **Compatibilidad**: La estructura dual (HTML/texto plano) garantiza que la información sea accesible en cualquier cliente de correo.

## Funcionamiento Técnico

1. El procesador SAGE genera tres archivos durante el procesamiento:
   - `output.log`: Contiene el registro completo de todas las operaciones
   - `error.log`: Registra específicamente los errores encontrados
   - `results.txt`: Resumen textual de los resultados

2. SAGE Daemon 2 identifica estos archivos a través de las rutas proporcionadas en el objeto de resultado:
   ```json
   {
     "details": {
       "output_log_path": "/path/to/output.log",
       "error_log_path": "/path/to/error.log", 
       "results_file_path": "/path/to/results.txt"
     }
   }
   ```

3. El sistema crea un HTML formateado con secciones para:
   - Resultados generales (estado, errores, advertencias)
   - Contenido del archivo results.txt (si está disponible)
   - Contenido del archivo output.log (si está disponible)

4. El archivo principal de log se adjunta al correo con el nombre `resultados_procesamiento.log` para referencia detallada.

## Ejemplos de Uso

1. Un usuario envía un archivo CSV a casilla45@sage.vidahub.ai
2. SAGE Daemon 2 procesa el archivo usando el procesador SAGE, que genera logs
3. El sistema localiza los archivos generados y crea una respuesta de correo que incluye:
   - Resumen visual de procesamiento en el cuerpo HTML del mensaje
   - Contenido del archivo de resultados formateado en el cuerpo del mensaje
   - El log completo como archivo adjunto
   - Estadísticas del procesamiento (filas procesadas, errores, advertencias)
