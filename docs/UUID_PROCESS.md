# Proceso de Generación y Sincronización de UUIDs en SAGE

Este documento explica cómo se generan y sincronizan los UUIDs en el sistema SAGE para asegurar la consistencia entre los directorios de ejecución y los registros en la base de datos.

## Problema Identificado

Se detectó un problema crítico donde el UUID almacenado en la base de datos (tabla `ejecuciones_yaml`) no coincidía con el UUID usado para crear el directorio de ejecución. Esto resultaba en:

1. Incapacidad para localizar los archivos de ejecución correspondientes
2. Errores al intentar acceder a logs y resultados
3. Dificultad para rastrear y auditar ejecuciones

## Flujo del Proceso

1. **Generación de UUID**:
   - En `sage/utils.py`, la función `create_execution_directory()` genera un UUID único cuando main.py procesa un archivo
   - Este UUID se usa para crear un directorio bajo `executions/[UUID]`
   - El UUID generado se devuelve como parte del resultado del procesamiento

2. **Procesamiento del archivo**:
   - Cuando se ejecuta `process_files()` en `sage/main.py`, se genera un UUID para la ejecución
   - El procesador crea un directorio con este UUID y coloca todos los archivos de resultado allí
   - Al finalizar, se devuelve el UUID junto con los conteos de errores/advertencias

3. **Almacenamiento en BD**:
   - En `src/pages/api/casillas/[id]/datos-directos.ts`, se recibe el UUID del procesamiento
   - Este UUID se debe almacenar en la tabla `ejecuciones_yaml` tanto en el campo `uuid` como parte de `ruta_directorio`

## Corrección Implementada

Para asegurar la consistencia, se modificó el código para:

1. **Extraer el UUID correcto**:
   ```typescript
   // Extraer el UUID directamente de la ruta del directorio
   const dirPathParts = path.join('executions', processingResult.execution_uuid).split(path.sep);
   const directoryUuid = dirPathParts[dirPathParts.length - 1];
   ```

2. **Usar el mismo UUID en todos los lugares**:
   - Al actualizar la base de datos
   - En la respuesta JSON devuelta al cliente
   - En la URL del log
   - En el campo `ruta_directorio` de la tabla

3. **Sincronizar UUID en respuesta**:
   ```typescript
   return res.status(200).json({
     // ...
     execution_uuid: directoryUuid, // UUID consistente
     // ...
     log_url: `/api/executions/${directoryUuid}/log` // URL consistente
   });
   ```

## Beneficios de la Corrección

- **Integridad de datos**: Garantiza que el UUID en la base de datos siempre coincida con el directorio físico
- **Rastreabilidad**: Permite localizar y auditar fácilmente todos los archivos relacionados con una ejecución
- **Accesibilidad**: Asegura que las URLs para acceder a logs y archivos de resultados sean válidas
- **Consistencia**: Mantiene un único identificador a lo largo de todo el proceso, desde la creación hasta la visualización

## Recomendaciones para Mantenimiento

1. Nunca generar UUIDs duplicados para la misma ejecución
2. Siempre extraer el UUID del nombre del directorio para asegurar consistencia
3. Usar el mismo UUID en todos los lugares que hagan referencia a la ejecución
4. Documentar claramente el proceso de generación y uso de UUIDs en módulos nuevos